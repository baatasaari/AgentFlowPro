import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireSuperAdmin, registerUser, comparePassword, generateToken, findOrCreateGoogleUser, type AuthRequest } from "./auth";
import {
  insertLeadSchema, insertNewsletterSubscriberSchema, insertContactSubmissionSchema,
  insertAgentSchema, updateAgentSchema, insertApiKeySchema, loginSchema, insertUserSchema,
  insertServiceSchema, insertStaffSchema, insertKnowledgeSchema, insertAppointmentSchema,
  businessSettingsSchema, PLANS, BUSINESS_TEMPLATES,
} from "@shared/schema";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { sendAppointmentConfirmation, sendCancellationEmail } from "./email";
import { listPlugins, getPlugin } from "./plugins/registry.js";
import { scrapeWebsite } from "./plugins/website-scraper.js";
import { validateGSTIN } from "./india/gst.js";
import { validateIndianPhone, generateUpiLink } from "./india/phone.js";
import { isIndianHoliday, getUpcomingHolidays } from "./india/holidays.js";
import { dispatch, WORKFLOW_TEMPLATES } from "./workflows/engine.js";

const WIDGET_BASE_URL = process.env.WIDGET_BASE_URL || "https://agentflowpro.com";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

let anthropic: Anthropic | null = null;
let stripe: Stripe | null = null;
function getAnthropic() { if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); return anthropic; }
function getStripe() { if (!stripe && process.env.STRIPE_SECRET_KEY) stripe = new Stripe(process.env.STRIPE_SECRET_KEY); return stripe; }

