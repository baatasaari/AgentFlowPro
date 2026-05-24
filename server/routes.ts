import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, registerUser, comparePassword, generateToken, type AuthRequest } from "./auth";
import {
  insertLeadSchema, insertNewsletterSubscriberSchema, insertContactSubmissionSchema,
  insertAgentSchema, insertApiKeySchema, loginSchema, insertUserSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // ─── Health Check ───────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || "1.0.0",
    });
  });

  // ─── Auth Routes ────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const body = insertUserSchema.extend({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        organizationName: z.string().optional(),
      }).parse(req.body);

      const { user, org } = await registerUser(
        body.email,
        body.username,
        body.password,
        body.firstName,
        body.lastName,
        body.organizationName,
      );

      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
      });

      await storage.createAuditLog({
        organizationId: org.id,
        userId: user.id,
        action: "user.registered",
        resourceType: "user",
        resourceId: String(user.id),
        details: { email: user.email },
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName },
        organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, trialEndsAt: org.trialEndsAt },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else if (error instanceof Error) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Registration failed" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);

      if (!user || !(await comparePassword(password, user.password))) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: "Account is deactivated" });
        return;
      }

      await storage.updateUserLastLogin(user.id);

      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
      });

      let organization = null;
      if (user.organizationId) {
        organization = await storage.getOrganization(user.organizationId);
      }

      await storage.createAuditLog({
        organizationId: user.organizationId,
        userId: user.id,
        action: "user.login",
        resourceType: "user",
        resourceId: String(user.id),
        details: {},
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.json({
        token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName },
        organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug, plan: organization.plan, trialEndsAt: organization.trialEndsAt } : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Login failed" });
      }
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      let organization = null;
      if (user.organizationId) {
        organization = await storage.getOrganization(user.organizationId);
      }

      res.json({
        user: { id: user.id, email: user.email, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, lastLoginAt: user.lastLoginAt },
        organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug, plan: organization.plan, trialEndsAt: organization.trialEndsAt } : null,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.status(400).json({ error: "No organization found" });
        return;
      }
      const stats = await storage.getDashboardStats(req.user!.organizationId);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ─── Agents ─────────────────────────────────────────────────────────────────
  app.get("/api/agents", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.json([]);
        return;
      }
      const agentList = await storage.getAgents(req.user!.organizationId);
      res.json(agentList);
    } catch {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.post("/api/agents", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.status(400).json({ error: "No organization found" });
        return;
      }
      const data = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent({
        ...data,
        organizationId: req.user!.organizationId,
        createdById: req.user!.id,
      } as any);

      await storage.createAuditLog({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: "agent.created",
        resourceType: "agent",
        resourceId: String(agent.id),
        details: { name: agent.name, platform: agent.platform },
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create agent" });
      }
    }
  });

  app.put("/api/agents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.status(400).json({ error: "No organization found" });
        return;
      }
      const id = parseInt(req.params.id);
      const updates = req.body;
      const agent = await storage.updateAgent(id, req.user!.organizationId, updates);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      await storage.createAuditLog({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: "agent.updated",
        resourceType: "agent",
        resourceId: String(id),
        details: updates,
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.json(agent);
    } catch {
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.status(400).json({ error: "No organization found" });
        return;
      }
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAgent(id, req.user!.organizationId);
      if (!deleted) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      await storage.createAuditLog({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: "agent.deleted",
        resourceType: "agent",
        resourceId: String(id),
        details: {},
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // ─── API Keys ───────────────────────────────────────────────────────────────
  app.get("/api/keys", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.json([]);
        return;
      }
      const keys = await storage.getApiKeys(req.user!.organizationId);
      res.json(keys);
    } catch {
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  app.post("/api/keys", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.status(400).json({ error: "No organization found" });
        return;
      }
      const { name, expiresAt } = insertApiKeySchema.parse(req.body);
      const { apiKey, rawKey } = await storage.createApiKey(
        req.user!.organizationId,
        req.user!.id,
        name,
        expiresAt ? new Date(expiresAt) : undefined,
      );

      await storage.createAuditLog({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: "api_key.created",
        resourceType: "api_key",
        resourceId: String(apiKey.id),
        details: { name },
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      // Return rawKey only on creation — never again
      res.status(201).json({ ...apiKey, rawKey });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create API key" });
      }
    }
  });

  app.delete("/api/keys/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user!.organizationId) {
        res.status(400).json({ error: "No organization found" });
        return;
      }
      const id = parseInt(req.params.id);
      const revoked = await storage.revokeApiKey(id, req.user!.organizationId);
      if (!revoked) {
        res.status(404).json({ error: "API key not found" });
        return;
      }

      await storage.createAuditLog({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: "api_key.revoked",
        resourceType: "api_key",
        resourceId: String(id),
        details: {},
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  // ─── Marketing Routes ────────────────────────────────────────────────────────
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.json({ success: true, lead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create lead" });
      }
    }
  });

  app.post("/api/newsletter", async (req, res) => {
    try {
      const subscriberData = insertNewsletterSubscriberSchema.parse(req.body);
      const subscriber = await storage.createNewsletterSubscriber(subscriberData);
      res.json({ success: true, subscriber });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to subscribe to newsletter" });
      }
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const contactData = insertContactSubmissionSchema.parse(req.body);
      const submission = await storage.createContactSubmission(contactData);
      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to submit contact form" });
      }
    }
  });

  app.get("/api/leads", requireAuth, async (req: AuthRequest, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/contact", requireAuth, async (req: AuthRequest, res) => {
    try {
      const submissions = await storage.getContactSubmissions();
      res.json(submissions);
    } catch {
      res.status(500).json({ error: "Failed to fetch contact submissions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
