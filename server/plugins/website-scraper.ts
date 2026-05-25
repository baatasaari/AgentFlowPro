import * as cheerio from "cheerio";
import { registerPlugin } from "./registry.js";

registerPlugin({
  id: "website_scraper",
  name: "Website Scraper",
  description: "Automatically extract services, FAQs, business hours, and contact info from any website URL.",
  icon: "🌐",
  category: "website",
  popularIn: ["IN"],
  configFields: [
    { key: "url", label: "Website URL", type: "url", required: true, placeholder: "https://yourbusiness.com" },
    { key: "deepScrape", label: "Scrape sub-pages (About, Services, Contact)", type: "boolean", required: false },
  ],
  capabilities: [
    { id: "scrape_services", name: "Extract Services & Prices", description: "Find service listings and pricing" },
    { id: "scrape_faqs", name: "Extract FAQs", description: "Find frequently asked questions" },
    { id: "scrape_hours", name: "Extract Business Hours", description: "Find opening/closing times" },
    { id: "scrape_contact", name: "Extract Contact Info", description: "Find phone, email, and address" },
  ],

  async testConnection(config) {
    try {
      const res = await fetchWithTimeout(config.url, 5000);
      if (!res.ok) return { success: false, message: `HTTP ${res.status}: ${res.statusText}` };
      return { success: true, message: "Website is accessible", data: { statusCode: res.status } };
    } catch (e: any) {
      return { success: false, message: `Cannot reach URL: ${e.message}` };
    }
  },
});

// ─── Scraper implementation ────────────────────────────────────────────────────

export interface ScrapedData {
  businessName?: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  services: Array<{ name: string; description?: string; price?: string; duration?: string }>;
  faqs: Array<{ question: string; answer: string }>;
  businessHours: Record<string, { open?: string; close?: string; closed?: boolean }>;
  socialLinks: Record<string, string>;
  pagesScraped: string[];
}

export async function scrapeWebsite(url: string, deepScrape = false): Promise<ScrapedData> {
  const baseUrl = normalizeUrl(url);
  const result: ScrapedData = {
    services: [],
    faqs: [],
    businessHours: {},
    socialLinks: {},
    pagesScraped: [],
  };

  // Determine pages to scrape
  const pages = [baseUrl];
  if (deepScrape) {
    // Try common sub-pages
    const subPaths = ["/about", "/about-us", "/services", "/our-services", "/contact", "/contact-us", "/faq", "/faqs", "/pricing"];
    pages.push(...subPaths.map(p => baseUrl.replace(/\/$/, "") + p));
  }

  for (const pageUrl of pages) {
    try {
      const html = await fetchHtml(pageUrl);
      if (!html) continue;
      result.pagesScraped.push(pageUrl);
      extractFromPage(pageUrl, html, result);
    } catch {
      // Skip unavailable pages
    }
  }

  return deduplicate(result);
}

