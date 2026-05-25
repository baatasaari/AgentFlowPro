import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendTemplateMessage,
  sendTextMessage,
  sendAppointmentConfirmationWA,
  sendAppointmentReminderWA,
  sendLeadNotificationWA,
  sendPaymentRequestWA,
  verifyMetaWebhook,
  parseWebhookPayload,
} from "../../../server/plugins/whatsapp.js";

const MOCK_CONFIG = {
  phoneNumberId: "123456789",
  accessToken: "test_access_token",
  businessAccountId: "987654321",
  verifyToken: "my_verify_token",
};

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: "wamid.test123" }] }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendTemplateMessage", () => {
  it("calls Meta API with correct endpoint", async () => {
    await sendTemplateMessage(MOCK_CONFIG, {
      to: "+919876543210",
      templateName: "appointment_confirmation",
      languageCode: "en",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("123456789/messages"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes Authorization header with Bearer token", async () => {
    await sendTemplateMessage(MOCK_CONFIG, {
      to: "9876543210",
      templateName: "test_template",
      languageCode: "hi",
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test_access_token");
  });

  it("normalizes phone number by stripping +", async () => {
    await sendTemplateMessage(MOCK_CONFIG, {
      to: "+91 98765 43210",
      templateName: "test",
      languageCode: "en",
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.to).toBe("919876543210"); // no +, no spaces
  });

  it("sets messaging_product to whatsapp", async () => {
    await sendTemplateMessage(MOCK_CONFIG, { to: "9876543210", templateName: "t", languageCode: "en" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messaging_product).toBe("whatsapp");
  });

  it("maps Hindi language code to Meta format", async () => {
    await sendTemplateMessage(MOCK_CONFIG, { to: "9876543210", templateName: "t", languageCode: "hi" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template.language.code).toBe("hi");
  });

  it("maps English language code to en_US", async () => {
    await sendTemplateMessage(MOCK_CONFIG, { to: "9876543210", templateName: "t", languageCode: "en" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template.language.code).toBe("en_US");
  });

  it("returns messageId on success", async () => {
    const result = await sendTemplateMessage(MOCK_CONFIG, { to: "9876543210", templateName: "t", languageCode: "en" });
    expect(result.messageId).toBe("wamid.test123");
    expect(result.status).toBe("sent");
  });

  it("returns failed status on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    const result = await sendTemplateMessage(MOCK_CONFIG, { to: "9876543210", templateName: "t", languageCode: "en" });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Invalid token");
  });

  it("returns failed status on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    const result = await sendTemplateMessage(MOCK_CONFIG, { to: "9876543210", templateName: "t", languageCode: "en" });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Network failure");
  });
});

describe("sendTextMessage", () => {
  it("sends a text type message", async () => {
    await sendTextMessage(MOCK_CONFIG, { to: "9876543210", body: "Hello!" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("Hello!");
  });

  it("includes preview_url flag", async () => {
    await sendTextMessage(MOCK_CONFIG, { to: "9876543210", body: "Check https://example.com", previewUrl: true });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text.preview_url).toBe(true);
  });
});

describe("sendAppointmentConfirmationWA", () => {
  it("sends with appointment_confirmation template", async () => {
    await sendAppointmentConfirmationWA(MOCK_CONFIG, {
      to: "+919876543210",
      customerName: "Rahul Sharma",
      businessName: "Dr Sharma Clinic",
      serviceName: "General Checkup",
      dateTime: "Monday, May 25, 2026 at 10:00 AM IST",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template.name).toBe("appointment_confirmation");
  });

  it("passes customer name as template parameter", async () => {
    await sendAppointmentConfirmationWA(MOCK_CONFIG, {
      to: "+919876543210",
      customerName: "Priya Patel",
      businessName: "Test",
      serviceName: "Test Service",
      dateTime: "2026-05-25",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const bodyComp = body.template.components.find((c: any) => c.type === "body");
    const params = bodyComp?.parameters.map((p: any) => p.text);
    expect(params).toContain("Priya Patel");
  });
});

describe("sendLeadNotificationWA", () => {
  it("sends text message (not template) to owner", async () => {
    await sendLeadNotificationWA(MOCK_CONFIG, {
      ownerPhone: "+919999999999",
      leadName: "New Customer",
      leadPhone: "+919876543210",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe("text");
    expect(body.text.body).toContain("New Customer");
  });
});

describe("sendPaymentRequestWA", () => {
  it("includes amount formatted in INR", async () => {
    await sendPaymentRequestWA(MOCK_CONFIG, {
      to: "+919876543210",
      customerName: "Amit Kumar",
      amount: 1500,
      upiLink: "upi://pay?pa=clinic@upi&am=1500",
      description: "Cardiology consultation",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text.body).toContain("1,500");
    expect(body.text.body).toContain("upi://pay");
  });
});

describe("verifyMetaWebhook", () => {
  it("returns challenge on valid subscribe request", () => {
    const result = verifyMetaWebhook("subscribe", "my_verify_token", "challenge_12345", "my_verify_token");
    expect(result).toBe("challenge_12345");
  });

  it("returns null on wrong token", () => {
    const result = verifyMetaWebhook("subscribe", "wrong_token", "challenge_12345", "my_verify_token");
    expect(result).toBeNull();
  });

  it("returns null on wrong mode", () => {
    const result = verifyMetaWebhook("unsubscribe", "my_verify_token", "challenge_12345", "my_verify_token");
    expect(result).toBeNull();
  });
});

describe("parseWebhookPayload", () => {
  it("extracts text message from Meta webhook format", () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: "919876543210",
              id: "wamid.abc123",
              timestamp: "1716614400",
              type: "text",
              text: { body: "I'd like to book an appointment" },
            }],
          },
        }],
      }],
    };

    const messages = parseWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe("919876543210");
    expect(messages[0].text).toBe("I'd like to book an appointment");
    expect(messages[0].type).toBe("text");
  });

  it("returns empty array for malformed payload", () => {
    expect(parseWebhookPayload({})).toHaveLength(0);
    expect(parseWebhookPayload(null)).toHaveLength(0);
    expect(parseWebhookPayload({ entry: [] })).toHaveLength(0);
  });
});
