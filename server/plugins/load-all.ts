// Import all plugins so they self-register into the plugin registry.
// This file is imported once from server/index.ts at startup.
import "./website-scraper.js";
import "./google-calendar.js";
import "./whatsapp.js";
import "./razorpay.js";
import "./msg91.js";
import "./zoho-crm.js";
