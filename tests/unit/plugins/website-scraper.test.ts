import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrapeWebsite } from "../../../server/plugins/website-scraper.js";

// Sample HTML fixture simulating a typical Indian business website
const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Dr Sharma Multi-Speciality Clinic - Mumbai</title>
  <meta name="description" content="Best multi-speciality clinic in Mumbai offering cardiology, orthopedics, and general medicine.">
  <meta property="og:site_name" content="Dr Sharma Clinic">
</head>
<body>
  <header>
    <div class="logo">Dr Sharma Clinic</div>
    <nav><a href="/">Home</a><a href="/services">Services</a><a href="/contact">Contact</a></nav>
  </header>

  <section class="hero">
    <h1>Your Health, Our Priority</h1>
    <p class="tagline">Trusted healthcare in the heart of Mumbai</p>
  </section>

  <section class="services">
    <div class="service-card">
      <h3>General Consultation</h3>
      <p>Comprehensive health check-up and diagnosis by our expert doctors</p>
      <span class="price">₹500</span>
    </div>
    <div class="service-card">
      <h3>Cardiology</h3>
      <p>ECG, Echo, stress tests and cardiac consultation</p>
      <span class="price">₹1500</span>
    </div>
    <div class="service-card">
      <h3>Orthopedics</h3>
      <p>Bone and joint care, fracture treatment</p>
      <span class="price">₹800</span>
    </div>
  </section>

  <section class="faq-section">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-item">
      <h4 class="question">What are your clinic timings?</h4>
      <p class="answer">We are open Monday to Saturday, 9 AM to 8 PM. Emergency services 24/7.</p>
    </div>
    <div class="faq-item">
      <h4 class="question">Do you accept insurance?</h4>
      <p class="answer">Yes, we accept all major insurance providers including Star Health, HDFC Ergo, and Bajaj Allianz.</p>
    </div>
    <div class="faq-item">
      <h4 class="question">How do I book an appointment?</h4>
      <p class="answer">You can book online through our website or call us at 9876543210.</p>
    </div>
  </section>

  <section class="hours">
    <h2>Working Hours</h2>
    <p>Monday 9am - 8pm</p>
    <p>Tuesday 9am - 8pm</p>
    <p>Sunday Closed</p>
  </section>

  <footer>
    <div class="contact-info">
      <p>📞 9876543210</p>
      <p>✉️ info@drsharma.com</p>
      <p>📍 15 Linking Road, Bandra West, Mumbai 400050</p>
    </div>
    <div class="social-links">
      <a href="https://www.facebook.com/drsharma">Facebook</a>
      <a href="https://www.instagram.com/drsharma_clinic">Instagram</a>
      <a href="https://wa.me/919876543210">WhatsApp</a>
    </div>
  </footer>
</body>
</html>
`;

// Mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: (key: string) => key === "content-type" ? "text/html" : null },
    text: async () => SAMPLE_HTML,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scrapeWebsite", () => {
  it("extracts business name from og:site_name", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.businessName).toBe("Dr Sharma Clinic");
  });

  it("extracts description from meta description", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.description).toContain("Mumbai");
  });

  it("extracts phone number in Indian format", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.phone).toMatch(/9876543210/);
  });

  it("extracts email address", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.email).toBe("info@drsharma.com");
  });

  it("extracts multiple services with prices", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.services.length).toBeGreaterThanOrEqual(2);

    const consultation = result.services.find(s => s.name.toLowerCase().includes("general"));
    expect(consultation).toBeDefined();
    expect(consultation?.price).toContain("500");
  });

  it("extracts FAQs with question and answer", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.faqs.length).toBeGreaterThanOrEqual(2);

    const timingsFaq = result.faqs.find(f => f.question.toLowerCase().includes("timing") || f.question.toLowerCase().includes("hour"));
    expect(timingsFaq).toBeDefined();
    expect(timingsFaq?.answer).toContain("9");
  });

  it("extracts social media links", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.socialLinks.facebook).toContain("facebook.com");
    expect(result.socialLinks.instagram).toContain("instagram.com");
    expect(result.socialLinks.whatsapp).toContain("wa.me");
  });

  it("records pages scraped", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    expect(result.pagesScraped).toContain("https://drsharma.com");
  });

  it("deduplicates services with same name", async () => {
    const result = await scrapeWebsite("https://drsharma.com");
    const names = result.services.map(s => s.name.toLowerCase());
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  it("handles fetch failure gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await scrapeWebsite("https://unreachable.com");
    expect(result.pagesScraped).toHaveLength(0);
    expect(result.services).toHaveLength(0);
    expect(result.faqs).toHaveLength(0);
  });

  it("handles non-200 HTTP responses", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "text/html" },
      text: async () => "<html><body>Not found</body></html>",
    });
    const result = await scrapeWebsite("https://example.com/notfound");
    expect(result.pagesScraped).toHaveLength(0);
  });
});

describe("price extraction", () => {
  it("handles ₹ prefix", async () => {
    const html = `<body><div class="service-card"><h3>Test Service</h3><p>desc</p><span>₹1,500</span></div></body>`;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (k: string) => k === "content-type" ? "text/html" : null },
      text: async () => html,
    });
    const result = await scrapeWebsite("https://test.com");
    expect(result.services[0]?.price).toContain("1,500");
  });
});
