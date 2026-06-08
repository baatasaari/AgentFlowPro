/**
 * Chief of Staff agent integration.
 *
 * In development / self-hosted: calls the Python ADK FastAPI service at
 *   AGENT_SERVICE_URL (default http://localhost:8001)
 *
 * In production via Vertex AI Agent Engine: calls the deployed engine via
 *   the streamQuery REST endpoint using Application Default Credentials.
 *   Set AGENT_ENGINE_RESOURCE_NAME to the full resource name returned by deploy.py.
 *
 * Model: Gemini 2.5 Flash Lite via LiteLLM inside the ADK agent.
 */

import type { CosTask, CosEvent, CosFinanceItem, CosHealthNote } from "@shared/schema";

// ─── Shared types (same interface as before — routes are untouched) ────────────

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

// ─── ADK FastAPI service call (local dev / self-hosted) ───────────────────────

async function callAdkService(ctx: BriefingContext): Promise<GeneratedBriefing> {
  const baseUrl = process.env.AGENT_SERVICE_URL ?? "http://localhost:8001";

  const response = await fetch(`${baseUrl}/briefing/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tasks: ctx.tasks,
      events: ctx.events,
      finance: ctx.finance,
      health: ctx.health,
      date: ctx.date,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`ADK service error: ${(err as any).detail ?? response.statusText}`);
  }

  return response.json() as Promise<GeneratedBriefing>;
}

// ─── Vertex AI Agent Engine call (production) ─────────────────────────────────

async function getGcpAccessToken(): Promise<string> {
  // Use Application Default Credentials (workload identity / service account)
  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  const r = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error("GCP metadata service unavailable");
  const data = (await r.json()) as { access_token: string };
  return data.access_token;
}

async function callAgentEngine(
  ctx: BriefingContext,
  resourceName: string
): Promise<GeneratedBriefing> {
  // resource name: projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{ID}
  const [, , project, , location, , , engineId] = resourceName.split("/");
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/${resourceName}:streamQuery`;

  const accessToken = await getGcpAccessToken();

  // Build the same prompt the FastAPI service would pass to the agent
  const message = buildAgentPrompt(ctx);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      class_method: "stream_query",
      input: { message, user_id: "vijay" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent Engine error ${response.status}: ${text.slice(0, 200)}`);
  }

  // streamQuery returns newline-delimited JSON events; collect final text
  const body = await response.text();
  let finalText = "";
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") continue;
    try {
      const event = JSON.parse(trimmed.replace(/^data:\s*/, ""));
      const parts = event?.output?.content?.parts ?? event?.content?.parts ?? [];
      for (const part of parts) {
        if (part?.text) finalText = part.text; // last wins
      }
    } catch {
      // skip non-JSON lines
    }
  }

  if (!finalText) throw new Error("No response content from Agent Engine");

  const match = finalText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse JSON from Agent Engine response");

  return JSON.parse(match[0]) as GeneratedBriefing;
}

// ─── Prompt builder (mirrors agent/main.py — used for Agent Engine path) ──────

function buildAgentPrompt(ctx: BriefingContext): string {
  const openTasks = ctx.tasks.filter(t => t.status === "open");
  const highCount = openTasks.filter(t => t.priority === "high").length;

  const taskLines = openTasks.slice(0, 10).map(t =>
    `- [${t.priority.toUpperCase()}] ${t.title} | ${t.category}` +
    (t.dueDate ? ` | Due: ${t.dueDate}` : "") +
    (t.notes ? ` | ${t.notes}` : "")
  ).join("\n") || "None";

  const eventLines = ctx.events.map(e =>
    `- ${e.startTime}: ${e.title}` +
    (e.location ? ` @ ${e.location}` : "") +
    ` [${e.importance}]`
  ).join("\n") || "None";

  const financeLines = ctx.finance.slice(0, 10).map(f =>
    `- ${f.date}: ${f.merchant} £${f.amount}` +
    (f.category ? ` | ${f.category}` : "") +
    (f.riskFlag ? " ⚠️ RISK" : "") +
    (f.notes ? ` | ${f.notes}` : "")
  ).join("\n") || "None";

  const healthLine = ctx.health
    ? `Sleep: ${ctx.health.sleepHours ?? "?"}h | Steps: ${ctx.health.steps ?? "?"}`
      + (ctx.health.caffeineCount != null ? ` | Caffeine: ${ctx.health.caffeineCount}` : "")
      + (ctx.health.notes ? ` | ${ctx.health.notes}` : "")
    : "No health data logged today";

  return `Today is ${ctx.date}.

OPEN TASKS (${openTasks.length} total, ${highCount} high priority):
${taskLines}

TODAY'S EVENTS (${ctx.events.length}):
${eventLines}

RECENT FINANCE (last 14 days):
${financeLines}

LATEST HEALTH:
${healthLine}

Generate today's Chief of Staff briefing as strict JSON per your instructions.`;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateDailyBriefing(ctx: BriefingContext): Promise<GeneratedBriefing> {
  const engineResource = process.env.AGENT_ENGINE_RESOURCE_NAME;

  if (engineResource) {
    return callAgentEngine(ctx, engineResource);
  }

  return callAdkService(ctx);
}
