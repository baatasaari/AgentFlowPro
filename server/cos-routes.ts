import type { Express } from "express";
import { z } from "zod";
import {
  insertCosTaskSchema,
  insertCosEventSchema,
  insertCosFinanceItemSchema,
  insertCosHealthNoteSchema,
} from "@shared/schema";
import {
  createCosTask, getOpenCosTasks, getAllCosTasks, updateCosTaskStatus,
  createCosEvent, getTodayCosEvents,
  createCosFinanceItem, getRecentCosFinanceItems, getRiskyFinanceItems,
  createCosHealthNote, getLatestCosHealthNote, getWeeklyCosHealthNotes,
  saveDailyBriefing, getTodaysBriefing, getRecentBriefings,
} from "./cos-storage";
import { generateDailyBriefing } from "./cos-agent";

export function registerCosRoutes(app: Express) {

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  app.post("/api/cos/tasks", async (req, res) => {
    try {
      const data = insertCosTaskSchema.parse(req.body);
      const task = await createCosTask(data);
      res.json(task);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.get("/api/cos/tasks/open", async (_req, res) => {
    try {
      const tasks = await getOpenCosTasks();
      res.json(tasks);
    } catch {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/cos/tasks", async (_req, res) => {
    try {
      const tasks = await getAllCosTasks();
      res.json(tasks);
    } catch {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.patch("/api/cos/tasks/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const task = await updateCosTaskStatus(id, status);
      res.json(task);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // ─── Events ─────────────────────────────────────────────────────────────────

  app.post("/api/cos/events", async (req, res) => {
    try {
      const data = insertCosEventSchema.parse(req.body);
      const event = await createCosEvent(data);
      res.json(event);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.get("/api/cos/events/today", async (_req, res) => {
    try {
      const events = await getTodayCosEvents();
      res.json(events);
    } catch {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // ─── Finance ────────────────────────────────────────────────────────────────

  app.post("/api/cos/finance", async (req, res) => {
    try {
      const data = insertCosFinanceItemSchema.parse(req.body);
      const item = await createCosFinanceItem(data);
      res.json(item);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Failed to create finance item" });
    }
  });

  app.get("/api/cos/finance", async (req, res) => {
    try {
      const days = parseInt((req.query.days as string) || "30", 10);
      const items = await getRecentCosFinanceItems(days);
      res.json(items);
    } catch {
      res.status(500).json({ error: "Failed to fetch finance items" });
    }
  });

  app.get("/api/cos/finance/risks", async (_req, res) => {
    try {
      const items = await getRiskyFinanceItems();
      res.json(items);
    } catch {
      res.status(500).json({ error: "Failed to fetch risk items" });
    }
  });

  // ─── Health ─────────────────────────────────────────────────────────────────

  app.post("/api/cos/health", async (req, res) => {
    try {
      const data = insertCosHealthNoteSchema.parse(req.body);
      const note = await createCosHealthNote(data);
      res.json(note);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Failed to create health note" });
    }
  });

  app.get("/api/cos/health/latest", async (_req, res) => {
    try {
      const note = await getLatestCosHealthNote();
      res.json(note || null);
    } catch {
      res.status(500).json({ error: "Failed to fetch health data" });
    }
  });

  app.get("/api/cos/health/week", async (_req, res) => {
    try {
      const notes = await getWeeklyCosHealthNotes();
      res.json(notes);
    } catch {
      res.status(500).json({ error: "Failed to fetch weekly health data" });
    }
  });

  // ─── Briefing ────────────────────────────────────────────────────────────────

  app.get("/api/cos/briefing/today", async (_req, res) => {
    try {
      const briefing = await getTodaysBriefing();
      res.json(briefing || null);
    } catch {
      res.status(500).json({ error: "Failed to fetch briefing" });
    }
  });

  app.get("/api/cos/briefing/recent", async (req, res) => {
    try {
      const days = parseInt((req.query.days as string) || "7", 10);
      const briefings = await getRecentBriefings(days);
      res.json(briefings);
    } catch {
      res.status(500).json({ error: "Failed to fetch recent briefings" });
    }
  });

  app.post("/api/cos/briefing/generate", async (_req, res) => {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
      }

      const today = new Date().toISOString().split("T")[0];
      const [tasks, events, finance, health] = await Promise.all([
        getOpenCosTasks(),
        getTodayCosEvents(),
        getRecentCosFinanceItems(14),
        getLatestCosHealthNote(),
      ]);

      const generated = await generateDailyBriefing({ tasks, events, finance, health: health || null, date: today });

      const briefing = await saveDailyBriefing({
        briefingDate: today,
        summary: generated.summary,
        topPriorities: JSON.stringify(generated.topPriorities),
        risks: JSON.stringify(generated.risks),
        rawContext: JSON.stringify({ generated }),
      });

      res.json({ briefing, generated });
    } catch (e: any) {
      console.error("Briefing generation error:", e);
      res.status(500).json({ error: e?.message || "Failed to generate briefing" });
    }
  });

  // ─── Dashboard context (all-in-one fetch for Today view) ────────────────────

  app.get("/api/cos/dashboard", async (_req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [tasks, events, finance, health, briefing] = await Promise.all([
        getOpenCosTasks(),
        getTodayCosEvents(),
        getRecentCosFinanceItems(7),
        getLatestCosHealthNote(),
        getTodaysBriefing(),
      ]);

      res.json({ today, tasks, events, finance, health: health || null, briefing: briefing || null });
    } catch {
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });
}
