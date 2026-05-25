// Razorpay payment plugin
// Dominant payment gateway in India (~80% market share)
// Features: Payment Links, UPI, Cards, Net Banking, Wallets

import crypto from "crypto";
import { registerPlugin } from "./registry.js";

registerPlugin({
  id: "razorpay",
  name: "Razorpay",
  description: "Accept payments via UPI, Credit/Debit cards, Net Banking, and all major Indian wallets. Create payment links for appointments.",
  icon: "💰",
  category: "payment",
  popularIn: ["IN"],
  docsUrl: "https://razorpay.com/docs/",
  configFields: [
    { key: "keyId", label: "Key ID", type: "text", required: true, placeholder: "rzp_live_xxxx", description: "From Razorpay Dashboard → Settings → API Keys" },
    { key: "keySecret", label: "Key Secret", type: "password", required: true, sensitive: true },
    { key: "webhookSecret", label: "Webhook Secret", type: "password", required: false, sensitive: true, description: "Set in Razorpay Dashboard → Settings → Webhooks" },
    { key: "accountName", label: "Account Name", type: "text", required: false, placeholder: "Your Business Name" },
  ],
  capabilities: [
    { id: "payment_link", name: "Payment Links", description: "Create and share payment links via WhatsApp/SMS" },
    { id: "upi_collect", name: "UPI Collect", description: "Request UPI payment from customer" },
    { id: "webhook_events", name: "Webhook Events", description: "Receive payment status updates" },
  ],

  async testConnection(config) {
    try {
      const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (res.status === 401) {
        return { success: false, message: "Invalid API credentials" };
      }
      if (!res.ok) {
        const data = await res.json() as any;
        return { success: false, message: data.error?.description || `HTTP ${res.status}` };
      }
      return { success: true, message: "Razorpay connected successfully", data: { keyId: config.keyId } };
    } catch (e: any) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export interface PaymentLinkRequest {
  amount: number;          // in INR (we convert to paise internally)
  currency?: string;       // default "INR"
  description: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;  // with +91 prefix
  callbackUrl?: string;
  callbackMethod?: "get" | "post";
  expiryHours?: number;    // default 24
  sendSms?: boolean;
  sendEmail?: boolean;
  notifyByWhatsApp?: boolean;
  referenceId?: string;    // your internal reference (e.g. appointment ID)
  notes?: Record<string, string>;
}

export interface PaymentLinkResult {
  id: string;
  shortUrl: string;
  status: string;
  amount: number;          // in INR
  currency: string;
  expiresAt?: number;      // unix timestamp
}

export interface PaymentWebhookEvent {
  event: string;           // "payment_link.paid" | "payment.captured" | etc.
  payload: {
    payment_link?: { entity: any };
    payment?: { entity: any };
  };
  createdAt: number;
}

// ─── Payment Links ────────────────────────────────────────────────────────────

export async function createPaymentLink(
  config: RazorpayConfig,
  request: PaymentLinkRequest
): Promise<PaymentLinkResult> {
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  const expiresAt = request.expiryHours
    ? Math.floor(Date.now() / 1000) + request.expiryHours * 3600
    : Math.floor(Date.now() / 1000) + 86400; // 24h default

  const body: any = {
    amount: Math.round(request.amount * 100), // rupees → paise
    currency: request.currency || "INR",
    description: request.description,
    customer: {
      name: request.customerName,
      ...(request.customerEmail && { email: request.customerEmail }),
      ...(request.customerPhone && { contact: normalizeRazorpayPhone(request.customerPhone) }),
    },
    expire_by: expiresAt,
    reminder_enable: true,
    notify: {
      sms: request.sendSms !== false,
      email: !!(request.sendEmail && request.customerEmail),
      whatsapp: request.notifyByWhatsApp !== false,
    },
    ...(request.callbackUrl && {
      callback_url: request.callbackUrl,
      callback_method: request.callbackMethod || "get",
    }),
    ...(request.referenceId && { reference_id: request.referenceId }),
    notes: request.notes || {},
  };

  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    throw new Error(data.error?.description || `Razorpay error: ${res.status}`);
  }

  return {
    id: data.id,
    shortUrl: data.short_url,
    status: data.status,
    amount: data.amount / 100,
    currency: data.currency,
    expiresAt: data.expire_by,
  };
}

/**
 * Retrieves a payment link by ID.
 */
export async function getPaymentLink(config: RazorpayConfig, linkId: string): Promise<any> {
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch payment link: ${res.status}`);
  return res.json();
}

// ─── Webhook verification ──────────────────────────────────────────────────────

/**
 * Verifies a Razorpay webhook signature.
 * Call this in /api/webhooks/razorpay BEFORE parsing the JSON body.
 */
export function verifyRazorpayWebhook(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string
): boolean {
  try {
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");
    // timingSafeEqual requires same-length buffers; unequal length → invalid
    if (expectedSignature.length !== signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

/**
 * Parses a Razorpay webhook body into a typed event.
 */
export function parseRazorpayWebhook(body: any): PaymentWebhookEvent {
  return {
    event: body.event,
    payload: body.payload || {},
    createdAt: body.created_at,
  };
}

// ─── UPI utilities ────────────────────────────────────────────────────────────

/**
 * Generates a Razorpay-compatible UPI payment intent.
 * Useful for businesses without a Razorpay account — redirects to UPI apps.
 */
export function generateUpiPaymentLink(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  note?: string;
}): string {
  const p = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    am: params.amount.toFixed(2),
    cu: "INR",
    tr: params.transactionRef,
    ...(params.note && { tn: params.note }),
  });
  return `upi://pay?${p.toString()}`;
}

function normalizeRazorpayPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = "+" + cleaned;
    else if (cleaned.length === 10) cleaned = "+91" + cleaned;
    else cleaned = "+" + cleaned;
  }
  return cleaned;
}
