import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, pgEnum, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["super_admin", "owner", "admin", "member", "viewer"]);
export const planEnum = pgEnum("plan", ["free", "starter", "professional", "enterprise"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "inactive", "training", "error"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled", "unpaid"]);
export const widgetStyleEnum = pgEnum("widget_style", ["whatsapp", "messenger", "telegram", "instagram", "custom"]);

// ─── Organizations (multi-tenant) ────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: planEnum("plan").default("free").notNull(),
  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("trialing"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  // Usage limits (set by plan)
  maxAgents: integer("max_agents").default(1).notNull(),
  maxMonthlyMessages: integer("max_monthly_messages").default(100).notNull(),
  // Usage this billing period
  messagesThisPeriod: integer("messages_this_period").default(0).notNull(),
  periodResetAt: timestamp("period_reset_at"),
  // Settings
  isSuspended: boolean("is_suspended").default(false),
  suspendedReason: text("suspended_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password"),  // null for Google OAuth users
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  role: userRoleEnum("role").default("owner").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id),
  emailVerified: boolean("email_verified").default(false),
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Agents ───────────────────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  status: agentStatusEnum("status").default("inactive").notNull(),
  // Business type / template
  businessType: text("business_type").notNull().default("custom"),
  // AI config
  systemPrompt: text("system_prompt"),
  model: text("model").default("claude-sonnet-4-6"),
  temperature: real("temperature").default(0.7),
  maxTokens: integer("max_tokens").default(512),
  // Widget config
  widgetToken: uuid("widget_token").defaultRandom().notNull().unique(),
  widgetStyle: widgetStyleEnum("widget_style").default("whatsapp").notNull(),
  primaryColor: text("primary_color").default("#25D366"),
  position: text("position").default("bottom-right"),
  greetingMessage: text("greeting_message").default("Hi! How can I help you today?"),
  agentDisplayName: text("agent_display_name").default("AI Assistant"),
  // Stats
  totalConversations: integer("total_conversations").default(0),
  totalMessages: integer("total_messages").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Widget Conversations ────────────────────────────────────────────────────
export const widgetConversations = pgTable("widget_conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  sessionId: text("session_id").notNull(),
  messages: jsonb("messages").default([]),
  visitorId: text("visitor_id"),
  startedAt: timestamp("started_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

// ─── API Keys ─────────────────────────────────────────────────────────────────
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
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Audit Log ───────────────────────────────────────────────────────────────
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

// ─── Marketing ───────────────────────────────────────────────────────────────
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

// ─── Plan definitions (static) ────────────────────────────────────────────────
export const PLANS = {
  free: { name: "Free", price: 0, maxAgents: 1, maxMonthlyMessages: 100, stripePriceId: null },
  starter: { name: "Starter", price: 49, maxAgents: 3, maxMonthlyMessages: 2000, stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null },
  professional: { name: "Professional", price: 149, maxAgents: 10, maxMonthlyMessages: 15000, stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null },
  enterprise: { name: "Enterprise", price: null, maxAgents: 999, maxMonthlyMessages: 999999, stripePriceId: null },
} as const;

// ─── Business type templates ──────────────────────────────────────────────────
export const BUSINESS_TEMPLATES = [
  {
    id: "ecommerce",
    label: "E-Commerce / Retail",
    description: "Product help, order tracking, returns",
    prompt: `You are a helpful customer service agent for an e-commerce store. Your role is to:
- Help customers find products and answer product questions
- Assist with order status, tracking, and delivery inquiries
- Handle return and refund requests professionally
- Recommend products based on customer needs
- Escalate complex issues politely

Always be friendly, concise, and solution-oriented. If you cannot resolve an issue, offer to connect the customer with a human agent.`,
    greetingMessage: "Hi! Welcome to our store. How can I help you today? 🛍️",
    primaryColor: "#6366f1",
  },
  {
    id: "restaurant",
    label: "Restaurant / Food",
    description: "Reservations, menu, orders",
    prompt: `You are a friendly assistant for a restaurant. Your role is to:
- Answer questions about the menu, ingredients, and dietary options
- Help customers make reservations and manage bookings
- Handle takeaway and delivery order inquiries
- Share information about opening hours, location, and specials
- Handle complaints with empathy and offer solutions

Be warm, welcoming, and reflect the restaurant's hospitality.`,
    greetingMessage: "Welcome! 🍽️ How can I help you today? Looking to make a reservation or have questions about our menu?",
    primaryColor: "#ef4444",
  },
  {
    id: "healthcare",
    label: "Healthcare / Medical",
    description: "Appointments, FAQs, clinic info",
    prompt: `You are a patient support assistant for a healthcare clinic. Your role is to:
- Help patients book, reschedule, or cancel appointments
- Answer general questions about services and departments
- Provide information about clinic hours, location, and contact details
- Guide patients on what to bring or prepare for appointments
- Handle insurance and billing inquiries at a general level

IMPORTANT: Never provide medical diagnoses or treatment advice. Always recommend patients speak with a healthcare professional for medical concerns.`,
    greetingMessage: "Hello! How can I assist you today? I can help with appointments, clinic information, and general inquiries. 🏥",
    primaryColor: "#0ea5e9",
  },
  {
    id: "realestate",
    label: "Real Estate",
    description: "Property listings, viewings, inquiries",
    prompt: `You are a professional real estate assistant. Your role is to:
- Help clients find properties matching their requirements
- Schedule property viewings and follow-ups
- Answer questions about the buying, selling, or renting process
- Provide general information about neighborhoods and market conditions
- Collect client requirements and connect them with the right agent

Be professional, knowledgeable, and help clients feel confident in their real estate journey.`,
    greetingMessage: "Hi there! Looking to buy, sell, or rent? I'm here to help you find your perfect property. 🏠",
    primaryColor: "#f59e0b",
  },
  {
    id: "saas",
    label: "SaaS / Tech Product",
    description: "Onboarding, support, features",
    prompt: `You are a product support specialist for a software company. Your role is to:
- Help users get started with the product and complete onboarding
- Troubleshoot technical issues and guide users step-by-step
- Explain features, pricing, and subscription options
- Handle bug reports and escalate to the technical team when needed
- Collect feedback and feature requests

Be technical but accessible. Provide clear, step-by-step guidance and links to documentation when helpful.`,
    greetingMessage: "Hey! 👋 Need help with your account or have a question about the product? I'm here!",
    primaryColor: "#8b5cf6",
  },
  {
    id: "education",
    label: "Education / Coaching",
    description: "Course info, enrollment, support",
    prompt: `You are a student support assistant for an educational institution or coaching service. Your role is to:
- Provide information about courses, programs, and schedules
- Help prospective students with enrollment and application questions
- Support current students with administrative inquiries
- Share information about fees, scholarships, and payment plans
- Answer FAQs about instructors, curriculum, and outcomes

Be encouraging, informative, and supportive of learners at every stage.`,
    greetingMessage: "Welcome! 📚 Ready to start your learning journey? How can I help you today?",
    primaryColor: "#10b981",
  },
  {
    id: "legal",
    label: "Legal / Professional Services",
    description: "Consultations, case intake, FAQs",
    prompt: `You are a client intake assistant for a law firm or professional services firm. Your role is to:
- Collect basic information about client inquiries and matters
- Schedule consultations with the appropriate attorney or professional
- Answer general questions about the firm's practice areas and services
- Provide information about fees and the consultation process
- Handle intake forms and document collection

IMPORTANT: Never provide specific legal advice. Always make clear that responses are general information only and clients should consult with a qualified professional for their specific situation.`,
    greetingMessage: "Hello! How can I assist you today? I can help schedule a consultation or answer general questions about our services. ⚖️",
    primaryColor: "#1e40af",
  },
  {
    id: "custom",
    label: "Custom / Other",
    description: "Write your own prompt",
    prompt: `You are a helpful AI assistant. Be friendly, concise, and helpful in answering customer questions. Always be polite and professional. If you cannot answer a question, offer to connect the customer with a human representative.`,
    greetingMessage: "Hi! How can I help you today?",
    primaryColor: "#6b7280",
  },
] as const;

// ─── Zod schemas ─────────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
  firstName: true,
  lastName: true,
}).extend({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const insertAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  businessType: z.string().default("custom"),
  systemPrompt: z.string().optional(),
  widgetStyle: z.enum(["whatsapp", "messenger", "telegram", "instagram", "custom"]).default("whatsapp"),
  primaryColor: z.string().optional(),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
  greetingMessage: z.string().optional(),
  agentDisplayName: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(100).max(2048).optional(),
});

export const updateAgentSchema = insertAgentSchema.partial();

export const insertApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true, subscribed: true });
export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({ id: true, createdAt: true, status: true });

// ─── Types ───────────────────────────────────────────────────────────────────
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type WidgetConversation = typeof widgetConversations.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;
