// Workflow Engine — event-driven workflow execution for AgentFlowPro
// Runs in-process asynchronously (no Redis/queue required)
// Handles: appointment lifecycle, lead capture, notifications, payments

import { db } from "../db.js";
import { workflowRuns, workflows } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export type TriggerType =
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_completed"
  | "lead_captured"
  | "payment_received"
  | "manual";

export interface WorkflowContext {
  trigger: Record<string, any>;
  organizationId: number;
  runId?: number;
  outputs: Record<string, any>; // step ID → output
}

export type StepType =
  | "send_whatsapp"
  | "send_sms"
  | "send_email"
  | "create_calendar_event"
  | "create_payment_link"
  | "push_to_crm"
  | "delay"
  | "condition"
  | "http_request";

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  config: Record<string, any>;
  conditions?: Array<{ field: string; operator: string; value: any }>;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface WorkflowDefinition {
  id?: number;
  name: string;
  triggerType: TriggerType;
  steps: WorkflowStep[];
  isActive: boolean;
}

// ─── Step executors ────────────────────────────────────────────────────────────

type StepHandler = (config: Record<string, any>, ctx: WorkflowContext) => Promise<Record<string, any>>;

const stepHandlers = new Map<StepType, StepHandler>();

export function registerStepHandler(type: StepType, handler: StepHandler): void {
  stepHandlers.set(type, handler);
}

// ─── Template interpolation ───────────────────────────────────────────────────

/**
 * Resolves {{trigger.customerName}} and {{outputs.stepId.key}} patterns in strings.
 */
export function interpolate(template: string, ctx: WorkflowContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split(".");
    let value: any = { trigger: ctx.trigger, outputs: ctx.outputs };
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return `{{${path}}}`;
    }
    return String(value);
  });
}

/**
 * Resolves a dotted path from context.
 */
export function resolveField(path: string, ctx: WorkflowContext): any {
  const parts = path.split(".");
  let value: any = { trigger: ctx.trigger, outputs: ctx.outputs };
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

// ─── Condition evaluation ──────────────────────────────────────────────────────

function evaluateConditions(
  conditions: WorkflowStep["conditions"],
  ctx: WorkflowContext
): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every(cond => {
    const actual = resolveField(cond.field, ctx);
    switch (cond.operator) {
      case "eq": return actual === cond.value;
      case "neq": return actual !== cond.value;
      case "gt": return Number(actual) > Number(cond.value);
      case "lt": return Number(actual) < Number(cond.value);
      case "contains": return String(actual).includes(String(cond.value));
      case "exists": return actual !== undefined && actual !== null;
      case "not_exists": return actual === undefined || actual === null;
      default: return true;
    }
  });
}

// ─── Step execution ────────────────────────────────────────────────────────────

async function executeStep(step: WorkflowStep, ctx: WorkflowContext): Promise<void> {
  const handler = stepHandlers.get(step.type);
  if (!handler) {
    console.warn(`[Workflow] No handler for step type: ${step.type}`);
    return;
  }

  // Check step conditions
  if (!evaluateConditions(step.conditions, ctx)) {
    console.log(`[Workflow] Step ${step.id} (${step.name}) skipped — conditions not met`);
    return;
  }

  const maxRetries = step.retryCount ?? 2;
  const retryDelay = step.retryDelayMs ?? 3000;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const output = await handler(step.config, ctx);
      ctx.outputs[step.id] = output;

      // Persist step result if we have a run ID
      if (ctx.runId) {
        await persistStepResult(ctx.runId, step.id, "success", output);
      }
      return;
    } catch (e: any) {
      lastError = e;
      console.error(`[Workflow] Step ${step.id} failed (attempt ${attempt + 1}/${maxRetries + 1}):`, e.message);
      if (attempt < maxRetries) {
        await sleep(retryDelay * Math.pow(2, attempt)); // exponential backoff
      }
    }
  }

  // All retries exhausted
  if (ctx.runId) {
    await persistStepResult(ctx.runId, step.id, "failed", undefined, lastError?.message);
  }
  console.error(`[Workflow] Step ${step.id} permanently failed:`, lastError?.message);
}

