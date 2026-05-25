// GST utilities for India market
// Handles GSTIN validation, tax calculation, invoice line items

export const GST_RATES = {
  EXEMPT: 0,
  FIVE: 5,
  TWELVE: 12,
  EIGHTEEN: 18,     // Most services (consulting, healthcare software, beauty)
  TWENTY_EIGHT: 28, // Luxury/sin goods
} as const;

// Service category → typical GST rate mapping for common business types
export const SERVICE_GST_RATES: Record<string, number> = {
  healthcare: 0,          // Medical services are GST exempt
  medical: 0,
  hospital: 0,
  clinic: 0,
  education: 0,           // Educational services exempt
  coaching: 0,
  tuition: 0,
  restaurant: 5,          // Non-AC restaurants
  hotel: 12,              // Budget accommodation
  beauty: 18,             // Salons, spas
  salon: 18,
  spa: 18,
  fitness: 18,
  gym: 18,
  consulting: 18,
  legal: 18,
  accounting: 18,
  it: 18,
  software: 18,
  real_estate: 5,         // Under-construction properties
  automobile: 18,
  auto_service: 18,
  retail: 18,             // Default retail
  default: 18,
};

// ─── GSTIN Validation ─────────────────────────────────────────────────────────

/**
 * Validates an Indian GST Identification Number (GSTIN).
 * Format: 2-digit state code + 10-char PAN + 1-digit entity number + Z + checksum
 * E.g.: 27AAPFU0939F1ZV
 */
export function validateGSTIN(gstin: string): { valid: boolean; error?: string; details?: GSTINDetails } {
  if (!gstin) return { valid: false, error: "GSTIN is required" };

  const cleaned = gstin.trim().toUpperCase().replace(/\s/g, "");

  if (cleaned.length !== 15) {
    return { valid: false, error: `GSTIN must be 15 characters, got ${cleaned.length}` };
  }

  // Regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$
  const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  if (!GSTIN_REGEX.test(cleaned)) {
    return { valid: false, error: "GSTIN format is invalid" };
  }

  const stateCode = parseInt(cleaned.substring(0, 2), 10);
  if (stateCode < 1 || stateCode > 38) {
    return { valid: false, error: "Invalid state code in GSTIN" };
  }

  // Checksum validation (Luhn-like algorithm used by GSTN)
  if (!verifyGSTINChecksum(cleaned)) {
    return { valid: false, error: "GSTIN checksum is invalid" };
  }

  const pan = cleaned.substring(2, 12);
  const entityNumber = cleaned[12];
  const stateName = GSTIN_STATE_CODES[stateCode] || "Unknown";

  return {
    valid: true,
    details: { gstin: cleaned, stateCode, stateName, pan, entityNumber },
  };
}

export interface GSTINDetails {
  gstin: string;
  stateCode: number;
  stateName: string;
  pan: string;
  entityNumber: string;
}

function verifyGSTINChecksum(gstin: string): boolean {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 2;
  let sum = 0;
  for (let i = gstin.length - 2; i >= 0; i--) {
    let codePoint = chars.indexOf(gstin[i]);
    let digit = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / 36) + (digit % 36);
    sum += digit;
  }
  const checkCode = (36 - (sum % 36)) % 36;
  return chars[checkCode] === gstin[gstin.length - 1];
}

// ─── GST Calculation ──────────────────────────────────────────────────────────

export interface GSTBreakdown {
  baseAmount: number;
  gstRate: number;
  cgst: number;       // Central GST (half of total for intra-state)
  sgst: number;       // State GST (half of total for intra-state)
  igst: number;       // Integrated GST (for inter-state, = cgst + sgst)
  totalTax: number;
  totalAmount: number;
  isInterState: boolean;
  currency: string;
}

/**
 * Calculate GST for a given amount.
 * @param baseAmount - amount before tax (in INR paise or rupees)
 * @param gstRate - tax rate (0, 5, 12, 18, 28)
 * @param isInterState - if supplier and buyer are in different states → IGST
 */
export function calculateGST(
  baseAmount: number,
  gstRate: number,
  isInterState = false,
  currency = "INR"
): GSTBreakdown {
  const totalTax = Math.round(baseAmount * gstRate) / 100;
  const halfTax = totalTax / 2;

  return {
    baseAmount,
    gstRate,
    cgst: isInterState ? 0 : halfTax,
    sgst: isInterState ? 0 : halfTax,
    igst: isInterState ? totalTax : 0,
    totalTax,
    totalAmount: baseAmount + totalTax,
    isInterState,
    currency,
  };
}

