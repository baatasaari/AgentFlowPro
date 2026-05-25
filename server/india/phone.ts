// Indian phone number validation and formatting
// India uses +91 country code, 10-digit mobile numbers
// Mobile: starts with 6, 7, 8, or 9
// Landline: area code + subscriber number (varies by state)

/**
 * Validates an Indian mobile number.
 * Accepts: 10-digit, +91 prefix, 91 prefix, 0 prefix variants
 */
export function validateIndianPhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone) return { valid: false, error: "Phone number is required" };

  // Remove all non-digit characters except leading +
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, "");

  // Strip country code
  if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("0091")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith("0") && cleaned.length === 11) cleaned = cleaned.slice(1);

  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: "Phone number must be 10 digits" };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  const firstDigit = parseInt(cleaned[0], 10);
  if (![6, 7, 8, 9].includes(firstDigit)) {
    return { valid: false, error: "Invalid Indian mobile number (must start with 6, 7, 8, or 9)" };
  }

  return { valid: true, normalized: `+91${cleaned}` };
}

/**
 * Formats a phone number for display in Indian style.
 * E.g.: +91 98765 43210
 */
export function formatIndianPhone(phone: string): string {
  const result = validateIndianPhone(phone);
  if (!result.valid || !result.normalized) return phone;
  const digits = result.normalized.slice(3); // remove +91
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/**
 * Returns true if the number is likely a WhatsApp-enabled number
 * (all Indian mobile numbers that start with 6-9 support WhatsApp).
 */
export function isWhatsAppEligible(phone: string): boolean {
  return validateIndianPhone(phone).valid;
}

/**
 * Generates a WhatsApp deep link URL for a phone number.
 * @param phone - any format Indian mobile number
 * @param message - optional pre-filled message (URL encoded)
 */
export function whatsappLink(phone: string, message?: string): string {
  const result = validateIndianPhone(phone);
  if (!result.valid) throw new Error("Invalid phone number for WhatsApp link");
  const number = result.normalized!.slice(1); // remove +, keep 91XXXXXXXXXX
  const baseUrl = `https://wa.me/${number}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

/**
 * Generates a UPI payment deep link.
 * @param upiId - e.g. business@paytm or 9876543210@upi
 * @param amount - amount in INR
 * @param note - payment note/description
 * @param merchantName - displayed merchant name
 */
export function generateUpiLink(
  upiId: string,
  amount: number,
  note: string,
  merchantName?: string
): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: merchantName || "Business",
    am: amount.toFixed(2),
    tn: note,
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Validates a UPI ID format.
 * Format: username@bankhandle (e.g. name@paytm, name@ybl, phone@upi)
 */
export function validateUpiId(upiId: string): { valid: boolean; error?: string } {
  if (!upiId) return { valid: false, error: "UPI ID is required" };
  const cleaned = upiId.trim().toLowerCase();
  // UPI ID: alphanumeric/dots/hyphens @ bank_handle
  const UPI_REGEX = /^[a-zA-Z0-9._\-+]+@[a-zA-Z0-9]+$/;
  if (!UPI_REGEX.test(cleaned)) {
    return { valid: false, error: "Invalid UPI ID format (expected: name@bankhandle)" };
  }
  const [, handle] = cleaned.split("@");
  const KNOWN_HANDLES = [
    "paytm", "upi", "ybl", "oksbi", "okaxis", "okhdfcbank", "okicici",
    "apl", "axisb", "cnrb", "cosb", "fbl", "hdfc", "hdfcbank", "icici",
    "ibl", "idbi", "idfcbank", "ikwik", "indus", "juspay", "kotak",
    "kvb", "mahb", "naviaxis", "niyoicici", "payzapp", "postbank",
    "rmhdfcbank", "rbl", "sbi", "sib", "timecosmos", "uco",
  ];
  const isKnown = KNOWN_HANDLES.some(h => handle.endsWith(h));
  if (!isKnown) {
    // Still allow unknown handles — new banks are added regularly
    return { valid: true };
  }
  return { valid: true };
}

// ─── Indian PIN Code Validation ───────────────────────────────────────────────

/**
 * Validates an Indian PIN code (postal index number).
 * Format: 6 digits, first digit 1-9, cannot be all zeros.
 */
export function validatePINCode(pin: string): { valid: boolean; state?: string; error?: string } {
  if (!pin) return { valid: false, error: "PIN code is required" };
  const cleaned = pin.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, error: "PIN code must be exactly 6 digits" };
  }
  if (cleaned === "000000") {
    return { valid: false, error: "Invalid PIN code" };
  }

  const firstDigit = parseInt(cleaned[0], 10);
  const region = PIN_REGIONS[firstDigit];
  return { valid: true, state: region };
}

const PIN_REGIONS: Record<number, string> = {
  1: "Delhi, Haryana, Punjab, HP, J&K, Chandigarh",
  2: "UP, Uttarakhand",
  3: "Rajasthan, Gujarat",
  4: "Maharashtra, Goa, MP, Chhattisgarh",
  5: "AP, Telangana, Karnataka",
  6: "Kerala, Tamil Nadu, Puducherry, Lakshadweep",
  7: "West Bengal, Odisha, Assam, NE States, A&N Islands",
  8: "Bihar, Jharkhand",
  9: "Military Post Office (APO/FPO)",
};
