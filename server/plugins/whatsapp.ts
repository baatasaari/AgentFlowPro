// WhatsApp Business Cloud API (Meta) plugin
// Critical for India market — WhatsApp has ~500M users in India
// Uses Meta's Cloud API: https://graph.facebook.com/v18.0/

import { registerPlugin } from "./registry.js";

const META_API_VERSION = "v18.0";
const META_GRAPH_BASE = "https://graph.facebook.com";

registerPlugin({
  id: "whatsapp_business",
  name: "WhatsApp Business",
  description: "Send appointment confirmations, reminders, payment links, and lead notifications via WhatsApp — the primary communication channel in India.",
  icon: "💬",
  category: "communication",
  popularIn: ["IN"],
  docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  configFields: [
    { key: "phoneNumberId", label: "Phone Number ID", type: "text", required: true, placeholder: "12345678901234", description: "From Meta Business Manager → WhatsApp → API Setup" },
    { key: "accessToken", label: "Permanent Access Token", type: "password", required: true, sensitive: true },
    { key: "businessAccountId", label: "Business Account ID", type: "text", required: true },
    { key: "verifyToken", label: "Webhook Verify Token", type: "text", required: false, description: "Used to verify webhook subscriptions" },
  ],
  capabilities: [
    { id: "send_template", name: "Send Template Messages", description: "Send pre-approved WhatsApp templates" },
    { id: "send_text", name: "Send Text Messages", description: "Send free-form text (within 24h window)" },
    { id: "receive_messages", name: "Receive Messages", description: "Receive and route incoming WhatsApp messages" },
  ],

  async testConnection(config) {
    try {
      const url = `${META_GRAPH_BASE}/${META_API_VERSION}/${config.phoneNumberId}?fields=verified_name,display_phone_number,status`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      const data = await res.json() as any;
      if (!res.ok) {
        return { success: false, message: data.error?.message || "Invalid credentials" };
      }
      return {
        success: true,
        message: `Connected as ${data.verified_name || data.display_phone_number}`,
        data: { displayPhone: data.display_phone_number, status: data.status },
      };
    } catch (e: any) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  },
});

// ─── Message types ─────────────────────────────────────────────────────────────

export interface TemplateMessage {
  to: string;                    // +91XXXXXXXXXX
  templateName: string;
  languageCode: string;          // "en", "hi", "ta" etc.
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters: TemplateParameter[];
}

export type TemplateParameter =
  | { type: "text"; text: string }
  | { type: "currency"; currency: { code: string; amount_1000: number; fallback_value: string } }
  | { type: "date_time"; date_time: { fallback_value: string } }
  | { type: "image"; image: { link: string } };

export interface TextMessage {
  to: string;
  body: string;
  previewUrl?: boolean;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  verifyToken?: string;
}

export interface SendResult {
  messageId: string;
  status: "sent" | "failed";
  error?: string;
}

// ─── Core send functions ───────────────────────────────────────────────────────

export async function sendTemplateMessage(config: WhatsAppConfig, msg: TemplateMessage): Promise<SendResult> {
  const normalizedTo = normalizeWhatsAppNumber(msg.to);

  const body = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "template",
    template: {
      name: msg.templateName,
      language: { code: toMetaLanguageCode(msg.languageCode) },
      components: msg.components || [],
    },
  };

  return sendToMeta(config, body);
}

export async function sendTextMessage(config: WhatsAppConfig, msg: TextMessage): Promise<SendResult> {
  const normalizedTo = normalizeWhatsAppNumber(msg.to);

  const body = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "text",
    text: { body: msg.body, preview_url: msg.previewUrl || false },
  };

  return sendToMeta(config, body);
}

