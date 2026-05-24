import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart3, Bot, Key, LogOut, Plus, Settings, Shield, Trash2, Zap,
  MessageSquare, TrendingUp, Activity, Copy, Eye, EyeOff, LayoutDashboard
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const PLATFORMS = ["whatsapp", "telegram", "discord", "facebook", "instagram", "linkedin", "custom"];

const agentFormSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  description: z.string().optional(),
  platform: z.enum(["whatsapp", "telegram", "discord", "facebook", "instagram", "linkedin", "custom"]),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
});

type AgentForm = z.infer<typeof agentFormSchema>;

function StatCard({ title, value, description, icon: Icon, trend }: {
  title: string; value: string | number; description?: string; icon: any; trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && <p className="text-xs text-green-600 mt-1 font-medium">{trend}</p>}
      </CardContent>
    </Card>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    whatsapp: "bg-green-100 text-green-800",
    telegram: "bg-blue-100 text-blue-800",
    discord: "bg-indigo-100 text-indigo-800",
    facebook: "bg-blue-100 text-blue-900",
    instagram: "bg-pink-100 text-pink-800",
    linkedin: "bg-sky-100 text-sky-800",
    custom: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[platform] || colors.custom}`}>
      {platform}
    </span>
  );
}

export default function Dashboard() {
  const { user, organization, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "keys">("overview");
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);

  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });
  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });
  const { data: keys = [] } = useQuery<any[]>({ queryKey: ["/api/keys"] });

  const agentForm = useForm<AgentForm>({ resolver: zodResolver(agentFormSchema) });

  const createAgent = useMutation({
    mutationFn: (data: AgentForm) => apiRequest("POST", "/api/agents", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/agents"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setAgentDialogOpen(false);
      agentForm.reset();
      toast({ title: "Agent created", description: "Your new AI agent is ready to configure." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create agent", variant: "destructive" }),
  });

  const deleteAgent = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/agents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/agents"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Agent deleted" });
    },
  });

  const toggleAgentStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/agents/${id}`, { status }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/agents"] }),
  });

  const createKey = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/keys", { name }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/keys"] });
      setCreatedRawKey(data.rawKey);
      setNewKeyName("");
      toast({ title: "API key created", description: "Copy it now — it won't be shown again." });
    },
  });

  const revokeKey = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/keys"] }),
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const trialDaysLeft = organization?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / (86400000)))
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">AgentFlow</span>
          </Link>
          {organization && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{organization.name}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "agents", label: "Agents", icon: Bot },
            { id: "keys", label: "API Keys", icon: Key },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === id ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t">
          {trialDaysLeft !== null && organization?.plan === "free" && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-800">{trialDaysLeft} days left in trial</p>
              <Link href="/pricing" className="text-xs text-primary hover:underline">Upgrade now →</Link>
            </div>
          )}
          <div className="flex items-center space-x-2 px-2 py-1 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">
                {user?.firstName?.[0] || user?.username?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.firstName || user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {user?.firstName || user?.username}</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Agents" value={stats?.totalAgents ?? 0} icon={Bot} description={`${stats?.activeAgents ?? 0} active`} />
                <StatCard title="Conversations" value={stats?.totalConversations ?? 0} icon={MessageSquare} description={`${stats?.openConversations ?? 0} open`} />
                <StatCard title="Messages Processed" value={stats?.totalMessages?.toLocaleString() ?? 0} icon={Activity} />
                <StatCard title="Success Rate" value={`${stats?.successRate ?? 100}%`} icon={TrendingUp} trend="Platform average" />
              </div>

              {stats?.conversationsLast7Days && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Conversations — Last 7 Days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.conversationsLast7Days}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip labelFormatter={d => `Date: ${d}`} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {agents.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-1">No agents yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Create your first AI agent to start automating conversations.</p>
                    <Button onClick={() => { setActiveTab("agents"); setAgentDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />Create Agent
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Agents tab */}
          {activeTab === "agents" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">AI Agents</h1>
                  <p className="text-muted-foreground">Deploy and manage your autonomous agents</p>
                </div>
                <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2" />New Agent</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create AI Agent</DialogTitle>
                      <DialogDescription>Configure your autonomous agent for a messaging platform.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={agentForm.handleSubmit(d => createAgent.mutate(d))} className="space-y-4 mt-2">
                      <div className="space-y-1">
                        <Label>Agent Name</Label>
                        <Input {...agentForm.register("name")} placeholder="Customer Support Bot" />
                        {agentForm.formState.errors.name && <p className="text-xs text-destructive">{agentForm.formState.errors.name.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label>Platform</Label>
                        <Select onValueChange={v => agentForm.setValue("platform", v as any)}>
                          <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map(p => (
                              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {agentForm.formState.errors.platform && <p className="text-xs text-destructive">{agentForm.formState.errors.platform.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Input {...agentForm.register("description")} placeholder="Handles customer support queries" />
                      </div>
                      <div className="space-y-1">
                        <Label>System Prompt <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Textarea {...agentForm.register("systemPrompt")} placeholder="You are a helpful customer support agent for..." rows={3} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setAgentDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createAgent.isPending}>
                          {createAgent.isPending ? "Creating…" : "Create Agent"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {agents.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-1">No agents created yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Create your first agent to start automating.</p>
                    <Button onClick={() => setAgentDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Agent</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {agents.map((agent: any) => (
                    <Card key={agent.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Bot className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{agent.name}</h3>
                                <PlatformBadge platform={agent.platform} />
                                <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">
                                  {agent.status}
                                </Badge>
                              </div>
                              {agent.description && <p className="text-sm text-muted-foreground mt-0.5">{agent.description}</p>}
                              <p className="text-xs text-muted-foreground mt-1">
                                {agent.totalConversations} conversations · {agent.totalMessages} messages
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleAgentStatus.mutate({
                                id: agent.id,
                                status: agent.status === "active" ? "inactive" : "active",
                              })}
                            >
                              {agent.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteAgent.mutate(agent.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* API Keys tab */}
          {activeTab === "keys" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">API Keys</h1>
                <p className="text-muted-foreground">Manage programmatic access to your organization</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Create New API Key</CardTitle>
                  <CardDescription>Keys are shown once. Store them securely.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Key name (e.g. Production, CI/CD)"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      onClick={() => createKey.mutate(newKeyName)}
                      disabled={!newKeyName.trim() || createKey.isPending}
                    >
                      <Plus className="w-4 h-4 mr-2" />Generate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {createdRawKey && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                      <Shield className="w-4 h-4" />API key created — copy it now
                    </CardTitle>
                    <CardDescription className="text-green-700">This key will not be shown again.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-sm font-mono break-all">
                        {createdRawKey}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { navigator.clipboard.writeText(createdRawKey); toast({ title: "Copied!" }); }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setCreatedRawKey(null)}>
                      I've saved it, dismiss
                    </Button>
                  </CardContent>
                </Card>
              )}

              {keys.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center">
                    <Key className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No API keys yet. Create one above.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {keys.map((key: any) => (
                    <Card key={key.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{key.name}</p>
                          <code className="text-xs text-muted-foreground">{key.keyPrefix}••••••••••••••••</code>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Created {new Date(key.createdAt).toLocaleDateString()}
                            {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                            {key.expiresAt && ` · Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => revokeKey.mutate(key.id)}
                        >
                          Revoke
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
