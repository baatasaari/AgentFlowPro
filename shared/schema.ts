import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "member", "viewer"]);
export const planEnum = pgEnum("plan", ["starter", "professional", "enterprise", "free"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "inactive", "training", "error"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["open", "resolved", "escalated"]);

// Organizations (multi-tenant)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: planEnum("plan").default("free").notNull(),
  maxAgents: integer("max_agents").default(1).notNull(),
  maxMonthlyConversations: integer("max_monthly_conversations").default(1000).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users (enhanced)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").default("member").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API Keys
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyId: uuid("key_id").defaultRandom().notNull().unique(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  permissions: jsonb("permissions").default(["read", "write"]),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Agents
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  status: agentStatusEnum("status").default("inactive").notNull(),
  platform: text("platform").notNull(), // whatsapp, telegram, discord, etc.
  systemPrompt: text("system_prompt"),
  model: text("model").default("claude-sonnet-4-6"),
  temperature: integer("temperature").default(70),
  maxTokens: integer("max_tokens").default(1024),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  config: jsonb("config").default({}),
  totalConversations: integer("total_conversations").default(0),
  totalMessages: integer("total_messages").default(0),
  avgResponseTimeMs: integer("avg_response_time_ms").default(0),
  successRate: integer("success_rate").default(100),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Conversations
export const agentConversations = pgTable("agent_conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  externalUserId: text("external_user_id"),
  platform: text("platform").notNull(),
  status: conversationStatusEnum("status").default("open").notNull(),
  messageCount: integer("message_count").default(0),
  resolved: boolean("resolved").default(false),
  escalatedToHuman: boolean("escalated_to_human").default(false),
  metadata: jsonb("metadata").default({}),
  startedAt: timestamp("started_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Audit Log
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketing tables (existing, kept for compatibility)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  phone: text("phone"),
  planInterest: text("plan_interest"),
  message: text("message"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribed: boolean("subscribed").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").default("new"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
  firstName: true,
  lastName: true,
}).extend({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  slug: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalConversations: true,
  totalMessages: true,
  avgResponseTimeMs: true,
  successRate: true,
}).extend({
  name: z.string().min(1).max(100),
  platform: z.enum(["whatsapp", "telegram", "discord", "facebook", "instagram", "linkedin", "custom"]),
  temperature: z.number().min(0).max(100).optional(),
});

export const insertApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
  permissions: z.array(z.string()).optional(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({
  id: true,
  createdAt: true,
  subscribed: true,
});

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  createdAt: true,
  status: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;