async function sendToMeta(config: WhatsAppConfig, body: object): Promise<SendResult> {
  try {
    const url = `${META_GRAPH_BASE}/${META_API_VERSION}/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      return { messageId: "", status: "failed", error: data.error?.message || `HTTP ${res.status}` };
    }

    const messageId = data.messages?.[0]?.id || "";
    return { messageId, status: "sent" };
  } catch (e: any) {
    return { messageId: "", status: "failed", error: e.message };
  }
}

// ─── Pre-built notification templates ─────────────────────────────────────────

/**
 * Sends an appointment confirmation WhatsApp message.
 * Assumes a template named "appointment_confirmation" is approved in Meta Business Manager.
 */
export async function sendAppointmentConfirmationWA(
  config: WhatsAppConfig,
  params: {
    to: string;
    customerName: string;
    businessName: string;
    serviceName: string;
    dateTime: string;  // formatted in IST
    staffName?: string;
    language?: string;
  }
): Promise<SendResult> {
  return sendTemplateMessage(config, {
    to: params.to,
    templateName: "appointment_confirmation",
    languageCode: params.language || "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.customerName },
          { type: "text", text: params.businessName },
          { type: "text", text: params.serviceName },
          { type: "text", text: params.dateTime },
          ...(params.staffName ? [{ type: "text" as const, text: params.staffName }] : []),
        ],
      },
    ],
  });
}

/**
 * Sends a reminder 24h before appointment.
 */
export async function sendAppointmentReminderWA(
  config: WhatsAppConfig,
  params: {
    to: string;
    customerName: string;
    businessName: string;
    dateTime: string;
    language?: string;
  }
): Promise<SendResult> {
  return sendTemplateMessage(config, {
    to: params.to,
    templateName: "appointment_reminder",
    languageCode: params.language || "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.customerName },
          { type: "text", text: params.dateTime },
          { type: "text", text: params.businessName },
        ],
      },
    ],
  });
}

/**
 * Notifies the business owner about a new hot lead.
 */
export async function sendLeadNotificationWA(
  config: WhatsAppConfig,
  params: {
    ownerPhone: string;
    leadName: string;
    leadPhone?: string;
    leadEmail?: string;
    source?: string;
    language?: string;
  }
): Promise<SendResult> {
  const body = `🔔 *New Lead Alert!*\n\nName: ${params.leadName}\nPhone: ${params.leadPhone || "Not provided"}\nEmail: ${params.leadEmail || "Not provided"}\nSource: ${params.source || "AI Chat"}\n\nRespond quickly for best conversion!`;

  return sendTextMessage(config, { to: params.ownerPhone, body, previewUrl: false });
}

/**
 * Sends a UPI payment request message.
 */
export async function sendPaymentRequestWA(
  config: WhatsAppConfig,
  params: {
    to: string;
    customerName: string;
    amount: number;
    upiLink: string;
    description: string;
    language?: string;
  }
): Promise<SendResult> {
  const body = `💳 *Payment Request*\n\nHi ${params.customerName},\n\n${params.description}\n\nAmount: ₹${params.amount.toLocaleString("en-IN")}\n\nPay via UPI: ${params.upiLink}\n\nThank you!`;
  return sendTextMessage(config, { to: params.to, body });
}

// ─── Webhook helpers ───────────────────────────────────────────────────────────

/**
 * Verifies Meta's webhook challenge (used in GET /api/webhooks/whatsapp).
 */
export function verifyMetaWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): string | null {
  if (mode === "subscribe" && token === verifyToken) return challenge;
  return null;
}

/**
 * Extracts incoming message data from Meta webhook payload.
 */
export interface IncomingWhatsAppMessage {
  from: string;
  messageId: string;
  timestamp: number;
  text?: string;
  type: "text" | "image" | "document" | "interactive" | "unknown";
}

export function parseWebhookPayload(body: any): IncomingWhatsAppMessage[] {
  const messages: IncomingWhatsAppMessage[] = [];
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  for (const msg of value?.messages || []) {
    messages.push({
      from: msg.from,
      messageId: msg.id,
      timestamp: parseInt(msg.timestamp, 10),
      text: msg.text?.body,
      type: msg.type || "unknown",
    });
  }
  return messages;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalizeWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = "91" + cleaned.slice(1);
  if (!cleaned.startsWith("91") && cleaned.length === 10) cleaned = "91" + cleaned;
  return cleaned;
}

// Maps our language codes to Meta's BCP-47 language codes
const LANGUAGE_MAP: Record<string, string> = {
  en: "en_US",
  hi: "hi",
  ta: "ta",
  bn: "bn",
  te: "te",
  mr: "mr",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  pa: "pa",
  or: "or",
  ur: "ur",
};

function toMetaLanguageCode(code: string): string {
  return LANGUAGE_MAP[code] || "en_US";
}
