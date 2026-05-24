import {
  users, leads, newsletterSubscribers, contactSubmissions,
  agents, apiKeys, agentConversations, auditLogs, organizations,
  type User, type InsertUser, type Lead, type InsertLead,
  type NewsletterSubscriber, type InsertNewsletterSubscriber,
  type ContactSubmission, type InsertContactSubmission,
  type Agent, type InsertAgent, type ApiKey,
  type Organization, type AuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;

  // Organizations
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;

  // Agents
  getAgents(organizationId: number): Promise<Agent[]>;
  getAgent(id: number, organizationId: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, organizationId: number, data: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: number, organizationId: number): Promise<boolean>;

  // API Keys
  getApiKeys(organizationId: number): Promise<Omit<ApiKey, "keyHash">[]>;
  createApiKey(organizationId: number, createdById: number, name: string, expiresAt?: Date): Promise<{ apiKey: ApiKey; rawKey: string }>;
  revokeApiKey(id: number, organizationId: number): Promise<boolean>;
  validateApiKey(rawKey: string): Promise<ApiKey | undefined>;

  // Dashboard stats
  getDashboardStats(organizationId: number): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    openConversations: number;
    totalMessages: number;
    successRate: number;
    conversationsLast7Days: { date: string; count: number }[];
  }>;

  // Audit log
  createAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void>;

  // Marketing
  createLead(lead: InsertLead): Promise<Lead>;
  createNewsletterSubscriber(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber>;
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  getLeads(): Promise<Lead[]>;
  getContactSubmissions(): Promise<ContactSubmission[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org;
  }

  async getAgents(organizationId: number): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.organizationId, organizationId)).orderBy(desc(agents.createdAt));
  }

  async getAgent(id: number, organizationId: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, id), eq(agents.organizationId, organizationId))
    );
    return agent;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [newAgent] = await db.insert(agents).values(agent as any).returning();
    return newAgent;
  }

  async updateAgent(id: number, organizationId: number, data: Partial<Agent>): Promise<Agent | undefined> {
    const [updated] = await db.update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteAgent(id: number, organizationId: number): Promise<boolean> {
    const result = await db.delete(agents).where(
      and(eq(agents.id, id), eq(agents.organizationId, organizationId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getApiKeys(organizationId: number): Promise<Omit<ApiKey, "keyHash">[]> {
    const keys = await db.select().from(apiKeys).where(
      and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.isActive, true))
    ).orderBy(desc(apiKeys.createdAt));
    return keys.map(({ keyHash: _kh, ...rest }) => rest);
  }

  async createApiKey(organizationId: number, createdById: number, name: string, expiresAt?: Date): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = `afp_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);

    const [apiKey] = await db.insert(apiKeys).values({
      keyId: uuidv4(),
      name,
      keyHash,
      keyPrefix,
      organizationId,
      createdById,
      expiresAt: expiresAt || null,
      isActive: true,
    }).returning();

    return { apiKey, rawKey };
  }

  async revokeApiKey(id: number, organizationId: number): Promise<boolean> {
    const result = await db.update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId)));
    return (result.rowCount ?? 0) > 0;
  }

  async validateApiKey(rawKey: string): Promise<ApiKey | undefined> {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const [key] = await db.select().from(apiKeys).where(
      and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true))
    );
    if (key) {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
    }
    return key;
  }

  async getDashboardStats(organizationId: number) {
    const [agentRows, conversationRows] = await Promise.all([
      db.select().from(agents).where(eq(agents.organizationId, organizationId)),
      db.select().from(agentConversations).where(eq(agentConversations.organizationId, organizationId)),
    ]);

    const totalAgents = agentRows.length;
    const activeAgents = agentRows.filter(a => a.status === "active").length;
    const totalConversations = conversationRows.length;
    const openConversations = conversationRows.filter(c => c.status === "open").length;
    const totalMessages = agentRows.reduce((sum, a) => sum + (a.totalMessages || 0), 0);
    const avgSuccessRate = agentRows.length > 0
      ? Math.round(agentRows.reduce((sum, a) => sum + (a.successRate || 100), 0) / agentRows.length)
      : 100;

    // Last 7 days conversation counts
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = conversationRows.filter(c => c.startedAt && c.startedAt > sevenDaysAgo);
    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const conv of recent) {
      const day = conv.startedAt!.toISOString().slice(0, 10);
      if (day in byDay) byDay[day]++;
    }

    return {
      totalAgents,
      activeAgents,
      totalConversations,
      openConversations,
      totalMessages,
      successRate: avgSuccessRate,
      conversationsLast7Days: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    };
  }

  async createAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
    await db.insert(auditLogs).values(entry);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async createNewsletterSubscriber(insertSubscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const [subscriber] = await db.insert(newsletterSubscribers).values(insertSubscriber).returning();
    return subscriber;
  }

  async createContactSubmission(insertSubmission: InsertContactSubmission): Promise<ContactSubmission> {
    const [submission] = await db.insert(contactSubmissions).values(insertSubmission).returning();
    return submission;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }
}

export const storage = new DatabaseStorage();