/**
 * Calculate GST from an inclusive amount (tax already included).
 */
export function extractGSTFromInclusive(
  inclusiveAmount: number,
  gstRate: number,
  isInterState = false,
  currency = "INR"
): GSTBreakdown {
  const baseAmount = Math.round((inclusiveAmount / (1 + gstRate / 100)) * 100) / 100;
  return calculateGST(baseAmount, gstRate, isInterState, currency);
}

/**
 * Get the standard GST rate for a business type.
 */
export function getGSTRateForBusinessType(businessType: string): number {
  const key = businessType.toLowerCase();
  return SERVICE_GST_RATES[key] ?? SERVICE_GST_RATES.default;
}

// ─── Invoice Generation ───────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  hsnsac?: string;  // HSN/SAC code
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
}

export interface GSTInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  sellerGSTIN?: string;
  sellerName: string;
  sellerAddress: string;
  buyerGSTIN?: string;
  buyerName: string;
  buyerAddress?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
  currency: string;
  notes?: string;
}

export function generateInvoice(
  params: Omit<GSTInvoice, "subtotal" | "totalCGST" | "totalSGST" | "totalIGST" | "totalTax" | "grandTotal">
): GSTInvoice {
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  for (const item of params.items) {
    const lineBase = item.unitPrice * item.quantity * (1 - (item.discount || 0) / 100);
    const breakdown = calculateGST(lineBase, item.gstRate, params.isInterState);
    subtotal += breakdown.baseAmount;
    totalCGST += breakdown.cgst;
    totalSGST += breakdown.sgst;
    totalIGST += breakdown.igst;
  }

  const totalTax = totalCGST + totalSGST + totalIGST;

  return {
    ...params,
    subtotal: Math.round(subtotal * 100) / 100,
    totalCGST: Math.round(totalCGST * 100) / 100,
    totalSGST: Math.round(totalSGST * 100) / 100,
    totalIGST: Math.round(totalIGST * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round((subtotal + totalTax) * 100) / 100,
  };
}

// ─── State codes ─────────────────────────────────────────────────────────────

export const GSTIN_STATE_CODES: Record<number, string> = {
  1: "Jammu & Kashmir", 2: "Himachal Pradesh", 3: "Punjab", 4: "Chandigarh",
  5: "Uttarakhand", 6: "Haryana", 7: "Delhi", 8: "Rajasthan", 9: "Uttar Pradesh",
  10: "Bihar", 11: "Sikkim", 12: "Arunachal Pradesh", 13: "Nagaland", 14: "Manipur",
  15: "Mizoram", 16: "Tripura", 17: "Meghalaya", 18: "Assam", 19: "West Bengal",
  20: "Jharkhand", 21: "Odisha", 22: "Chhattisgarh", 23: "Madhya Pradesh",
  24: "Gujarat", 25: "Daman & Diu", 26: "Dadra & Nagar Haveli", 27: "Maharashtra",
  28: "Andhra Pradesh", 29: "Karnataka", 30: "Goa", 31: "Lakshadweep", 32: "Kerala",
  33: "Tamil Nadu", 34: "Puducherry", 35: "Andaman & Nicobar", 36: "Telangana",
  37: "Andhra Pradesh (New)", 38: "Ladakh",
};

export const INDIAN_STATES = Object.values(GSTIN_STATE_CODES);
export const INDIAN_STATE_CODES: Record<string, string> = {
  JK: "Jammu & Kashmir", HP: "Himachal Pradesh", PB: "Punjab", CH: "Chandigarh",
  UT: "Uttarakhand", HR: "Haryana", DL: "Delhi", RJ: "Rajasthan", UP: "Uttar Pradesh",
  BR: "Bihar", SK: "Sikkim", AR: "Arunachal Pradesh", NL: "Nagaland", MN: "Manipur",
  MZ: "Mizoram", TR: "Tripura", ML: "Meghalaya", AS: "Assam", WB: "West Bengal",
  JH: "Jharkhand", OR: "Odisha", CG: "Chhattisgarh", MP: "Madhya Pradesh",
  GJ: "Gujarat", MH: "Maharashtra", AP: "Andhra Pradesh", KA: "Karnataka",
  GA: "Goa", KL: "Kerala", TN: "Tamil Nadu", PY: "Puducherry", TS: "Telangana",
  LD: "Ladakh",
};
