import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Bot, Key, LogOut, Plus, Trash2, Zap, MessageSquare, TrendingUp,
  Activity, Copy, LayoutDashboard, Code, ChevronRight, Check, CreditCard,
  Settings, AlertTriangle, ExternalLink,
} from "lucide-react";

const WIDGET_STYLES = [
  { id: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { id: "messenger", label: "Messenger", color: "#0084FF" },
  { id: "telegram", label: "Telegram", color: "#2AABEE" },
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "custom", label: "Custom", color: "#6b7280" },
];

const agentSchema = z.object({
  name: z.string().min(1, "Agent name required"),
  businessType: z.string().default("custom"),
  systemPrompt: z.string().min(10, "Prompt must be at least 10 characters"),
  widgetStyle: z.enum(["whatsapp", "messenger", "telegram", "instagram", "custom"]),
  agentDisplayName: z.string().min(1, "Display name required"),
  greetingMessage: z.string().min(1, "Greeting required"),
  primaryColor: z.string().default("#25D366"),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
  maxTokens: z.number().min(100).max(2048).default(512),
});

type AgentForm = z.infer<typeof agentSchema>;

export default function Dashboard() {
  const { user, organization, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "keys" | "billing">("overview");
  const [agentStep, setAgentStep] = useState(1);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [embedDialogAgent, setEmbedDialogAgent] = useState<any>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);

  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });
  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });
  const { data: keys = [] } = useQuery<any[]>({ queryKey: ["/api/keys"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/templates"] });

  const agentForm = useForm<AgentForm>({
    resolver: zodResolver(agentSchema),
    defaultValues: { businessType: "custom", widgetStyle: "whatsapp", primaryColor: "#25D366", position: "bottom-right", maxTokens: 512 },
  });

  const createAgent = useMutation({
    mutationFn: (data: AgentForm) => apiRequest("POST", "/api/agents", data).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["/api/agents"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setAgentDialogOpen(false);
      setAgentStep(1);
      agentForm.reset();
      toast({ title: "Agent created!", description: "Get the embed code to add it to your website." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create agent", variant: "destructive" }),
  });

  const updateAgent = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AgentForm> }) => apiRequest("PUT", `/api/agents/${id}`, data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/agents"] }); toast({ title: "Agent updated" }); },
  });

  const deleteAgent = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/agents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/agents"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PUT", `/api/agents/${id}`, { status }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/agents"] }),
  });

  const createKey = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/keys", { name }).then(r => r.json()),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["/api/keys"] }); setCreatedRawKey(data.rawKey); setNewKeyName(""); },
  });

  const revokeKey = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/keys"] }),
  });

  const createCheckout = useMutation({
    mutationFn: (plan: string) => apiRequest("POST", "/api/billing/create-checkout", { plan }).then(r => r.json()),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: () => toast({ title: "Error", description: "Billing not configured yet.", variant: "destructive" }),
  });

  const openPortal = useMutation({
    mutationFn: () => apiRequest("POST", "/api/billing/portal").then(r => r.json()),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });

  function selectTemplate(t: any) {
    setSelectedTemplate(t);
    agentForm.setValue("businessType", t.id);
    agentForm.setValue("systemPrompt", t.prompt);
    agentForm.setValue("greetingMessage", t.greetingMessage);
    agentForm.setValue("primaryColor", t.primaryColor);
    agentForm.setValue("agentDisplayName", t.label + " Assistant");
    setAgentStep(2);
  }

  const trialDaysLeft = organization?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const usagePercent = stats?.usagePercent ?? 0;

  const PLANS = [
    { id: "free", name: "Free", price: 0, agents: 1, messages: 100 },
    { id: "starter", name: "Starter", price: 49, agents: 3, messages: 2000 },
    { id: "professional", name: "Professional", price: 149, agents: 10, messages: 15000 },
  ];

  function getEmbedCode(agent: any) {
    return `<script src="${window.location.origin}/widget.js" data-token="${agent.widgetToken}" async></script>`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-5 border-b">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">AgentFlow</span>
          </Link>
          {organization && <p className="text-xs text-muted-foreground mt-1 truncate">{organization.name}</p>}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "agents", label: "My Agents", icon: Bot },
            { id: "keys", label: "API Keys", icon: Key },
            { id: "billing", label: "Billing & Plan", icon: CreditCard },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === id ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <Icon className="w-4 h-4" /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t space-y-2">
          {trialDaysLeft !== null && organization?.plan === "free" && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-800">{trialDaysLeft} trial days left</p>
              <button onClick={() => setActiveTab("billing")} className="text-xs text-primary hover:underline">Upgrade →</button>
            </div>
          )}
          {organization?.isSuspended && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Account suspended</p>
            </div>
          )}
          <div className="px-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {user?.avatarUrl ? <img src={user.avatarUrl} className="w-7 h-7 rounded-full" /> : <span className="text-xs font-bold text-primary">{(user?.firstName?.[0] || user?.username?.[0] || "U").toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.firstName || user?.username}</p>
              <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">{organization?.plan || "free"}</Badge>
            </div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            <LogOut className="w-4 h-4" /><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <>
              <div><h1 className="text-2xl font-bold">Overview</h1><p className="text-muted-foreground">Welcome back, {user?.firstName || user?.username}</p></div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Agents</p><p className="text-3xl font-bold">{stats?.totalAgents ?? 0}</p><p className="text-xs text-muted-foreground mt-1">{stats?.activeAgents ?? 0} active</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Messages This Month</p><p className="text-3xl font-bold">{stats?.messagesThisPeriod ?? 0}</p><p className="text-xs text-muted-foreground mt-1">of {stats?.maxMonthlyMessages ?? 100} limit</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Plan</p><p className="text-3xl font-bold capitalize">{organization?.plan ?? "free"}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Usage</p><p className="text-3xl font-bold">{usagePercent}%</p><Progress value={usagePercent} className="mt-2 h-2" /></CardContent></Card>
              </div>

              {usagePercent >= 80 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="flex-1"><p className="font-medium text-amber-900">Approaching message limit</p><p className="text-sm text-amber-700">You've used {usagePercent}% of your monthly messages. Upgrade to avoid disruption.</p></div>
                    <Button size="sm" onClick={() => setActiveTab("billing")}>Upgrade</Button>
                  </CardContent>
                </Card>
              )}

              {agents.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <Bot className="w-14 h-14 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-1">Create your first AI agent</h3>
                    <p className="text-muted-foreground text-sm mb-6">Choose a business type, configure your agent, and embed it on your website.</p>
                    <Button onClick={() => { setActiveTab("agents"); setAgentDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Create Agent</Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── Agents ── */}
          {activeTab === "agents" && (
            <>
              <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">My Agents</h1><p className="text-muted-foreground">Configure and deploy AI chat agents on your website</p></div>
                <Dialog open={agentDialogOpen} onOpenChange={(o) => { setAgentDialogOpen(o); if (!o) { setAgentStep(1); agentForm.reset(); } }}>
                  <DialogTrigger asChild>
                    <Button disabled={!!organization?.isSuspended}><Plus className="w-4 h-4 mr-2" />New Agent</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create AI Agent</DialogTitle>
                      <DialogDescription>Step {agentStep} of 3 — {agentStep === 1 ? "Choose business type" : agentStep === 2 ? "Configure agent" : "Widget appearance"}</DialogDescription>
                    </DialogHeader>

                    {/* Step 1: Choose template */}
                    {agentStep === 1 && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {templates.map((t: any) => (
                          <button key={t.id} onClick={() => selectTemplate(t)}
                            className="text-left p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors">
                            <p className="font-semibold text-sm">{t.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Step 2: Configure prompt */}
                    {agentStep === 2 && (
                      <form className="space-y-4 mt-2">
                        <div className="space-y-1">
                          <Label>Agent Name</Label>
                          <Input {...agentForm.register("name")} placeholder="My Support Bot" />
                          {agentForm.formState.errors.name && <p className="text-xs text-destructive">{agentForm.formState.errors.name.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <Label>Display Name <span className="text-muted-foreground text-xs">(shown to customers)</span></Label>
                          <Input {...agentForm.register("agentDisplayName")} placeholder="AI Assistant" />
                        </div>
                        <div className="space-y-1">
                          <Label>Greeting Message</Label>
                          <Input {...agentForm.register("greetingMessage")} />
                        </div>
                        <div className="space-y-1">
                          <Label>System Prompt <span className="text-muted-foreground text-xs">(defines agent behaviour)</span></Label>
                          <Textarea {...agentForm.register("systemPrompt")} rows={8} className="font-mono text-sm" />
                          {agentForm.formState.errors.systemPrompt && <p className="text-xs text-destructive">{agentForm.formState.errors.systemPrompt.message}</p>}
                        </div>
                        <div className="flex justify-between">
                          <Button type="button" variant="outline" onClick={() => setAgentStep(1)}>Back</Button>
                          <Button type="button" onClick={async () => { const ok = await agentForm.trigger(["name", "agentDisplayName", "greetingMessage", "systemPrompt"]); if (ok) setAgentStep(3); }}>Next</Button>
                        </div>
                      </form>
                    )}

                    {/* Step 3: Widget appearance */}
                    {agentStep === 3 && (
                      <form onSubmit={agentForm.handleSubmit(d => createAgent.mutate(d))} className="space-y-4 mt-2">
                        <div className="space-y-2">
                          <Label>Chat Style</Label>
                          <div className="grid grid-cols-5 gap-2">
                            {WIDGET_STYLES.map(s => (
                              <button key={s.id} type="button"
                                onClick={() => { agentForm.setValue("widgetStyle", s.id as any); agentForm.setValue("primaryColor", s.color); }}
                                className={`p-3 border rounded-lg text-center text-xs transition-colors ${agentForm.watch("widgetStyle") === s.id ? "border-primary bg-primary/5 font-semibold" : "hover:border-gray-400"}`}>
                                <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ background: s.color }} />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label>Position</Label>
                            <Select defaultValue="bottom-right" onValueChange={v => agentForm.setValue("position", v as any)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Max Response Length</Label>
                            <Select defaultValue="512" onValueChange={v => agentForm.setValue("maxTokens", parseInt(v))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="256">Short (256)</SelectItem>
                                <SelectItem value="512">Medium (512)</SelectItem>
                                <SelectItem value="1024">Long (1024)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <Button type="button" variant="outline" onClick={() => setAgentStep(2)}>Back</Button>
                          <Button type="submit" disabled={createAgent.isPending}>{createAgent.isPending ? "Creating…" : "Create Agent"}</Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              {/* Embed code dialog */}
              <Dialog open={!!embedDialogAgent} onOpenChange={() => setEmbedDialogAgent(null)}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Code className="w-4 h-4" /> Embed Code</DialogTitle>
                    <DialogDescription>Copy this code and paste it before the closing &lt;/body&gt; tag on your website.</DialogDescription>
                  </DialogHeader>
                  {embedDialogAgent && (
                    <div className="space-y-4 mt-2">
                      <div className="bg-gray-950 rounded-lg p-4 relative">
                        <code className="text-green-400 text-xs font-mono break-all whitespace-pre-wrap">{getEmbedCode(embedDialogAgent)}</code>
                        <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white"
                          onClick={() => { navigator.clipboard.writeText(getEmbedCode(embedDialogAgent)); toast({ title: "Copied!" }); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                        <strong>Important:</strong> This code is unique to this agent. Do not modify it. The widget style and behaviour are controlled from your dashboard.
                      </div>
                      <p className="text-sm text-muted-foreground">Make sure the agent is set to <strong>Active</strong> before your customers can use it.</p>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Agent list */}
              {agents.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-12 text-center"><Bot className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground mb-4">No agents yet.</p><Button onClick={() => setAgentDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Agent</Button></CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent: any) => (
                    <Card key={agent.id}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: agent.primaryColor + "20" }}>
                            <Bot className="w-5 h-5" style={{ color: agent.primaryColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{agent.name}</h3>
                              <Badge variant="outline" className="text-xs capitalize">{agent.widgetStyle}</Badge>
                              <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">{agent.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">{agent.agentDisplayName} · {agent.greetingMessage}</p>
                            <p className="text-xs text-muted-foreground mt-1">{agent.totalMessages} messages sent</p>

                            {/* Inline prompt editing */}
                            <details className="mt-3">
                              <summary className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1"><Settings className="w-3 h-3" /> Fine-tune prompt</summary>
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  defaultValue={agent.systemPrompt}
                                  rows={5}
                                  className="font-mono text-xs"
                                  onBlur={(e) => updateAgent.mutate({ id: agent.id, data: { systemPrompt: e.target.value } })}
                                />
                                <div className="flex gap-2">
                                  <Input defaultValue={agent.greetingMessage} placeholder="Greeting message" className="text-xs"
                                    onBlur={(e) => updateAgent.mutate({ id: agent.id, data: { greetingMessage: e.target.value } })} />
                                  <Input defaultValue={agent.agentDisplayName} placeholder="Display name" className="text-xs"
                                    onBlur={(e) => updateAgent.mutate({ id: agent.id, data: { agentDisplayName: e.target.value } })} />
                                </div>
                                <p className="text-xs text-muted-foreground">Changes auto-save on blur. The embed code on your website never changes.</p>
                              </div>
                            </details>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => setEmbedDialogAgent(agent)}>
                              <Code className="w-3 h-3 mr-1" />Get Code
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => toggleStatus.mutate({ id: agent.id, status: agent.status === "active" ? "inactive" : "active" })}>
                              {agent.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteAgent.mutate(agent.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── API Keys ── */}
          {activeTab === "keys" && (
            <>
              <div><h1 className="text-2xl font-bold">API Keys</h1><p className="text-muted-foreground">For programmatic access to your account</p></div>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex gap-2">
                    <Input placeholder="Key name (e.g. Production)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="max-w-xs" />
                    <Button onClick={() => createKey.mutate(newKeyName)} disabled={!newKeyName.trim() || createKey.isPending}><Plus className="w-4 h-4 mr-2" />Generate</Button>
                  </div>
                </CardContent>
              </Card>
              {createdRawKey && (
                <Card className="border-green-300 bg-green-50">
                  <CardContent className="pt-6 space-y-3">
                    <p className="text-sm font-semibold text-green-800">API key created — copy it now, it won't be shown again.</p>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-xs font-mono break-all">{createdRawKey}</code>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdRawKey); toast({ title: "Copied!" }); }}><Copy className="w-4 h-4" /></Button>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setCreatedRawKey(null)}>I've saved it, dismiss</Button>
                  </CardContent>
                </Card>
              )}
              {keys.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-10 text-center"><Key className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No API keys yet.</p></CardContent></Card>
              ) : keys.map((key: any) => (
                <Card key={key.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div><p className="font-medium text-sm">{key.name}</p><code className="text-xs text-muted-foreground">{key.keyPrefix}••••</code><p className="text-xs text-muted-foreground mt-0.5">Created {new Date(key.createdAt).toLocaleDateString()}{key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}</p></div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => revokeKey.mutate(key.id)}>Revoke</Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* ── Billing ── */}
          {activeTab === "billing" && (
            <>
              <div><h1 className="text-2xl font-bold">Billing & Plan</h1><p className="text-muted-foreground">Manage your subscription</p></div>

              {organization?.subscriptionStatus === "past_due" && (
                <Card className="border-red-300 bg-red-50"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-600" /><div><p className="font-medium text-red-900">Payment past due</p><p className="text-sm text-red-700">Update your payment method to avoid service interruption.</p></div><Button size="sm" variant="destructive" onClick={() => openPortal.mutate()}>Update Payment</Button></CardContent></Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map(plan => {
                  const isCurrent = organization?.plan === plan.id;
                  const isDowngrade = plan.id === "free" && organization?.plan !== "free";
                  return (
                    <Card key={plan.id} className={isCurrent ? "border-primary ring-1 ring-primary" : ""}>
                      <CardHeader>
                        <div className="flex items-center justify-between"><CardTitle>{plan.name}</CardTitle>{isCurrent && <Badge>Current</Badge>}</div>
                        <p className="text-3xl font-bold">{plan.price === 0 ? "Free" : `$${plan.price}`}<span className="text-sm font-normal text-muted-foreground">{plan.price > 0 ? "/mo" : ""}</span></p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">Up to {plan.agents} agent{plan.agents > 1 ? "s" : ""}</p>
                        <p className="text-sm text-muted-foreground">{plan.messages.toLocaleString()} messages/month</p>
                        {!isCurrent && !isDowngrade && plan.id !== "free" && (
                          <Button className="w-full mt-2" onClick={() => createCheckout.mutate(plan.id === "professional" ? "professional" : "starter")} disabled={createCheckout.isPending}>
                            Upgrade to {plan.name}
                          </Button>
                        )}
                        {organization?.stripeSubscriptionId && isCurrent && plan.id !== "free" && (
                          <Button variant="outline" className="w-full mt-2" onClick={() => openPortal.mutate()}>Manage Subscription <ExternalLink className="w-3 h-3 ml-2" /></Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-1">Enterprise Plan</h3>
                  <p className="text-sm text-muted-foreground mb-3">Unlimited agents, custom integrations, dedicated support, SLA, and white-label options.</p>
                  <Button variant="outline" asChild><Link href="/contact">Contact Sales</Link></Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
