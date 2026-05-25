import { describe, it, expect } from "vitest";
import {
  validateIndianPhone,
  formatIndianPhone,
  isWhatsAppEligible,
  whatsappLink,
  generateUpiLink,
  validateUpiId,
  validatePINCode,
} from "../../../server/india/phone.js";

describe("validateIndianPhone", () => {
  it("accepts standard 10-digit mobile starting with 9", () => {
    expect(validateIndianPhone("9876543210").valid).toBe(true);
    expect(validateIndianPhone("9876543210").normalized).toBe("+919876543210");
  });

  it("accepts numbers starting with 6, 7, 8, 9", () => {
    expect(validateIndianPhone("6876543210").valid).toBe(true);
    expect(validateIndianPhone("7876543210").valid).toBe(true);
    expect(validateIndianPhone("8876543210").valid).toBe(true);
  });

  it("rejects numbers starting with 0–5", () => {
    expect(validateIndianPhone("5876543210").valid).toBe(false);
    expect(validateIndianPhone("1876543210").valid).toBe(false);
    expect(validateIndianPhone("0876543210").valid).toBe(false);
  });

  it("strips +91 prefix and normalizes", () => {
    const r = validateIndianPhone("+91 98765 43210");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+919876543210");
  });

  it("strips 91 prefix when 12 digits", () => {
    const r = validateIndianPhone("919876543210");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+919876543210");
  });

  it("strips leading 0 (landline format)", () => {
    const r = validateIndianPhone("09876543210");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+919876543210");
  });

  it("strips 0091 prefix", () => {
    expect(validateIndianPhone("00919876543210").valid).toBe(true);
  });

  it("strips spaces and dashes", () => {
    expect(validateIndianPhone("98-765-43210").valid).toBe(true);
    expect(validateIndianPhone("98 765 43210").valid).toBe(true);
  });

  it("rejects too-short numbers", () => {
    expect(validateIndianPhone("98765").valid).toBe(false);
    expect(validateIndianPhone("").valid).toBe(false);
  });

  it("rejects too-long numbers", () => {
    expect(validateIndianPhone("987654321099").valid).toBe(false);
  });
});

describe("formatIndianPhone", () => {
  it("formats as +91 XXXXX XXXXX", () => {
    expect(formatIndianPhone("9876543210")).toBe("+91 98765 43210");
  });

  it("returns original on invalid input", () => {
    expect(formatIndianPhone("invalid")).toBe("invalid");
  });
});

describe("isWhatsAppEligible", () => {
  it("returns true for valid Indian mobile", () => {
    expect(isWhatsAppEligible("9876543210")).toBe(true);
  });

  it("returns false for invalid numbers", () => {
    expect(isWhatsAppEligible("1234")).toBe(false);
  });
});

describe("whatsappLink", () => {
  it("generates correct WhatsApp link", () => {
    const link = whatsappLink("9876543210");
    expect(link).toBe("https://wa.me/919876543210");
  });

  it("includes pre-filled message when provided", () => {
    const link = whatsappLink("9876543210", "Hello!");
    expect(link).toContain("text=Hello!");
  });

  it("throws on invalid phone", () => {
    expect(() => whatsappLink("12345")).toThrow();
  });
});

describe("generateUpiLink", () => {
  it("generates valid UPI deep link", () => {
    const link = generateUpiLink("business@paytm", 500, "Appointment booking", "My Clinic");
    expect(link).toContain("upi://pay");
    expect(link).toContain("pa=business%40paytm");
    expect(link).toContain("am=500.00");
    expect(link).toContain("cu=INR");
  });

  it("includes merchant name", () => {
    const link = generateUpiLink("test@upi", 100, "Test", "Test Biz");
    expect(link).toContain("pn=Test+Biz");
  });
});

describe("validateUpiId", () => {
  it("accepts valid UPI IDs", () => {
    expect(validateUpiId("merchant@paytm").valid).toBe(true);
    expect(validateUpiId("user123@ybl").valid).toBe(true);
    expect(validateUpiId("9876543210@upi").valid).toBe(true);
    expect(validateUpiId("name.surname@oksbi").valid).toBe(true);
  });

  it("rejects invalid UPI IDs", () => {
    expect(validateUpiId("invalid").valid).toBe(false);
    expect(validateUpiId("@bank").valid).toBe(false);
    expect(validateUpiId("user@").valid).toBe(false);
    expect(validateUpiId("").valid).toBe(false);
  });
});

describe("validatePINCode", () => {
  it("accepts valid 6-digit PIN codes", () => {
    const r = validatePINCode("400001"); // Mumbai
    expect(r.valid).toBe(true);
    expect(r.state).toContain("Maharashtra");
  });

  it("identifies region from first digit", () => {
    expect(validatePINCode("110001").state).toContain("Delhi");
    expect(validatePINCode("600001").state).toContain("Tamil Nadu");
  });

  it("rejects 5-digit codes", () => {
    expect(validatePINCode("40000").valid).toBe(false);
  });

  it("rejects 7-digit codes", () => {
    expect(validatePINCode("4000001").valid).toBe(false);
  });

  it("rejects all-zeros", () => {
    expect(validatePINCode("000000").valid).toBe(false);
  });
});
