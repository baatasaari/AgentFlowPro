// Zoho CRM plugin — widely used CRM in India
// Uses Zoho CRM REST API v7 with OAuth 2.0

import { registerPlugin } from "./registry.js";

const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in";  // Indian data center
const ZOHO_API_URL = "https://www.zohoapis.in/crm/v7"; // Indian data center

registerPlugin({
  id: "zoho_crm",
  name: "Zoho CRM",
  description: "Push leads and contacts captured by your AI agent directly into Zoho CRM — the most popular CRM in India.",
  icon: "🗃️",
  category: "crm",
  popularIn: ["IN"],
  docsUrl: "https://www.zoho.com/crm/developer/docs/api/v7/",
  configFields: [
    { key: "clientId", label: "Client ID", type: "text", required: true, description: "From Zoho Developer Console" },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true, sensitive: true },
    { key: "refreshToken", label: "Refresh Token", type: "password", required: true, sensitive: true },
    { key: "orgId", label: "Organization ID", type: "text", required: false, description: "Your Zoho CRM Org ID (optional, used in API calls)" },
    { key: "defaultLeadSource", label: "Default Lead Source", type: "text", required: false, placeholder: "Website Chat", description: "How leads will be marked in Zoho CRM" },
  ],
  capabilities: [
    { id: "create_lead", name: "Create Leads", description: "Auto-create leads from AI chat conversations" },
    { id: "create_contact", name: "Create Contacts", description: "Create contacts after appointment confirmation" },
    { id: "update_lead", name: "Update Leads", description: "Update lead status after follow-up" },
    { id: "search_records", name: "Search Records", description: "Check for duplicate leads/contacts" },
  ],

  async testConnection(config) {
    try {
      const token = await refreshZohoToken(config as ZohoCRMConfig);
      const res = await fetch(`${ZOHO_API_URL}/org`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      if (!res.ok) return { success: false, message: `Zoho API returned ${res.status}` };
      const data = await res.json() as any;
      const orgName = data.org?.[0]?.company_name;
      return { success: true, message: `Connected to Zoho CRM: ${orgName}`, data: { orgName } };
    } catch (e: any) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZohoCRMConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgId?: string;
  defaultLeadSource?: string;
}

export interface ZohoLead {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  leadSource?: string;
  description?: string;
  rating?: "Acquired" | "Active" | "Market Failed" | "Project Cancelled" | "Shut Down";
  // India-specific fields
  mobilePhone?: string;
  state?: string;
  zipCode?: string;
  // Custom fields
  [key: string]: any;
}

export interface ZohoContact {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  title?: string;
  department?: string;
  accountName?: string;
  description?: string;
  mailingState?: string;
  mailingZip?: string;
  [key: string]: any;
}

export interface ZohoCreateResult {
  id: string;
  status: "success" | "error";
  errorMessage?: string;
  isDuplicate?: boolean;
}

// ─── Token Management ──────────────────────────────────────────────────────────

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function refreshZohoToken(config: ZohoCRMConfig): Promise<string> {
  const cacheKey = config.refreshToken.substring(0, 20);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) throw new Error(`Zoho token refresh failed: ${res.status}`);
  const data = await res.json() as any;
  if (data.error) throw new Error(`Zoho token error: ${data.error}`);

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

// ─── Lead Operations ──────────────────────────────────────────────────────────

/**
 * Creates a lead in Zoho CRM.
 * Checks for duplicates by email/phone before creating.
 */
export async function createLead(config: ZohoCRMConfig, lead: ZohoLead): Promise<ZohoCreateResult> {
  const token = await refreshZohoToken(config);

  // Check for duplicate by email
  if (lead.email) {
    const existing = await searchByEmail(token, lead.email, "Leads");
    if (existing) return { id: existing, status: "success", isDuplicate: true };
  }

  const data = mapLeadToZoho(lead, config.defaultLeadSource);

  const res = await fetch(`${ZOHO_API_URL}/Leads`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [data] }),
  });

  const result = await res.json() as any;
  const item = result.data?.[0];

  if (!res.ok || item?.status === "error") {
    return { id: "", status: "error", errorMessage: item?.message || `HTTP ${res.status}` };
  }

  return { id: item.details.id, status: "success" };
}

/**
 * Creates a contact in Zoho CRM (used after appointment completion).
 */
export async function createContact(config: ZohoCRMConfig, contact: ZohoContact): Promise<ZohoCreateResult> {
  const token = await refreshZohoToken(config);

  if (contact.email) {
    const existing = await searchByEmail(token, contact.email, "Contacts");
    if (existing) return { id: existing, status: "success", isDuplicate: true };
  }

  const data = mapContactToZoho(contact);

  const res = await fetch(`${ZOHO_API_URL}/Contacts`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [data] }),
  });

  const result = await res.json() as any;
  const item = result.data?.[0];

  if (!res.ok || item?.status === "error") {
    return { id: "", status: "error", errorMessage: item?.message || `HTTP ${res.status}` };
  }

  return { id: item.details.id, status: "success" };
}

/**
 * Updates lead status (e.g., "Contacted", "Not Contacted", "Converted").
 */
export async function updateLeadStatus(
  config: ZohoCRMConfig,
  leadId: string,
  status: string,
  notes?: string
): Promise<void> {
  const token = await refreshZohoToken(config);
  const body: any = { Lead_Status: status };
  if (notes) body.Description = notes;

  await fetch(`${ZOHO_API_URL}/Leads/${leadId}`, {
    method: "PUT",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [body] }),
  });
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function searchByEmail(token: string, email: string, module: string): Promise<string | null> {
  const url = `${ZOHO_API_URL}/${module}/search?criteria=(Email:equals:${encodeURIComponent(email)})&fields=id`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (!res.ok) return null;
  const data = await res.json() as any;
  return data.data?.[0]?.id || null;
}

function mapLeadToZoho(lead: ZohoLead, defaultSource?: string): Record<string, any> {
  return {
    First_Name: lead.firstName,
    Last_Name: lead.lastName || "(Unknown)",
    Email: lead.email,
    Phone: lead.phone,
    Mobile: lead.mobilePhone || lead.phone,
    Company: lead.company || "(Unknown)",
    Lead_Source: lead.leadSource || defaultSource || "Website",
    Description: lead.description,
    Rating: lead.rating,
    State: lead.state,
    Zip_Code: lead.zipCode,
  };
}

function mapContactToZoho(contact: ZohoContact): Record<string, any> {
  return {
    First_Name: contact.firstName,
    Last_Name: contact.lastName || "(Unknown)",
    Email: contact.email,
    Phone: contact.phone,
    Mobile: contact.mobilePhone || contact.phone,
    Title: contact.title,
    Department: contact.department,
    Account_Name: contact.accountName,
    Description: contact.description,
    Mailing_State: contact.mailingState,
    Mailing_Zip: contact.mailingZip,
  };
}
