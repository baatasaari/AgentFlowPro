import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // widget.js must be loadable cross-origin
}));

// Rate limiting
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many auth attempts" } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many messages" } });
app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/chat", chatLimiter);

// Raw body for Stripe webhooks
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// Serve widget.js with CORS (must be loadable from any domain)
const publicDir = path.join(process.cwd(), "public");
app.get("/widget.js", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(publicDir, "widget.js"));
});

// Chat API: allow cross-origin from any embedded site
app.use("/api/chat", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const p = req.path;
  let captured: any;
  const orig = res.json;
  res.json = function (body, ...args) { captured = body; return orig.apply(res, [body, ...args]); };
  res.on("finish", () => {
    if (p.startsWith("/api")) {
      let line = `${req.method} ${p} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured && res.statusCode >= 400) line += ` :: ${JSON.stringify(captured)}`;
      if (line.length > 120) line = line.slice(0, 119) + "…";
      log(line);
    }
  });
  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
    if (status === 500) console.error(err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