function extractFromPage(url: string, html: string, acc: ScrapedData): void {
  const $ = cheerio.load(html);

  // ─── Business name (from meta — no cleanup needed) ───────────────────────────
  if (!acc.businessName) {
    acc.businessName =
      $("meta[property='og:site_name']").attr("content") ||
      $("meta[name='application-name']").attr("content") ||
      $(".logo").first().text().trim() ||
      $("h1").first().text().trim() ||
      $("title").text().replace(/\s*[-|].*$/, "").trim() ||
      undefined;
  }

  // ─── Description / tagline ───────────────────────────────────────────────────
  if (!acc.description) {
    acc.description =
      $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $(".hero-description, .tagline, .subtitle").first().text().trim() ||
      undefined;
  }

  // ─── Social links (before footer removal — they live in footer) ──────────────
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("facebook.com")) acc.socialLinks.facebook = href;
    else if (href.includes("instagram.com")) acc.socialLinks.instagram = href;
    else if (href.includes("twitter.com") || href.includes("x.com")) acc.socialLinks.twitter = href;
    else if (href.includes("linkedin.com")) acc.socialLinks.linkedin = href;
    else if (href.includes("youtube.com")) acc.socialLinks.youtube = href;
    else if (href.includes("wa.me") || href.includes("whatsapp")) acc.socialLinks.whatsapp = href;
  });

  // ─── Contact info (before footer removal) ────────────────────────────────────
  const fullBodyText = $("body").text();

  if (!acc.phone) {
    const phoneMatch = fullBodyText.match(/(\+91[\s\-]?)?[6-9]\d{9}|\+91[\s\-]?\d{10}/);
    if (phoneMatch) acc.phone = phoneMatch[0].replace(/[\s\-]/g, "");
  }

  if (!acc.email) {
    const emailMatch = fullBodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !emailMatch[0].includes("example.com")) acc.email = emailMatch[0];
  }

  if (!acc.address) {
    const pinMatch = fullBodyText.match(/[A-Za-z\s,.\-]+[\s,]+(?:Mumbai|Delhi|Chennai|Kolkata|Bangalore|Bengaluru|Hyderabad|Pune|Ahmedabad|Surat|Jaipur|Lucknow|Kanpur|Nagpur|Indore|Thane|Bhopal|Visakhapatnam|Vadodara|Coimbatore)[,\s\d]+\d{6}/i);
    if (pinMatch) acc.address = pinMatch[0].trim().substring(0, 200);
  }

  // Remove script, style, nav, footer clutter for service/FAQ extraction
  $("script, style, nav, footer, .nav, .navigation, .header-nav, iframe, noscript").remove();

  // ─── Services ────────────────────────────────────────────────────────────────
  // Look for common service listing patterns
  const serviceSelectors = [
    ".service-card, .service-item, .service-box",
    ".package, .plan, .pricing-card",
    "[class*='service'], [class*='Service']",
    "article.service",
  ];
  for (const sel of serviceSelectors) {
    $(sel).each((_, el) => {
      const name =
        $(el).find("h2, h3, h4, .service-title, .title").first().text().trim() ||
        $(el).find("strong").first().text().trim();
      const description = $(el).find("p, .description").first().text().trim();
      const price = extractPrice($(el).text());
      if (name && name.length > 2 && name.length < 100) {
        acc.services.push({ name, description: description.substring(0, 300), price });
      }
    });
    if (acc.services.length > 0) break;
  }

  // ─── FAQs ────────────────────────────────────────────────────────────────────
  // Look for accordion/FAQ patterns
  const faqSelectors = [
    ".faq-item, .accordion-item, [class*='faq']",
    "details",
  ];
  for (const sel of faqSelectors) {
    $(sel).each((_, el) => {
      const q = $(el).find("summary, h3, h4, .question, [class*='question'], dt").first().text().trim();
      const a = $(el).find("p, .answer, [class*='answer'], dd").first().text().trim();
      if (q && a && q.length < 300 && a.length < 1000) {
        acc.faqs.push({ question: q, answer: a });
      }
    });
  }

  // Also try dt/dd pattern (definition lists)
  $("dl").each((_, dl) => {
    const dts = $(dl).find("dt");
    const dds = $(dl).find("dd");
    dts.each((i, dt) => {
      const q = $(dt).text().trim();
      const a = $(dds.eq(i)).text().trim();
      if (q && a) acc.faqs.push({ question: q, answer: a });
    });
  });

  // ─── Business hours ───────────────────────────────────────────────────────────
  const hoursText = $("[class*='hour'], [class*='timing'], [class*='schedule'], [class*='open']").text();
  if (hoursText) {
    const dayPatterns = [
      { day: "monday", key: "mon" }, { day: "tuesday", key: "tue" },
      { day: "wednesday", key: "wed" }, { day: "thursday", key: "thu" },
      { day: "friday", key: "fri" }, { day: "saturday", key: "sat" },
      { day: "sunday", key: "sun" },
    ];
    for (const { day, key } of dayPatterns) {
      const regex = new RegExp(`${day}[\\s\\S]{0,50}?(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?\\s*[-–—]\\s*\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)`, "i");
      const match = hoursText.match(regex);
      if (match) {
        const [open, close] = match[1].split(/[-–—]/);
        acc.businessHours[key] = { open: open?.trim(), close: close?.trim() };
      }
    }
  }

}

function extractPrice(text: string): string | undefined {
  // Matches: ₹500, Rs.500, INR 500, $50, 500 INR, 500/-
  const match = text.match(/(₹|Rs\.?|INR\s?|\$)?\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s*(INR|\/\-)?/i);
  if (!match) return undefined;
  return `${match[1] || ""}${match[2]}`.replace(/\s/g, "");
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) url = `https://${url}`;
  return url.replace(/\/$/, "");
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AgentFlowPro-Scraper/1.0 (business data discovery)",
        "Accept": "text/html",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function deduplicate(data: ScrapedData): ScrapedData {
  // Deduplicate services by name
  const seen = new Set<string>();
  data.services = data.services.filter(s => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20); // cap at 20

  // Deduplicate FAQs
  const faqSeen = new Set<string>();
  data.faqs = data.faqs.filter(f => {
    const key = f.question.toLowerCase().substring(0, 50);
    if (faqSeen.has(key)) return false;
    faqSeen.add(key);
    return true;
  }).slice(0, 30);

  return data;
}