// ─── Workflow execution ───────────────────────────────────────────────────────

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  trigger: Record<string, any>,
  organizationId: number
): Promise<void> {
  let runId: number | undefined;

  // Create run record if workflow has DB ID
  if (workflow.id) {
    try {
      const [run] = await db.insert(workflowRuns).values({
        workflowId: workflow.id,
        organizationId,
        status: "running",
        triggerPayload: trigger,
        startedAt: new Date(),
      }).returning({ id: workflowRuns.id });
      runId = run.id;
    } catch {
      // Don't fail the workflow if we can't persist the run
    }
  }

  const ctx: WorkflowContext = {
    trigger,
    organizationId,
    runId,
    outputs: {},
  };

  try {
    for (const step of workflow.steps) {
      await executeStep(step, ctx);
    }

    if (runId) {
      await db.update(workflowRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(workflowRuns.id, runId));
    }
  } catch (e: any) {
    if (runId) {
      await db.update(workflowRuns)
        .set({ status: "failed", errorMessage: e.message, completedAt: new Date() })
        .where(eq(workflowRuns.id, runId));
    }
  }
}

// ─── Trigger dispatcher ───────────────────────────────────────────────────────

/**
 * Dispatches a trigger event — finds all active workflows for the org
 * that listen to this trigger and executes them asynchronously.
 */
export async function dispatch(
  triggerType: TriggerType,
  payload: Record<string, any>,
  organizationId: number
): Promise<void> {
  try {
    const activeWorkflows = await db.select()
      .from(workflows)
      .where(and(
        eq(workflows.organizationId, organizationId),
        eq(workflows.status, "active"),
      ));

    const matching = activeWorkflows.filter(w => {
      const trigger = w.trigger as any;
      return trigger?.type === triggerType;
    });

    for (const wf of matching) {
      // Run asynchronously — don't await, so the main request returns immediately
      setImmediate(() => {
        executeWorkflow(
          {
            id: wf.id,
            name: wf.name,
            triggerType,
            steps: (wf.steps as WorkflowStep[]) || [],
            isActive: wf.status === "active",
          },
          payload,
          organizationId
        ).catch(e => console.error(`[Workflow] Dispatch error for workflow ${wf.id}:`, e.message));
      });
    }
  } catch (e: any) {
    console.error("[Workflow] Dispatch failed:", e.message);
  }
}

