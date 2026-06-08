import { db } from "./db";
import { eq, like, desc, and, not } from "drizzle-orm";
import {
  cosTasks, cosEvents, cosFinanceItems, cosHealthNotes, cosDailyBriefings,
  type CosTask, type InsertCosTask,
  type CosEvent, type InsertCosEvent,
  type CosFinanceItem, type InsertCosFinanceItem,
  type CosHealthNote, type InsertCosHealthNote,
  type CosDailyBriefing, type InsertCosDailyBriefing,
} from "@shared/schema";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createCosTask(task: InsertCosTask): Promise<CosTask> {
  const [row] = await db.insert(cosTasks).values(task).returning();
  return row;
}

export async function getOpenCosTasks(): Promise<CosTask[]> {
  return db.select().from(cosTasks)
    .where(not(eq(cosTasks.status, "done")))
    .orderBy(desc(cosTasks.createdAt));
}

export async function getAllCosTasks(): Promise<CosTask[]> {
  return db.select().from(cosTasks).orderBy(desc(cosTasks.createdAt));
}

export async function updateCosTaskStatus(id: number, status: string): Promise<CosTask> {
  const [row] = await db.update(cosTasks)
    .set({ status })
    .where(eq(cosTasks.id, id))
    .returning();
  return row;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function createCosEvent(event: InsertCosEvent): Promise<CosEvent> {
  const [row] = await db.insert(cosEvents).values(event).returning();
  return row;
}

export async function getTodayCosEvents(): Promise<CosEvent[]> {
  const today = todayStr();
  return db.select().from(cosEvents)
    .where(like(cosEvents.startTime, `${today}%`));
}

export async function getUpcomingCosEvents(days = 7): Promise<CosEvent[]> {
  const today = todayStr();
  return db.select().from(cosEvents)
    .where(and(
      like(cosEvents.startTime, `%T%`),
      // simple: return all future events up to N days ahead
    ))
    .orderBy(cosEvents.startTime)
    .limit(50);
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export async function createCosFinanceItem(item: InsertCosFinanceItem): Promise<CosFinanceItem> {
  const [row] = await db.insert(cosFinanceItems).values(item).returning();
  return row;
}

export async function getRecentCosFinanceItems(days = 30): Promise<CosFinanceItem[]> {
  const since = daysAgoStr(days);
  return db.select().from(cosFinanceItems)
    .orderBy(desc(cosFinanceItems.date))
    .limit(100);
}

export async function getRiskyFinanceItems(): Promise<CosFinanceItem[]> {
  return db.select().from(cosFinanceItems)
    .where(eq(cosFinanceItems.riskFlag, true))
    .orderBy(desc(cosFinanceItems.date));
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function createCosHealthNote(note: InsertCosHealthNote): Promise<CosHealthNote> {
  const [row] = await db.insert(cosHealthNotes).values(note).returning();
  return row;
}

export async function getLatestCosHealthNote(): Promise<CosHealthNote | undefined> {
  const [row] = await db.select().from(cosHealthNotes)
    .orderBy(desc(cosHealthNotes.date))
    .limit(1);
  return row;
}

export async function getWeeklyCosHealthNotes(): Promise<CosHealthNote[]> {
  const since = daysAgoStr(7);
  return db.select().from(cosHealthNotes)
    .orderBy(desc(cosHealthNotes.date))
    .limit(7);
}

// ─── Daily Briefings ─────────────────────────────────────────────────────────

export async function saveDailyBriefing(briefing: InsertCosDailyBriefing): Promise<CosDailyBriefing> {
  const [row] = await db.insert(cosDailyBriefings).values(briefing).returning();
  return row;
}

export async function getTodaysBriefing(): Promise<CosDailyBriefing | undefined> {
  const today = todayStr();
  const [row] = await db.select().from(cosDailyBriefings)
    .where(eq(cosDailyBriefings.briefingDate, today))
    .orderBy(desc(cosDailyBriefings.createdAt))
    .limit(1);
  return row;
}

export async function getRecentBriefings(days = 7): Promise<CosDailyBriefing[]> {
  return db.select().from(cosDailyBriefings)
    .orderBy(desc(cosDailyBriefings.briefingDate))
    .limit(days);
}