export async function registerRoutes(app: Express): Promise<Server> {
  const http = createServer(app);

  // ─── Health ──────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok", uptime: Math.floor(process.uptime()) }));

  // ─── Templates & plans ───────────────────────────────────────────────────────
  app.get("/api/templates", (_req, res) => res.json(BUSINESS_TEMPLATES));
  app.get("/api/plans", (_req, res) => res.json(PLANS));

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const body = insertUserSchema.extend({ firstName: z.string().optional(), lastName: z.string().optional(), organizationName: z.string().optional() }).parse(req.body);
      const { user, org, token } = await registerUser(body.email, body.username!, body.password!, body.firstName, body.lastName, body.organizationName);
      res.status(201).json({ token, user: sanitizeUser(user), organization: sanitizeOrg(org) });
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(409).json({ error: (e as Error).message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password || !(await comparePassword(password, user.password))) { res.status(401).json({ error: "Invalid email or password" }); return; }
      if (!user.isActive) { res.status(403).json({ error: "Account deactivated" }); return; }
      await storage.updateUserLastLogin(user.id);
      const token = generateToken({ id: user.id, email: user.email, username: user.username, role: user.role, organizationId: user.organizationId });
      const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
      res.json({ token, user: sanitizeUser(user), organization: org ? sanitizeOrg(org) : null });
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
    res.json({ user: sanitizeUser(user), organization: org ? sanitizeOrg(org) : null });
  });

  app.get("/api/auth/google", (req, res) => {
    const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: `${WIDGET_BASE_URL}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account" });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) { res.redirect("/login?error=google_failed"); return; }
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: `${WIDGET_BASE_URL}/api/auth/google/callback`, grant_type: "authorization_code" }) });
      const td = await tokenRes.json() as any;
      if (!td.access_token) { res.redirect("/login?error=google_failed"); return; }
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${td.access_token}` } });
      const profile = await profileRes.json() as any;
      const { token, isNew } = await findOrCreateGoogleUser({ googleId: profile.id, email: profile.email, firstName: profile.given_name, lastName: profile.family_name, avatarUrl: profile.picture });
      res.redirect(`/auth/callback?token=${token}&new=${isNew}`);
    } catch (err) { console.error("Google OAuth:", err); res.redirect("/login?error=google_failed"); }
  });

  // ─── Dashboard stats ──────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json({}); return; }
    res.json(await storage.getDashboardStats(req.user!.organizationId));
  });

  // ─── Analytics ────────────────────────────────────────────────────────────────
  app.get("/api/analytics", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json({}); return; }
    res.json(await storage.getAnalytics(req.user!.organizationId));
  });

  // ─── Business Settings ────────────────────────────────────────────────────────
  app.get("/api/business-settings", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json({}); return; }
    const s = await storage.getBusinessSettings(req.user!.organizationId);
    if (s?.smtpPass) s.smtpPass = "••••••••"; // mask password
    res.json(s || {});
  });

  app.put("/api/business-settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const data = businessSettingsSchema.parse(req.body);
      // Don't overwrite SMTP pass if masked
      if ((data as any).smtpPass === "••••••••") delete (data as any).smtpPass;
      const s = await storage.upsertBusinessSettings(req.user!.organizationId, data as any);
      res.json(s);
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ─── Services ─────────────────────────────────────────────────────────────────
  app.get("/api/services", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json([]); return; }
    res.json(await storage.getServices(req.user!.organizationId));
  });

  app.post("/api/services", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const data = insertServiceSchema.parse(req.body);
      res.status(201).json(await storage.createService(req.user!.organizationId, data as any));
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const data = insertServiceSchema.partial().parse(req.body);
      const s = await storage.updateService(parseInt(req.params.id), req.user!.organizationId, data as any);
      if (!s) { res.status(404).json({ error: "Not found" }); return; }
      res.json(s);
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
    const ok = await storage.deleteService(parseInt(req.params.id), req.user!.organizationId);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  });

  // ─── Staff ────────────────────────────────────────────────────────────────────
  app.get("/api/staff", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json([]); return; }
    res.json(await storage.getStaff(req.user!.organizationId));
  });

  app.post("/api/staff", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const data = insertStaffSchema.parse(req.body);
      res.status(201).json(await storage.createStaff(req.user!.organizationId, data as any));
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to create staff" });
    }
  });

  app.put("/api/staff/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const s = await storage.updateStaff(parseInt(req.params.id), req.user!.organizationId, req.body);
      if (!s) { res.status(404).json({ error: "Not found" }); return; }
      res.json(s);
    } catch { res.status(500).json({ error: "Failed to update staff" }); }
  });

  app.delete("/api/staff/:id", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
    const ok = await storage.deleteStaff(parseInt(req.params.id), req.user!.organizationId);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  });

  // Availability for a staff member
  app.get("/api/staff/:id/availability", requireAuth, async (req: AuthRequest, res) => {
    res.json(await storage.getAvailability(parseInt(req.params.id)));
  });

  app.put("/api/staff/:id/availability", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const rules = z.array(z.object({ dayOfWeek: z.number().min(0).max(6), startTime: z.string(), endTime: z.string(), isActive: z.boolean() })).parse(req.body);
      await storage.setAvailability(parseInt(req.params.id), req.user!.organizationId, rules);
      res.json({ success: true });
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to set availability" });
    }
  });

  // ─── Knowledge Base ───────────────────────────────────────────────────────────
  app.get("/api/knowledge", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json([]); return; }
    res.json(await storage.getKnowledge(req.user!.organizationId));
  });

  app.post("/api/knowledge", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const data = insertKnowledgeSchema.parse(req.body);
      res.status(201).json(await storage.createKnowledge(req.user!.organizationId, data as any));
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.put("/api/knowledge/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const k = await storage.updateKnowledge(parseInt(req.params.id), req.user!.organizationId, req.body);
      if (!k) { res.status(404).json({ error: "Not found" }); return; }
      res.json(k);
    } catch { res.status(500).json({ error: "Failed to update" }); }
  });

  app.delete("/api/knowledge/:id", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
    const ok = await storage.deleteKnowledge(parseInt(req.params.id), req.user!.organizationId);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  });

  // ─── Appointments (dashboard) ─────────────────────────────────────────────────
  app.get("/api/appointments", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json([]); return; }
    res.json(await storage.getAppointments(req.user!.organizationId));
  });

  app.put("/api/appointments/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const { status, internalNotes, cancellationReason } = req.body;
      const appt = await storage.updateAppointment(parseInt(req.params.id), req.user!.organizationId, { status, internalNotes, cancellationReason, ...(status === "cancelled" ? { cancelledAt: new Date() } : {}), ...(status === "confirmed" ? { confirmedAt: new Date() } : {}), ...(status === "completed" ? { completedAt: new Date() } : {}) });
      if (!appt) { res.status(404).json({ error: "Not found" }); return; }
      // Send cancellation email
      if (status === "cancelled") {
        const [biz, svc] = await Promise.all([storage.getBusinessSettings(req.user!.organizationId), appt.serviceId ? storage.getActiveServices(req.user!.organizationId).then(svcs => svcs.find(s => s.id === appt.serviceId)) : null]);
        if (biz) sendCancellationEmail({ settings: biz, appointment: appt, service: svc || null }).catch(console.error);
      }
      res.json(appt);
    } catch { res.status(500).json({ error: "Failed to update appointment" }); }
  });

  // ─── Public Booking API (widget token auth) ───────────────────────────────────
  app.get("/api/booking/info/:token", async (req, res) => {
    try {
      const agent = await storage.getAgentByWidgetToken(req.params.token);
      if (!agent) { res.status(404).json({ error: "Not found" }); return; }
      const [svcs, staff, biz] = await Promise.all([
        storage.getActiveServices(agent.organizationId),
        storage.getActiveStaff(agent.organizationId),
        storage.getBusinessSettings(agent.organizationId),
      ]);
      res.json({
        services: svcs,
        staff: staff.filter(s => s.acceptsOnlineBooking).map(s => ({ id: s.id, name: s.name, role: s.role, speciality: s.speciality, avatarUrl: s.avatarUrl, calendarColor: s.calendarColor })),
        businessName: biz?.businessName,
        timezone: biz?.timezone || "UTC",
      });
    } catch { res.status(500).json({ error: "Failed to load booking info" }); }
  });

  app.get("/api/booking/slots/:token", async (req, res) => {
    try {
      const agent = await storage.getAgentByWidgetToken(req.params.token);
      if (!agent) { res.status(404).json({ error: "Not found" }); return; }
      const { serviceId, staffId, date } = req.query;
      if (!date) { res.status(400).json({ error: "date required" }); return; }
      const slots = await storage.getAvailableSlots({
        organizationId: agent.organizationId,
        staffId: staffId ? parseInt(staffId as string) : undefined,
        serviceId: serviceId ? parseInt(serviceId as string) : undefined,
        date: date as string,
      });
      res.json(slots);
    } catch { res.status(500).json({ error: "Failed to load slots" }); }
  });

  app.post("/api/booking/create/:token", async (req, res) => {
    try {
      const agent = await storage.getAgentByWidgetToken(req.params.token);
      if (!agent || agent.status !== "active") { res.status(404).json({ error: "Agent not found or inactive" }); return; }

      const data = insertAppointmentSchema.parse(req.body);
      const org = await storage.getOrganization(agent.organizationId);
      if (org?.isSuspended) { res.status(403).json({ error: "Service unavailable" }); return; }

      // Look up service for duration
      let durationMinutes = 60;
      let svc = null;
      if (data.serviceId) {
        const svcs = await storage.getActiveServices(agent.organizationId);
        svc = svcs.find(s => s.id === data.serviceId) || null;
        if (svc) durationMinutes = svc.durationMinutes || 60;
      }

      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

      const biz = await storage.getBusinessSettings(agent.organizationId);
      const autoConfirm = biz?.autoConfirmBookings !== false;

      const appt = await storage.createAppointment(agent.organizationId, {
        ...data as any,
        agentId: agent.id,
        startsAt,
        endsAt,
        status: autoConfirm ? "confirmed" : "pending",
        confirmedAt: autoConfirm ? new Date() : null,
        source: "widget",
      });

      // Send confirmation email
      let staffMember = null;
      if (data.staffId) {
        const allStaff = await storage.getStaff(agent.organizationId);
        staffMember = allStaff.find(s => s.id === data.staffId) || null;
      }

      if (biz && (autoConfirm || biz.autoConfirmBookings)) {
        sendAppointmentConfirmation({ settings: biz, appointment: appt, service: svc, staff: staffMember }).catch(console.error);
        await storage.updateAppointment(appt.id, agent.organizationId, { confirmationSentAt: new Date() });
      }

      res.status(201).json({ success: true, appointmentId: appt.id, status: appt.status, startsAt, endsAt });
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // ─── AI Chat (grounded, with tool use) ───────────────────────────────────────
  app.get("/api/chat/config/:token", async (req, res) => {
    try {
      const agent = await storage.getAgentByWidgetToken(req.params.token);
      if (!agent) { res.status(404).json({ error: "Not found" }); return; }
      const org = await storage.getOrganization(agent.organizationId);
      const limited = org && (org.messagesThisPeriod >= org.maxMonthlyMessages || !!org.isSuspended);
      res.json({
        style: agent.widgetStyle, primaryColor: agent.primaryColor, position: agent.position,
        greetingMessage: limited ? "Service temporarily unavailable." : agent.greetingMessage,
        agentDisplayName: agent.agentDisplayName,
        isActive: agent.status === "active" && !limited,
        enableBooking: agent.enableBooking,
      });
    } catch { res.status(500).json({ error: "Config error" }); }
  });

  app.post("/api/chat/message", async (req, res) => {
    const { token, sessionId, message } = req.body;
    if (!token || !sessionId || !message) { res.status(400).json({ error: "token, sessionId, and message are required" }); return; }

    const agent = await storage.getAgentByWidgetToken(token);
    if (!agent || agent.status !== "active") { res.status(404).json({ error: "Agent not found or inactive" }); return; }

    const { allowed } = await storage.incrementMessageCount(agent.organizationId);
    if (!allowed) { res.json({ reply: "I'm sorry, this service is temporarily unavailable. Please contact us directly.", limited: true }); return; }

    const conv = await storage.getOrCreateConversation(agent.id, agent.organizationId, sessionId);
    const history = ((conv.messages as any[]) || []).slice(-12);

    try {
      const ai = getAnthropic();

      // Build grounded system prompt
      const groundingCtx = await storage.buildGroundingContext(agent.organizationId, agent.id);
      const biz = await storage.getBusinessSettings(agent.organizationId);
      const businessName = biz?.businessName || "our business";
      const displayName = agent.agentDisplayName || "AI Assistant";

      let systemPrompt = agent.systemPrompt || `You are ${displayName}, a helpful AI assistant for ${businessName}.`;
      systemPrompt = systemPrompt.replace("{agentName}", displayName).replace("{businessName}", businessName);
      systemPrompt += `\n\n${groundingCtx}`;

      if (agent.enableBooking) {
        systemPrompt += `\n\n=== BOOKING ===\nYou can help customers book appointments. When they want to book, use the get_available_slots tool to check availability, then use create_appointment to confirm. Always collect: customer name, email, preferred service, preferred date. Confirm the appointment details before booking.`;
      }

      // Define tools for booking
      const tools: Anthropic.Tool[] = agent.enableBooking ? [
        {
          name: "get_available_slots",
          description: "Get available appointment slots for a given date. Call this when a customer wants to see availability.",
          input_schema: {
            type: "object" as const,
            properties: {
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              serviceId: { type: "number", description: "Service ID (optional)" },
              staffId: { type: "number", description: "Staff member ID (optional)" },
            },
            required: ["date"],
          },
        },
        {
          name: "create_appointment",
          description: "Create a booking after confirming all details with the customer.",
          input_schema: {
            type: "object" as const,
            properties: {
              customerName: { type: "string" },
              customerEmail: { type: "string" },
              customerPhone: { type: "string" },
              serviceId: { type: "number" },
              staffId: { type: "number" },
              startsAt: { type: "string", description: "ISO 8601 datetime" },
              customerNotes: { type: "string" },
            },
            required: ["customerName", "customerEmail", "startsAt"],
          },
        },
      ] : [];

      const aiMessages: Anthropic.MessageParam[] = [
        ...history.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: message },
      ];

      let reply = "";
      let bookingConfirmed: any = null;

      // Agentic loop for tool use
      let loopMessages = [...aiMessages];
      for (let iteration = 0; iteration < 5; iteration++) {
        const response = await ai.messages.create({
          model: agent.model || "claude-sonnet-4-6",
          max_tokens: agent.maxTokens || 512,
          system: systemPrompt,
          messages: loopMessages,
          tools: tools.length > 0 ? tools : undefined,
        });

        const textBlock = response.content.find(b => b.type === "text");
        if (textBlock && textBlock.type === "text") reply = textBlock.text;

        if (response.stop_reason !== "tool_use") break;

        // Process tool calls
        const toolUses = response.content.filter(b => b.type === "tool_use");
        if (!toolUses.length) break;

        loopMessages = [...loopMessages, { role: "assistant" as const, content: response.content }];
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
          if (toolUse.type !== "tool_use") continue;
          const input = toolUse.input as any;
          let toolResult: string;

          if (toolUse.name === "get_available_slots") {
            const slots = await storage.getAvailableSlots({
              organizationId: agent.organizationId,
              date: input.date,
              serviceId: input.serviceId,
              staffId: input.staffId,
            });
            toolResult = slots.length > 0
              ? `Available slots on ${input.date}:\n` + slots.map(s => `• ${s.startTime}–${s.endTime} with ${s.staffName}`).join("\n")
              : `No available slots on ${input.date}. Please try another date.`;
          } else if (toolUse.name === "create_appointment") {
            try {
              const svcs = await storage.getActiveServices(agent.organizationId);
              const svc = input.serviceId ? svcs.find((s: any) => s.id === input.serviceId) : null;
              const durationMinutes = svc?.durationMinutes || 60;
              const startsAt = new Date(input.startsAt);
              const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
              const biz = await storage.getBusinessSettings(agent.organizationId);
              const appt = await storage.createAppointment(agent.organizationId, {
                ...input,
                agentId: agent.id,
                startsAt,
                endsAt,
                status: "confirmed",
                confirmedAt: new Date(),
                source: "widget_chat",
              });
              // Send confirmation email
              let staffMember = null;
              if (input.staffId) {
                const allStaff = await storage.getStaff(agent.organizationId);
                staffMember = allStaff.find(s => s.id === input.staffId) || null;
              }
              if (biz) sendAppointmentConfirmation({ settings: biz, appointment: appt, service: svc || null, staff: staffMember }).catch(console.error);
              bookingConfirmed = { id: appt.id, startsAt, endsAt, service: svc?.name };
              toolResult = `Appointment created! Confirmation #${appt.id}. A confirmation email has been sent to ${input.customerEmail}.`;
            } catch (err) {
              toolResult = `Failed to create appointment: ${(err as Error).message}`;
            }
          } else {
            toolResult = "Unknown tool";
          }

          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: toolResult });
        }

        loopMessages = [...loopMessages, { role: "user" as const, content: toolResults }];
      }

      // Update conversation lead info if email/name detected in message
      if (message.includes("@")) {
        const emailMatch = message.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
        if (emailMatch) await storage.updateConversationLead(conv.id, { leadEmail: emailMatch[0] });
      }

      await storage.appendMessage(conv.id, "user", message);
      await storage.appendMessage(conv.id, "assistant", reply);
      await storage.incrementAgentStats(agent.id);

      res.json({ reply, bookingConfirmed });
    } catch (err) {
      console.error("AI error:", err);
      res.status(500).json({ error: "AI service error" });
    }
  });

  // ─── Agents ───────────────────────────────────────────────────────────────────
  app.get("/api/agents", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json([]); return; }
    res.json(await storage.getAgents(req.user!.organizationId));
  });

  app.post("/api/agents", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const org = await storage.getOrganization(req.user!.organizationId);
      const existing = await storage.getAgents(req.user!.organizationId);
      if (org && existing.length >= org.maxAgents) { res.status(403).json({ error: `Your plan allows up to ${org.maxAgents} agent(s). Please upgrade.` }); return; }
      const data = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent({ ...data, organizationId: req.user!.organizationId, createdById: req.user!.id } as any);
      res.status(201).json(agent);
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const { widgetToken: _wt, organizationId: _oi, createdById: _cb, ...safe } = req.body;
      const updates = updateAgentSchema.parse(safe);
      const agent = await storage.updateAgent(parseInt(req.params.id), req.user!.organizationId, updates as any);
      if (!agent) { res.status(404).json({ error: "Not found" }); return; }
      res.json(agent);
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
    const ok = await storage.deleteAgent(parseInt(req.params.id), req.user!.organizationId);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  });

  app.get("/api/agents/:id/embed", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
    const agent = await storage.getAgent(parseInt(req.params.id), req.user!.organizationId);
    if (!agent) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ embedCode: `<script src="${WIDGET_BASE_URL}/widget.js" data-token="${agent.widgetToken}" async></script>`, widgetToken: agent.widgetToken });
  });

  // ─── API Keys ──────────────────────────────────────────────────────────────────
  app.get("/api/keys", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.json([]); return; }
    res.json(await storage.getApiKeys(req.user!.organizationId));
  });

  app.post("/api/keys", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const { name, expiresAt } = insertApiKeySchema.parse(req.body);
      const { apiKey, rawKey } = await storage.createApiKey(req.user!.organizationId, req.user!.id, name, expiresAt ? new Date(expiresAt) : undefined);
      res.status(201).json({ ...apiKey, rawKey });
    } catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.errors }); return; }
      res.status(500).json({ error: "Failed to create key" });
    }
  });

  app.delete("/api/keys/:id", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
    const ok = await storage.revokeApiKey(parseInt(req.params.id), req.user!.organizationId);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  });

  // ─── Stripe ───────────────────────────────────────────────────────────────────
  app.post("/api/billing/create-checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const s = getStripe();
      if (!s) { res.status(501).json({ error: "Billing not configured" }); return; }
      const { plan } = req.body as { plan: "starter" | "professional" };
      const planConfig = PLANS[plan];
      if (!planConfig?.stripePriceId) { res.status(400).json({ error: "Invalid plan or price not configured" }); return; }
      const session = await s.checkout.sessions.create({ mode: "subscription", payment_method_types: ["card"], line_items: [{ price: planConfig.stripePriceId, quantity: 1 }], customer_email: req.user!.email, metadata: { organizationId: String(req.user!.organizationId) }, success_url: `${WIDGET_BASE_URL}/dashboard?upgraded=true`, cancel_url: `${WIDGET_BASE_URL}/dashboard` });
      res.json({ url: session.url });
    } catch { res.status(500).json({ error: "Stripe error" }); }
  });

  app.post("/api/billing/portal", requireAuth, async (req: AuthRequest, res) => {
    try {
      const s = getStripe();
      if (!s) { res.status(501).json({ error: "Billing not configured" }); return; }
      const org = await storage.getOrganization(req.user!.organizationId!);
      if (!org?.stripeCustomerId) { res.status(400).json({ error: "No billing account" }); return; }
      const session = await s.billingPortal.sessions.create({ customer: org.stripeCustomerId, return_url: `${WIDGET_BASE_URL}/dashboard` });
      res.json({ url: session.url });
    } catch { res.status(500).json({ error: "Portal error" }); }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    const s = getStripe();
    if (!s) { res.status(501).end(); return; }
    let event: Stripe.Event;
    try { event = s.webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, process.env.STRIPE_WEBHOOK_SECRET || ""); } catch { res.status(400).end(); return; }
    const orgId = (event.data.object as any).metadata?.organizationId;
    if (!orgId) { res.json({ received: true }); return; }
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await storage.updateOrganization(parseInt(orgId), { stripeCustomerId: session.customer as string, stripeSubscriptionId: session.subscription as string, subscriptionStatus: "active" });
        break;
      }
      case "customer.subscription.deleted": await storage.upgradePlan(parseInt(orgId), "free"); await storage.updateOrganization(parseInt(orgId), { subscriptionStatus: "canceled" }); break;
      case "invoice.payment_failed": await storage.updateOrganization(parseInt(orgId), { subscriptionStatus: "past_due" }); break;
    }
    res.json({ received: true });
  });

  // ─── Admin ────────────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAuth, requireSuperAdmin, async (_req, res) => { res.json(await storage.getAdminStats()); });
  app.get("/api/admin/organizations", requireAuth, requireSuperAdmin, async (_req, res) => { res.json(await storage.getAllOrgsWithUsers()); });
  app.post("/api/admin/organizations/:id/suspend", requireAuth, requireSuperAdmin, async (req, res) => { res.json(await storage.updateOrganization(parseInt(req.params.id), { isSuspended: true, suspendedReason: req.body.reason || "Admin" })); });
  app.post("/api/admin/organizations/:id/reactivate", requireAuth, requireSuperAdmin, async (req, res) => { res.json(await storage.updateOrganization(parseInt(req.params.id), { isSuspended: false, suspendedReason: null })); });
  app.put("/api/admin/organizations/:id/plan", requireAuth, requireSuperAdmin, async (req, res) => { res.json(await storage.upgradePlan(parseInt(req.params.id), req.body.plan)); });

  // ─── Marketing ────────────────────────────────────────────────────────────────
  app.post("/api/leads", async (req, res) => { try { res.json(await storage.createLead(insertLeadSchema.parse(req.body))); } catch { res.status(500).json({ error: "Failed" }); } });
  app.post("/api/newsletter", async (req, res) => { try { res.json(await storage.createNewsletterSubscriber(insertNewsletterSubscriberSchema.parse(req.body))); } catch { res.status(500).json({ error: "Failed" }); } });
  app.post("/api/contact", async (req, res) => { try { res.json(await storage.createContactSubmission(insertContactSubmissionSchema.parse(req.body))); } catch { res.status(500).json({ error: "Failed" }); } });

  // ─── Plugin / Connector routes ─────────────────────────────────────────────

  app.get("/api/plugins", requireAuth, (_req, res) => {
    res.json(listPlugins().map(p => ({
      id: p.id, name: p.name, description: p.description, icon: p.icon,
      category: p.category, configFields: p.configFields, capabilities: p.capabilities,
      docsUrl: p.docsUrl, popularIn: p.popularIn,
    })));
  });

  app.get("/api/plugins/:id", requireAuth, (req, res) => {
    const plugin = getPlugin(req.params.id);
    if (!plugin) return res.status(404).json({ error: "Plugin not found" });
    res.json(plugin);
  });

  app.post("/api/plugins/:id/test", requireAuth, async (req: AuthRequest, res) => {
    const plugin = getPlugin(req.params.id);
    if (!plugin) return res.status(404).json({ error: "Plugin not found" });
    try {
      const result = await plugin.testConnection(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/scrape-preview", requireAuth, async (req: AuthRequest, res) => {
    const { url, deepScrape } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    try {
      const result = await scrapeWebsite(url, !!deepScrape);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Workflow routes ────────────────────────────────────────────────────────

  app.get("/api/workflow-templates", requireAuth, (_req, res) => {
    res.json(WORKFLOW_TEMPLATES);
  });

  app.post("/api/workflows/dispatch", requireAuth, async (req: AuthRequest, res) => {
    const { triggerType, payload } = req.body;
    if (!triggerType) return res.status(400).json({ error: "triggerType is required" });
    try {
      await dispatch(triggerType, payload || {}, req.user!.organizationId!);
      res.json({ queued: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── India utilities ────────────────────────────────────────────────────────

  app.post("/api/india/validate-gstin", requireAuth, (req, res) => {
    const { gstin } = req.body;
    if (!gstin) return res.status(400).json({ error: "gstin is required" });
    res.json(validateGSTIN(gstin));
  });

  app.post("/api/india/validate-phone", requireAuth, (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });
    res.json(validateIndianPhone(phone));
  });

  app.post("/api/india/upi-link", requireAuth, (req, res) => {
    const { upiId, amount, note, merchantName } = req.body;
    if (!upiId || !amount) return res.status(400).json({ error: "upiId and amount are required" });
    try {
      const link = generateUpiLink(upiId, amount, note || "", merchantName);
      res.json({ link });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/india/holidays", requireAuth, (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const stateCode = req.query.stateCode as string | undefined;
    res.json(getUpcomingHolidays(days, stateCode));
  });

  app.post("/api/india/check-holiday", requireAuth, (req, res) => {
    const { date, stateCode } = req.body;
    if (!date) return res.status(400).json({ error: "date is required" });
    res.json({ isHoliday: isIndianHoliday(date, stateCode) });
  });

  return http;
}

function sanitizeUser(u: any) { return { id: u.id, email: u.email, username: u.username, role: u.role, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl }; }
function sanitizeOrg(o: any) { return { id: o.id, name: o.name, slug: o.slug, plan: o.plan, subscriptionStatus: o.subscriptionStatus, trialEndsAt: o.trialEndsAt, maxAgents: o.maxAgents, maxMonthlyMessages: o.maxMonthlyMessages, messagesThisPeriod: o.messagesThisPeriod, isSuspended: o.isSuspended, stripeSubscriptionId: o.stripeSubscriptionId }; }