// ─── Pre-built workflow templates ─────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  steps: WorkflowStep[];
  requiredConnectors: string[];
  category: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "appointment_confirmation",
    name: "Appointment Confirmation",
    description: "Send WhatsApp + SMS confirmation when an appointment is created, then create a calendar event.",
    triggerType: "appointment_created",
    category: "appointments",
    requiredConnectors: ["whatsapp_business"],
    steps: [
      {
        id: "confirm-wa",
        type: "send_whatsapp",
        name: "Send WhatsApp Confirmation",
        config: {
          templateName: "appointment_confirmation",
          recipientField: "trigger.customerPhone",
          components: [
            { type: "body", parameters: [
              { type: "text", valueTemplate: "{{trigger.customerName}}" },
              { type: "text", valueTemplate: "{{trigger.businessName}}" },
              { type: "text", valueTemplate: "{{trigger.serviceName}}" },
              { type: "text", valueTemplate: "{{trigger.startsAt}}" },
            ]},
          ],
        },
      },
      {
        id: "confirm-sms",
        type: "send_sms",
        name: "Send SMS Confirmation (Fallback)",
        conditions: [{ field: "trigger.customerPhone", operator: "exists", value: null }],
        config: {
          bodyTemplate: "Hi {{trigger.customerName}}, your appointment at {{trigger.businessName}} for {{trigger.serviceName}} on {{trigger.startsAt}} is confirmed! -AgentFlowPro",
          recipientField: "trigger.customerPhone",
        },
      },
      {
        id: "calendar-event",
        type: "create_calendar_event",
        name: "Add to Google Calendar",
        config: {
          titleTemplate: "{{trigger.serviceName}} - {{trigger.customerName}}",
          descriptionTemplate: "Customer: {{trigger.customerName}}\nPhone: {{trigger.customerPhone}}\nEmail: {{trigger.customerEmail}}\nNotes: {{trigger.customerNotes}}",
          startsAtField: "trigger.startsAt",
          endsAtField: "trigger.endsAt",
        },
      },
    ],
  },
  {
    id: "appointment_reminder",
    name: "24-Hour Reminder",
    description: "Send a reminder WhatsApp message 24 hours before the appointment.",
    triggerType: "appointment_created",
    category: "appointments",
    requiredConnectors: ["whatsapp_business"],
    steps: [
      {
        id: "delay-24h",
        type: "delay",
        name: "Wait 24h Before Appointment",
        config: {
          relativeToField: "trigger.startsAt",
          relativeOffsetMs: -86400000, // 24h before
        },
      },
      {
        id: "reminder-wa",
        type: "send_whatsapp",
        name: "Send Reminder",
        config: {
          templateName: "appointment_reminder",
          recipientField: "trigger.customerPhone",
          components: [{
            type: "body",
            parameters: [
              { type: "text", valueTemplate: "{{trigger.customerName}}" },
              { type: "text", valueTemplate: "{{trigger.startsAt}}" },
              { type: "text", valueTemplate: "{{trigger.businessName}}" },
            ],
          }],
        },
      },
    ],
  },
  {
    id: "lead_capture_and_notify",
    name: "Lead Capture & Notify Owner",
    description: "When a lead is captured via chat, push to Zoho CRM and notify the business owner via WhatsApp.",
    triggerType: "lead_captured",
    category: "leads",
    requiredConnectors: ["whatsapp_business"],
    steps: [
      {
        id: "push-crm",
        type: "push_to_crm",
        name: "Add to Zoho CRM",
        conditions: [{ field: "trigger.leadEmail", operator: "exists", value: null }],
        config: {
          entityType: "lead",
          fieldMappings: {
            firstName: "trigger.leadName",
            email: "trigger.leadEmail",
            phone: "trigger.leadPhone",
            leadSource: "Website Chat",
            description: "trigger.leadNotes",
          },
        },
      },
      {
        id: "notify-owner",
        type: "send_whatsapp",
        name: "Notify Owner",
        config: {
          recipientField: "trigger.ownerPhone",
          bodyTemplate: "🔔 New lead: {{trigger.leadName}} ({{trigger.leadPhone || trigger.leadEmail}}). Captured via AI chat.",
          useText: true,
        },
      },
    ],
  },
  {
    id: "payment_request",
    name: "Payment Request After Booking",
    description: "Send a Razorpay payment link via WhatsApp when an appointment requires payment.",
    triggerType: "appointment_created",
    category: "payments",
    requiredConnectors: ["razorpay", "whatsapp_business"],
    steps: [
      {
        id: "check-payment",
        type: "condition",
        name: "Requires Payment?",
        config: {
          field: "trigger.requiresPayment",
          operator: "eq",
          value: true,
          onTrue: ["create-link"],
          onFalse: [],
        },
      },
      {
        id: "create-link",
        type: "create_payment_link",
        name: "Create Razorpay Payment Link",
        config: {
          amountField: "trigger.servicePrice",
          currency: "INR",
          descriptionTemplate: "Payment for {{trigger.serviceName}} on {{trigger.startsAt}}",
          customerNameField: "trigger.customerName",
          customerPhoneField: "trigger.customerPhone",
        },
      },
      {
        id: "send-payment-wa",
        type: "send_whatsapp",
        name: "Send Payment Link via WhatsApp",
        conditions: [{ field: "outputs.create-link.shortUrl", operator: "exists", value: null }],
        config: {
          recipientField: "trigger.customerPhone",
          bodyTemplate: "Hi {{trigger.customerName}}, please complete payment of ₹{{trigger.servicePrice}} for your appointment: {{outputs.create-link.shortUrl}}",
          useText: true,
        },
      },
    ],
  },
];

// ─── Persistence helpers ───────────────────────────────────────────────────────

async function persistStepResult(
  runId: number,
  stepId: string,
  status: "success" | "failed",
  output?: any,
  error?: string
): Promise<void> {
  try {
    const run = await db.select({ stepResults: workflowRuns.stepResults })
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .limit(1);

    if (!run[0]) return;

    const results = (run[0].stepResults as any[]) || [];
    results.push({
      stepId,
      status,
      output,
      error,
      completedAt: new Date().toISOString(),
    });

    await db.update(workflowRuns)
      .set({ stepResults: results })
      .where(eq(workflowRuns.id, runId));
  } catch {
    // Non-critical — don't fail workflow for persistence errors
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
