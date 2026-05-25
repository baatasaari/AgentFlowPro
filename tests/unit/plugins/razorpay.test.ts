import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  createPaymentLink,
  verifyRazorpayWebhook,
  parseRazorpayWebhook,
  generateUpiPaymentLink,
} from "../../../server/plugins/razorpay.js";

const MOCK_CONFIG = {
  keyId: "rzp_test_abc123",
  keySecret: "test_secret_key",
  webhookSecret: "webhook_secret_key",
};

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      id: "plink_abc123",
      short_url: "https://rzp.io/l/abc123",
      status: "created",
      amount: 50000, // paise
      currency: "INR",
      expire_by: Math.floor(Date.now() / 1000) + 86400,
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPaymentLink", () => {
  it("converts INR to paise (×100) for Razorpay", async () => {
    await createPaymentLink(MOCK_CONFIG, {
      amount: 500,  // ₹500
      description: "Appointment payment",
      customerName: "Rahul Sharma",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.amount).toBe(50000); // 500 × 100 paise
  });

  it("sets Basic auth header", async () => {
    await createPaymentLink(MOCK_CONFIG, {
      amount: 100,
      description: "Test",
      customerName: "Test User",
    });

    const expectedAuth = "Basic " + Buffer.from("rzp_test_abc123:test_secret_key").toString("base64");
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(expectedAuth);
  });

  it("includes customer details", async () => {
    await createPaymentLink(MOCK_CONFIG, {
      amount: 1000,
      description: "Test payment",
      customerName: "Priya Patel",
      customerEmail: "priya@example.com",
      customerPhone: "+919876543210",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.customer.name).toBe("Priya Patel");
    expect(body.customer.email).toBe("priya@example.com");
  });

  it("returns PaymentLinkResult with shortUrl", async () => {
    const result = await createPaymentLink(MOCK_CONFIG, {
      amount: 500,
      description: "Test",
      customerName: "Test",
    });

    expect(result.id).toBe("plink_abc123");
    expect(result.shortUrl).toBe("https://rzp.io/l/abc123");
    expect(result.amount).toBe(500); // converted back to INR
    expect(result.currency).toBe("INR");
  });

  it("sets expiry to 24h by default", async () => {
    const before = Math.floor(Date.now() / 1000) + 86400 - 5;
    await createPaymentLink(MOCK_CONFIG, { amount: 100, description: "T", customerName: "T" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.expire_by).toBeGreaterThan(before);
  });

  it("respects custom expiry hours", async () => {
    await createPaymentLink(MOCK_CONFIG, {
      amount: 100,
      description: "T",
      customerName: "T",
      expiryHours: 48,
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const expectedExpiry = Math.floor(Date.now() / 1000) + 48 * 3600;
    expect(body.expire_by).toBeGreaterThan(expectedExpiry - 5);
  });

  it("includes referenceId when provided", async () => {
    await createPaymentLink(MOCK_CONFIG, {
      amount: 100,
      description: "T",
      customerName: "T",
      referenceId: "APPT-123",
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reference_id).toBe("APPT-123");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: "Invalid amount" } }),
    });

    await expect(
      createPaymentLink(MOCK_CONFIG, { amount: -1, description: "T", customerName: "T" })
    ).rejects.toThrow("Invalid amount");
  });

  it("normalizes Indian phone numbers to +91XXXXXXXXXX", async () => {
    await createPaymentLink(MOCK_CONFIG, {
      amount: 100,
      description: "T",
      customerName: "T",
      customerPhone: "9876543210",
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.customer.contact).toBe("+919876543210");
  });
});

describe("verifyRazorpayWebhook", () => {
  it("returns true for valid signature", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const signature = crypto.createHmac("sha256", "webhook_secret_key").update(body).digest("hex");

    expect(verifyRazorpayWebhook(body, signature, "webhook_secret_key")).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyRazorpayWebhook(body, "fake_signature", "webhook_secret_key")).toBe(false);
  });

  it("returns false for tampered body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = crypto.createHmac("sha256", "webhook_secret_key").update(body).digest("hex");
    const tamperedBody = JSON.stringify({ event: "payment.refunded" }); // tampered!
    expect(verifyRazorpayWebhook(tamperedBody, signature, "webhook_secret_key")).toBe(false);
  });

  it("handles Buffer input for rawBody", () => {
    const body = '{"event":"test"}';
    const sig = crypto.createHmac("sha256", "webhook_secret_key").update(body).digest("hex");
    expect(verifyRazorpayWebhook(Buffer.from(body), sig, "webhook_secret_key")).toBe(true);
  });
});

describe("parseRazorpayWebhook", () => {
  it("parses payment_link.paid event", () => {
    const body = {
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: "plink_123", amount: 50000 } },
        payment: { entity: { id: "pay_abc", status: "captured" } },
      },
      created_at: 1716614400,
    };

    const event = parseRazorpayWebhook(body);
    expect(event.event).toBe("payment_link.paid");
    expect(event.payload.payment_link?.entity.id).toBe("plink_123");
  });
});

describe("generateUpiPaymentLink", () => {
  it("generates valid UPI deep link", () => {
    const link = generateUpiPaymentLink({
      upiId: "clinic@paytm",
      payeeName: "Dr Sharma Clinic",
      amount: 500,
      transactionRef: "APPT-001",
      note: "General Consultation",
    });

    expect(link).toMatch(/^upi:\/\/pay\?/);
    expect(link).toContain("pa=clinic%40paytm");
    expect(link).toContain("am=500.00");
    expect(link).toContain("cu=INR");
    expect(link).toContain("tr=APPT-001");
  });

  it("includes transaction note when provided", () => {
    const link = generateUpiPaymentLink({
      upiId: "test@upi",
      payeeName: "Test",
      amount: 100,
      transactionRef: "REF-1",
      note: "Test Payment",
    });

    expect(link).toContain("tn=Test+Payment");
  });

  it("formats amount to 2 decimal places", () => {
    const link = generateUpiPaymentLink({
      upiId: "test@upi",
      payeeName: "Test",
      amount: 1000,
      transactionRef: "REF-1",
    });

    expect(link).toContain("am=1000.00");
  });
});
