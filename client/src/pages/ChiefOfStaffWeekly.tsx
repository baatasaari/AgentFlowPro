import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Brain, CheckCircle2, PoundSterling, Heart,
  TrendingDown, TrendingUp, AlertTriangle, Calendar,
} from "lucide-react";

interface Task {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  dueDate?: string;
  createdAt: string;
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
  id: number;
  date: string;
  sleepHours?: string;
  steps?: number;
  caffeineCount?: number;
}

interface DailyBriefing {
  id: number;
  briefingDate: string;
  summary: string;
  topPriorities: string;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

const CATEGORY_ICONS: Record<string, string> = {
  family: "👨‍👩‍👦",
  finance: "💰",
  health: "❤️",
  church: "⛪",
  "work-personal": "💼",
};

export default function ChiefOfStaffWeekly() {
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/cos/tasks"],
    queryFn: async () => {
      const r = await fetch("/api/cos/tasks");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: finance = [] } = useQuery<FinanceItem[]>({
    queryKey: ["/api/cos/finance"],
    queryFn: async () => {
      const r = await fetch("/api/cos/finance?days=7");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: health = [] } = useQuery<HealthNote[]>({
    queryKey: ["/api/cos/health/week"],
    queryFn: async () => {
      const r = await fetch("/api/cos/health/week");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: briefings = [] } = useQuery<DailyBriefing[]>({
    queryKey: ["/api/cos/briefing/recent"],
    queryFn: async () => {
      const r = await fetch("/api/cos/briefing/recent?days=7");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  // Stats
  const doneTasks = tasks.filter(t => t.status === "done").length;
  const openTasks = tasks.filter(t => t.status === "open").length;
  const deferredTasks = tasks.filter(t => t.status === "deferred").length;

  const totalSpend = finance.reduce((sum, f) => sum + parseFloat(f.amount || "0"), 0);
  const riskItems = finance.filter(f => f.riskFlag);
  const riskSpend = riskItems.reduce((sum, f) => sum + parseFloat(f.amount || "0"), 0);

  const sleepValues = health.filter(h => h.sleepHours).map(h => parseFloat(h.sleepHours!));
  const avgSleep = avg(sleepValues);
  const stepValues = health.filter(h => h.steps).map(h => h.steps!);
  const avgSteps = avg(stepValues);

  // Category breakdown for tasks
  const byCategory: Record<string, number> = {};
  tasks.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/chief-of-staff">
            <Button variant="ghost" size="sm" className="text-slate-500">
              <ArrowLeft className="w-4 h-4 mr-1" /> Today
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-600" /> Weekly Review
            </h1>
            <p className="text-xs text-slate-500">Last 7 days overview</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-slate-500">Tasks done</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{doneTasks}</p>
              <p className="text-xs text-slate-400">{openTasks} open · {deferredTasks} deferred</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <PoundSterling className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-slate-500">Total spend (7d)</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">£{totalSpend.toFixed(0)}</p>
              {riskSpend > 0 && (
                <p className="text-xs text-red-500">⚠️ £{riskSpend.toFixed(0)} at risk</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-rose-500" />
                <span className="text-xs text-slate-500">Avg sleep</span>
              </div>
              <p className={`text-2xl font-bold ${avgSleep >= 7 ? "text-green-600" : avgSleep > 0 ? "text-red-500" : "text-slate-300"}`}>
                {avgSleep > 0 ? `${avgSleep}h` : "—"}
              </p>
              {avgSteps > 0 && <p className="text-xs text-slate-400">~{avgSteps.toLocaleString()} avg steps</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-slate-500">Briefings generated</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{briefings.length}</p>
              <p className="text-xs text-slate-400">this week</p>
            </CardContent>
          </Card>
        </div>

        {/* Finance leakage */}
        {riskItems.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" /> Finance risks requiring action
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {riskItems.map(f => (
                  <div key={f.id} className="flex items-start justify-between bg-white rounded-lg p-3 border border-amber-100">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{f.merchant}</p>
                      {f.category && <p className="text-xs text-slate-500">{f.category}</p>}
                      {f.notes && <p className="text-xs text-slate-500 italic">{f.notes}</p>}
                      <p className="text-xs text-slate-400">{f.date}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-700 shrink-0">£{f.amount}</span>
                  </div>
                ))}
                <p className="text-xs text-amber-700 font-medium pt-1">
                  Total at risk: £{riskSpend.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All finance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PoundSterling className="w-4 h-4 text-amber-500" /> All Finance (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {finance.length ? (
              <div className="divide-y divide-slate-100">
                {finance.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm text-slate-800">{f.merchant}</span>
                      {f.category && <span className="text-xs text-slate-400 ml-2">{f.category}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {f.riskFlag && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                      <span className="text-sm font-medium text-slate-700">£{f.amount}</span>
                      <span className="text-xs text-slate-400">{f.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No finance items this week</p>
            )}
          </CardContent>
        </Card>

        {/* Task breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-500" /> Tasks by category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(byCategory).length ? (
                <div className="space-y-2">
                  {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">
                        {CATEGORY_ICONS[cat] || "📋"} {cat}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No tasks yet</p>
              )}
            </CardContent>
          </Card>

          {/* Health summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" /> Health (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health.length ? (
                <div className="space-y-1.5">
                  {health.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500 text-xs">{h.date}</span>
                      <div className="flex gap-3">
                        {h.sleepHours && (
                          <span className={`text-xs font-medium ${parseFloat(h.sleepHours) >= 7 ? "text-green-600" : "text-red-500"}`}>
                            {h.sleepHours}h
                          </span>
                        )}
                        {h.steps !== undefined && (
                          <span className={`text-xs font-medium ${(h.steps || 0) >= 8000 ? "text-green-600" : "text-amber-500"}`}>
                            {(h.steps || 0).toLocaleString()}
                          </span>
                        )}
                        {h.caffeineCount !== undefined && (
                          <span className={`text-xs font-medium ${(h.caffeineCount || 0) <= 3 ? "text-slate-500" : "text-red-500"}`}>
                            ☕{h.caffeineCount}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No health data this week</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent briefings */}
        {briefings.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" /> Recent briefings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {briefings.map(b => (
                  <div key={b.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{b.briefingDate}</span>
                    </div>
                    <p className="text-xs text-slate-600">{b.summary}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
