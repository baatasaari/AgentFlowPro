import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Calendar, DollarSign, Heart, CheckCircle2, Circle,
  AlertTriangle, TrendingUp, Plus, RefreshCw, BarChart3, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: number;
  title: string;
  category: string;
  priority: string;
  dueDate?: string;
  status: string;
  notes?: string;
}

interface Event {
  id: number;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  importance: string;
}

interface FinanceItem {
  id: number;
  date: string;
  merchant: string;
  amount: string;
  category?: string;
  riskFlag: boolean;
  notes?: string;
}

interface HealthNote {
  date: string;
  sleepHours?: string;
  steps?: number;
  caffeineCount?: number;
  notes?: string;
}

interface BriefingPriority {
  rank: number;
  action: string;
  reason: string;
}

interface BriefingRisk {
  type: string;
  description: string;
  urgency: string;
}

interface GeneratedBriefing {
  greeting: string;
  topPriorities: BriefingPriority[];
  risks: BriefingRisk[];
  calendarAlert: string | null;
  moneyWarning: string | null;
  healthNudge: string | null;
  summary: string;
}

interface DailyBriefing {
  id: number;
  briefingDate: string;
  summary: string;
  topPriorities: string;
  risks: string;
  rawContext?: string;
}

interface Dashboard {
  today: string;
  tasks: Task[];
  events: Event[];
  finance: FinanceItem[];
  health: HealthNote | null;
  briefing: DailyBriefing | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const URGENCY_COLORS: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-blue-400",
};

const CATEGORY_ICONS: Record<string, string> = {
  family: "👨‍👩‍👦",
  finance: "💰",
  health: "❤️",
  church: "⛪",
  "work-personal": "💼",
};

