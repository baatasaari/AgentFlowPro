// MSG91 SMS plugin — leading SMS provider in India
// Supports OTP, transactional, and promotional SMS
// Website: https://msg91.com/

import { registerPlugin } from "./registry.js";

registerPlugin({
  id: "sms_msg91",
  name: "MSG91 SMS",
  description: "Send SMS notifications, OTPs, and reminders via MSG91 — India's leading SMS platform with 99%+ delivery rates.",
  icon: "📱",
  category: "communication",
  popularIn: ["IN"],
  docsUrl: "https://docs.msg91.com/",
  configFields: [
    { key: "authKey", label: "Auth Key", type: "password", required: true, sensitive: true, placeholder: "xxxxxx...", description: "From MSG91 Dashboard → API" },
    { key: "senderId", label: "Sender ID", type: "text", required: true, placeholder: "BUSNAME", description: "6-character sender ID (approved by TRAI)" },
    { key: "dltTemplateId", label: "DLT Template ID", type: "text", required: false, description: "TRAI DLT registered template ID (required for transactional SMS in India)" },
    { key: "country", label: "Default Country Code", type: "text", required: false, placeholder: "91", description: "Default: 91 (India)" },
  ],
  capabilities: [
    { id: "send_sms", name: "Send SMS", description: "Send transactional SMS notifications" },
    { id: "send_otp", name: "Send OTP", description: "Send one-time passwords for verification" },
    { id: "delivery_reports", name: "Delivery Reports", description: "Track SMS delivery status" },
  ],

  async testConnection(config) {
    try {
      // MSG91 balance check
      const res = await fetch(`https://api.msg91.com/api/balance.php?authkey=${config.authKey}&type=2`, {
        headers: { "User-Agent": "AgentFlowPro/1.0" },
      });
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` };
      const text = await res.text();
      if (text.includes("Invalid")) return { success: false, message: "Invalid Auth Key" };
      return { success: true, message: `MSG91 connected. Balance: ${text.trim()}`, data: { balance: text.trim() } };
    } catch (e: any) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MSG91Config {
  authKey: string;
  senderId: string;
  dltTemplateId?: string;
  country?: string;
}

export interface SMSRequest {
  to: string[];          // Indian mobile numbers (will be normalized to 91XXXXXXXXXX)
  message: string;
  templateId?: string;   // DLT template ID (overrides config default)
}

export interface SMSResult {
  requestId?: string;
  status: "success" | "failed";
  error?: string;
  delivered: number;
  failed: number;
}

export interface OTPRequest {
  to: string;            // single mobile number
  otp?: string;          // if not provided, MSG91 generates it
  otpLength?: number;    // 4 or 6 (default 6)
  expiryMinutes?: number; // default 10
  templateId?: string;
}

export interface OTPResult {
  requestId: string;
  status: "success" | "failed";
  error?: string;
}

// ─── SMS sending ──────────────────────────────────────────────────────────────

export async function sendSMS(config: MSG91Config, request: SMSRequest): Promise<SMSResult> {
  const numbers = request.to.map(normalizeMsg91Phone).filter(Boolean);
  if (numbers.length === 0) {
    return { status: "failed", error: "No valid phone numbers", delivered: 0, failed: request.to.length };
  }

  const body: any = {
    sender: config.senderId,
    route: "4", // transactional route
    country: config.country || "91",
    sms: [
      {
        message: request.message,
        to: numbers,
      },
    ],
  };

  if (request.templateId || config.dltTemplateId) {
    body.DLT_TE_ID = request.templateId || config.dltTemplateId;
  }

  try {
    const res = await fetch("https://api.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: config.authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;

    if (data.type === "error") {
      return { status: "failed", error: data.message, delivered: 0, failed: numbers.length };
    }

    return {
      requestId: data.request_id,
      status: "success",
      delivered: numbers.length,
      failed: 0,
    };
  } catch (e: any) {
    return { status: "failed", error: e.message, delivered: 0, failed: numbers.length };
  }
}

/**
 * Send appointment confirmation SMS.
 */
export async function sendAppointmentConfirmationSMS(
  config: MSG91Config,
  params: {
    to: string;
    customerName: string;
    businessName: string;
    dateTime: string;
    serviceName?: string;
  }
): Promise<SMSResult> {
  const message = `Dear ${params.customerName}, your appointment at ${params.businessName} for ${params.serviceName || "service"} is confirmed on ${params.dateTime}. Please arrive 5 mins early. Replies: CANCEL to cancel.`;
  return sendSMS(config, { to: [params.to], message });
}

/**
 * Send appointment reminder SMS (24h before).
 */
export async function sendReminderSMS(
  config: MSG91Config,
  params: { to: string; customerName: string; businessName: string; dateTime: string }
): Promise<SMSResult> {
  const message = `Reminder: Hi ${params.customerName}, your appointment at ${params.businessName} is scheduled for ${params.dateTime}. Kindly confirm or reply CANCEL.`;
  return sendSMS(config, { to: [params.to], message });
}

/**
 * Send OTP via MSG91 (for appointment verification or login).
 */
export async function sendOTP(config: MSG91Config, request: OTPRequest): Promise<OTPResult> {
  const phone = normalizeMsg91Phone(request.to);
  if (!phone) return { requestId: "", status: "failed", error: "Invalid phone number" };

  const params = new URLSearchParams({
    authkey: config.authKey,
    mobile: phone,
    message: "Your OTP for verification is {{otp}}. Valid for {{expiry}} minutes. -AgentFlowPro",
    otp: request.otp || "",
    otp_length: String(request.otpLength || 6),
    expiry: String(request.expiryMinutes || 10),
    sender: config.senderId,
  });
  if (request.templateId) params.set("template_id", request.templateId);

  try {
    const res = await fetch(`https://api.msg91.com/api/v5/otp?${params.toString()}`, {
      method: "GET",
    });
    const data = await res.json() as any;
    if (data.type === "error") return { requestId: "", status: "failed", error: data.message };
    return { requestId: data.request_id, status: "success" };
  } catch (e: any) {
    return { requestId: "", status: "failed", error: e.message };
  }
}

/**
 * Notify business owner of new lead via SMS.
 */
export async function sendLeadAlertSMS(
  config: MSG91Config,
  params: { ownerPhone: string; leadName: string; leadPhone?: string; service?: string }
): Promise<SMSResult> {
  const message = `AgentFlowPro Alert: New lead ${params.leadName}${params.leadPhone ? ` (${params.leadPhone})` : ""}${params.service ? ` interested in ${params.service}` : ""}. Contact them soon!`;
  return sendSMS(config, { to: [params.ownerPhone], message });
}

// ─── Phone normalization ──────────────────────────────────────────────────────

function normalizeMsg91Phone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.+]/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return "91" + cleaned;
  return cleaned.length >= 10 ? cleaned : "";
}
