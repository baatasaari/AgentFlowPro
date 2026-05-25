import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Bot, Key, LogOut, Plus, Trash2, Zap, MessageSquare, TrendingUp, Activity,
  Copy, LayoutDashboard, Code, Check, CreditCard, Settings, AlertTriangle,
  ExternalLink, Users, Calendar, BookOpen, ChevronDown, ChevronUp, DollarSign,
  Phone, Mail, MapPin, Clock, Edit2, Save, X, HelpCircle, FileText, Info,
  BarChart2, Pencil,
} from "lucide-react";

const WIDGET_STYLES = [
  { id: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { id: "messenger", label: "Messenger", color: "#0084FF" },
  { id: "telegram", label: "Telegram", color: "#2AABEE" },
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "custom", label: "Custom", color: "#6b7280" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_COLORS = { pending: "#f59e0b", confirmed: "#10b981", completed: "#6366f1", cancelled: "#ef4444", no_show: "#6b7280" };
const CHART_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];

type TabId = "overview" | "agents" | "knowledge" | "appointments" | "analytics" | "keys" | "billing";

export default function Dashboard() {
  const { user, organization, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentStep, setAgentStep] = useState(1);
  const [embedAgent, setEmbedAgent] = useState<any>(null);
  const [editingService, setEditingService] = useState<any>(null);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<any>(null);
  const [staffAvailability, setStaffAvailability] = useState<any>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });
  const { data: analytics } = useQuery<any>({ queryKey: ["/api/analytics"] });
  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/templates"] });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ["/api/services"] });
  const { data: staff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });
  const { data: knowledge = [] } = useQuery<any[]>({ queryKey: ["/api/knowledge"] });
  const { data: appointments = [] } = useQuery<any[]>({ queryKey: ["/api/appointments"] });
  const { data: bizSettings } = useQuery<any>({ queryKey: ["/api/business-settings"] });
  const { data: keys = [] } = useQuery<any[]>({ queryKey: ["/api/keys"] });

  // Agent form
  const agentForm = useForm({ defaultValues: { name: "", businessType: "custom", systemPrompt: "", widgetStyle: "whatsapp", primaryColor: "#25D366", position: "bottom-right", maxTokens: 512, agentDisplayName: "", greetingMessage: "", enableBooking: false, enableLeadCapture: true } });

  // Service form
  const serviceForm = useForm({ defaultValues: { name: "", description: "", category: "", price: "0", durationMinutes: 60, bufferMinutes: 0, currency: "USD", isActive: true, requiresPayment: false } });

  // Staff form
  const staffForm = useForm({ defaultValues: { name: "", role: "", speciality: "", bio: "", email: "", phone: "", calendarColor: "#6366f1", acceptsOnlineBooking: true } });

  // Knowledge form
  const knowledgeForm = useForm({ defaultValues: { type: "faq", category: "", question: "", answer: "", title: "" } });

  // Biz settings form
  const [bizForm, setBizForm] = useState<any>({});
  const [bizEditing, setBizEditing] = useState(false);

  // Mutations
  const createAgent = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/agents", d).then(r => r.json()),
    onSuccess: (d) => { if (d.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; } qc.invalidateQueries({ queryKey: ["/api/agents"] }); setAgentDialogOpen(false); setAgentStep(1); agentForm.reset(); toast({ title: "Agent created!" }); },
  });
  const updateAgent = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/agents/${id}`, data).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/agents"] }) });
  const deleteAgent = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/agents/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/agents"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); } });

  const createService = useMutation({ mutationFn: (d: any) => apiRequest("POST", "/api/services", d).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/services"] }); setEditingService(null); serviceForm.reset(); toast({ title: "Service saved" }); } });
  const updateService = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/services/${id}`, data).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/services"] }); setEditingService(null); toast({ title: "Service updated" }); } });
  const deleteService = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/services/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/services"] }) });

  const createStaff = useMutation({ mutationFn: (d: any) => apiRequest("POST", "/api/staff", d).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff"] }); setEditingStaff(null); staffForm.reset(); toast({ title: "Team member added" }); } });
  const updateStaff = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/staff/${id}`, data).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff"] }); setEditingStaff(null); toast({ title: "Updated" }); } });
  const deleteStaff = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/staff/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/staff"] }) });

  const saveAvailability = useMutation({
    mutationFn: ({ staffId, rules }: any) => apiRequest("PUT", `/api/staff/${staffId}/availability`, rules),
    onSuccess: () => { setStaffAvailability(null); toast({ title: "Availability saved" }); },
  });

  const createKnowledge = useMutation({ mutationFn: (d: any) => apiRequest("POST", "/api/knowledge", d).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/knowledge"] }); setEditingKnowledge(null); knowledgeForm.reset(); toast({ title: "Entry added" }); } });
  const updateKnowledge = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/knowledge/${id}`, data).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/knowledge"] }); setEditingKnowledge(null); toast({ title: "Updated" }); } });
  const deleteKnowledge = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/knowledge/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/knowledge"] }) });

  const updateAppointment = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/appointments/${id}`, data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/appointments"] }); qc.invalidateQueries({ queryKey: ["/api/analytics"] }); toast({ title: "Appointment updated" }); },
  });

  const saveBizSettings = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/business-settings", d).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/business-settings"] }); setBizEditing(false); toast({ title: "Business info saved" }); },
  });

  const createKey = useMutation({ mutationFn: (name: string) => apiRequest("POST", "/api/keys", { name }).then(r => r.json()), onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["/api/keys"] }); setCreatedRawKey(d.rawKey); setNewKeyName(""); } });
  const revokeKey = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/keys"] }) });

  const createCheckout = useMutation({ mutationFn: (plan: string) => apiRequest("POST", "/api/billing/create-checkout", { plan }).then(r => r.json()), onSuccess: (d) => { if (d.url) window.location.href = d.url; } });
  const openPortal = useMutation({ mutationFn: () => apiRequest("POST", "/api/billing/portal").then(r => r.json()), onSuccess: (d) => { if (d.url) window.location.href = d.url; } });

  function selectTemplate(t: any) {
    agentForm.setValue("businessType", t.id);
    agentForm.setValue("systemPrompt", t.prompt);
    agentForm.setValue("greetingMessage", t.greetingMessage);
    agentForm.setValue("primaryColor", t.primaryColor);
    agentForm.setValue("agentDisplayName", t.label + " Assistant");
    setAgentStep(2);
  }

  const ov = analytics?.overview || {};
  const trialDaysLeft = organization?.trialEndsAt ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;

  const PLANS_UI = [
    { id: "free", name: "Free", price: 0, agents: 1, messages: 100 },
    { id: "starter", name: "Starter", price: 49, agents: 3, messages: 2000 },
    { id: "professional", name: "Professional", price: 149, agents: 10, messages: 15000 },
  ];

  const apptList = Array.isArray(appointments) ? appointments : [];
  const knowledgeByType = {
    faq: knowledge.filter((k: any) => k.type === "faq"),
    policy: knowledge.filter((k: any) => k.type === "policy"),
    service_info: knowledge.filter((k: any) => k.type === "service_info"),
    custom: knowledge.filter((k: any) => k.type === "custom"),
  };

  // Availability state for editing
  const defaultAvail = DAYS.map((_, i) => ({ dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i >= 1 && i <= 5 }));
  const [availRules, setAvailRules] = useState<any[]>(defaultAvail);

  async function openAvailability(staffMember: any) {
    const res = await apiRequest("GET", `/api/staff/${staffMember.id}/availability`).then(r => r.json()).catch(() => []);
    const existing = Array.isArray(res) ? res : [];
    const rules = defaultAvail.map(d => {
      const found = existing.find((r: any) => r.dayOfWeek === d.dayOfWeek);
      return found || d;
    });
    setAvailRules(rules);
    setStaffAvailability(staffMember);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
            <span className="font-bold text-sm">AgentFlow Pro</span>
          </Link>
          {organization && <p className="text-xs text-muted-foreground mt-1 truncate">{organization.name}</p>}
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "agents", label: "AI Agents", icon: Bot },
            { id: "knowledge", label: "Knowledge Hub", icon: BookOpen },
            { id: "appointments", label: "Appointments", icon: Calendar },
            { id: "analytics", label: "Analytics", icon: BarChart2 },
            { id: "keys", label: "API Keys", icon: Key },
            { id: "billing", label: "Billing & Plan", icon: CreditCard },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === id ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <Icon className="w-4 h-4 shrink-0" /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-2 border-t space-y-2">
          {trialDaysLeft !== null && organization?.plan === "free" && (
            <div className="mx-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-800">{trialDaysLeft} trial days left</p>
              <button onClick={() => setActiveTab("billing")} className="text-xs text-primary hover:underline">Upgrade →</button>
            </div>
          )}
          {organization?.isSuspended && (
            <div className="mx-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Account suspended</p>
            </div>
          )}
          <div className="px-3 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {user?.avatarUrl ? <img src={user.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt="" /> : <span className="text-xs font-bold text-primary">{(user?.firstName?.[0] || user?.username?.[0] || "U").toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.firstName || user?.username}</p>
              <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">{organization?.plan || "free"}</Badge>
            </div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            <LogOut className="w-4 h-4" /><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-6">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <>
              <div><h1 className="text-2xl font-bold">Overview</h1><p className="text-muted-foreground">Welcome back, {user?.firstName || user?.username}</p></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Conversations</p><p className="text-3xl font-bold">{ov.totalConversations ?? 0}</p><p className="text-xs text-muted-foreground">{ov.conversationsThisMonth ?? 0} this month</p></CardContent></Card>
                <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Appointments</p><p className="text-3xl font-bold">{ov.totalAppointments ?? 0}</p><p className="text-xs text-muted-foreground">{ov.appointmentsToday ?? 0} today · {ov.pendingAppointments ?? 0} pending</p></CardContent></Card>
                <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</p><p className="text-3xl font-bold">${(ov.totalRevenue ?? 0).toFixed(0)}</p><p className="text-xs text-muted-foreground">${(ov.revenueThisMonth ?? 0).toFixed(0)} this month</p></CardContent></Card>
                <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Leads Captured</p><p className="text-3xl font-bold">{ov.totalLeads ?? 0}</p><p className="text-xs text-muted-foreground">{ov.avgMessagesPerConversation ?? 0} msg/conv avg</p></CardContent></Card>
              </div>
              <Card><CardContent className="pt-4"><p className="text-sm font-medium mb-2">Monthly Message Usage — {ov.messagesThisPeriod ?? 0} / {ov.maxMonthlyMessages ?? 100}</p><Progress value={ov.usagePercent ?? 0} className="h-2" /><p className="text-xs text-muted-foreground mt-1">{ov.usagePercent ?? 0}% used</p></CardContent></Card>
              {analytics?.charts?.daily && (
                <Card><CardHeader><CardTitle className="text-sm">Last 30 Days</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={analytics.charts.daily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#6366f1" fill="url(#cg)" strokeWidth={2} />
                        <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#10b981" fill="url(#ag)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              {agents.length === 0 && <Card className="border-dashed"><CardContent className="py-12 text-center"><Bot className="w-12 h-12 mx-auto text-muted-foreground mb-3" /><h3 className="font-semibold mb-1">Create your first AI agent</h3><p className="text-muted-foreground text-sm mb-4">Add your business data, then deploy a widget on your website.</p><Button onClick={() => { setActiveTab("agents"); setAgentDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Create Agent</Button></CardContent></Card>}
            </>
          )}

          {/* ── AGENTS ── */}
          {activeTab === "agents" && (
            <>
              <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">AI Agents</h1><p className="text-muted-foreground">Agents use your Knowledge Hub data to answer questions and book appointments</p></div>
                <Dialog open={agentDialogOpen} onOpenChange={(o) => { setAgentDialogOpen(o); if (!o) { setAgentStep(1); agentForm.reset(); } }}>
                  <DialogTrigger asChild><Button disabled={!!organization?.isSuspended}><Plus className="w-4 h-4 mr-2" />New Agent</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Create AI Agent</DialogTitle><DialogDescription>Step {agentStep} of 3</DialogDescription></DialogHeader>
                    {agentStep === 1 && <div className="grid grid-cols-2 gap-3 mt-2">{templates.map((t: any) => <button key={t.id} onClick={() => selectTemplate(t)} className="text-left p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors"><p className="font-semibold text-sm">{t.label}</p><p className="text-xs text-muted-foreground mt-1">{t.description}</p></button>)}</div>}
                    {agentStep === 2 && (
                      <div className="space-y-4 mt-2">
                        <div className="space-y-1"><Label>Agent Name</Label><Input {...agentForm.register("name")} placeholder="My Support Bot" /></div>
                        <div className="space-y-1"><Label>Display Name</Label><Input {...agentForm.register("agentDisplayName")} /></div>
                        <div className="space-y-1"><Label>Greeting Message</Label><Input {...agentForm.register("greetingMessage")} /></div>
                        <div className="space-y-1"><Label>System Prompt</Label><Textarea {...agentForm.register("systemPrompt")} rows={7} className="font-mono text-xs" /></div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg"><Switch checked={agentForm.watch("enableBooking")} onCheckedChange={v => agentForm.setValue("enableBooking", v)} /><div><p className="text-sm font-medium">Enable Appointment Booking</p><p className="text-xs text-muted-foreground">AI can book appointments using your staff availability</p></div></div>
                        <div className="flex justify-between"><Button type="button" variant="outline" onClick={() => setAgentStep(1)}>Back</Button><Button type="button" onClick={() => setAgentStep(3)}>Next</Button></div>
                      </div>
                    )}
                    {agentStep === 3 && (
                      <div className="space-y-4 mt-2">
                        <div className="space-y-2"><Label>Chat Style</Label><div className="grid grid-cols-5 gap-2">{WIDGET_STYLES.map(s => <button key={s.id} type="button" onClick={() => { agentForm.setValue("widgetStyle", s.id as any); agentForm.setValue("primaryColor", s.color); }} className={`p-2 border rounded-lg text-center text-xs transition-colors ${agentForm.watch("widgetStyle") === s.id ? "border-primary bg-primary/5" : "hover:border-gray-400"}`}><div className="w-5 h-5 rounded-full mx-auto mb-1" style={{ background: s.color }} />{s.label}</button>)}</div></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><Label>Position</Label><Select defaultValue="bottom-right" onValueChange={v => agentForm.setValue("position", v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom-right">Bottom Right</SelectItem><SelectItem value="bottom-left">Bottom Left</SelectItem></SelectContent></Select></div>
                          <div className="space-y-1"><Label>Max Response Tokens</Label><Select defaultValue="512" onValueChange={v => agentForm.setValue("maxTokens", parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="256">Short (256)</SelectItem><SelectItem value="512">Medium (512)</SelectItem><SelectItem value="1024">Long (1024)</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="flex justify-between"><Button type="button" variant="outline" onClick={() => setAgentStep(2)}>Back</Button><Button onClick={() => createAgent.mutate(agentForm.getValues())} disabled={createAgent.isPending}>{createAgent.isPending ? "Creating…" : "Create Agent"}</Button></div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              {/* Embed code dialog */}
              <Dialog open={!!embedAgent} onOpenChange={() => setEmbedAgent(null)}>
                <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Code className="w-4 h-4" />Embed Code</DialogTitle><DialogDescription>Paste before &lt;/body&gt; on your website.</DialogDescription></DialogHeader>
                {embedAgent && <div className="space-y-3 mt-2"><div className="bg-gray-950 rounded-lg p-4 relative group"><code className="text-green-400 text-xs font-mono break-all whitespace-pre-wrap">{`<script src="${window.location.origin}/widget.js" data-token="${embedAgent.widgetToken}" async></script>`}</code><Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(`<script src="${window.location.origin}/widget.js" data-token="${embedAgent.widgetToken}" async></script>`); toast({ title: "Copied!" }); }}><Copy className="w-3 h-3" /></Button></div><p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 p-2 rounded">The widget auto-loads your business info. Set the agent to <strong>Active</strong> to go live.</p></div>}
                </DialogContent>
              </Dialog>

              {agents.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-12 text-center"><Bot className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground mb-4">No agents yet.</p><Button onClick={() => setAgentDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Agent</Button></CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {agents.map((a: any) => (
                    <Card key={a.id}><CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: a.primaryColor + "20" }}><Bot className="w-5 h-5" style={{ color: a.primaryColor }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold">{a.name}</h3><Badge variant="outline" className="text-xs capitalize">{a.widgetStyle}</Badge><Badge variant={a.status === "active" ? "default" : "secondary"} className="text-xs">{a.status}</Badge>{a.enableBooking && <Badge variant="outline" className="text-xs text-green-700 border-green-300">📅 Booking</Badge>}</div>
                          <p className="text-sm text-muted-foreground mt-0.5">{a.agentDisplayName} · {a.totalMessages} messages · {a.totalConversations} conversations</p>
                          <details className="mt-3"><summary className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1"><Settings className="w-3 h-3" />Fine-tune prompt</summary>
                            <div className="mt-2 space-y-2">
                              <Textarea defaultValue={a.systemPrompt} rows={5} className="font-mono text-xs" onBlur={(e) => updateAgent.mutate({ id: a.id, data: { systemPrompt: e.target.value } })} />
                              <div className="grid grid-cols-2 gap-2"><Input defaultValue={a.greetingMessage} placeholder="Greeting" className="text-xs" onBlur={(e) => updateAgent.mutate({ id: a.id, data: { greetingMessage: e.target.value } })} /><Input defaultValue={a.agentDisplayName} placeholder="Display name" className="text-xs" onBlur={(e) => updateAgent.mutate({ id: a.id, data: { agentDisplayName: e.target.value } })} /></div>
                            </div>
                          </details>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEmbedAgent(a)}><Code className="w-3 h-3 mr-1" />Embed</Button>
                          <Button size="sm" variant="outline" onClick={() => updateAgent.mutate({ id: a.id, data: { status: a.status === "active" ? "inactive" : "active" } })}>{a.status === "active" ? "Deactivate" : "Activate"}</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAgent.mutate(a.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── KNOWLEDGE HUB ── */}
          {activeTab === "knowledge" && (
            <>
              <div><h1 className="text-2xl font-bold">Knowledge Hub</h1><p className="text-muted-foreground">Ground your AI with real business data — services, team, FAQs, policies. The AI uses all of this automatically.</p></div>

              <Tabs defaultValue="business">
                <TabsList className="mb-4"><TabsTrigger value="business"><Settings className="w-3 h-3 mr-1.5" />Business Info</TabsTrigger><TabsTrigger value="services"><DollarSign className="w-3 h-3 mr-1.5" />Services</TabsTrigger><TabsTrigger value="team"><Users className="w-3 h-3 mr-1.5" />Team</TabsTrigger><TabsTrigger value="faq"><HelpCircle className="w-3 h-3 mr-1.5" />FAQs</TabsTrigger><TabsTrigger value="policies"><FileText className="w-3 h-3 mr-1.5" />Policies</TabsTrigger></TabsList>

                {/* Business Info */}
                <TabsContent value="business">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div><CardTitle>Business Information</CardTitle><CardDescription>This appears in AI responses to customer questions about your business.</CardDescription></div>
                      {!bizEditing ? <Button variant="outline" size="sm" onClick={() => { setBizForm(bizSettings || {}); setBizEditing(true); }}><Pencil className="w-3 h-3 mr-1.5" />Edit</Button> : <div className="flex gap-2"><Button size="sm" onClick={() => saveBizSettings.mutate(bizForm)} disabled={saveBizSettings.isPending}><Save className="w-3 h-3 mr-1.5" />Save</Button><Button size="sm" variant="outline" onClick={() => setBizEditing(false)}><X className="w-3 h-3" /></Button></div>}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {bizEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><Label>Business Name</Label><Input value={bizForm.businessName || ""} onChange={e => setBizForm({...bizForm, businessName: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Tagline</Label><Input value={bizForm.tagline || ""} onChange={e => setBizForm({...bizForm, tagline: e.target.value})} placeholder="e.g. Expert care you can trust" /></div>
                          <div className="col-span-2 space-y-1"><Label>Description</Label><Textarea value={bizForm.description || ""} onChange={e => setBizForm({...bizForm, description: e.target.value})} rows={3} placeholder="Brief description of your business" /></div>
                          <div className="space-y-1"><Label>Phone</Label><Input value={bizForm.phone || ""} onChange={e => setBizForm({...bizForm, phone: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Email</Label><Input value={bizForm.email || ""} onChange={e => setBizForm({...bizForm, email: e.target.value})} type="email" /></div>
                          <div className="space-y-1"><Label>Address</Label><Input value={bizForm.address || ""} onChange={e => setBizForm({...bizForm, address: e.target.value})} /></div>
                          <div className="space-y-1"><Label>City</Label><Input value={bizForm.city || ""} onChange={e => setBizForm({...bizForm, city: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Website</Label><Input value={bizForm.website || ""} onChange={e => setBizForm({...bizForm, website: e.target.value})} placeholder="https://" /></div>
                          <div className="space-y-1"><Label>Timezone</Label><Input value={bizForm.timezone || "UTC"} onChange={e => setBizForm({...bizForm, timezone: e.target.value})} placeholder="America/New_York" /></div>
                          <div className="col-span-2 space-y-1"><Label>Business Hours</Label>
                            <div className="space-y-2">{DAYS.map((d, i) => {
                              const dayKey = d.toLowerCase();
                              const hrs = bizForm.businessHours?.[dayKey] || {};
                              return (
                                <div key={d} className="flex items-center gap-3">
                                  <div className="w-12 text-sm font-medium">{d}</div>
                                  <Switch checked={!hrs.closed} onCheckedChange={v => setBizForm({...bizForm, businessHours: {...(bizForm.businessHours || {}), [dayKey]: {...hrs, closed: !v}}})} />
                                  {!hrs.closed && <>
                                    <Input type="time" value={hrs.open || "09:00"} className="w-28" onChange={e => setBizForm({...bizForm, businessHours: {...(bizForm.businessHours || {}), [dayKey]: {...hrs, open: e.target.value}}})} />
                                    <span className="text-muted-foreground text-sm">to</span>
                                    <Input type="time" value={hrs.close || "18:00"} className="w-28" onChange={e => setBizForm({...bizForm, businessHours: {...(bizForm.businessHours || {}), [dayKey]: {...hrs, close: e.target.value}}})} />
                                  </>}
                                  {hrs.closed && <span className="text-sm text-muted-foreground">Closed</span>}
                                </div>
                              );
                            })}</div>
                          </div>
                          <div className="col-span-2 border-t pt-4">
                            <p className="font-medium text-sm mb-3">Booking Settings</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2"><Switch checked={!!bizForm.autoConfirmBookings} onCheckedChange={v => setBizForm({...bizForm, autoConfirmBookings: v})} /><Label>Auto-confirm bookings</Label></div>
                              <div className="space-y-1"><Label>Cancellation notice (hours)</Label><Input type="number" value={bizForm.cancellationPolicyHours ?? 24} onChange={e => setBizForm({...bizForm, cancellationPolicyHours: parseInt(e.target.value)})} /></div>
                              <div className="space-y-1"><Label>Book up to (days ahead)</Label><Input type="number" value={bizForm.bookingAdvanceDays ?? 30} onChange={e => setBizForm({...bizForm, bookingAdvanceDays: parseInt(e.target.value)})} /></div>
                            </div>
                          </div>
                          <div className="col-span-2 border-t pt-4">
                            <p className="font-medium text-sm mb-3 flex items-center gap-2"><Mail className="w-4 h-4" />Email (SMTP for sending confirmations)</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1"><Label>SMTP Host</Label><Input value={bizForm.smtpHost || ""} onChange={e => setBizForm({...bizForm, smtpHost: e.target.value})} placeholder="smtp.gmail.com" /></div>
                              <div className="space-y-1"><Label>Port</Label><Input type="number" value={bizForm.smtpPort || 587} onChange={e => setBizForm({...bizForm, smtpPort: parseInt(e.target.value)})} /></div>
                              <div className="space-y-1"><Label>SMTP Username</Label><Input value={bizForm.smtpUser || ""} onChange={e => setBizForm({...bizForm, smtpUser: e.target.value})} /></div>
                              <div className="space-y-1"><Label>SMTP Password</Label><Input type="password" value={bizForm.smtpPass || ""} onChange={e => setBizForm({...bizForm, smtpPass: e.target.value})} placeholder="Enter to change" /></div>
                              <div className="col-span-2 space-y-1"><Label>From Address</Label><Input value={bizForm.smtpFrom || ""} onChange={e => setBizForm({...bizForm, smtpFrom: e.target.value})} placeholder="hello@yourpractice.com" /></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {bizSettings?.businessName && <div><p className="text-muted-foreground text-xs">Business Name</p><p className="font-medium">{bizSettings.businessName}</p></div>}
                          {bizSettings?.phone && <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{bizSettings.phone}</p></div>}
                          {bizSettings?.email && <div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium">{bizSettings.email}</p></div>}
                          {bizSettings?.address && <div><p className="text-muted-foreground text-xs">Address</p><p className="font-medium">{bizSettings.address}{bizSettings.city && `, ${bizSettings.city}`}</p></div>}
                          {bizSettings?.website && <div><p className="text-muted-foreground text-xs">Website</p><p className="font-medium">{bizSettings.website}</p></div>}
                          {!bizSettings?.businessName && <p className="col-span-2 text-muted-foreground text-sm">No business info added yet. Click Edit to add your details.</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Services */}
                <TabsContent value="services">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><div><h2 className="font-semibold">Services & Packages</h2><p className="text-sm text-muted-foreground">List all your offerings with prices and duration. The AI quotes these to customers.</p></div><Button size="sm" onClick={() => setEditingService("new")}><Plus className="w-4 h-4 mr-1.5" />Add Service</Button></div>

                    {(editingService === "new" || (editingService && typeof editingService === "object")) && (
                      <Card className="border-primary"><CardContent className="pt-4">
                        <form className="space-y-3" onSubmit={serviceForm.handleSubmit(d => {
                          if (editingService === "new") createService.mutate(d);
                          else updateService.mutate({ id: editingService.id, data: d });
                        })}>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1"><Label>Service Name *</Label><Input {...serviceForm.register("name")} placeholder="e.g. Full Health Checkup" /></div>
                            <div className="space-y-1"><Label>Category</Label><Input {...serviceForm.register("category")} placeholder="e.g. Diagnostics" /></div>
                            <div className="space-y-1"><Label>Price</Label><Input {...serviceForm.register("price")} placeholder="0" /></div>
                            <div className="space-y-1"><Label>Currency</Label><Input {...serviceForm.register("currency")} /></div>
                            <div className="space-y-1"><Label>Duration (min)</Label><Input type="number" {...serviceForm.register("durationMinutes", { valueAsNumber: true })} /></div>
                            <div className="space-y-1"><Label>Buffer (min)</Label><Input type="number" {...serviceForm.register("bufferMinutes", { valueAsNumber: true })} /></div>
                            <div className="col-span-2 space-y-1"><Label>Description</Label><Textarea {...serviceForm.register("description")} rows={2} placeholder="What's included, who it's for..." /></div>
                          </div>
                          <div className="flex gap-2"><Button type="submit" size="sm" disabled={createService.isPending || updateService.isPending}><Save className="w-3 h-3 mr-1.5" />Save</Button><Button type="button" size="sm" variant="outline" onClick={() => { setEditingService(null); serviceForm.reset(); }}><X className="w-3 h-3" /></Button></div>
                        </form>
                      </CardContent></Card>
                    )}

                    {services.length === 0 && editingService === null && <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No services added. Add your packages, treatments, or offerings above.</CardContent></Card>}

                    {services.map((s: any) => (
                      <Card key={s.id}><CardContent className="p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2"><p className="font-medium">{s.name}</p>{s.category && <Badge variant="outline" className="text-xs">{s.category}</Badge>}{!s.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}</div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5"><span>{s.currency} {parseFloat(s.price || "0").toFixed(2)}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.durationMinutes} min</span></div>
                          {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{s.description}</p>}
                        </div>
                        <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => { setEditingService(s); serviceForm.reset(s); }}><Pencil className="w-3 h-3" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteService.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button></div>
                      </CardContent></Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Team */}
                <TabsContent value="team">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><div><h2 className="font-semibold">Team Members</h2><p className="text-sm text-muted-foreground">Add doctors, staff, and specialists. Customers can ask about them and book with specific people.</p></div><Button size="sm" onClick={() => setEditingStaff("new")}><Plus className="w-4 h-4 mr-1.5" />Add Member</Button></div>

                    {(editingStaff === "new" || (editingStaff && typeof editingStaff === "object")) && (
                      <Card className="border-primary"><CardContent className="pt-4">
                        <form className="space-y-3" onSubmit={staffForm.handleSubmit(d => {
                          if (editingStaff === "new") createStaff.mutate(d);
                          else updateStaff.mutate({ id: editingStaff.id, data: d });
                        })}>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1"><Label>Full Name *</Label><Input {...staffForm.register("name")} placeholder="Dr. Jane Smith" /></div>
                            <div className="space-y-1"><Label>Role</Label><Input {...staffForm.register("role")} placeholder="General Practitioner" /></div>
                            <div className="space-y-1"><Label>Speciality</Label><Input {...staffForm.register("speciality")} placeholder="Cardiology, Sports Medicine..." /></div>
                            <div className="space-y-1"><Label>Email</Label><Input type="email" {...staffForm.register("email")} /></div>
                            <div className="space-y-1"><Label>Phone</Label><Input {...staffForm.register("phone")} /></div>
                            <div className="flex items-center gap-2 pt-5"><Switch checked={staffForm.watch("acceptsOnlineBooking")} onCheckedChange={v => staffForm.setValue("acceptsOnlineBooking", v)} /><Label>Accepts online booking</Label></div>
                            <div className="col-span-2 space-y-1"><Label>Bio</Label><Textarea {...staffForm.register("bio")} rows={2} placeholder="Brief description, qualifications, years of experience..." /></div>
                          </div>
                          <div className="flex gap-2"><Button type="submit" size="sm" disabled={createStaff.isPending || updateStaff.isPending}><Save className="w-3 h-3 mr-1.5" />Save</Button><Button type="button" size="sm" variant="outline" onClick={() => { setEditingStaff(null); staffForm.reset(); }}><X className="w-3 h-3" /></Button></div>
                        </form>
                      </CardContent></Card>
                    )}

                    {staff.length === 0 && editingStaff === null && <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No team members added yet.</CardContent></Card>}

                    {staff.map((s: any) => (
                      <Card key={s.id}><CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: s.calendarColor || "#6366f1" }}>{s.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{s.name}{s.role && <span className="text-sm text-muted-foreground font-normal"> · {s.role}</span>}</p>
                          {s.speciality && <p className="text-xs text-muted-foreground">{s.speciality}</p>}
                          {s.bio && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{s.bio}</p>}
                          {!s.isActive && <Badge variant="secondary" className="text-xs mt-1">Inactive</Badge>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => openAvailability(s)}><Calendar className="w-3 h-3 mr-1" />Availability</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingStaff(s); staffForm.reset(s); }}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteStaff.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </CardContent></Card>
                    ))}
                  </div>

                  {/* Availability Modal */}
                  <Dialog open={!!staffAvailability} onOpenChange={() => setStaffAvailability(null)}>
                    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Availability — {staffAvailability?.name}</DialogTitle><DialogDescription>Set weekly working hours for online bookings.</DialogDescription></DialogHeader>
                      <div className="space-y-2 mt-2">
                        {DAYS.map((day, i) => {
                          const rule = availRules[i] || { dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: false };
                          return (
                            <div key={day} className="flex items-center gap-3">
                              <div className="w-10 text-sm font-medium">{day}</div>
                              <Switch checked={!!rule.isActive} onCheckedChange={v => setAvailRules(prev => prev.map(r => r.dayOfWeek === i ? {...r, isActive: v} : r))} />
                              {rule.isActive ? (
                                <>
                                  <Input type="time" value={rule.startTime} className="w-28" onChange={e => setAvailRules(prev => prev.map(r => r.dayOfWeek === i ? {...r, startTime: e.target.value} : r))} />
                                  <span className="text-muted-foreground text-xs">–</span>
                                  <Input type="time" value={rule.endTime} className="w-28" onChange={e => setAvailRules(prev => prev.map(r => r.dayOfWeek === i ? {...r, endTime: e.target.value} : r))} />
                                </>
                              ) : <span className="text-sm text-muted-foreground">Off</span>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setStaffAvailability(null)}>Cancel</Button>
                        <Button onClick={() => saveAvailability.mutate({ staffId: staffAvailability?.id, rules: availRules })} disabled={saveAvailability.isPending}>Save Availability</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                {/* FAQs */}
                <TabsContent value="faq">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><div><h2 className="font-semibold">FAQs</h2><p className="text-sm text-muted-foreground">Common questions and answers. The AI uses these to give accurate, consistent responses.</p></div><Button size="sm" onClick={() => { setEditingKnowledge("new"); knowledgeForm.reset({ type: "faq" }); }}><Plus className="w-4 h-4 mr-1.5" />Add FAQ</Button></div>

                    {(editingKnowledge === "new" || (editingKnowledge && editingKnowledge?.type === "faq")) && (
                      <Card className="border-primary"><CardContent className="pt-4">
                        <form className="space-y-3" onSubmit={knowledgeForm.handleSubmit(d => {
                          const payload = { ...d, type: "faq" };
                          if (editingKnowledge === "new") createKnowledge.mutate(payload);
                          else updateKnowledge.mutate({ id: editingKnowledge.id, data: payload });
                        })}>
                          <div className="space-y-1"><Label>Question</Label><Input {...knowledgeForm.register("question")} placeholder="What are your opening hours?" /></div>
                          <div className="space-y-1"><Label>Answer</Label><Textarea {...knowledgeForm.register("answer")} rows={3} placeholder="We are open Monday–Friday, 9am–6pm..." /></div>
                          <div className="space-y-1"><Label>Category (optional)</Label><Input {...knowledgeForm.register("category")} placeholder="Hours, Pricing, Insurance..." /></div>
                          <div className="flex gap-2"><Button type="submit" size="sm"><Save className="w-3 h-3 mr-1.5" />Save</Button><Button type="button" size="sm" variant="outline" onClick={() => { setEditingKnowledge(null); knowledgeForm.reset(); }}><X className="w-3 h-3" /></Button></div>
                        </form>
                      </CardContent></Card>
                    )}

                    {knowledgeByType.faq.length === 0 && editingKnowledge === null && <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No FAQs yet. Add your most common customer questions.</CardContent></Card>}
                    {knowledgeByType.faq.map((k: any) => (
                      <Card key={k.id}><CardContent className="p-4 flex gap-3">
                        <div className="flex-1"><p className="font-medium text-sm">{k.question}</p><p className="text-sm text-muted-foreground mt-1">{k.answer}</p>{k.category && <Badge variant="outline" className="text-xs mt-2">{k.category}</Badge>}</div>
                        <div className="flex gap-1 shrink-0"><Button size="sm" variant="ghost" onClick={() => { setEditingKnowledge(k); knowledgeForm.reset(k); }}><Pencil className="w-3 h-3" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteKnowledge.mutate(k.id)}><Trash2 className="w-3 h-3" /></Button></div>
                      </CardContent></Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Policies */}
                <TabsContent value="policies">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><div><h2 className="font-semibold">Policies & Info</h2><p className="text-sm text-muted-foreground">Cancellation policy, payment terms, insurance, etc.</p></div><Button size="sm" onClick={() => { setEditingKnowledge("new"); knowledgeForm.reset({ type: "policy" }); }}><Plus className="w-4 h-4 mr-1.5" />Add Policy</Button></div>

                    {(editingKnowledge === "new" || (editingKnowledge && editingKnowledge?.type === "policy")) && (
                      <Card className="border-primary"><CardContent className="pt-4">
                        <form className="space-y-3" onSubmit={knowledgeForm.handleSubmit(d => {
                          const payload = { ...d, type: "policy" };
                          if (editingKnowledge === "new") createKnowledge.mutate(payload);
                          else updateKnowledge.mutate({ id: editingKnowledge.id, data: payload });
                        })}>
                          <div className="space-y-1"><Label>Policy Title</Label><Input {...knowledgeForm.register("title")} placeholder="Cancellation Policy" /></div>
                          <div className="space-y-1"><Label>Details</Label><Textarea {...knowledgeForm.register("answer")} rows={4} placeholder="Describe the policy in detail..." /></div>
                          <div className="flex gap-2"><Button type="submit" size="sm"><Save className="w-3 h-3 mr-1.5" />Save</Button><Button type="button" size="sm" variant="outline" onClick={() => { setEditingKnowledge(null); knowledgeForm.reset(); }}><X className="w-3 h-3" /></Button></div>
                        </form>
                      </CardContent></Card>
                    )}

                    {[...knowledgeByType.policy, ...knowledgeByType.service_info, ...knowledgeByType.custom].length === 0 && editingKnowledge === null && <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No policies added yet.</CardContent></Card>}
                    {[...knowledgeByType.policy, ...knowledgeByType.service_info, ...knowledgeByType.custom].map((k: any) => (
                      <Card key={k.id}><CardContent className="p-4 flex gap-3">
                        <div className="flex-1"><p className="font-medium text-sm">{k.title || k.type}</p><p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{k.answer}</p></div>
                        <div className="flex gap-1 shrink-0"><Button size="sm" variant="ghost" onClick={() => { setEditingKnowledge(k); knowledgeForm.reset(k); }}><Pencil className="w-3 h-3" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteKnowledge.mutate(k.id)}><Trash2 className="w-3 h-3" /></Button></div>
                      </CardContent></Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* ── APPOINTMENTS ── */}
          {activeTab === "appointments" && (
            <>
              <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">Appointments</h1><p className="text-muted-foreground">All bookings made through your AI agents</p></div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">{ov.pendingAppointments ?? 0} pending</Badge>
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">{ov.appointmentsToday ?? 0} today</Badge>
                </div>
              </div>

              {apptList.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-12 text-center"><Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm">No appointments yet. Enable booking on an agent to start receiving bookings.</p></CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {apptList.map((row: any) => {
                    const appt = row.appointment || row;
                    const svc = row.service;
                    const st = row.staff;
                    const starts = new Date(appt.startsAt);
                    const statusColor = STATUS_COLORS[appt.status as keyof typeof STATUS_COLORS] || "#6b7280";
                    return (
                      <Card key={appt.id}><CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="text-center shrink-0 w-14">
                            <p className="text-xs text-muted-foreground">{starts.toLocaleDateString("en", { month: "short" })}</p>
                            <p className="text-2xl font-bold leading-none">{starts.getDate()}</p>
                            <p className="text-xs text-muted-foreground">{starts.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{appt.customerName}</p>
                              <Badge style={{ background: statusColor + "20", color: statusColor, borderColor: statusColor + "40" }} variant="outline" className="text-xs capitalize">{appt.status}</Badge>
                              {appt.paymentStatus === "paid" && <Badge variant="outline" className="text-xs text-green-700 border-green-300">💰 Paid</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                              {svc?.name && <span>{svc.name}</span>}
                              {st?.name && <span>with {st.name}</span>}
                              {appt.customerEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{appt.customerEmail}</span>}
                              {appt.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{appt.customerPhone}</span>}
                            </div>
                            {appt.customerNotes && <p className="text-xs text-muted-foreground mt-1 italic">"{appt.customerNotes}"</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {appt.status === "pending" && <Button size="sm" variant="outline" className="text-green-700 border-green-300 h-7 text-xs" onClick={() => updateAppointment.mutate({ id: appt.id, data: { status: "confirmed" } })}>Confirm</Button>}
                            {(appt.status === "confirmed" || appt.status === "pending") && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateAppointment.mutate({ id: appt.id, data: { status: "completed" } })}>Complete</Button>}
                            {appt.status !== "cancelled" && (
                              <Dialog>
                                <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive h-7 text-xs">Cancel</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Cancel Appointment</DialogTitle></DialogHeader>
                                  <div className="space-y-3 mt-2"><Label>Reason (optional)</Label><Textarea value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} rows={2} placeholder="e.g. Staff unavailable..." /><Button className="w-full" variant="destructive" onClick={() => { updateAppointment.mutate({ id: appt.id, data: { status: "cancelled", cancellationReason } }); setCancellationReason(""); }}>Confirm Cancellation</Button></div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      </CardContent></Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── ANALYTICS ── */}
          {activeTab === "analytics" && (
            <>
              <div><h1 className="text-2xl font-bold">Analytics & Reports</h1><p className="text-muted-foreground">Conversations, appointments, revenue, and leads in one view</p></div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Total Revenue</p><p className="text-2xl font-bold">${(ov.totalRevenue ?? 0).toFixed(2)}</p><p className="text-xs text-muted-foreground">+${(ov.revenueThisMonth ?? 0).toFixed(0)} this month</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Appointments</p><p className="text-2xl font-bold">{ov.totalAppointments ?? 0}</p><p className="text-xs text-muted-foreground">{ov.appointmentsThisMonth ?? 0} this month</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Conversations</p><p className="text-2xl font-bold">{ov.totalConversations ?? 0}</p><p className="text-xs text-muted-foreground">{ov.avgMessagesPerConversation ?? 0} msg avg</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Leads Captured</p><p className="text-2xl font-bold">{ov.totalLeads ?? 0}</p><p className="text-xs text-muted-foreground">emails from chat</p></CardContent></Card>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                {/* Trend chart */}
                <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-sm">Daily Activity (30 days)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={analytics?.charts?.daily || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                          <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#6366f1" fill="url(#cg2)" strokeWidth={2} />
                        <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#10b981" fill="url(#ag2)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Appointment status pie */}
                <Card><CardHeader><CardTitle className="text-sm">Appointment Status</CardTitle></CardHeader>
                  <CardContent>
                    {analytics?.charts?.statusBreakdown && (() => {
                      const data = Object.entries(analytics.charts.statusBreakdown).filter(([, v]) => (v as number) > 0).map(([name, value]) => ({ name, value: value as number }));
                      if (!data.length) return <p className="text-muted-foreground text-sm text-center py-8">No data yet</p>;
                      return (
                        <div>
                          <ResponsiveContainer width="100%" height={140}>
                            <PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie><Tooltip /></PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2">{data.map((d, i) => <div key={d.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{d.name}</span><span className="font-semibold">{d.value}</span></div>)}</div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Top Services */}
              {analytics?.charts?.topServices?.length > 0 && (
                <Card><CardHeader><CardTitle className="text-sm">Top Services by Bookings</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={analytics.charts.topServices} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Bookings" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Leads */}
              {analytics?.recentLeads?.length > 0 && (
                <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Captured Leads</CardTitle><Button size="sm" variant="outline" onClick={() => {
                  const csv = "Name,Email,Phone,Date\n" + analytics.recentLeads.map((l: any) => `"${l.name||""}","${l.email||""}","${l.phone||""}","${l.date||""}"`).join("\n");
                  const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "leads.csv"; a.click();
                }} className="text-xs">Export CSV</Button></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analytics.recentLeads.slice(0, 10).map((l: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{(l.name || l.email || "?")[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{l.name || "Anonymous"}</p><p className="text-xs text-muted-foreground">{l.email}</p></div>
                          {l.phone && <p className="text-xs text-muted-foreground">{l.phone}</p>}
                          <p className="text-xs text-muted-foreground shrink-0">{new Date(l.date).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── API KEYS ── */}
          {activeTab === "keys" && (
            <>
              <div><h1 className="text-2xl font-bold">API Keys</h1><p className="text-muted-foreground">Programmatic access to your account</p></div>
              <Card><CardContent className="pt-5"><div className="flex gap-2"><Input placeholder="Key name (e.g. Production)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="max-w-xs" /><Button onClick={() => createKey.mutate(newKeyName)} disabled={!newKeyName.trim() || createKey.isPending}><Plus className="w-4 h-4 mr-2" />Generate</Button></div></CardContent></Card>
              {createdRawKey && <Card className="border-green-300 bg-green-50"><CardContent className="pt-4 space-y-3"><p className="text-sm font-semibold text-green-800">Copy now — shown once only.</p><div className="flex gap-2"><code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-xs font-mono break-all">{createdRawKey}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdRawKey); toast({ title: "Copied!" }); }}><Copy className="w-4 h-4" /></Button></div><Button size="sm" variant="ghost" className="text-xs" onClick={() => setCreatedRawKey(null)}>Dismiss</Button></CardContent></Card>}
              {keys.map((k: any) => <Card key={k.id}><CardContent className="p-4 flex items-center justify-between"><div><p className="font-medium text-sm">{k.name}</p><code className="text-xs text-muted-foreground">{k.keyPrefix}••••</code></div><Button size="sm" variant="ghost" className="text-destructive" onClick={() => revokeKey.mutate(k.id)}>Revoke</Button></CardContent></Card>)}
            </>
          )}

          {/* ── BILLING ── */}
          {activeTab === "billing" && (
            <>
              <div><h1 className="text-2xl font-bold">Billing & Plan</h1><p className="text-muted-foreground">Manage your subscription</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS_UI.map(plan => {
                  const isCurrent = organization?.plan === plan.id;
                  return (
                    <Card key={plan.id} className={isCurrent ? "border-primary ring-1 ring-primary" : ""}>
                      <CardHeader><div className="flex items-center justify-between"><CardTitle>{plan.name}</CardTitle>{isCurrent && <Badge>Current</Badge>}</div><p className="text-3xl font-bold">{plan.price === 0 ? "Free" : `$${plan.price}`}<span className="text-sm font-normal text-muted-foreground">{plan.price > 0 ? "/mo" : ""}</span></p></CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground"><p>Up to {plan.agents} agent{plan.agents > 1 ? "s" : ""}</p><p>{plan.messages.toLocaleString()} messages/month</p>
                        {!isCurrent && plan.id !== "free" && <Button className="w-full mt-2" onClick={() => createCheckout.mutate(plan.id)} disabled={createCheckout.isPending}>Upgrade to {plan.name}</Button>}
                        {isCurrent && organization?.stripeSubscriptionId && plan.id !== "free" && <Button variant="outline" className="w-full mt-2" onClick={() => openPortal.mutate()}>Manage <ExternalLink className="w-3 h-3 ml-2" /></Button>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Card><CardContent className="p-5"><h3 className="font-semibold mb-1">Enterprise</h3><p className="text-sm text-muted-foreground mb-3">Unlimited agents, white-label, dedicated support, custom integrations.</p><Button variant="outline" asChild><Link href="/contact">Contact Sales</Link></Button></CardContent></Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
