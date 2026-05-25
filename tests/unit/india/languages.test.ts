import { describe, it, expect } from "vitest";
import {
  INDIAN_LANGUAGES,
  GREETINGS,
  detectLanguage,
  getDefaultLanguageForState,
  getGreeting,
  buildAgentGreeting,
  formatINR,
  numberToIndianWords,
} from "../../../server/india/languages.js";

describe("INDIAN_LANGUAGES", () => {
  it("contains all major Indian languages", () => {
    const codes = INDIAN_LANGUAGES.map(l => l.code);
    expect(codes).toContain("hi"); // Hindi
    expect(codes).toContain("ta"); // Tamil
    expect(codes).toContain("te"); // Telugu
    expect(codes).toContain("bn"); // Bengali
    expect(codes).toContain("mr"); // Marathi
    expect(codes).toContain("gu"); // Gujarati
    expect(codes).toContain("kn"); // Kannada
    expect(codes).toContain("ml"); // Malayalam
    expect(codes).toContain("pa"); // Punjabi
    expect(codes).toContain("en"); // English
  });

  it("Hindi has highest speaker count", () => {
    const hindi = INDIAN_LANGUAGES.find(l => l.code === "hi");
    expect(hindi?.speakers).toBeGreaterThan(500);
  });

  it("Urdu is right-to-left", () => {
    const urdu = INDIAN_LANGUAGES.find(l => l.code === "ur");
    expect(urdu?.rtl).toBe(true);
  });

  it("all others are left-to-right", () => {
    const ltr = INDIAN_LANGUAGES.filter(l => l.code !== "ur");
    expect(ltr.every(l => !l.rtl)).toBe(true);
  });
});

describe("getDefaultLanguageForState", () => {
  it("returns Tamil for TN (Tamil Nadu)", () => {
    expect(getDefaultLanguageForState("TN")).toBe("ta");
  });

  it("returns Kannada for KA (Karnataka)", () => {
    expect(getDefaultLanguageForState("KA")).toBe("kn");
  });

  it("returns Gujarati for GJ (Gujarat)", () => {
    expect(getDefaultLanguageForState("GJ")).toBe("gu");
  });

  it("returns Punjabi for PB (Punjab)", () => {
    expect(getDefaultLanguageForState("PB")).toBe("pa");
  });

  it("defaults to Hindi for unknown state", () => {
    expect(getDefaultLanguageForState("XX")).toBe("hi");
  });
});

describe("getGreeting", () => {
  it("returns Hindi greeting for hi", () => {
    const g = getGreeting("hi");
    expect(g.hello).toBe("नमस्ते!");
    expect(g.howHelp).toContain("मदद");
  });

  it("returns Tamil greeting for ta", () => {
    const g = getGreeting("ta");
    expect(g.hello).toBe("வணக்கம்!");
  });

  it("falls back to English for unknown code", () => {
    const g = getGreeting("xyz");
    expect(g.hello).toBe("Hello!");
  });
});

describe("buildAgentGreeting", () => {
  it("builds a greeting with Hindi as primary", () => {
    const greeting = buildAgentGreeting("hi", "Dr Sharma Clinic");
    expect(greeting).toContain("नमस्ते!");
  });

  it("builds bilingual greeting when secondary language given", () => {
    const greeting = buildAgentGreeting("hi", "Test Clinic", "en");
    expect(greeting).toContain("Hello!"); // English secondary
  });
});

describe("detectLanguage", () => {
  it("detects Hindi (Devanagari script)", () => {
    expect(detectLanguage("नमस्ते आप कैसे हैं")).toBe("hi");
  });

  it("detects Tamil script", () => {
    expect(detectLanguage("வணக்கம்")).toBe("ta");
  });

  it("detects Telugu script", () => {
    expect(detectLanguage("నమస్కారం")).toBe("te");
  });

  it("detects Bengali script", () => {
    expect(detectLanguage("নমস্কার")).toBe("bn");
  });

  it("detects Gujarati script", () => {
    expect(detectLanguage("નમસ્તે")).toBe("gu");
  });

  it("defaults to English for Latin script", () => {
    expect(detectLanguage("Hello how are you")).toBe("en");
  });
});

describe("formatINR", () => {
  it("formats 1500 as ₹1,500", () => {
    const formatted = formatINR(1500);
    expect(formatted).toContain("1,500");
    expect(formatted).toContain("₹");
  });

  it("formats 150000 in Indian system (1.5 lakh)", () => {
    const formatted = formatINR(150000);
    expect(formatted).toContain("1,50,000");
  });

  it("formats 10000000 (1 crore)", () => {
    const formatted = formatINR(10000000);
    expect(formatted).toContain("1,00,00,000");
  });
});

describe("numberToIndianWords", () => {
  it("converts 0 to Zero", () => {
    expect(numberToIndianWords(0)).toBe("Zero");
  });

  it("converts 500 correctly", () => {
    expect(numberToIndianWords(500)).toContain("Five Hundred Rupees");
  });

  it("uses Lakh for 100000", () => {
    expect(numberToIndianWords(100000)).toContain("One Lakh");
  });

  it("uses Crore for 10000000", () => {
    expect(numberToIndianWords(10000000)).toContain("One Crore");
  });

  it("includes Paise for decimal amounts", () => {
    expect(numberToIndianWords(100.50)).toContain("Paise");
  });

  it("includes 'Only' suffix", () => {
    expect(numberToIndianWords(100)).toContain("Only");
  });
});
