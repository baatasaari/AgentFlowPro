import Anthropic from "@anthropic-ai/sdk";
import type { CosTask, CosEvent, CosFinanceItem, CosHealthNote } from "@shared/schema";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Vijay's Personal Chief of Staff.
Your job is to reduce mental load, protect family priorities, protect financial security, and prevent missed commitments.
You must be blunt, practical, and concise.
Always prioritise:
1. Financial risk
2. Family commitments
3. Health and energy
4. Time-sensitive actions
5. Long-term goals
Do not produce motivational fluff.
Do not create long lists.
Give the top 3 actions unless there is a genuine emergency.
For every recommendation, explain the reason in one sentence.
Always respond with valid JSON only — no markdown, no explanation outside the JSON.`;

export interface BriefingContext {
  tasks: CosTask[];
  events: CosEvent[];
  finance: CosFinanceItem[];
  health: CosHealthNote | null;
  date: string;
}

export interface BriefingPriority {
  rank: number;
  action: string;
  reason: string;
}

export interface BriefingRisk {
  type: "finance" | "family" | "health" | "work";
  description: string;
  urgency: "high" | "medium" | "low";
}

export interface GeneratedBriefing {
  greeting: string;
  topPriorities: BriefingPriority[];
  risks: BriefingRisk[];
  calendarAlert: string | null;
  moneyWarning: string | null;
  healthNudge: string | null;
  summary: string;
}

export async function generateDailyBriefing(ctx: BriefingContext): Promise<GeneratedBriefing> {
  const openTasks = ctx.tasks.filter(t => t.status === "open");
  const highPriority = openTasks.filter(t => t.priority === "high");
  const dueSoon = openTasks.filter(t => t.dueDate && t.dueDate <= ctx.date);
  const riskFinance = ctx.finance.filter(f => f.riskFlag);

  const userMessage = `Today is ${ctx.date}.

OPEN TASKS (${openTasks.length} total, ${highPriority.length} high priority):
${openTasks.slice(0, 10).map(t =>
  `- [${t.priority.toUpperCase()}] ${t.title} | Category: ${t.category}${t.dueDate ? ` | Due: ${t.dueDate}` : ""}${t.notes ? ` | Note: ${t.notes}` : ""}`
).join("\n") || "None"}

TODAY'S EVENTS (${ctx.events.length}):
${ctx.events.map(e =>
  `- ${e.startTime}: ${e.title}${e.location ? ` @ ${e.location}` : ""} [${e.importance}]`
).join("\n") || "None"}

RECENT FINANCE ITEMS:
${ctx.finance.slice(0, 10).map(f =>
  `- ${f.date}: ${f.merchant} £${f.amount} | ${f.category || "uncategorised"}${f.riskFlag ? " ⚠️ RISK" : ""}${f.notes ? ` | ${f.notes}` : ""}`
).join("\n") || "None"}

LATEST HEALTH DATA:
${ctx.health
  ? `Sleep: ${ctx.health.sleepHours || "?"}h | Steps: ${ctx.health.steps || "?"}${ctx.health.caffeineCount !== null ? ` | Caffeine: ${ctx.health.caffeineCount}` : ""}${ctx.health.notes ? ` | Notes: ${ctx.health.notes}` : ""}`
  : "No health data logged"}

Return ONLY this JSON (no markdown, no extra text):
{
  "greeting": "Good morning, Vijay",
  "topPriorities": [
    {"rank": 1, "action": "...", "reason": "..."},
    {"rank": 2, "action": "...", "reason": "..."},
    {"rank": 3, "action": "...", "reason": "..."}
  ],
  "risks": [
    {"type": "finance|family|health|work", "description": "...", "urgency": "high|medium|low"}
  ],
  "calendarAlert": "..." or null,
  "moneyWarning": "..." or null,
  "healthNudge": "..." or null,
  "summary": "One sentence summary of today's key focus"
}`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from AI");

  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  return JSON.parse(jsonMatch[0]) as GeneratedBriefing;
}
