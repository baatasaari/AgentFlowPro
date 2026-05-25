import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, pgEnum, real, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["super_admin", "owner", "admin", "member", "viewer"]);
export const planEnum = pgEnum("plan", ["free", "starter", "professional", "enterprise"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "inactive", "training", "error"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled", "unpaid"]);
export const widgetStyleEnum = pgEnum("widget_style", ["whatsapp", "messenger", "telegram", "instagram", "custom"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "cancelled", "completed", "no_show"]);
export const paymentStatusEnum = pgEnum("payment_status", ["none", "pending", "paid", "refunded", "failed"]);
export const knowledgeTypeEnum = pgEnum("knowledge_type", ["faq", "policy", "service_info", "custom"]);

// ─── Organizations ────────────────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: planEnum("plan").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("trialing"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  maxAgents: integer("max_agents").default(1).notNull(),
  maxMonthlyMessages: integer("max_monthly_messages").default(100).notNull(),
  messagesThisPeriod: integer("messages_this_period").default(0).notNull(),
  periodResetAt: timestamp("period_reset_at"),
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
  password: text("password"),
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

// ─── Business Settings ────────────────────────────────────────────────────────
export const businessSettings = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull().unique(),
  // Identity
  businessName: text("business_name"),
  tagline: text("tagline"),
  description: text("description"),
  logoUrl: text("logo_url"),
  website: text("website"),
  // Contact
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  timezone: text("timezone").default("UTC"),
  // Hours (JSON: { mon: {open:"09:00", close:"18:00"}, ... })
  businessHours: jsonb("business_hours").default({}),
  // Booking settings
  requirePaymentToBook: boolean("require_payment_to_book").default(false),
  cancellationPolicyHours: integer("cancellation_policy_hours").default(24),
  bookingAdvanceDays: integer("booking_advance_days").default(30),
  autoConfirmBookings: boolean("auto_confirm_bookings").default(true),
  // Email (SMTP for sending confirmations)
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFrom: text("smtp_from"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Services / Packages ──────────────────────────────────────────────────────
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  price: numeric("price", { precision: 10, scale: 2 }).default("0"),
  currency: text("currency").default("USD"),
  durationMinutes: integer("duration_minutes").default(60),
  bufferMinutes: integer("buffer_minutes").default(0), // time between appointments
  maxCapacity: integer("max_capacity").default(1),
  isActive: boolean("is_active").default(true),
  requiresPayment: boolean("requires_payment").default(false),
  stripePriceId: text("stripe_price_id"),
  imageUrl: text("image_url"),
  tags: jsonb("tags").default([]),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Staff Members ────────────────────────────────────────────────────────────
export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  role: text("role"),
  speciality: text("speciality"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  phone: text("phone"),
  calendarColor: text("calendar_color").default("#6366f1"),
  acceptsOnlineBooking: boolean("accepts_online_booking").default(true),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Staff ↔ Service mapping ──────────────────────────────────────────────────
export const staffServices = pgTable("staff_services", {
  staffId: integer("staff_id").references(() => staffMembers.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
});

// ─── Availability Rules (weekly schedule) ─────────────────────────────────────
export const availabilityRules = pgTable("availability_rules", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").references(() => staffMembers.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun, 1=Mon ... 6=Sat
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(),     // "17:00"
  isActive: boolean("is_active").default(true),
});

// ─── Appointments ─────────────────────────────────────────────────────────────
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  serviceId: integer("service_id").references(() => services.id),
  staffId: integer("staff_id").references(() => staffMembers.id),
  // Customer info
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  customerNotes: text("customer_notes"),
  // Timing
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  timezone: text("timezone").default("UTC"),
  // Status
  status: appointmentStatusEnum("status").default("pending").notNull(),
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at"),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  // Payment
  paymentStatus: paymentStatusEnum("payment_status").default("none").notNull(),
  paymentAmount: numeric("payment_amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  // Email tracking
  confirmationSentAt: timestamp("confirmation_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  // Internal
  internalNotes: text("internal_notes"),
  source: text("source").default("widget"), // widget, manual, api
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Knowledge Base ───────────────────────────────────────────────────────────
export const knowledgeEntries = pgTable("knowledge_entries", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id), // null = org-wide
  type: knowledgeTypeEnum("type").default("faq").notNull(),
  category: text("category"),
  question: text("question"), // for FAQ type
  answer: text("answer").notNull(),
  title: text("title"), // for policy/info types
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
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
  businessType: text("business_type").notNull().default("custom"),
  systemPrompt: text("system_prompt"),
  model: text("model").default("claude-sonnet-4-6"),
  temperature: real("temperature").default(0.7),
  maxTokens: integer("max_tokens").default(512),
  // Widget
  widgetToken: uuid("widget_token").defaultRandom().notNull().unique(),
  widgetStyle: widgetStyleEnum("widget_style").default("whatsapp").notNull(),
  primaryColor: text("primary_color").default("#25D366"),
  position: text("position").default("bottom-right"),
  greetingMessage: text("greeting_message").default("Hi! How can I help you today?"),
  agentDisplayName: text("agent_display_name").default("AI Assistant"),
  // Features enabled per agent
  enableBooking: boolean("enable_booking").default(false),
  enableLeadCapture: boolean("enable_lead_capture").default(true),
  // Stats
  totalConversations: integer("total_conversations").default(0),
  totalMessages: integer("total_messages").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Widget Conversations ─────────────────────────────────────────────────────
export const widgetConversations = pgTable("widget_conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  sessionId: text("session_id").notNull(),
  messages: jsonb("messages").default([]),
  // Lead data collected during conversation
  leadName: text("lead_name"),
  leadEmail: text("lead_email"),
  leadPhone: text("lead_phone"),
  // Metadata
  source: text("source"), // referrer URL
  messageCount: integer("message_count").default(0),
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

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Marketing tables ─────────────────────────────────────────────────────────
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

// ─── Plan definitions ─────────────────────────────────────────────────────────
export const PLANS = {
  free:         { name: "Free",         price: 0,   maxAgents: 1,  maxMonthlyMessages: 100,   stripePriceId: null },
  starter:      { name: "Starter",      price: 49,  maxAgents: 3,  maxMonthlyMessages: 2000,  stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null },
  professional: { name: "Professional", price: 149, maxAgents: 10, maxMonthlyMessages: 15000, stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null },
  enterprise:   { name: "Enterprise",   price: null, maxAgents: 999, maxMonthlyMessages: 999999, stripePriceId: null },
} as const;

// ─── Business templates ───────────────────────────────────────────────────────
export const BUSINESS_TEMPLATES = [
  { id: "healthcare", label: "Healthcare / Medical", description: "Appointments, packages, doctor info", prompt: `You are {agentName}, the AI assistant for {businessName}. You help patients book appointments, answer questions about our services, and provide general information about our clinic.\n\nIMPORTANT: Never provide medical diagnoses or treatment advice. Always recommend speaking with a qualified healthcare professional.\n\nUse the business context provided to answer questions accurately. When a patient wants to book an appointment, use the booking tool.`, greetingMessage: "Hello! How can I assist you today? I can help with appointments, answer questions about our services, and provide clinic information. 🏥", primaryColor: "#0ea5e9" },
  { id: "ecommerce",  label: "E-Commerce / Retail",  description: "Product help, orders, returns",      prompt: `You are {agentName}, a customer service agent for {businessName}. Help customers find products, check order status, handle returns, and answer product questions.\n\nBe friendly, concise, and solution-oriented. Use the business context to answer accurately about our products and pricing.`,                                                                                                                                                                             greetingMessage: "Hi! Welcome to our store. How can I help you today? 🛍️",                                                                                                                                    primaryColor: "#6366f1" },
  { id: "restaurant", label: "Restaurant / Food",    description: "Reservations, menu, orders",         prompt: `You are {agentName}, the assistant for {businessName}. Help guests with menu questions, reservations, and dietary information. Be warm and reflect our hospitality.\n\nUse the business context to accurately describe our menu items, prices, and availability.`,                                                                                                                                                                                                        greetingMessage: "Welcome! 🍽️ How can I help you today?",                                                                                                                                                      primaryColor: "#ef4444" },
  { id: "realestate", label: "Real Estate",          description: "Listings, viewings, inquiries",      prompt: `You are {agentName}, a property consultant for {businessName}. Help clients find properties, schedule viewings, and understand the buying/renting process.\n\nUse the business context to answer questions about our properties and services.`,                                                                                                                                                                                                                          greetingMessage: "Hi there! Looking to buy, sell, or rent? I'm here to help. 🏠",                                                                                                                             primaryColor: "#f59e0b" },
  { id: "saas",       label: "SaaS / Tech Product",  description: "Onboarding, support, features",      prompt: `You are {agentName}, a product support specialist for {businessName}. Help users onboard, troubleshoot issues, and understand features.\n\nUse the business context to provide accurate product information. Provide step-by-step guidance.`,                                                                                                                                                                                                                           greetingMessage: "Hey! 👋 Need help with the product? I'm here!",                                                                                                                                              primaryColor: "#8b5cf6" },
  { id: "education",  label: "Education / Coaching", description: "Courses, enrollment, support",       prompt: `You are {agentName}, a student support assistant for {businessName}. Help with course information, enrollment, scheduling, and general inquiries.\n\nUse the business context to accurately describe our programs, fees, and schedule.`,                                                                                                                                                                                                                               greetingMessage: "Welcome! 📚 How can I help you start your learning journey?",                                                                                                                                primaryColor: "#10b981" },
  { id: "legal",      label: "Legal / Professional", description: "Consultations, intake, FAQs",        prompt: `You are {agentName}, a client intake assistant for {businessName}. Schedule consultations and answer general questions about our services.\n\nIMPORTANT: Never provide legal advice. This assistant provides general information only.\n\nUse the business context to accurately describe our practice areas and services.`,                                                                                                                                             greetingMessage: "Hello! How can I assist you today? I can help schedule a consultation or answer general questions. ⚖️",                                                                                     primaryColor: "#1e40af" },
  { id: "custom",     label: "Custom / Other",       description: "Write your own prompt",              prompt: `You are {agentName}, a helpful AI assistant for {businessName}. Use the business context provided to answer questions accurately and helpfully.\n\nBe friendly, concise, and professional.`,                                                                                                                                                                                                                                                                            greetingMessage: "Hi! How can I help you today?",                                                                                                                                                              primaryColor: "#6b7280" },
] as const;

// ─── Zod schemas ──────────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).pick({ email: true, username: true, password: true, firstName: true, lastName: true }).extend({
  email: z.string().email(),
  password: z.string().min(8).optional(),
});

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

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
  enableBooking: z.boolean().optional(),
  enableLeadCapture: z.boolean().optional(),
});

export const updateAgentSchema = insertAgentSchema.partial().extend({
  status: z.enum(["active", "inactive", "training", "error"]).optional(),
});

export const insertServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.string().or(z.number()).optional(),
  currency: z.string().default("USD"),
  durationMinutes: z.number().min(5).max(480).default(60),
  bufferMinutes: z.number().min(0).max(60).default(0),
  isActive: z.boolean().default(true),
  requiresPayment: z.boolean().default(false),
  sortOrder: z.number().optional(),
});

export const insertStaffSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  speciality: z.string().optional(),
  bio: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  calendarColor: z.string().optional(),
  acceptsOnlineBooking: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().optional(),
});

