import {
  users, organizations, agents, services, staffMembers, availabilityRules,
  appointments, knowledgeEntries, businessSettings, widgetConversations,
  apiKeys, auditLogs, leads, newsletterSubscribers, contactSubmissions,
  staffServices, PLANS,
  type User, type Organization, type Agent, type Service, type StaffMember,
  type AvailabilityRule, type Appointment, type KnowledgeEntry, type BusinessSettings,
  type WidgetConversation, type ApiKey, type AuditLog,
  type Lead, type InsertLead, type NewsletterSubscriber, type InsertNewsletterSubscriber,
  type ContactSubmission, type InsertContactSubmission,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lt, lte, ne, between } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

export class DatabaseStorage {
  // ─── Users ──────────────────────────────────────────────────────────────────
  async getUser(id: number) { const [u] = await db.select().from(users).where(eq(users.id, id)); return u; }
  async getUserByEmail(email: string) { const [u] = await db.select().from(users).where(eq(users.email, email)); return u; }
  async getUserByGoogleId(gid: string) { const [u] = await db.select().from(users).where(eq(users.googleId, gid)); return u; }
  async createUser(data: Partial<User> & { email: string; username: string }): Promise<User> { const [u] = await db.insert(users).values(data as any).returning(); return u; }
  async updateUser(id: number, data: Partial<User>): Promise<User> { const [u] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning(); return u; }
  async updateUserLastLogin(id: number) { await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id)); }

  // ─── Organizations ──────────────────────────────────────────────────────────
  async getOrganization(id: number) { const [o] = await db.select().from(organizations).where(eq(organizations.id, id)); return o; }
  async getAllOrganizations() { return db.select().from(organizations).orderBy(desc(organizations.createdAt)); }

  async createOrganization(data: Partial<Organization> & { name: string; slug: string }): Promise<Organization> {
    const plan = (data.plan || "free") as keyof typeof PLANS;
    const limits = PLANS[plan];
    const [org] = await db.insert(organizations).values({
      ...data,
      maxAgents: limits.maxAgents,
      maxMonthlyMessages: limits.maxMonthlyMessages,
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
      periodResetAt: new Date(Date.now() + 30 * 86400000),
    } as any).returning();
    // Create default business settings
    await db.insert(businessSettings).values({ organizationId: org.id, businessName: data.name }).onConflictDoNothing();
    return org;
  }

  async updateOrganization(id: number, data: Partial<Organization>): Promise<Organization> {
    const [o] = await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
    return o;
  }

  async upgradePlan(organizationId: number, plan: keyof typeof PLANS): Promise<Organization> {
    const limits = PLANS[plan];
    return this.updateOrganization(organizationId, { plan, maxAgents: limits.maxAgents, maxMonthlyMessages: limits.maxMonthlyMessages });
  }

  async incrementMessageCount(organizationId: number): Promise<{ allowed: boolean }> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    if (!org || org.isSuspended) return { allowed: false };
    if (org.messagesThisPeriod >= org.maxMonthlyMessages) return { allowed: false };
    await db.update(organizations).set({ messagesThisPeriod: sql`${organizations.messagesThisPeriod} + 1` }).where(eq(organizations.id, organizationId));
    return { allowed: true };
  }

  // ─── Business Settings ──────────────────────────────────────────────────────
  async getBusinessSettings(organizationId: number): Promise<BusinessSettings | undefined> {
    const [s] = await db.select().from(businessSettings).where(eq(businessSettings.organizationId, organizationId));
    return s;
  }

  async upsertBusinessSettings(organizationId: number, data: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const existing = await this.getBusinessSettings(organizationId);
    if (existing) {
      const [s] = await db.update(businessSettings).set({ ...data, updatedAt: new Date() }).where(eq(businessSettings.organizationId, organizationId)).returning();
      return s;
    }
    const [s] = await db.insert(businessSettings).values({ organizationId, ...data } as any).returning();
    return s;
  }

  // ─── Agents ─────────────────────────────────────────────────────────────────
  async getAgents(organizationId: number) { return db.select().from(agents).where(eq(agents.organizationId, organizationId)).orderBy(desc(agents.createdAt)); }
  async getAgentById(id: number) { const [a] = await db.select().from(agents).where(eq(agents.id, id)); return a; }
  async getAgentByWidgetToken(token: string) { const [a] = await db.select().from(agents).where(eq(agents.widgetToken, token)); return a; }
  async getAgent(id: number, organizationId: number) { const [a] = await db.select().from(agents).where(and(eq(agents.id, id), eq(agents.organizationId, organizationId))); return a; }

  async createAgent(data: Partial<Agent> & { organizationId: number; createdById: number; name: string }): Promise<Agent> {
    const [a] = await db.insert(agents).values(data as any).returning();
    return a;
  }

  async updateAgent(id: number, organizationId: number, data: Partial<Agent>): Promise<Agent | undefined> {
    const [a] = await db.update(agents).set({ ...data, updatedAt: new Date() }).where(and(eq(agents.id, id), eq(agents.organizationId, organizationId))).returning();
    return a;
  }

  async deleteAgent(id: number, organizationId: number): Promise<boolean> {
    const r = await db.delete(agents).where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  async incrementAgentStats(agentId: number) {
    await db.update(agents).set({ totalMessages: sql`${agents.totalMessages} + 1` }).where(eq(agents.id, agentId));
  }

  // ─── Services ────────────────────────────────────────────────────────────────
  async getServices(organizationId: number) {
    return db.select().from(services).where(and(eq(services.organizationId, organizationId))).orderBy(services.sortOrder, services.name);
  }

  async getActiveServices(organizationId: number) {
    return db.select().from(services).where(and(eq(services.organizationId, organizationId), eq(services.isActive, true))).orderBy(services.sortOrder, services.name);
  }

  async createService(organizationId: number, data: Partial<Service>): Promise<Service> {
    const [s] = await db.insert(services).values({ ...data, organizationId } as any).returning();
    return s;
  }

  async updateService(id: number, organizationId: number, data: Partial<Service>): Promise<Service | undefined> {
    const [s] = await db.update(services).set({ ...data, updatedAt: new Date() }).where(and(eq(services.id, id), eq(services.organizationId, organizationId))).returning();
    return s;
  }

  async deleteService(id: number, organizationId: number): Promise<boolean> {
    const r = await db.delete(services).where(and(eq(services.id, id), eq(services.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Staff ───────────────────────────────────────────────────────────────────
  async getStaff(organizationId: number) {
    return db.select().from(staffMembers).where(eq(staffMembers.organizationId, organizationId)).orderBy(staffMembers.sortOrder, staffMembers.name);
  }

  async getActiveStaff(organizationId: number) {
    return db.select().from(staffMembers).where(and(eq(staffMembers.organizationId, organizationId), eq(staffMembers.isActive, true))).orderBy(staffMembers.sortOrder, staffMembers.name);
  }

  async createStaff(organizationId: number, data: Partial<StaffMember>): Promise<StaffMember> {
    const [s] = await db.insert(staffMembers).values({ ...data, organizationId } as any).returning();
    return s;
  }

  async updateStaff(id: number, organizationId: number, data: Partial<StaffMember>): Promise<StaffMember | undefined> {
    const [s] = await db.update(staffMembers).set(data).where(and(eq(staffMembers.id, id), eq(staffMembers.organizationId, organizationId))).returning();
    return s;
  }

  async deleteStaff(id: number, organizationId: number): Promise<boolean> {
    const r = await db.delete(staffMembers).where(and(eq(staffMembers.id, id), eq(staffMembers.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Availability Rules ───────────────────────────────────────────────────────
  async getAvailability(staffId: number) {
    return db.select().from(availabilityRules).where(and(eq(availabilityRules.staffId, staffId), eq(availabilityRules.isActive, true))).orderBy(availabilityRules.dayOfWeek);
  }

  async getAvailabilityForOrg(organizationId: number) {
    return db.select().from(availabilityRules).where(eq(availabilityRules.organizationId, organizationId));
  }

  async setAvailability(staffId: number, organizationId: number, rules: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>): Promise<void> {
    await db.delete(availabilityRules).where(and(eq(availabilityRules.staffId, staffId), eq(availabilityRules.organizationId, organizationId)));
    if (rules.length > 0) {
      await db.insert(availabilityRules).values(rules.map(r => ({ ...r, staffId, organizationId })));
    }
  }

  // ─── Available Slots ──────────────────────────────────────────────────────────
  async getAvailableSlots(opts: {
    organizationId: number;
    staffId?: number;
    serviceId?: number;
    date: string; // YYYY-MM-DD
  }): Promise<Array<{ staffId: number; staffName: string; startTime: string; endTime: string }>> {
    const { organizationId, staffId, serviceId, date } = opts;
    const dateObj = new Date(date + "T00:00:00Z");
    const dayOfWeek = dateObj.getUTCDay();

    // Get service duration
    let durationMinutes = 60;
    let bufferMinutes = 0;
    if (serviceId) {
      const [svc] = await db.select().from(services).where(eq(services.id, serviceId));
      if (svc) { durationMinutes = svc.durationMinutes || 60; bufferMinutes = svc.bufferMinutes || 0; }
    }

    // Get staff to check
    let staffList = staffId
      ? await db.select().from(staffMembers).where(and(eq(staffMembers.id, staffId), eq(staffMembers.organizationId, organizationId), eq(staffMembers.isActive, true), eq(staffMembers.acceptsOnlineBooking, true)))
      : await this.getActiveStaff(organizationId);
    staffList = staffList.filter(s => s.acceptsOnlineBooking);

    const slots: Array<{ staffId: number; staffName: string; startTime: string; endTime: string }> = [];

    for (const staff of staffList) {
      // Get availability for this day
      const [avail] = await db.select().from(availabilityRules)
        .where(and(eq(availabilityRules.staffId, staff.id), eq(availabilityRules.dayOfWeek, dayOfWeek), eq(availabilityRules.isActive, true)));
      if (!avail) continue;

      // Get existing appointments for this staff on this date
      const dayStart = new Date(date + "T00:00:00Z");
      const dayEnd = new Date(date + "T23:59:59Z");
      const existingAppts = await db.select().from(appointments)
        .where(and(
          eq(appointments.staffId, staff.id),
          gte(appointments.startsAt, dayStart),
          lte(appointments.startsAt, dayEnd),
          ne(appointments.status, "cancelled"),
        ));

      // Generate 30-min slot increments within availability window
      const [sh, sm] = avail.startTime.split(":").map(Number);
      const [eh, em] = avail.endTime.split(":").map(Number);
      const windowStart = sh * 60 + sm;
      const windowEnd = eh * 60 + em - durationMinutes;

      for (let min = windowStart; min <= windowEnd; min += 30) {
        const slotEnd = min + durationMinutes + bufferMinutes;
        // Check for conflicts with existing appointments
        const slotStartISO = new Date(`${date}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00Z`);
        const slotEndISO = new Date(`${date}T${String(Math.floor(slotEnd / 60)).padStart(2, "0")}:${String(slotEnd % 60).padStart(2, "0")}:00Z`);

        const conflict = existingAppts.some(a => {
          const as = new Date(a.startsAt).getTime();
          const ae = new Date(a.endsAt).getTime();
          return slotStartISO.getTime() < ae && slotEndISO.getTime() > as;
        });

        if (!conflict) {
          slots.push({
            staffId: staff.id,
            staffName: staff.name,
            startTime: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`,
            endTime: `${String(Math.floor((min + durationMinutes) / 60)).padStart(2, "0")}:${String((min + durationMinutes) % 60).padStart(2, "0")}`,
          });
        }
      }
    }

    return slots;
  }

  // ─── Appointments ────────────────────────────────────────────────────────────
  async getAppointments(organizationId: number, opts?: { status?: string; from?: Date; to?: Date }) {
    let query = db.select({
      appointment: appointments,
      service: { id: services.id, name: services.name, price: services.price, currency: services.currency },
      staff: { id: staffMembers.id, name: staffMembers.name, role: staffMembers.role },
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(staffMembers, eq(appointments.staffId, staffMembers.id))
    .where(eq(appointments.organizationId, organizationId))
    .orderBy(desc(appointments.startsAt));

    return query;
  }

  async getAppointment(id: number, organizationId: number) {
    const [a] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)));
    return a;
  }

  async createAppointment(organizationId: number, data: Partial<Appointment>): Promise<Appointment> {
    const [a] = await db.insert(appointments).values({ ...data, organizationId } as any).returning();
    return a;
  }

  async updateAppointment(id: number, organizationId: number, data: Partial<Appointment>): Promise<Appointment | undefined> {
    const [a] = await db.update(appointments).set({ ...data, updatedAt: new Date() }).where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId))).returning();
    return a;
  }

  async cancelAppointment(id: number, organizationId: number, reason?: string): Promise<Appointment | undefined> {
    return this.updateAppointment(id, organizationId, { status: "cancelled", cancellationReason: reason || null, cancelledAt: new Date() });
  }

  // ─── Knowledge Base ───────────────────────────────────────────────────────────
  async getKnowledge(organizationId: number) {
    return db.select().from(knowledgeEntries).where(and(eq(knowledgeEntries.organizationId, organizationId), eq(knowledgeEntries.isActive, true))).orderBy(knowledgeEntries.type, knowledgeEntries.sortOrder);
  }

  async createKnowledge(organizationId: number, data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    const [k] = await db.insert(knowledgeEntries).values({ ...data, organizationId } as any).returning();
    return k;
  }

  async updateKnowledge(id: number, organizationId: number, data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry | undefined> {
    const [k] = await db.update(knowledgeEntries).set({ ...data, updatedAt: new Date() }).where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.organizationId, organizationId))).returning();
    return k;
  }

  async deleteKnowledge(id: number, organizationId: number): Promise<boolean> {
    const r = await db.delete(knowledgeEntries).where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Build grounding context for AI ────────────────────────────────────────
  async buildGroundingContext(organizationId: number, agentId: number): Promise<string> {
    const [biz, svcList, staffList, knowledge] = await Promise.all([
      this.getBusinessSettings(organizationId),
      this.getActiveServices(organizationId),
      this.getActiveStaff(organizationId),
      this.getKnowledge(organizationId),
    ]);

    let ctx = "=== BUSINESS CONTEXT ===\n";
    if (biz) {
      if (biz.businessName) ctx += `Business: ${biz.businessName}\n`;
      if (biz.tagline) ctx += `Tagline: ${biz.tagline}\n`;
      if (biz.description) ctx += `About: ${biz.description}\n`;
      if (biz.phone) ctx += `Phone: ${biz.phone}\n`;
      if (biz.email) ctx += `Email: ${biz.email}\n`;
      if (biz.address) ctx += `Address: ${biz.address}${biz.city ? ", " + biz.city : ""}\n`;
      if (biz.website) ctx += `Website: ${biz.website}\n`;
      if (biz.businessHours && Object.keys(biz.businessHours as object).length > 0) {
        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const hours = biz.businessHours as Record<string, any>;
        const hoursStr = Object.entries(hours).map(([d, h]: [string, any]) => h.closed ? `${d}: Closed` : `${d}: ${h.open}–${h.close}`).join(", ");
        ctx += `Hours: ${hoursStr}\n`;
      }
    }

    if (svcList.length > 0) {
      ctx += "\n=== SERVICES & PACKAGES ===\n";
      const byCat: Record<string, typeof svcList> = {};
      for (const s of svcList) { const cat = s.category || "General"; (byCat[cat] ??= []).push(s); }
      for (const [cat, svcs] of Object.entries(byCat)) {
        ctx += `\n[${cat}]\n`;
        for (const s of svcs) {
          ctx += `• ${s.name}`;
          if (s.price && parseFloat(String(s.price)) > 0) ctx += ` — ${s.currency || "USD"} ${s.price}`;
          if (s.durationMinutes) ctx += ` (${s.durationMinutes} min)`;
          if (s.description) ctx += `\n  ${s.description}`;
          ctx += "\n";
        }
      }
    }

    if (staffList.length > 0) {
      ctx += "\n=== OUR TEAM ===\n";
      for (const st of staffList) {
        ctx += `• ${st.name}`;
        if (st.role) ctx += ` — ${st.role}`;
        if (st.speciality) ctx += ` (${st.speciality})`;
        if (st.bio) ctx += `\n  ${st.bio}`;
        ctx += "\n";
      }
    }

    const faqs = knowledge.filter(k => k.type === "faq" && k.question);
    if (faqs.length > 0) {
      ctx += "\n=== FREQUENTLY ASKED QUESTIONS ===\n";
      for (const f of faqs) { ctx += `Q: ${f.question}\nA: ${f.answer}\n\n`; }
    }

    const policies = knowledge.filter(k => k.type === "policy");
    if (policies.length > 0) {
      ctx += "\n=== POLICIES ===\n";
      for (const p of policies) { ctx += `${p.title || "Policy"}: ${p.answer}\n`; }
    }

    const other = knowledge.filter(k => !["faq", "policy"].includes(k.type));
    if (other.length > 0) {
      ctx += "\n=== ADDITIONAL INFORMATION ===\n";
      for (const o of other) { ctx += `${o.title || o.type}: ${o.answer}\n`; }
    }

    return ctx;
  }

  // ─── Widget Conversations ────────────────────────────────────────────────────
  async getOrCreateConversation(agentId: number, organizationId: number, sessionId: string): Promise<WidgetConversation> {
    const [existing] = await db.select().from(widgetConversations).where(and(eq(widgetConversations.agentId, agentId), eq(widgetConversations.sessionId, sessionId)));
    if (existing) return existing;
    const [conv] = await db.insert(widgetConversations).values({ agentId, organizationId, sessionId, messages: [] }).returning();
    // Increment agent conversations count
    await db.update(agents).set({ totalConversations: sql`${agents.totalConversations} + 1` }).where(eq(agents.id, agentId));
    return conv;
  }

  async appendMessage(sessionId: number, role: "user" | "assistant", content: string): Promise<void> {
    await db.update(widgetConversations).set({
      messages: sql`${widgetConversations.messages} || ${JSON.stringify([{ role, content, ts: Date.now() }])}::jsonb`,
      lastMessageAt: new Date(),
      messageCount: sql`${widgetConversations.messageCount} + 1`,
    }).where(eq(widgetConversations.id, sessionId));
  }

  async updateConversationLead(sessionId: number, data: { leadName?: string; leadEmail?: string; leadPhone?: string }): Promise<void> {
    await db.update(widgetConversations).set(data).where(eq(widgetConversations.id, sessionId));
  }

  // ─── Analytics ────────────────────────────────────────────────────────────────
  async getAnalytics(organizationId: number) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    const [allAppts, allConvs, allSvcs, org] = await Promise.all([
      db.select().from(appointments).where(eq(appointments.organizationId, organizationId)),
      db.select().from(widgetConversations).where(eq(widgetConversations.organizationId, organizationId)),
      db.select().from(services).where(eq(services.organizationId, organizationId)),
      this.getOrganization(organizationId),
    ]);

    // Appointment stats
    const confirmedAppts = allAppts.filter(a => a.status === "confirmed" || a.status === "completed");
    const paidAppts = allAppts.filter(a => a.paymentStatus === "paid");
    const totalRevenue = paidAppts.reduce((s, a) => s + parseFloat(String(a.paymentAmount || 0)), 0);
    const thisMonthAppts = allAppts.filter(a => new Date(a.createdAt!) >= thirtyDaysAgo);
    const todayAppts = allAppts.filter(a => new Date(a.startsAt) >= todayStart);
    const pendingAppts = allAppts.filter(a => a.status === "pending");

    // Conversation stats
    const thisMonthConvs = allConvs.filter(c => new Date(c.startedAt!) >= thirtyDaysAgo);
    const leads = allConvs.filter(c => c.leadEmail);
    const avgMessages = allConvs.length ? Math.round(allConvs.reduce((s, c) => s + (c.messageCount || 0), 0) / allConvs.length) : 0;

    // Daily breakdown for charts (last 30 days)
    const dailyData: Record<string, { date: string; conversations: number; appointments: number; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyData[key] = { date: key, conversations: 0, appointments: 0, revenue: 0 };
    }
    for (const c of allConvs) {
      const key = new Date(c.startedAt!).toISOString().slice(0, 10);
      if (dailyData[key]) dailyData[key].conversations++;
    }
    for (const a of allAppts) {
      const key = new Date(a.createdAt!).toISOString().slice(0, 10);
      if (dailyData[key]) {
        dailyData[key].appointments++;
        if (a.paymentStatus === "paid") dailyData[key].revenue += parseFloat(String(a.paymentAmount || 0));
      }
    }

    // Appointment status breakdown
    const statusBreakdown = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
    for (const a of allAppts) { if (a.status in statusBreakdown) statusBreakdown[a.status as keyof typeof statusBreakdown]++; }

    // Top services
    const serviceCounts: Record<number, { name: string; count: number; revenue: number }> = {};
    for (const a of allAppts) {
      if (a.serviceId) {
        if (!serviceCounts[a.serviceId]) {
          const svc = allSvcs.find(s => s.id === a.serviceId);
          serviceCounts[a.serviceId] = { name: svc?.name || "Unknown", count: 0, revenue: 0 };
        }
        serviceCounts[a.serviceId].count++;
        if (a.paymentStatus === "paid") serviceCounts[a.serviceId].revenue += parseFloat(String(a.paymentAmount || 0));
      }
    }
    const topServices = Object.values(serviceCounts).sort((a, b) => b.count - a.count).slice(0, 5);

    // Recent leads (from conversations)
    const recentLeads = allConvs.filter(c => c.leadEmail).sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime()).slice(0, 20).map(c => ({
      name: c.leadName, email: c.leadEmail, phone: c.leadPhone, date: c.startedAt,
    }));

    return {
      overview: {
        totalConversations: allConvs.length,
        conversationsThisMonth: thisMonthConvs.length,
        totalAppointments: allAppts.length,
        appointmentsThisMonth: thisMonthAppts.length,
        appointmentsToday: todayAppts.length,
        pendingAppointments: pendingAppts.length,
        totalLeads: leads.length,
        avgMessagesPerConversation: avgMessages,
        totalRevenue,
        revenueThisMonth: paidAppts.filter(a => new Date(a.createdAt!) >= thirtyDaysAgo).reduce((s, a) => s + parseFloat(String(a.paymentAmount || 0)), 0),
        messagesThisPeriod: org?.messagesThisPeriod || 0,
        maxMonthlyMessages: org?.maxMonthlyMessages || 100,
        usagePercent: org ? Math.round(((org.messagesThisPeriod || 0) / (org.maxMonthlyMessages || 100)) * 100) : 0,
      },
      charts: {
        daily: Object.values(dailyData),
        statusBreakdown,
        topServices,
      },
      recentLeads,
    };
  }

  async getDashboardStats(organizationId: number) {
    const [agentRows, org] = await Promise.all([
      db.select().from(agents).where(eq(agents.organizationId, organizationId)),
      this.getOrganization(organizationId),
    ]);
    return {
      totalAgents: agentRows.length,
      activeAgents: agentRows.filter(a => a.status === "active").length,
      totalMessages: agentRows.reduce((s, a) => s + (a.totalMessages || 0), 0),
      messagesThisPeriod: org?.messagesThisPeriod ?? 0,
      maxMonthlyMessages: org?.maxMonthlyMessages ?? 100,
      plan: org?.plan ?? "free",
      usagePercent: org ? Math.round(((org.messagesThisPeriod || 0) / (org.maxMonthlyMessages || 100)) * 100) : 0,
    };
  }

  // ─── API Keys ────────────────────────────────────────────────────────────────
  async getApiKeys(organizationId: number) {
    const keys = await db.select().from(apiKeys).where(and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.isActive, true))).orderBy(desc(apiKeys.createdAt));
    return keys.map(({ keyHash: _kh, ...rest }) => rest);
  }

  async createApiKey(organizationId: number, createdById: number, name: string, expiresAt?: Date) {
    const rawKey = `afp_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);
    const [apiKey] = await db.insert(apiKeys).values({ keyId: uuidv4(), name, keyHash, keyPrefix, organizationId, createdById, expiresAt: expiresAt || null, isActive: true }).returning();
    return { apiKey, rawKey };
  }

  async revokeApiKey(id: number, organizationId: number) {
    const r = await db.update(apiKeys).set({ isActive: false }).where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId)));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────
  async getAdminStats() {
    const [allOrgs, allAgents] = await Promise.all([db.select().from(organizations), db.select().from(agents)]);
    return {
      totalOrganizations: allOrgs.length,
      activeOrganizations: allOrgs.filter(o => !o.isSuspended).length,
      totalAgents: allAgents.length,
      activeAgents: allAgents.filter(a => a.status === "active").length,
      planBreakdown: { free: allOrgs.filter(o => o.plan === "free").length, starter: allOrgs.filter(o => o.plan === "starter").length, professional: allOrgs.filter(o => o.plan === "professional").length, enterprise: allOrgs.filter(o => o.plan === "enterprise").length },
      totalMessages: allOrgs.reduce((s, o) => s + (o.messagesThisPeriod || 0), 0),
    };
  }

  async getAllOrgsWithUsers() {
    const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    return Promise.all(orgs.map(async (org) => {
      const orgUsers = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, createdAt: users.createdAt }).from(users).where(eq(users.organizationId, org.id));
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(agents).where(eq(agents.organizationId, org.id));
      return { ...org, users: orgUsers, agentCount: Number(count || 0) };
    }));
  }

  // ─── Marketing ───────────────────────────────────────────────────────────────
  async createLead(data: InsertLead) { const [l] = await db.insert(leads).values(data).returning(); return l; }
  async createNewsletterSubscriber(data: InsertNewsletterSubscriber) { const [s] = await db.insert(newsletterSubscribers).values(data).returning(); return s; }
  async createContactSubmission(data: InsertContactSubmission) { const [c] = await db.insert(contactSubmissions).values(data).returning(); return c; }
}

export const storage = new DatabaseStorage();
