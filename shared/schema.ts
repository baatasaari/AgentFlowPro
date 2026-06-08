import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Chief of Staff tables ────────────────────────────────────────────────────

export const cosTasks = pgTable("cos_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(), // family, finance, health, church, work-personal
  priority: text("priority").notNull().default("medium"), // high, medium, low
  dueDate: text("due_date"),
  status: text("status").notNull().default("open"), // open, done, deferred
  source: text("source").notNull().default("manual"), // manual, email, calendar
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cosEvents = pgTable("cos_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  startTime: text("start_time").notNull(), // ISO: "2025-06-08T09:00"
  endTime: text("end_time"),
  location: text("location"),
  source: text("source").notNull().default("manual"),
  importance: text("importance").notNull().default("normal"), // high, normal, low
  createdAt: timestamp("created_at").defaultNow(),
});

export const cosFinanceItems = pgTable("cos_finance_items", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  merchant: text("merchant").notNull(),
  amount: text("amount").notNull(), // stored as string, e.g. "71.50"
  category: text("category"), // food, subscription, utility, transport, impulse
  riskFlag: boolean("risk_flag").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cosHealthNotes = pgTable("cos_health_notes", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  sleepHours: text("sleep_hours"),
  steps: integer("steps"),
  caffeineCount: integer("caffeine_count"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cosDailyBriefings = pgTable("cos_daily_briefings", {
  id: serial("id").primaryKey(),
  briefingDate: text("briefing_date").notNull(), // YYYY-MM-DD
  summary: text("summary").notNull(),
  topPriorities: text("top_priorities").notNull(), // JSON string
  risks: text("risks").notNull(), // JSON string
  rawContext: text("raw_context"), // JSON string of input data
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  phone: text("phone"),
  planInterest: text("plan_interest"),
  message: text("message"),
  source: text("source").notNull(), // trial, demo, contact, newsletter
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
  status: text("status").default("new"), // new, in_progress, resolved
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;

// ─── Chief of Staff Zod schemas ───────────────────────────────────────────────

export const insertCosTaskSchema = createInsertSchema(cosTasks).omit({ id: true, createdAt: true });
export const insertCosEventSchema = createInsertSchema(cosEvents).omit({ id: true, createdAt: true });
export const insertCosFinanceItemSchema = createInsertSchema(cosFinanceItems).omit({ id: true, createdAt: true });
export const insertCosHealthNoteSchema = createInsertSchema(cosHealthNotes).omit({ id: true, createdAt: true });
export const insertCosDailyBriefingSchema = createInsertSchema(cosDailyBriefings).omit({ id: true, createdAt: true });

export type CosTask = typeof cosTasks.$inferSelect;
export type InsertCosTask = z.infer<typeof insertCosTaskSchema>;
export type CosEvent = typeof cosEvents.$inferSelect;
export type InsertCosEvent = z.infer<typeof insertCosEventSchema>;
export type CosFinanceItem = typeof cosFinanceItems.$inferSelect;
export type InsertCosFinanceItem = z.infer<typeof insertCosFinanceItemSchema>;
export type CosHealthNote = typeof cosHealthNotes.$inferSelect;
export type InsertCosHealthNote = z.infer<typeof insertCosHealthNoteSchema>;
export type CosDailyBriefing = typeof cosDailyBriefings.$inferSelect;
export type InsertCosDailyBriefing = z.infer<typeof insertCosDailyBriefingSchema>;