export const insertAvailabilitySchema = z.object({
  staffId: z.number(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().default(true),
});

export const insertKnowledgeSchema = z.object({
  type: z.enum(["faq", "policy", "service_info", "custom"]).default("faq"),
  category: z.string().optional(),
  question: z.string().optional(),
  answer: z.string().min(1),
  title: z.string().optional(),
  agentId: z.number().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().optional(),
});

export const insertAppointmentSchema = z.object({
  serviceId: z.number().optional(),
  staffId: z.number().optional(),
  agentId: z.number().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  customerNotes: z.string().optional(),
  startsAt: z.string().datetime(),
  timezone: z.string().default("UTC"),
  source: z.string().default("widget"),
});

export const businessSettingsSchema = z.object({
  businessName: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  businessHours: z.record(z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() })).optional(),
  requirePaymentToBook: z.boolean().optional(),
  cancellationPolicyHours: z.number().optional(),
  bookingAdvanceDays: z.number().optional(),
  autoConfirmBookings: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
});

export const insertApiKeySchema = z.object({ name: z.string().min(1).max(100), expiresAt: z.string().datetime().optional() });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true, subscribed: true });
export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({ id: true, createdAt: true, status: true });

// ─── Types ───────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Service = typeof services.$inferSelect;
export type StaffMember = typeof staffMembers.$inferSelect;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type BusinessSettings = typeof businessSettings.$inferSelect;
export type WidgetConversation = typeof widgetConversations.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type InsertKnowledge = z.infer<typeof insertKnowledgeSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
