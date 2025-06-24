import { users, leads, newsletterSubscribers, contactSubmissions, type User, type InsertUser, type Lead, type InsertLead, type NewsletterSubscriber, type InsertNewsletterSubscriber, type ContactSubmission, type InsertContactSubmission } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createLead(lead: InsertLead): Promise<Lead>;
  createNewsletterSubscriber(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber>;
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  getLeads(): Promise<Lead[]>;
  getContactSubmissions(): Promise<ContactSubmission[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private leads: Map<number, Lead>;
  private newsletterSubscribers: Map<number, NewsletterSubscriber>;
  private contactSubmissions: Map<number, ContactSubmission>;
  private currentUserId: number;
  private currentLeadId: number;
  private currentSubscriberId: number;
  private currentContactId: number;

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    this.newsletterSubscribers = new Map();
    this.contactSubmissions = new Map();
    this.currentUserId = 1;
    this.currentLeadId = 1;
    this.currentSubscriberId = 1;
    this.currentContactId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = this.currentLeadId++;
    const lead: Lead = { 
      ...insertLead, 
      id, 
      createdAt: new Date(),
      company: insertLead.company || null,
      phone: insertLead.phone || null,
      planInterest: insertLead.planInterest || null,
      message: insertLead.message || null
    };
    this.leads.set(id, lead);
    return lead;
  }

  async createNewsletterSubscriber(insertSubscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const id = this.currentSubscriberId++;
    const subscriber: NewsletterSubscriber = { 
      ...insertSubscriber, 
      id, 
      subscribed: true,
      createdAt: new Date() 
    };
    this.newsletterSubscribers.set(id, subscriber);
    return subscriber;
  }

  async createContactSubmission(insertSubmission: InsertContactSubmission): Promise<ContactSubmission> {
    const id = this.currentContactId++;
    const submission: ContactSubmission = { 
      ...insertSubmission, 
      id, 
      status: "new",
      createdAt: new Date(),
      company: insertSubmission.company || null
    };
    this.contactSubmissions.set(id, submission);
    return submission;
  }

  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values());
  }

  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return Array.from(this.contactSubmissions.values());
  }
}

export const storage = new MemStorage();
