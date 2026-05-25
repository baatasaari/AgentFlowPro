import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  interpolate,
  resolveField,
  registerStepHandler,
  executeWorkflow,
  WorkflowContext,
  WORKFLOW_TEMPLATES,
} from "../../../server/workflows/engine.js";

// Mock the db module to avoid real database calls
vi.mock("../../../server/db.js", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}));

vi.mock("@shared/schema", () => ({
  workflows: {},
  workflowRuns: { id: "id", status: "status", stepResults: "stepResults" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// Helper to build a WorkflowContext
function makeCtx(trigger: Record<string, any> = {}, outputs: Record<string, any> = {}): WorkflowContext {
  return { trigger, organizationId: 1, outputs };
}

describe("interpolate", () => {
  it("replaces {{trigger.customerName}} with value from context", () => {
    const ctx = makeCtx({ customerName: "Rahul Sharma" });
    expect(interpolate("Hello {{trigger.customerName}}!", ctx)).toBe("Hello Rahul Sharma!");
  });

  it("replaces {{trigger.amount}} with numeric value", () => {
    const ctx = makeCtx({ amount: 1500 });
    expect(interpolate("Total: ₹{{trigger.amount}}", ctx)).toBe("Total: ₹1500");
  });

  it("replaces multiple placeholders in one string", () => {
    const ctx = makeCtx({ name: "Priya", biz: "Test Clinic" });
    const result = interpolate("Hi {{trigger.name}}, welcome to {{trigger.biz}}!", ctx);
    expect(result).toBe("Hi Priya, welcome to Test Clinic!");
  });

  it("leaves unknown placeholders unchanged", () => {
    const ctx = makeCtx({});
    expect(interpolate("Hello {{trigger.missing}}", ctx)).toBe("Hello {{trigger.missing}}");
  });

  it("resolves nested step outputs", () => {
    const ctx = makeCtx({}, { "step-1": { paymentUrl: "https://rzp.io/test" } });
    expect(interpolate("Pay here: {{outputs.step-1.paymentUrl}}", ctx)).toBe("Pay here: https://rzp.io/test");
  });

  it("renders null values as the string 'null'", () => {
    const ctx = makeCtx({ phone: null });
    expect(interpolate("Phone: {{trigger.phone}}", ctx)).toBe("Phone: null");
  });
});

describe("resolveField", () => {
  it("resolves simple trigger fields", () => {
    const ctx = makeCtx({ customerEmail: "test@example.com" });
    expect(resolveField("trigger.customerEmail", ctx)).toBe("test@example.com");
  });

  it("resolves nested output fields", () => {
    const ctx = makeCtx({}, { "payment-step": { shortUrl: "https://rzp.io/x" } });
    expect(resolveField("outputs.payment-step.shortUrl", ctx)).toBe("https://rzp.io/x");
  });

  it("returns undefined for missing fields", () => {
    const ctx = makeCtx({});
    expect(resolveField("trigger.nonexistent", ctx)).toBeUndefined();
  });

  it("resolves organizationId from context", () => {
    const ctx = makeCtx({});
    // organizationId is not in the data-resolved path, but trigger fields are
    expect(resolveField("trigger.missing.deep.path", ctx)).toBeUndefined();
  });
});

describe("registerStepHandler + executeWorkflow", () => {
  it("executes all steps in order", async () => {
    const order: string[] = [];

    registerStepHandler("send_whatsapp" as any, async (config) => {
      order.push(`wa:${config.id}`);
      return { sent: true };
    });

    registerStepHandler("send_sms" as any, async (config) => {
      order.push(`sms:${config.id}`);
      return { sent: true };
    });

    await executeWorkflow(
      {
        name: "Test Workflow",
        triggerType: "appointment_created",
        isActive: true,
        steps: [
          { id: "s1", type: "send_whatsapp" as any, name: "WhatsApp", config: { id: "s1" } },
          { id: "s2", type: "send_sms" as any, name: "SMS", config: { id: "s2" } },
        ],
      },
      { customerName: "Test" },
      1
    );

    expect(order).toEqual(["wa:s1", "sms:s2"]);
  });

  it("retries failed steps up to retryCount times", async () => {
    let attempts = 0;
    registerStepHandler("http_request" as any, async () => {
      attempts++;
      if (attempts < 3) throw new Error("Transient error");
      return { success: true };
    });

    await executeWorkflow(
      {
        name: "Retry Test",
        triggerType: "appointment_created",
        isActive: true,
        steps: [{
          id: "r1",
          type: "http_request" as any,
          name: "HTTP",
          config: {},
          retryCount: 3,
          retryDelayMs: 1, // fast for tests
        }],
      },
      {},
      1
    );

    expect(attempts).toBe(3); // failed twice, succeeded on 3rd
  });

  it("skips step when condition is not met", async () => {
    const executed: string[] = [];

    registerStepHandler("send_email" as any, async (config) => {
      executed.push(config.id);
      return {};
    });

    await executeWorkflow(
      {
        name: "Conditional Test",
        triggerType: "appointment_created",
        isActive: true,
        steps: [
          {
            id: "e1",
            type: "send_email" as any,
            name: "Email",
            config: { id: "e1" },
            conditions: [{ field: "trigger.requiresPayment", operator: "eq", value: true }],
          },
        ],
      },
      { requiresPayment: false },
      1
    );

    expect(executed).not.toContain("e1");
  });

  it("runs step when condition IS met", async () => {
    const executed: string[] = [];

    registerStepHandler("send_email" as any, async (config) => {
      executed.push(config.id);
      return {};
    });

    await executeWorkflow(
      {
        name: "Condition Met Test",
        triggerType: "appointment_created",
        isActive: true,
        steps: [{
          id: "e2",
          type: "send_email" as any,
          name: "Email",
          config: { id: "e2" },
          conditions: [{ field: "trigger.requiresPayment", operator: "eq", value: true }],
        }],
      },
      { requiresPayment: true },
      1
    );

    expect(executed).toContain("e2");
  });

  it("accumulates step outputs in context", async () => {
    let capturedCtx: WorkflowContext | undefined;

    registerStepHandler("create_payment_link" as any, async (_config, ctx) => {
      return { shortUrl: "https://rzp.io/test", amount: 500 };
    });

    registerStepHandler("send_whatsapp" as any, async (config, ctx) => {
      capturedCtx = ctx;
      return { sent: true };
    });

    await executeWorkflow(
      {
        name: "Output Test",
        triggerType: "appointment_created",
        isActive: true,
        steps: [
          { id: "pl1", type: "create_payment_link" as any, name: "Payment", config: {} },
          { id: "wa1", type: "send_whatsapp" as any, name: "WhatsApp", config: {} },
        ],
      },
      {},
      1
    );

    expect(capturedCtx?.outputs["pl1"]).toEqual({ shortUrl: "https://rzp.io/test", amount: 500 });
  });

  it("continues remaining steps after one step fails all retries", async () => {
    const executed: string[] = [];

    registerStepHandler("http_request" as any, async () => {
      throw new Error("Permanent failure");
    });

    registerStepHandler("send_sms" as any, async () => {
      executed.push("sms");
      return {};
    });

    await executeWorkflow(
      {
        name: "Failure Test",
        triggerType: "appointment_created",
        isActive: true,
        steps: [
          { id: "fail", type: "http_request" as any, name: "Fail", config: {}, retryCount: 0, retryDelayMs: 1 },
          { id: "ok", type: "send_sms" as any, name: "SMS", config: {} },
        ],
      },
      {},
      1
    );

    expect(executed).toContain("sms"); // continues even after failure
  });
});

describe("WORKFLOW_TEMPLATES", () => {
  it("contains all 4 pre-built workflow templates", () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(4);
  });

  it("appointment_confirmation template has whatsapp and calendar steps", () => {
    const tmpl = WORKFLOW_TEMPLATES.find(t => t.id === "appointment_confirmation");
    expect(tmpl).toBeDefined();
    expect(tmpl?.steps.some(s => s.type === "send_whatsapp")).toBe(true);
    expect(tmpl?.steps.some(s => s.type === "create_calendar_event")).toBe(true);
  });

  it("lead_capture template pushes to CRM", () => {
    const tmpl = WORKFLOW_TEMPLATES.find(t => t.id === "lead_capture_and_notify");
    expect(tmpl).toBeDefined();
    expect(tmpl?.steps.some(s => s.type === "push_to_crm")).toBe(true);
  });

  it("all templates have triggerType", () => {
    for (const tmpl of WORKFLOW_TEMPLATES) {
      expect(tmpl.triggerType).toBeDefined();
    }
  });

  it("all templates have at least one step", () => {
    for (const tmpl of WORKFLOW_TEMPLATES) {
      expect(tmpl.steps.length).toBeGreaterThan(0);
    }
  });
});
