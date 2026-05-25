import {
  users, leads, newsletterSubscribers, contactSubmissions,
  agents, apiKeys, widgetConversations, auditLogs, organizations,
  PLANS,
  type User, type InsertUser, type Lead, type InsertLead,
  type NewsletterSubscriber, type InsertNewsletterSubscriber,
  type ContactSubmission, type InsertContactSubmission,
  type Agent, type InsertAgent, type ApiKey,
  type Organization, type AuditLog, type WidgetConversation,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, lt } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

export class DatabaseStorage {
  // ─── Users ──────────────────────────────────────────────────────────────────
  async getUser(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.googleId, googleId));
    return u;
  }

  async createUser(data: Partial<User> & { email: string; username: string }): Promise<User> {
    const [u] = await db.insert(users).values(data as any).returning();
    return u;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [u] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return u;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  // ─── Organizations ──────────────────────────────────────────────────────────
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async createOrganization(data: Partial<Organization> & { name: string; slug: string }): Promise<Organization> {
    const plan = (data.plan || "free") as keyof typeof PLANS;
    const limits = PLANS[plan];
    const [org] = await db.insert(organizations).values({
      ...data,
      maxAgents: limits.maxAgents,
      maxMonthlyMessages: limits.maxMonthlyMessages,
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
      periodResetAt: new Date(Date.now() + 30 * 86400000),
    } as any).returning();
    return org;
  }

  async updateOrganization(id: number, data: Partial<Organization>): Promise<Organization> {
    const [org] = await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
    return org;
  }

  async incrementMessageCount(organizationId: number): Promise<{ allowed: boolean }> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    if (!org) return { allowed: false };
    if (org.isSuspended) return { allowed: false };
    if (org.messagesThisPeriod >= org.maxMonthlyMessages) return { allowed: false };
    await db.update(organizations)
      .set({ messagesThisPeriod: sql`${organizations.messagesThisPeriod} + 1` })
      .where(eq(organizations.id, organizationId));
    return { allowed: true };
  }

  async upgradePlan(organizationId: number, plan: keyof typeof PLANS): Promise<Organization> {
    const limits = PLANS[plan];
    return this.updateOrganization(organizationId, {
      plan,
      maxAgents: limits.maxAgents,
      maxMonthlyMessages: limits.maxMonthlyMessages,
    });
  }

  // ─── Agents ─────────────────────────────────────────────────────────────────
  async getAgents(organizationId: number): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.organizationId, organizationId)).orderBy(desc(agents.createdAt));
  }

  async getAgentById(id: number): Promise<Agent | undefined> {
    const [a] = await db.select().from(agents).where(eq(agents.id, id));
    return a;
  }

  async getAgentByWidgetToken(token: string): Promise<Agent | undefined> {
    const [a] = await db.select().from(agents).where(eq(agents.widgetToken, token));
    return a;
  }

  async getAgent(id: number, organizationId: number): Promise<Agent | undefined> {
    const [a] = await db.select().from(agents).where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return a;
  }

  async createAgent(data: Partial<Agent> & { organizationId: number; createdById: number; name: string }): Promise<Agent> {
    const [a] = await db.insert(agents).values(data as any).returning();
    return a;
  }

  async updateAgent(id: number, organizationId: number, data: Partial<Agent>): Promise<Agent | undefined> {
    const [a] = await db.update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)))
      .returning();
    return a;
  }

  async deleteAgent(id: number, organizationId: number): Promise<boolean> {
    const r = await db.delete(agents).where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  async incrementAgentStats(agentId: number): Promise<void> {
    await db.update(agents).set({
      totalMessages: sql`${agents.totalMessages} + 1`,
    }).where(eq(agents.id, agentId));
  }

  // ─── Widget Conversations ────────────────────────────────────────────────────
  async getOrCreateConversation(agentId: number, organizationId: number, sessionId: string): Promise<WidgetConversation> {
    const [existing] = await db.select().from(widgetConversations)
      .where(and(eq(widgetConversations.agentId, agentId), eq(widgetConversations.sessionId, sessionId)));
    if (existing) return existing;
    const [conv] = await db.insert(widgetConversations).values({ agentId, organizationId, sessionId, messages: [] }).returning();
    return conv;
  }

  async appendMessage(sessionId: number, role: "user" | "assistant", content: string): Promise<void> {
    await db.update(widgetConversations)
      .set({
        messages: sql`${widgetConversations.messages} || ${JSON.stringify([{ role, content, ts: Date.now() }])}::jsonb`,
        lastMessageAt: new Date(),
      })
      .where(eq(widgetConversations.id, sessionId));
  }

  // ─── API Keys ────────────────────────────────────────────────────────────────
  async getApiKeys(organizationId: number): Promise<Omit<ApiKey, "keyHash">[]> {
    const keys = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.isActive, true)))
      .orderBy(desc(apiKeys.createdAt));
    return keys.map(({ keyHash: _kh, ...rest }) => rest);
  }

  async createApiKey(organizationId: number, createdById: number, name: string, expiresAt?: Date): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = `afp_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);
    const [apiKey] = await db.insert(apiKeys).values({
      keyId: uuidv4(), name, keyHash, keyPrefix, organizationId, createdById,
      expiresAt: expiresAt || null, isActive: true,
    }).returning();
    return { apiKey, rawKey };
  }

  async revokeApiKey(id: number, organizationId: number): Promise<boolean> {
    const r = await db.update(apiKeys).set({ isActive: false })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Dashboard stats ─────────────────────────────────────────────────────────
  async getDashboardStats(organizationId: number) {
    const [agentRows, org] = await Promise.all([
      db.select().from(agents).where(eq(agents.organizationId, organizationId)),
      this.getOrganization(organizationId),
    ]);
    const totalAgents = agentRows.length;
    const activeAgents = agentRows.filter(a => a.status === "active").length;
    const totalMessages = agentRows.reduce((s, a) => s + (a.totalMessages || 0), 0);
    return {
      totalAgents,
      activeAgents,
      totalMessages,
      messagesThisPeriod: org?.messagesThisPeriod ?? 0,
      maxMonthlyMessages: org?.maxMonthlyMessages ?? 100,
      plan: org?.plan ?? "free",
      usagePercent: org ? Math.round(((org.messagesThisPeriod || 0) / (org.maxMonthlyMessages || 100)) * 100) : 0,
    };
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────
  async getAdminStats() {
    const [allOrgs, allAgents] = await Promise.all([
      db.select().from(organizations),
      db.select().from(agents),
    ]);
    return {
      totalOrganizations: allOrgs.length,
      activeOrganizations: allOrgs.filter(o => !o.isSuspended).length,
      totalAgents: allAgents.length,
      activeAgents: allAgents.filter(a => a.status === "active").length,
      planBreakdown: {
        free: allOrgs.filter(o => o.plan === "free").length,
        starter: allOrgs.filter(o => o.plan === "starter").length,
        professional: allOrgs.filter(o => o.plan === "professional").length,
        enterprise: allOrgs.filter(o => o.plan === "enterprise").length,
      },
      totalMessages: allOrgs.reduce((s, o) => s + (o.messagesThisPeriod || 0), 0),
    };
  }

  async getAllOrgsWithUsers() {
    const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    const result = await Promise.all(orgs.map(async (org) => {
      const orgUsers = await db.select({
        id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, createdAt: users.createdAt,
      }).from(users).where(eq(users.organizationId, org.id));
      const agentCount = await db.select({ count: sql<number>`count(*)` }).from(agents).where(eq(agents.organizationId, org.id));
      return { ...org, users: orgUsers, agentCount: Number(agentCount[0]?.count || 0) };
    }));
    return result;
  }

  // ─── Audit log ───────────────────────────────────────────────────────────────
  async createAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
    await db.insert(auditLogs).values(entry);
  }

  // ─── Marketing ───────────────────────────────────────────────────────────────
  async createLead(data: InsertLead): Promise<Lead> {
    const [l] = await db.insert(leads).values(data).returning();
    return l;
  }

  async createNewsletterSubscriber(data: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const [s] = await db.insert(newsletterSubscribers).values(data).returning();
    return s;
  }

  async createContactSubmission(data: InsertContactSubmission): Promise<ContactSubmission> {
    const [c] = await db.insert(contactSubmissions).values(data).returning();
    return c;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }
}

export const storage = new DatabaseStorage();
