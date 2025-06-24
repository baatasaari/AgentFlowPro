import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertNewsletterSubscriberSchema, insertContactSubmissionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Lead capture endpoint
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.json({ success: true, lead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create lead" });
      }
    }
  });

  // Newsletter subscription endpoint
  app.post("/api/newsletter", async (req, res) => {
    try {
      const subscriberData = insertNewsletterSubscriberSchema.parse(req.body);
      const subscriber = await storage.createNewsletterSubscriber(subscriberData);
      res.json({ success: true, subscriber });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to subscribe to newsletter" });
      }
    }
  });

  // Contact form submission endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const contactData = insertContactSubmissionSchema.parse(req.body);
      const submission = await storage.createContactSubmission(contactData);
      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to submit contact form" });
      }
    }
  });

  // Get leads (for admin/internal use)
  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get contact submissions (for admin/internal use)
  app.get("/api/contact", async (req, res) => {
    try {
      const submissions = await storage.getContactSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contact submissions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
