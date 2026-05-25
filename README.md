# AgentFlowPro

**Multi-tenant SaaS platform for Indian businesses to deploy AI chat agents, automate workflows, and manage appointments — with deep India-market integrations.**

---

## What It Does

Business owners (clinics, salons, coaching centres, restaurants, real estate agents, etc.) sign up, connect their website and tools, and get an embeddable AI chat widget that:

- Answers questions using their own business data (services, staff, FAQs, policies)
- Books appointments with real availability checking
- Sends WhatsApp confirmations and reminders
- Accepts UPI / Razorpay payments
- Pushes leads to Zoho CRM
- Runs multi-step automation workflows

---

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables (copy and fill in)
cp .env.example .env

# Push schema to your Postgres database
npm run db:push

# Start development server
npm run dev
```

The app runs on **http://localhost:5000**.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon or local) |
| `JWT_SECRET` | ✅ | Secret for JWT signing (min 32 chars) |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key for AI chat |
| `STRIPE_SECRET_KEY` | Billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Billing | Stripe webhook signing secret |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth app client secret |
| `TEST_DATABASE_URL` | Testing | Postgres URL for integration tests |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, React Query |
| Backend | Node.js, Express, TypeScript (ES modules) |
| Database | PostgreSQL via Drizzle ORM (Neon serverless or local `pg`) |
| AI | Anthropic Claude (`claude-haiku-4-5`) |
| Auth | JWT (30-day), bcrypt, Google OAuth 2.0 |
| Payments | Stripe (subscriptions) + Razorpay + UPI deep links |
| Messaging | WhatsApp Business Cloud API (Meta) |
| SMS | MSG91 (DLT-compliant for India) |
| Calendar | Google Calendar API (OAuth 2.0) |
| CRM | Zoho CRM REST API v7 (Indian data center) |

---

## Project Structure

```
├── client/                   # React frontend
│   └── src/
│       ├── pages/            # Route-level page components
│       ├── components/       # Shared UI components
│       └── lib/              # API client, utilities
│
├── server/                   # Express backend
│   ├── index.ts              # Entry point, middleware, widget.js serving
│   ├── routes.ts             # All API route handlers
│   ├── auth.ts               # JWT auth, Google OAuth, password utils
│   ├── storage.ts            # Database access layer
│   ├── db.ts                 # Drizzle client (Neon / local pg)
│   ├── email.ts              # Nodemailer email sending
│   │
│   ├── india/                # India-market utilities
│   │   ├── gst.ts            # GSTIN validation, GST calculation
│   │   ├── holidays.ts       # Indian public holidays 2024-2026
│   │   ├── languages.ts      # 13 Indian languages, detection, INR formatting
│   │   └── phone.ts          # Phone / UPI / PIN code validation
│   │
│   ├── plugins/              # Integration connectors
│   │   ├── registry.ts       # Plugin registry (self-registering pattern)
│   │   ├── load-all.ts       # Import all plugins at server start
│   │   ├── website-scraper.ts  # Scrape business website with cheerio
│   │   ├── whatsapp.ts       # Meta Cloud API messaging
│   │   ├── razorpay.ts       # Payment links + UPI
│   │   ├── msg91.ts          # SMS (DLT template support)
│   │   ├── google-calendar.ts  # Calendar events + free/busy
│   │   └── zoho-crm.ts       # Lead / contact management
│   │
│   └── workflows/
│       └── engine.ts         # Event-driven workflow execution
│
├── shared/
│   └── schema.ts             # Drizzle tables + Zod schemas (single source of truth)
│
├── tests/
│   ├── setup.ts              # Test env vars
│   ├── unit/                 # Unit tests (no DB needed)
│   │   ├── india/            # GST, holidays, languages, phone tests
│   │   ├── plugins/          # WhatsApp, Razorpay, website-scraper tests
│   │   └── workflows/        # Engine interpolation, retry, condition tests
│   └── integration/
│       └── api.test.ts       # Full HTTP API tests (needs TEST_DATABASE_URL)
│
└── public/
    └── widget.js             # Embeddable chat widget (served at /widget.js)
```

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register user + create org |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET` | `/api/auth/me` | Current user + org |
| `GET` | `/api/auth/google` | Google OAuth redirect |

### Business
| Method | Path | Description |
|---|---|---|
| `PUT` | `/api/business-settings` | Save business profile |
| `GET/POST` | `/api/services` | Services catalogue |
| `PUT/DELETE` | `/api/services/:id` | Update / delete service |
| `GET/POST` | `/api/staff` | Staff management |
| `PUT` | `/api/staff/:id/availability` | Set weekly availability |
| `GET/POST/PUT/DELETE` | `/api/knowledge` | FAQs, policies, custom knowledge |
| `GET` | `/api/analytics` | Conversation + appointment analytics |

### Booking (public)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/booking/info/:token` | Business info for booking page |
| `GET` | `/api/booking/slots/:token` | Available time slots |
| `POST` | `/api/booking/create/:token` | Create appointment |

### AI Chat (public)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/chat/config/:token` | Agent config for widget |
| `POST` | `/api/chat/message` | Send message, get AI response |
| `GET` | `/widget.js` | Embeddable widget script |

