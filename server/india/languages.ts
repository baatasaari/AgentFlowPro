// Indian regional language support for AI agents
// Provides language detection, greeting templates, and locale configs

export interface IndianLanguage {
  code: string;       // BCP-47 code
  name: string;       // English name
  nativeName: string; // Native script name
  script: string;
  statesSpoken: string[]; // State codes where spoken
  speakers: number;   // approximate millions
  rtl: boolean;
}

export const INDIAN_LANGUAGES: IndianLanguage[] = [
  { code: "hi", name: "Hindi", nativeName: "हिंदी", script: "Devanagari", statesSpoken: ["UP", "MP", "RJ", "HR", "DL", "CG", "JH", "UK", "HP", "BR"], speakers: 600, rtl: false },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", script: "Bengali", statesSpoken: ["WB", "TR"], speakers: 230, rtl: false },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", script: "Telugu", statesSpoken: ["AP", "TS"], speakers: 93, rtl: false },
  { code: "mr", name: "Marathi", nativeName: "मराठी", script: "Devanagari", statesSpoken: ["MH"], speakers: 95, rtl: false },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", script: "Tamil", statesSpoken: ["TN", "PY"], speakers: 78, rtl: false },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati", statesSpoken: ["GJ"], speakers: 62, rtl: false },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", statesSpoken: ["KA"], speakers: 59, rtl: false },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", statesSpoken: ["KL", "LD"], speakers: 38, rtl: false },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi", statesSpoken: ["PB", "HR"], speakers: 33, rtl: false },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia", statesSpoken: ["OR"], speakers: 45, rtl: false },
  { code: "ur", name: "Urdu", nativeName: "اردو", script: "Nastaliq", statesSpoken: ["JK", "UP", "BR", "MH", "AP"], speakers: 50, rtl: true },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া", script: "Bengali", statesSpoken: ["AS"], speakers: 15, rtl: false },
  { code: "mai", name: "Maithili", nativeName: "मैथिली", script: "Devanagari", statesSpoken: ["BR", "JH"], speakers: 14, rtl: false },
  { code: "en", name: "English", nativeName: "English", script: "Latin", statesSpoken: [], speakers: 200, rtl: false },
];

// ─── Greeting templates per language ─────────────────────────────────────────

export const GREETINGS: Record<string, { hello: string; welcome: string; howHelp: string; goodbye: string }> = {
  hi: {
    hello: "नमस्ते!",
    welcome: "आपका स्वागत है!",
    howHelp: "मैं आपकी कैसे मदद कर सकता हूँ?",
    goodbye: "धन्यवाद! फिर मिलेंगे।",
  },
  bn: {
    hello: "নমস্কার!",
    welcome: "আপনাকে স্বাগতম!",
    howHelp: "আমি কিভাবে আপনাকে সাহায্য করতে পারি?",
    goodbye: "ধন্যবাদ! আবার দেখা হবে।",
  },
  te: {
    hello: "నమస్కారం!",
    welcome: "స్వాగతం!",
    howHelp: "నేను మీకు ఎలా సహాయం చేయగలను?",
    goodbye: "ధన్యవాదాలు! మళ్ళీ కలుద్దాం.",
  },
  mr: {
    hello: "नमस्कार!",
    welcome: "आपले स्वागत आहे!",
    howHelp: "मी तुम्हाला कशी मदत करू शकतो?",
    goodbye: "धन्यवाद! पुन्हा भेटू.",
  },
  ta: {
    hello: "வணக்கம்!",
    welcome: "வரவேற்கிறோம்!",
    howHelp: "நான் உங்களுக்கு எப்படி உதவலாம்?",
    goodbye: "நன்றி! மீண்டும் சந்திக்கலாம்.",
  },
  gu: {
    hello: "નમસ્તે!",
    welcome: "આપનું સ્વાગત છે!",
    howHelp: "હું આપની કેવી રીતે મદદ કરી શકું?",
    goodbye: "આભાર! ફરી મળીશું.",
  },
  kn: {
    hello: "ನಮಸ್ಕಾರ!",
    welcome: "ಸ್ವಾಗತ!",
    howHelp: "ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
    goodbye: "ಧನ್ಯವಾದ! ಮತ್ತೆ ಸಿಗೋಣ.",
  },
  ml: {
    hello: "നമസ്കാരം!",
    welcome: "സ്വാഗതം!",
    howHelp: "ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?",
    goodbye: "നന്ദി! വീണ്ടും കാണാം.",
  },
  pa: {
    hello: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ!",
    welcome: "ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ!",
    howHelp: "ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
    goodbye: "ਧੰਨਵਾਦ! ਫਿਰ ਮਿਲਾਂਗੇ।",
  },
  or: {
    hello: "ନମସ୍କାର!",
    welcome: "ଆପଣଙ୍କୁ ସ୍ୱାଗତ!",
    howHelp: "ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
    goodbye: "ଧନ୍ୟବାଦ! ଆଉ ଥରେ ଭେଟ ହେବ।",
  },
  en: {
    hello: "Hello!",
    welcome: "Welcome!",
    howHelp: "How can I help you today?",
    goodbye: "Thank you! Have a great day.",
  },
};