function formatTime(iso: string): string {
  const t = iso.split("T")[1];
  if (!t) return iso;
  return t.slice(0, 5);
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function ChiefOfStaff() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [generatedBriefing, setGeneratedBriefing] = useState<GeneratedBriefing | null>(null);

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ["/api/cos/dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/cos/dashboard");
      if (!r.ok) throw new Error("Failed to load dashboard");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/cos/briefing/generate", { method: "POST" });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Failed to generate briefing");
      }
      return r.json();
    },
    onSuccess: (data) => {
      setGeneratedBriefing(data.generated);
      qc.invalidateQueries({ queryKey: ["/api/cos/dashboard"] });
      toast({ title: "Briefing generated", description: data.generated.summary });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/cos/tasks/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!r.ok) throw new Error("Failed to update task");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cos/dashboard"] }),
  });

  const parsedBriefing: GeneratedBriefing | null = (() => {
    if (generatedBriefing) return generatedBriefing;
    if (!dashboard?.briefing?.rawContext) return null;
    try {
      const raw = JSON.parse(dashboard.briefing.rawContext);
      return raw.generated || null;
    } catch {
      return null;
    }
  })();

  const today = dashboard?.today || new Date().toISOString().split("T")[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-slate-400 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-500">Loading your briefing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              Chief of Staff
            </h1>
            <p className="text-sm text-slate-500">{formatDate(today)}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/chief-of-staff/weekly">
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-1" /> Weekly
              </Button>
            </Link>
            <Link href="/chief-of-staff/add">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* AI Briefing Card */}
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-indigo-900 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                {parsedBriefing ? parsedBriefing.greeting : "Today's Briefing"}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                {dashboard?.briefing ? "Regenerate" : "Generate Briefing"}
              </Button>
            </div>
            {parsedBriefing && (
              <p className="text-sm text-indigo-700 mt-1">{parsedBriefing.summary}</p>
            )}
          </CardHeader>

          {parsedBriefing ? (
            <CardContent className="space-y-4">
              {/* Top Priorities */}
              <div>
                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2">Top 3 Actions</p>
                <div className="space-y-2">
                  {parsedBriefing.topPriorities.map(p => (
                    <div key={p.rank} className="flex gap-3 bg-white rounded-lg p-3 border border-indigo-100">
                      <span className="text-lg font-bold text-indigo-600 w-5 shrink-0">{p.rank}.</span>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{p.action}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerts row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {parsedBriefing.calendarAlert && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100 text-sm">
                    <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Calendar
                    </p>
                    <p className="text-slate-700">{parsedBriefing.calendarAlert}</p>
                  </div>
                )}
                {parsedBriefing.moneyWarning && (
                  <div className="bg-white rounded-lg p-3 border border-amber-100 text-sm">
                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Money
                    </p>
                    <p className="text-slate-700">{parsedBriefing.moneyWarning}</p>
                  </div>
                )}
                {parsedBriefing.healthNudge && (
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-sm">
                    <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                      <Heart className="w-3 h-3" /> Health
                    </p>
                    <p className="text-slate-700">{parsedBriefing.healthNudge}</p>
                  </div>
                )}
              </div>

              {/* Risks */}
              {parsedBriefing.risks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2">Risks</p>
                  <div className="space-y-1">
                    {parsedBriefing.risks.map((r, i) => (
                      <div
                        key={i}
                        className={`bg-white border-l-4 rounded-r-lg p-2 text-sm ${URGENCY_COLORS[r.urgency] || "border-l-slate-300"}`}
                      >
                        <span className="font-medium text-slate-800">{r.type.toUpperCase()}: </span>
                        <span className="text-slate-600">{r.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-sm text-indigo-600 italic">
                {generateMutation.isPending
                  ? "Your Chief of Staff is reading the room…"
                  : "Click Generate Briefing to get your daily priorities."}
              </p>
            </CardContent>
          )}
        </Card>

        {/* Three columns: Calendar | Finance | Health */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Calendar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Today's Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.events.length ? (
                <div className="space-y-2">
                  {dashboard.events.map(e => (
                    <div key={e.id} className="flex gap-2 items-start">
                      <span className="text-xs font-mono text-slate-400 mt-0.5 shrink-0">{formatTime(e.startTime)}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{e.title}</p>
                        {e.location && <p className="text-xs text-slate-400">{e.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No events today</p>
              )}
              <Link href="/chief-of-staff/add?tab=event">
                <Button variant="ghost" size="sm" className="mt-3 w-full text-xs text-blue-600 hover:text-blue-700">
                  <Plus className="w-3 h-3 mr-1" /> Add event
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Finance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" /> Finance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.finance.length ? (
                <div className="space-y-1.5">
                  {dashboard.finance.filter(f => f.riskFlag).slice(0, 3).map(f => (
                    <div key={f.id} className="flex items-center justify-between bg-amber-50 rounded p-2 border border-amber-100">
                      <div>
                        <p className="text-xs font-medium text-slate-800">{f.merchant}</p>
                        {f.notes && <p className="text-xs text-slate-500">{f.notes}</p>}
                      </div>
                      <span className="text-xs font-semibold text-amber-700">£{f.amount}</span>
                    </div>
                  ))}
                  {dashboard.finance.filter(f => !f.riskFlag).slice(0, 2).map(f => (
                    <div key={f.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                      <p className="text-xs text-slate-600">{f.merchant}</p>
                      <span className="text-xs text-slate-500">£{f.amount}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No recent finance items</p>
              )}
              <Link href="/chief-of-staff/add?tab=finance">
                <Button variant="ghost" size="sm" className="mt-3 w-full text-xs text-amber-600 hover:text-amber-700">
                  <Plus className="w-3 h-3 mr-1" /> Add finance item
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Health */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" /> Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.health ? (
                <div className="space-y-2">
                  {dashboard.health.sleepHours && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Sleep</span>
                      <span className={`text-sm font-semibold ${
                        parseFloat(dashboard.health.sleepHours) >= 7 ? "text-green-600" : "text-red-500"
                      }`}>{dashboard.health.sleepHours}h</span>
                    </div>
                  )}
                  {dashboard.health.steps !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Steps</span>
                      <span className={`text-sm font-semibold ${
                        (dashboard.health.steps || 0) >= 8000 ? "text-green-600" : "text-amber-500"
                      }`}>{(dashboard.health.steps || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {dashboard.health.caffeineCount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Caffeine</span>
                      <span className={`text-sm font-semibold ${
                        (dashboard.health.caffeineCount || 0) <= 3 ? "text-green-600" : "text-red-500"
                      }`}>{dashboard.health.caffeineCount} cups</span>
                    </div>
                  )}
                  {dashboard.health.notes && (
                    <p className="text-xs text-slate-500 italic">{dashboard.health.notes}</p>
                  )}
                  <p className="text-xs text-slate-400">Logged: {dashboard.health.date}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No health data logged</p>
              )}
              <Link href="/chief-of-staff/add?tab=health">
                <Button variant="ghost" size="sm" className="mt-3 w-full text-xs text-rose-600 hover:text-rose-700">
                  <Plus className="w-3 h-3 mr-1" /> Log health
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Open Tasks */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              Open Tasks
              {dashboard?.tasks.length ? (
                <Badge variant="secondary" className="text-xs">{dashboard.tasks.length}</Badge>
              ) : null}
            </CardTitle>
            <Link href="/chief-of-staff/add?tab=task">
              <Button variant="ghost" size="sm" className="text-xs text-indigo-600">
                <Plus className="w-3 h-3 mr-1" /> New task
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {dashboard?.tasks.length ? (
              <div className="divide-y divide-slate-100">
                {dashboard.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 py-2.5 group">
                    <button
                      onClick={() => completeMutation.mutate(task.id)}
                      className="mt-0.5 shrink-0 text-slate-300 hover:text-green-500 transition-colors"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{task.title}</span>
                        <span className="text-sm">{CATEGORY_ICONS[task.category] || "📋"}</span>
                        <Badge className={`text-xs px-1.5 py-0 border ${PRIORITY_COLORS[task.priority] || ""}`}>
                          {task.priority}
                        </Badge>
                        {task.status === "deferred" && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 text-slate-400">deferred</Badge>
                        )}
                      </div>
                      {task.dueDate && (
                        <p className="text-xs text-slate-400 mt-0.5">Due: {task.dueDate}</p>
                      )}
                      {task.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 italic">{task.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => completeMutation.mutate(task.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <CheckCircle2 className="w-4 h-4 text-slate-300 hover:text-green-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">All clear — no open tasks.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