### Plugins & Workflows
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/plugins` | List all available plugins |
| `POST` | `/api/plugins/:id/test` | Test a plugin connection |
| `POST` | `/api/scrape-preview` | Scrape a URL and return structured data |
| `GET` | `/api/workflow-templates` | Pre-built workflow templates |
| `POST` | `/api/workflows/dispatch` | Trigger a workflow by event type |

### India Utilities
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/india/validate-gstin` | Validate GSTIN with checksum |
| `POST` | `/api/india/validate-phone` | Validate + normalize Indian phone |
| `POST` | `/api/india/upi-link` | Generate UPI deep link |
| `GET` | `/api/india/holidays` | Upcoming Indian holidays |
| `POST` | `/api/india/check-holiday` | Check if a date is a holiday |

---

## Embeddable Widget

Add to any website:

```html
<script
  src="https://your-domain.com/widget.js"
  data-token="YOUR_AGENT_WIDGET_TOKEN"
  data-position="bottom-right"
  data-primary-color="#6366f1"
></script>
```

The widget token is found under **Agents → Embed** in the dashboard.

---

## Plugins

All plugins implement the same interface and self-register on import.

| Plugin | Category | India-Specific |
|---|---|---|
| Website Scraper | website | |
| WhatsApp Business | communication | ✅ ~500M users in India |
| Razorpay | payment | ✅ UPI + payment links |
| MSG91 SMS | communication | ✅ DLT template support |
| Google Calendar | calendar | |
| Zoho CRM | crm | ✅ zohoapis.in data center |

### Adding a custom plugin

```typescript
// server/plugins/my-plugin.ts
import { registerPlugin } from "./registry.js";

registerPlugin({
  id: "my_plugin",
  name: "My Plugin",
  category: "communication",
  configFields: [
    { key: "apiKey", label: "API Key", type: "password", required: true, sensitive: true },
  ],
  capabilities: [],
  async testConnection(config) {
    // try connecting; return { success: true/false, message: "..." }
  },
});
```

Then add `import "./my-plugin.js"` to `server/plugins/load-all.ts`.

---

## Workflow Engine

Event-driven, in-process execution (no Redis / queue required).

**Trigger types:** `appointment_created`, `appointment_confirmed`, `appointment_cancelled`, `appointment_completed`, `lead_captured`, `payment_received`, `manual`

**Step types:** `send_whatsapp`, `send_sms`, `send_email`, `create_calendar_event`, `create_payment_link`, `push_to_crm`, `delay`, `condition`, `http_request`

**Template interpolation:**
```
"Hi {{trigger.customerName}}, your payment link: {{outputs.payment-step.shortUrl}}"
```

**Pre-built templates:**
- `appointment_confirmation` — WhatsApp + calendar event
- `appointment_reminder` — WhatsApp 24h before
- `lead_capture_and_notify` — Push to CRM + notify owner
- `payment_request` — Create Razorpay link + WhatsApp it

---

## India Market Features

### GST
```typescript
import { validateGSTIN, calculateGST } from "./server/india/gst.js";

validateGSTIN("27AAPFU0939F1ZV"); // { valid: true, details: { stateName: "Maharashtra", ... } }
calculateGST(1000, 18, false);    // { cgst: 90, sgst: 90, igst: 0, totalAmount: 1180 }
```

### Holidays
```typescript
import { isIndianHoliday, getUpcomingHolidays } from "./server/india/holidays.js";

isIndianHoliday("2026-01-26");              // true (Republic Day)
getUpcomingHolidays(30, "MH");              // holidays in next 30 days for Maharashtra
```

### Phone & UPI
```typescript
import { validateIndianPhone, generateUpiLink } from "./server/india/phone.js";

validateIndianPhone("9876543210");          // { valid: true, normalized: "+919876543210" }
generateUpiLink("clinic@paytm", 500, "Consultation"); // upi://pay?pa=clinic@paytm&am=500.00...
```

---

## Testing

```bash
# Run all unit tests (no database needed)
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Run integration tests (requires a live Postgres database)
TEST_DATABASE_URL=postgresql://user:pass@host/dbname npm test
```

**177 unit tests** cover India utilities, all plugins, and the workflow engine.  
**37 integration tests** cover the full HTTP API (auto-skipped without `TEST_DATABASE_URL`).

---

## Plans

| Plan | Price | Agents | Messages/month |
|---|---|---|---|
| Free | ₹0 | 1 | 100 |
| Starter | ₹3,999/mo | 3 | 5,000 |
| Pro | ₹11,999/mo | 10 | 25,000 |
| Enterprise | Custom | Unlimited | Unlimited |

---

## Deployment

### Build for production
```bash
npm run build        # Vite frontend + ESBuild server
npm start            # Runs dist/index.js
```

### Database migrations
```bash
npm run db:push      # Apply schema changes (drizzle-kit push)
```

### Required for production
- `DATABASE_URL` pointing to a PostgreSQL instance (Neon recommended)
- `JWT_SECRET` (strong random 32+ char string)
- `ANTHROPIC_API_KEY`
- Stripe keys if billing is enabled
