/**
 * Integration tests — full HTTP API layer using supertest.
 * Requires a running PostgreSQL test database.
 * Set TEST_DATABASE_URL env var or defaults to agentflowpro_test.
 * Skipped automatically when no database is reachable.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Integration tests require a live PostgreSQL database.
// Set TEST_DATABASE_URL env var to enable them. Without it they are skipped.
const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL;
const describeWithDB = DB_AVAILABLE ? describe : describe.skip;

// Mock Anthropic to avoid real API calls
import { vi } from "vitest";
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "This is a test AI response" }],
        stop_reason: "end_turn",
      }),
    };
  },
}));

let app: express.Express;
let authToken: string;
let widgetToken: string;
let orgId: number;
let agentId: number;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function register(overrides = {}) {
  const ts = Date.now();
  return request(app)
    .post("/api/auth/register")
    .send({
      email: `test-${ts}@example.com`,
      username: `testuser${ts}`,
      password: "TestPass123!",
      firstName: "Test",
      lastName: "User",
      organizationName: "Test Business",
      ...overrides,
    });
}

async function login(email: string, password = "TestPass123!") {
  return request(app)
    .post("/api/auth/login")
    .send({ email, password });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!DB_AVAILABLE) return; // Skip setup when TEST_DATABASE_URL not set

  const { registerRoutes } = await import("../../server/routes.js");

  app = express();
  app.use(express.json());

  await registerRoutes(app as any);

  // Register then login to get token
  const ts = Date.now();
  const email = `integration-${ts}@test.com`;

  const regRes = await request(app)
    .post("/api/auth/register")
    .send({
      email,
      username: `intuser${ts}`,
      password: "TestPass123!",
      firstName: "Integration",
      lastName: "Test",
      organizationName: "Integration Test Org",
    });

  authToken = regRes.body.token;
  orgId = regRes.body.organization?.id;
}, 30000);

// ─── Auth tests ────────────────────────────────────────────────────────────────

describeWithDB("POST /api/auth/register", () => {
  it("creates user + org and returns JWT", async () => {
    const ts = Date.now();
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `new-${ts}@test.com`,
        username: `newuser${ts}`,
        password: "SecurePass1!",
        firstName: "New",
        lastName: "User",
        organizationName: "New Org",
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toContain("@test.com");
    expect(res.body.organization.name).toBe("New Org");
    expect(res.body.organization.plan).toBe("free");
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ password: "Test123!", username: "u1", organizationName: "Org" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for duplicate email", async () => {
    const ts = Date.now();
    const email = `dup-${ts}@test.com`;

    await request(app).post("/api/auth/register").send({
      email, username: `dup${ts}`, password: "Test123!", firstName: "A", lastName: "B", organizationName: "X",
    });

    const res = await request(app).post("/api/auth/register").send({
      email, username: `dup2${ts}`, password: "Test123!", firstName: "C", lastName: "D", organizationName: "Y",
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describeWithDB("POST /api/auth/login", () => {
  it("returns JWT for valid credentials", async () => {
    const ts = Date.now();
    const email = `login-${ts}@test.com`;
    await request(app).post("/api/auth/register").send({
      email, username: `loginuser${ts}`, password: "TestPass1!", firstName: "L", lastName: "U", organizationName: "L Org",
    });

    const res = await request(app).post("/api/auth/login").send({ email, password: "TestPass1!" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nonexistent@test.com",
      password: "WrongPass123!",
    });
    expect(res.status).toBe(401);
  });
});

describeWithDB("GET /api/auth/me", () => {
  it("returns user + org for valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.organization).toBeDefined();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with malformed token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer definitely.not.valid");
    expect(res.status).toBe(401);
  });
});

// ─── Business settings ─────────────────────────────────────────────────────────

describeWithDB("PUT /api/business-settings", () => {
  it("saves business settings", async () => {
    const res = await request(app)
      .put("/api/business-settings")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        businessName: "Test Medical Centre",
        phone: "+91 98765 43210",
        timezone: "Asia/Kolkata",
        city: "Mumbai",
        country: "India",
      });

    expect(res.status).toBe(200);
    expect(res.body.businessName).toBe("Test Medical Centre");
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).put("/api/business-settings").send({ businessName: "Test" });
    expect(res.status).toBe(401);
  });
});

// ─── Services ────────────────────────────────────────────────────────────────

describeWithDB("Services CRUD", () => {
  let serviceId: number;

  it("POST /api/services creates a service", async () => {
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "General Consultation",
        description: "Basic health check",
        price: "500",
        currency: "INR",
        durationMinutes: 30,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("General Consultation");
    serviceId = res.body.id;
  });

  it("GET /api/services returns list", async () => {
    const res = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT /api/services/:id updates service", async () => {
    const res = await request(app)
      .put(`/api/services/${serviceId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ price: "750" });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe("750.00");
  });

  it("cannot access another org's service", async () => {
    const res = await request(app)
      .put("/api/services/999999")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ price: "100" });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── Staff ───────────────────────────────────────────────────────────────────

describeWithDB("Staff CRUD", () => {
  let staffId: number;

  it("creates staff member", async () => {
    const res = await request(app)
      .post("/api/staff")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Dr Rahul Gupta",
        role: "Doctor",
        speciality: "General Medicine",
        email: "dr.rahul@test.com",
        phone: "+919876543210",
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Dr Rahul Gupta");
    staffId = res.body.id;
  });

  it("sets availability for staff", async () => {
    const res = await request(app)
      .put(`/api/staff/${staffId}/availability`)
      .set("Authorization", `Bearer ${authToken}`)
      .send([
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true },
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isActive: true },
      ]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/staff/${staffId}/availability`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(getRes.body).toHaveLength(3);
  });
});

// ─── Agents ──────────────────────────────────────────────────────────────────

describeWithDB("Agents CRUD + booking flow", () => {
  it("creates an agent with booking enabled", async () => {
    const res = await request(app)
      .post("/api/agents")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Integration Test Agent",
        businessType: "healthcare",
        systemPrompt: "You are a helpful healthcare assistant.",
        enableBooking: true,
        greeting: "Hello! How can I help?",
      });

    expect(res.status).toBe(201);
    expect(res.body.widgetToken).toBeDefined();
    expect(res.body.enableBooking).toBe(true);

    agentId = res.body.id;
    widgetToken = res.body.widgetToken;
  });

  it("activates the agent", async () => {
    const res = await request(app)
      .put(`/api/agents/${agentId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active");
  });

  it("GET /api/agents/:id/embed returns embed code", async () => {
    const res = await request(app)
      .get(`/api/agents/${agentId}/embed`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.embedCode).toContain("widget.js");
    expect(res.body.embedCode).toContain(widgetToken);
  });
});

// ─── Public booking API ───────────────────────────────────────────────────────

describeWithDB("Public booking API (/api/booking/*)", () => {
  it("GET /api/booking/info/:token returns business info", async () => {
    const res = await request(app).get(`/api/booking/info/${widgetToken}`);

    expect(res.status).toBe(200);
    expect(res.body.businessName).toBeDefined();
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(Array.isArray(res.body.staff)).toBe(true);
  });

  it("GET /api/booking/slots/:token returns available slots for a business day", async () => {
    // 2026-06-01 is a Monday
    const res = await request(app)
      .get(`/api/booking/slots/${widgetToken}?date=2026-06-01`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 404 for invalid widget token", async () => {
    const res = await request(app).get("/api/booking/info/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("POST /api/booking/create creates appointment", async () => {
    const res = await request(app)
      .post(`/api/booking/create/${widgetToken}`)
      .send({
        customerName: "Amit Kumar",
        customerEmail: "amit@example.com",
        customerPhone: "+919876543210",
        startsAt: "2026-07-15T10:00:00.000Z",
        notes: "First visit",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.appointmentId).toBeDefined();
  });
});

// ─── Knowledge base ───────────────────────────────────────────────────────────

describeWithDB("Knowledge base", () => {
  let kbId: number;

  it("creates a FAQ entry", async () => {
    const res = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "faq",
        question: "What are your timings?",
        answer: "Mon-Sat 9AM to 6PM",
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.question).toBe("What are your timings?");
    kbId = res.body.id;
  });

  it("creates a policy entry", async () => {
    const res = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "policy",
        title: "Cancellation Policy",
        answer: "Please cancel 24 hours in advance. Late cancellations incur 50% charge.",
        isActive: true,
      });

    expect(res.status).toBe(201);
  });

  it("lists all knowledge entries", async () => {
    const res = await request(app)
      .get("/api/knowledge")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("updates an entry", async () => {
    const res = await request(app)
      .put(`/api/knowledge/${kbId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ answer: "Mon-Sat 9AM to 8PM (updated)" });

    expect(res.status).toBe(200);
    expect(res.body.answer).toContain("8PM");
  });

  it("deletes an entry", async () => {
    const res = await request(app)
      .delete(`/api/knowledge/${kbId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

describeWithDB("GET /api/analytics", () => {
  it("returns analytics overview", async () => {
    const res = await request(app)
      .get("/api/analytics")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overview).toBeDefined();
    expect(res.body.overview.totalAppointments).toBeDefined();
    expect(res.body.overview.totalConversations).toBeDefined();
    expect(res.body.charts).toBeDefined();
  });
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

describeWithDB("API Keys management", () => {
  let keyId: number;

  it("creates an API key", async () => {
    const res = await request(app)
      .post("/api/keys")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Integration Test Key" });

    expect(res.status).toBe(201);
    expect(res.body.rawKey).toMatch(/^afp_/);
    expect(res.body.name).toBe("Integration Test Key");
    keyId = res.body.id;
  });

  it("lists API keys (without revealing rawKey)", async () => {
    const res = await request(app)
      .get("/api/keys")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // rawKey should not be returned on list
    for (const key of res.body) {
      expect(key.rawKey).toBeUndefined();
    }
  });

  it("revokes an API key", async () => {
    const res = await request(app)
      .delete(`/api/keys/${keyId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Plans ────────────────────────────────────────────────────────────────────

describeWithDB("GET /api/plans", () => {
  it("returns all plan details", async () => {
    const res = await request(app).get("/api/plans");

    expect(res.status).toBe(200);
    expect(res.body.free).toBeDefined();
    expect(res.body.starter).toBeDefined();
    expect(res.body.professional).toBeDefined();
    expect(res.body.enterprise).toBeDefined();
    expect(res.body.starter.price).toBe(49);
  });
});

// ─── Widget serving ───────────────────────────────────────────────────────────

describeWithDB("GET /widget.js", () => {
  it("serves widget.js with correct content-type", async () => {
    const res = await request(app).get("/widget.js");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("javascript");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});

// ─── Chat config endpoint ──────────────────────────────────────────────────────

describeWithDB("GET /api/chat/config/:token", () => {
  it("returns chat config for valid token", async () => {
    const res = await request(app).get(`/api/chat/config/${widgetToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
    expect(res.body.greetingMessage).toBeDefined();
    expect(res.body.enableBooking).toBe(true);
  });

  it("returns 404 for invalid token", async () => {
    const res = await request(app).get("/api/chat/config/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

// ─── CORS headers ─────────────────────────────────────────────────────────────

describeWithDB("CORS", () => {
  it("includes CORS headers on chat endpoints", async () => {
    const res = await request(app)
      .options("/api/chat/message")
      .set("Origin", "https://random-customer-website.com");

    // Should have CORS headers or at least return a valid status
    const corsHeader = res.headers["access-control-allow-origin"];
    expect(corsHeader).toBe("*");
  });
});
