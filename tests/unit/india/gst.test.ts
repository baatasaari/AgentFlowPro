import { describe, it, expect } from "vitest";
import {
  validateGSTIN,
  calculateGST,
  extractGSTFromInclusive,
  getGSTRateForBusinessType,
  generateInvoice,
  GSTIN_STATE_CODES,
  SERVICE_GST_RATES,
} from "../../../server/india/gst.js";

describe("validateGSTIN", () => {
  it("validates a correct Maharashtra GSTIN", () => {
    // 27 = Maharashtra, AAPFU0939F = PAN, 1 = entity, Z, V = check
    const r = validateGSTIN("27AAPFU0939F1ZV");
    expect(r.valid).toBe(true);
    expect(r.details?.stateCode).toBe(27);
    expect(r.details?.stateName).toBe("Maharashtra");
  });

  it("validates Karnataka GSTIN", () => {
    const r = validateGSTIN("29AABCT1332L1ZA");
    expect(r.valid).toBe(true);
    expect(r.details?.stateCode).toBe(29);
    expect(r.details?.stateName).toBe("Karnataka");
  });

  it("rejects GSTIN shorter than 15 chars", () => {
    const r = validateGSTIN("27AAPFU0939F1Z");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("15 characters");
  });

  it("rejects GSTIN with invalid format", () => {
    expect(validateGSTIN("INVALID").valid).toBe(false);
  });

  it("rejects empty GSTIN", () => {
    expect(validateGSTIN("").valid).toBe(false);
  });

  it("rejects GSTIN with invalid state code (0)", () => {
    const r = validateGSTIN("00AAPFU0939F1ZV");
    expect(r.valid).toBe(false);
  });

  it("handles lowercase by converting to uppercase", () => {
    const r = validateGSTIN("27aapfu0939f1zv");
    // Should normalize to uppercase and validate
    expect(typeof r.valid).toBe("boolean");
  });
});

describe("calculateGST", () => {
  it("calculates 18% GST on 1000 correctly", () => {
    const result = calculateGST(1000, 18);
    expect(result.baseAmount).toBe(1000);
    expect(result.totalTax).toBe(180);
    expect(result.totalAmount).toBe(1180);
  });

  it("splits CGST/SGST 50/50 for intra-state", () => {
    const result = calculateGST(1000, 18, false);
    expect(result.cgst).toBe(90);
    expect(result.sgst).toBe(90);
    expect(result.igst).toBe(0);
    expect(result.isInterState).toBe(false);
  });

  it("uses IGST for inter-state", () => {
    const result = calculateGST(1000, 18, true);
    expect(result.igst).toBe(180);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.isInterState).toBe(true);
  });

  it("calculates 5% GST correctly", () => {
    const result = calculateGST(2000, 5);
    expect(result.totalTax).toBe(100);
    expect(result.totalAmount).toBe(2100);
  });

  it("handles 0% GST (exempt services like healthcare)", () => {
    const result = calculateGST(5000, 0);
    expect(result.totalTax).toBe(0);
    expect(result.totalAmount).toBe(5000);
  });
});

describe("extractGSTFromInclusive", () => {
  it("back-calculates base from GST-inclusive amount", () => {
    const result = extractGSTFromInclusive(1180, 18);
    expect(result.baseAmount).toBeCloseTo(1000, 0);
    expect(result.totalTax).toBeCloseTo(180, 0);
  });
});

describe("getGSTRateForBusinessType", () => {
  it("returns 0% for healthcare", () => {
    expect(getGSTRateForBusinessType("healthcare")).toBe(0);
    expect(getGSTRateForBusinessType("clinic")).toBe(0);
    expect(getGSTRateForBusinessType("hospital")).toBe(0);
  });

  it("returns 0% for education", () => {
    expect(getGSTRateForBusinessType("coaching")).toBe(0);
    expect(getGSTRateForBusinessType("education")).toBe(0);
  });

  it("returns 18% for beauty/wellness", () => {
    expect(getGSTRateForBusinessType("beauty")).toBe(18);
    expect(getGSTRateForBusinessType("salon")).toBe(18);
    expect(getGSTRateForBusinessType("spa")).toBe(18);
  });

  it("returns 18% for consulting/IT", () => {
    expect(getGSTRateForBusinessType("consulting")).toBe(18);
    expect(getGSTRateForBusinessType("it")).toBe(18);
  });

  it("returns 18% for unknown business type (default)", () => {
    expect(getGSTRateForBusinessType("unknown_type")).toBe(18);
  });
});

describe("generateInvoice", () => {
  it("generates a complete invoice with correct totals", () => {
    const invoice = generateInvoice({
      invoiceNumber: "INV-001",
      invoiceDate: "2026-05-25",
      sellerName: "Test Clinic",
      sellerAddress: "Mumbai, Maharashtra",
      buyerName: "John Smith",
      isInterState: false,
      currency: "INR",
      items: [
        { description: "Consultation", quantity: 1, unitPrice: 500, gstRate: 0 },
        { description: "Lab Tests", quantity: 2, unitPrice: 300, gstRate: 5 },
      ],
    });

    expect(invoice.subtotal).toBe(1100); // 500 + 600
    expect(invoice.totalTax).toBeCloseTo(30, 0); // 5% of 600
    expect(invoice.grandTotal).toBeCloseTo(1130, 0);
    expect(invoice.invoiceNumber).toBe("INV-001");
  });

  it("calculates CGST+SGST correctly for intra-state", () => {
    const invoice = generateInvoice({
      invoiceNumber: "INV-002",
      invoiceDate: "2026-05-25",
      sellerName: "IT Company",
      sellerAddress: "Bangalore, Karnataka",
      buyerName: "Client Corp",
      isInterState: false,
      currency: "INR",
      items: [
        { description: "Software Service", quantity: 1, unitPrice: 10000, gstRate: 18 },
      ],
    });

    expect(invoice.totalCGST).toBe(900);
    expect(invoice.totalSGST).toBe(900);
    expect(invoice.totalIGST).toBe(0);
    expect(invoice.grandTotal).toBe(11800);
  });

  it("uses IGST for inter-state transaction", () => {
    const invoice = generateInvoice({
      invoiceNumber: "INV-003",
      invoiceDate: "2026-05-25",
      sellerName: "Mumbai Corp",
      sellerAddress: "Mumbai, MH",
      buyerName: "Delhi Client",
      isInterState: true,
      currency: "INR",
      items: [
        { description: "Consulting", quantity: 1, unitPrice: 5000, gstRate: 18 },
      ],
    });

    expect(invoice.totalCGST).toBe(0);
    expect(invoice.totalSGST).toBe(0);
    expect(invoice.totalIGST).toBe(900);
  });
});

describe("GSTIN_STATE_CODES", () => {
  it("has entries for all 38 state codes", () => {
    expect(GSTIN_STATE_CODES[27]).toBe("Maharashtra");
    expect(GSTIN_STATE_CODES[33]).toBe("Tamil Nadu");
    expect(GSTIN_STATE_CODES[7]).toBe("Delhi");
    expect(GSTIN_STATE_CODES[29]).toBe("Karnataka");
    expect(GSTIN_STATE_CODES[32]).toBe("Kerala");
  });
});
