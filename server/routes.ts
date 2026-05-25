import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireSuperAdmin, registerUser, comparePassword, generateToken, findOrCreateGoogleUser, type AuthRequest } from "./auth";
import {
  insertLeadSchema, insertNewsletterSubscriberSchema, insertContactSubmissionSchema,
  insertAgentSchema, updateAgentSchema, insertApiKeySchema, loginSchema, insertUserSchema, PLANS, BUSINESS_TEMPLATES,
} from "@shared/schema";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";

const WIDGET_BASE_URL = process.env.WIDGET_BASE_URL || "https://agentflowpro.com";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Lazy-init to avoid startup crashes when keys are missing
let anthropic: Anthropic | null = null;
let stripe: Stripe | null = null;

function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ─── Health ──────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  });

  // ─── Business templates ──────────────────────────────────────────────────────
  app.get("/api/templates", (_req, res) => {
    res.json(BUSINESS_TEMPLATES);
  });

  // ─── Plans ──────────────────────────────────────────────────────────────────
  app.get("/api/plans", (_req, res) => {
    res.json(PLANS);
  });

  // ─── Auth: Email/Password ────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const body = insertUserSchema.extend({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        organizationName: z.string().optional(),
      }).parse(req.body);
      const { user, org, token } = await registerUser(body.email, body.username!, body.password!, body.firstName, body.lastName, body.organizationName);
      res.status(201).json({
        token,
        user: sanitizeUser(user),
        organization: sanitizeOrg(org),
      });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password || !(await comparePassword(password, user.password))) {
        res.status(401).json({ error: "Invalid email or password" }); return;
      }
      if (!user.isActive) { res.status(403).json({ error: "Account deactivated" }); return; }
      await storage.updateUserLastLogin(user.id);
      const token = generateToken({ id: user.id, email: user.email, username: user.username, role: user.role, organizationId: user.organizationId });
      const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
      res.json({ token, user: sanitizeUser(user), organization: org ? sanitizeOrg(org) : null });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
      res.json({ user: sanitizeUser(user), organization: org ? sanitizeOrg(org) : null });
    } catch { res.status(500).json({ error: "Failed to fetch user" }); }
  });

  // ─── Auth: Google OAuth ──────────────────────────────────────────────────────
  // Step 1: redirect to Google
  app.get("/api/auth/google", (req, res) => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${WIDGET_BASE_URL}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Step 2: Google redirects back with a code
  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) { res.redirect("/login?error=google_failed"); return; }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${WIDGET_BASE_URL}/api/auth/google/callback`,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) { res.redirect("/login?error=google_failed"); return; }

      // Get user profile
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json() as any;

      const { token, isNew } = await findOrCreateGoogleUser({
        googleId: profile.id,
        email: profile.email,
        firstName: profile.given_name,
        lastName: profile.family_name,
        avatarUrl: profile.picture,
      });

      // Redirect to frontend with token in query (frontend reads + stores it)
      res.redirect(`/auth/callback?token=${token}&new=${isNew}`);
    } catch (err) {
      console.error("Google OAuth error:", err);
      res.redirect("/login?error=google_failed");
    }
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.json({}); return; }
      const stats = await storage.getDashboardStats(req.user!.organizationId);
      res.json(stats);
    } catch { res.status(500).json({ error: "Failed to fetch stats" }); }
  });

  // ─── Agents ─────────────────────────────────────────────────────────────────
  app.get("/api/agents", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.json([]); return; }
      const list = await storage.getAgents(req.user!.organizationId);
      res.json(list);
    } catch { res.status(500).json({ error: "Failed to fetch agents" }); }
  });

  app.post("/api/agents", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization found" }); return; }
      const org = await storage.getOrganization(req.user!.organizationId);
      const existingAgents = await storage.getAgents(req.user!.organizationId);
      if (org && existingAgents.length >= org.maxAgents) {
        res.status(403).json({ error: `Your plan allows up to ${org.maxAgents} agent(s). Please upgrade to create more.` }); return;
      }
      const data = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent({ ...data, organizationId: req.user!.organizationId, createdById: req.user!.id } as any);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization found" }); return; }
      const id = parseInt(req.params.id);
      // Block editing widgetToken — that's the embed code anchor
      const { widgetToken: _wt, organizationId: _oi, createdById: _cb, ...safe } = req.body;
      const updates = updateAgentSchema.parse(safe);
      const agent = await storage.updateAgent(id, req.user!.organizationId, updates as any);
      if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const deleted = await storage.deleteAgent(parseInt(req.params.id), req.user!.organizationId);
      if (!deleted) { res.status(404).json({ error: "Agent not found" }); return; }
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to delete agent" }); }
  });

  // Embed code for an agent — read-only
  app.get("/api/agents/:id/embed", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const agent = await storage.getAgent(parseInt(req.params.id), req.user!.organizationId);
      if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
      const embedCode = `<script src="${WIDGET_BASE_URL}/widget.js" data-token="${agent.widgetToken}" async></script>`;
      res.json({ embedCode, widgetToken: agent.widgetToken, widgetStyle: agent.widgetStyle });
    } catch { res.status(500).json({ error: "Failed to generate embed code" }); }
  });

  // ─── Chat (widget endpoint — public, auth by widget token) ─────────────────
  app.post("/api/chat/message", async (req, res) => {
    const { token, sessionId, message } = req.body;
    if (!token || !sessionId || !message) {
      res.status(400).json({ error: "token, sessionId, and message are required" }); return;
    }

    const agent = await storage.getAgentByWidgetToken(token);
    if (!agent || agent.status !== "active") {
      res.status(404).json({ error: "Agent not found or inactive" }); return;
    }

    // Check org message limits
    const { allowed } = await storage.incrementMessageCount(agent.organizationId);
    if (!allowed) {
      res.json({ reply: "I'm sorry, this service is temporarily unavailable. Please contact the website owner.", limited: true });
      return;
    }

    // Get or create conversation for history (last 10 messages)
    const conv = await storage.getOrCreateConversation(agent.id, agent.organizationId, sessionId);
    const history = ((conv.messages as any[]) || []).slice(-10);

    try {
      const ai = getAnthropic();
      const response = await ai.messages.create({
        model: agent.model || "claude-sonnet-4-6",
        max_tokens: agent.maxTokens || 512,
        system: agent.systemPrompt || "You are a helpful assistant.",
        messages: [
          ...history.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: message },
        ],
      });

      const reply = response.content[0].type === "text" ? response.content[0].text : "";

      // Persist conversation
      await storage.appendMessage(conv.id, "user", message);
      await storage.appendMessage(conv.id, "assistant", reply);
      await storage.incrementAgentStats(agent.id);

      res.json({ reply });
    } catch (err) {
      console.error("AI error:", err);
      res.status(500).json({ error: "AI service error" });
    }
  });

  // Widget config (public — widget loads this on init)
  app.get("/api/chat/config/:token", async (req, res) => {
    const agent = await storage.getAgentByWidgetToken(req.params.token);
    if (!agent) { res.status(404).json({ error: "Not found" }); return; }
    const org = await storage.getOrganization(agent.organizationId);
    const limited = org && (org.messagesThisPeriod >= org.maxMonthlyMessages || !!org.isSuspended);
    res.json({
      style: agent.widgetStyle,
      primaryColor: agent.primaryColor,
      position: agent.position,
      greetingMessage: limited ? "Service temporarily unavailable." : agent.greetingMessage,
      agentDisplayName: agent.agentDisplayName,
      isActive: agent.status === "active" && !limited,
    });
  });

  // ─── API Keys ────────────────────────────────────────────────────────────────
  app.get("/api/keys", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.json([]); return; }
      res.json(await storage.getApiKeys(req.user!.organizationId));
    } catch { res.status(500).json({ error: "Failed to fetch keys" }); }
  });

  app.post("/api/keys", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const { name, expiresAt } = insertApiKeySchema.parse(req.body);
      const { apiKey, rawKey } = await storage.createApiKey(req.user!.organizationId, req.user!.id, name, expiresAt ? new Date(expiresAt) : undefined);
      res.status(201).json({ ...apiKey, rawKey });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Failed to create key" });
    }
  });

  app.delete("/api/keys/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) { res.status(400).json({ error: "No organization" }); return; }
      const revoked = await storage.revokeApiKey(parseInt(req.params.id), req.user!.organizationId);
      if (!revoked) { res.status(404).json({ error: "Key not found" }); return; }
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to revoke key" }); }
  });

  // ─── Stripe Billing ──────────────────────────────────────────────────────────
  app.post("/api/billing/create-checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const s = getStripe();
      if (!s) { res.status(501).json({ error: "Billing not configured" }); return; }
      const { plan } = req.body as { plan: "starter" | "professional" };
      const planConfig = PLANS[plan];
      if (!planConfig?.stripePriceId) { res.status(400).json({ error: "Invalid plan or price not configured" }); return; }
      const org = await storage.getOrganization(req.user!.organizationId!);
      const session = await s.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: planConfig.stripePriceId, quantity: 1 }],
        customer_email: req.user!.email,
        metadata: { organizationId: String(req.user!.organizationId) },
        success_url: `${WIDGET_BASE_URL}/dashboard?upgraded=true`,
        cancel_url: `${WIDGET_BASE_URL}/dashboard/billing`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/billing/portal", requireAuth, async (req: AuthRequest, res) => {
    try {
      const s = getStripe();
      if (!s) { res.status(501).json({ error: "Billing not configured" }); return; }
      const org = await storage.getOrganization(req.user!.organizationId!);
      if (!org?.stripeCustomerId) { res.status(400).json({ error: "No billing account found" }); return; }
      const session = await s.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${WIDGET_BASE_URL}/dashboard`,
      });
      res.json({ url: session.url });
    } catch { res.status(500).json({ error: "Failed to create portal session" }); }
  });

  // Stripe webhook
  app.post("/api/webhooks/stripe", async (req, res) => {
    const s = getStripe();
    if (!s) { res.status(501).json({ error: "Billing not configured" }); return; }
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    try {
      event = s.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
    } catch { res.status(400).json({ error: "Invalid signature" }); return; }

    const orgId = (event.data.object as any).metadata?.organizationId;
    if (!orgId) { res.json({ received: true }); return; }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const planKey = Object.entries(PLANS).find(([, p]) => p.stripePriceId === (session as any)?.line_items?.data?.[0]?.price?.id)?.[0];
        if (planKey) await storage.upgradePlan(parseInt(orgId), planKey as any);
        await storage.updateOrganization(parseInt(orgId), {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: "active",
        });
        break;
      }
      case "customer.subscription.deleted":
        await storage.upgradePlan(parseInt(orgId), "free");
        await storage.updateOrganization(parseInt(orgId), { subscriptionStatus: "canceled" });
        break;
      case "invoice.payment_failed":
        await storage.updateOrganization(parseInt(orgId), { subscriptionStatus: "past_due" });
        break;
    }
    res.json({ received: true });
  });

  // ─── Super Admin ─────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAdminStats());
    } catch { res.status(500).json({ error: "Failed to fetch admin stats" }); }
  });

  app.get("/api/admin/organizations", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllOrgsWithUsers());
    } catch { res.status(500).json({ error: "Failed to fetch organizations" }); }
  });

  app.post("/api/admin/organizations/:id/suspend", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      const org = await storage.updateOrganization(parseInt(req.params.id), { isSuspended: true, suspendedReason: reason || "Suspended by admin" });
      res.json(org);
    } catch { res.status(500).json({ error: "Failed to suspend organization" }); }
  });

  app.post("/api/admin/organizations/:id/reactivate", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const org = await storage.updateOrganization(parseInt(req.params.id), { isSuspended: false, suspendedReason: null });
      res.json(org);
    } catch { res.status(500).json({ error: "Failed to reactivate organization" }); }
  });

  app.put("/api/admin/organizations/:id/plan", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { plan } = req.body;
      const org = await storage.upgradePlan(parseInt(req.params.id), plan);
      res.json(org);
    } catch { res.status(500).json({ error: "Failed to update plan" }); }
  });

  // ─── Marketing ───────────────────────────────────────────────────────────────
  app.post("/api/leads", async (req, res) => {
    try {
      const lead = await storage.createLead(insertLeadSchema.parse(req.body));
      res.json({ success: true, lead });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.post("/api/newsletter", async (req, res) => {
    try {
      const sub = await storage.createNewsletterSubscriber(insertNewsletterSubscriberSchema.parse(req.body));
      res.json({ success: true, sub });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const submission = await storage.createContactSubmission(insertContactSubmissionSchema.parse(req.body));
      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.errors }); return; }
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeUser(u: any) {
  return { id: u.id, email: u.email, username: u.username, role: u.role, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl };
}
function sanitizeOrg(o: any) {
  return { id: o.id, name: o.name, slug: o.slug, plan: o.plan, subscriptionStatus: o.subscriptionStatus, trialEndsAt: o.trialEndsAt, maxAgents: o.maxAgents, maxMonthlyMessages: o.maxMonthlyMessages, messagesThisPeriod: o.messagesThisPeriod, isSuspended: o.isSuspended };
}