/**
 * Gets the default language code for a given Indian state.
 */
export function getDefaultLanguageForState(stateCode: string): string {
  const lang = INDIAN_LANGUAGES.find(l => l.statesSpoken.includes(stateCode));
  return lang?.code ?? "hi"; // Default to Hindi
}

/**
 * Returns greeting template for a language code.
 * Falls back to English if language not found.
 */
export function getGreeting(languageCode: string): typeof GREETINGS["en"] {
  return GREETINGS[languageCode] || GREETINGS["en"];
}

/**
 * Builds a multilingual greeting message for an AI agent
 * given a business's primary language and optional secondary.
 */
export function buildAgentGreeting(
  primaryLang: string,
  businessName: string,
  secondaryLang?: string
): string {
  const primary = getGreeting(primaryLang);
  const lines = [
    `${primary.hello} ${primary.welcome}`,
    `${businessName} में आपका स्वागत है!`.replace("में", primaryLang === "en" ? "—" : "में"),
    primary.howHelp,
  ];

  if (secondaryLang && secondaryLang !== primaryLang) {
    const secondary = getGreeting(secondaryLang);
    lines.push(`\n${secondary.hello} ${secondary.howHelp}`);
  }

  return lines.join("\n");
}

/**
 * Detects likely language from a text string using character range detection.
 * Useful for routing AI responses to correct language.
 */
export function detectLanguage(text: string): string {
  const ranges: Record<string, [number, number][]> = {
    hi: [[0x0900, 0x097F]], // Devanagari
    ta: [[0x0B80, 0x0BFF]], // Tamil
    te: [[0x0C00, 0x0C7F]], // Telugu
    kn: [[0x0C80, 0x0CFF]], // Kannada
    ml: [[0x0D00, 0x0D7F]], // Malayalam
    bn: [[0x0980, 0x09FF]], // Bengali (also Assamese)
    gu: [[0x0A80, 0x0AFF]], // Gujarati
    pa: [[0x0A00, 0x0A7F]], // Gurmukhi (Punjabi)
    or: [[0x0B00, 0x0B7F]], // Odia
    ur: [[0x0600, 0x06FF]], // Arabic/Urdu
  };

  const counts: Record<string, number> = {};
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    for (const [lang, rangeList] of Object.entries(ranges)) {
      for (const [start, end] of rangeList) {
        if (cp >= start && cp <= end) {
          counts[lang] = (counts[lang] || 0) + 1;
        }
      }
    }
  }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return sorted[0]?.[0] ?? "en";
}

/**
 * Currency formatting for Indian numbering system (lakhs/crores).
 * E.g.: 1,50,000 instead of 150,000
 */
export function formatINR(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted;
}

/**
 * Converts a number to Indian word representation (for invoices).
 * E.g.: 12500 → "Twelve Thousand Five Hundred"
 */
export function numberToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  if (num < 0) return `Minus ${numberToIndianWords(-num)}`;

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "");
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = convert(rupees) + " Rupees";
  if (paise > 0) result += " and " + convert(paise) + " Paise";
  return result + " Only";
}
