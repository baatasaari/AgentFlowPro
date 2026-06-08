import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, CheckCircle2, Brain, DollarSign, Heart, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function nowISO() {
  const d = new Date();
  return `${d.toISOString().split("T")[0]}T${d.toTimeString().slice(0, 5)}`;
}

// ─── Task form ────────────────────────────────────────────────────────────────

interface TaskForm {
  title: string;
  category: string;
  priority: string;
  dueDate?: string;
  notes?: string;
}

function TaskTab({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<TaskForm>({
    defaultValues: { priority: "medium", category: "family" },
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (data: TaskForm) => {
      const r = await fetch("/api/cos/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: "open", source: "manual" }),
      });
      if (!r.ok) throw new Error("Failed to save task");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Task added" });
      qc.invalidateQueries({ queryKey: ["/api/cos/dashboard"] });
      reset();
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Could not save task", variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4">
      <div>
        <Label>Task *</Label>
        <Input {...register("title", { required: true })} placeholder="e.g. Check Joshua TMUA date" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select defaultValue="family" onValueChange={v => setValue("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="family">👨‍👩‍👦 Family</SelectItem>
              <SelectItem value="finance">💰 Finance</SelectItem>
              <SelectItem value="health">❤️ Health</SelectItem>
              <SelectItem value="church">⛪ Church</SelectItem>
              <SelectItem value="work-personal">💼 Work / Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select defaultValue="medium" onValueChange={v => setValue("priority", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">🔴 High</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="low">🟢 Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Due date</Label>
        <Input type="date" {...register("dueDate")} defaultValue={todayISO()} />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea {...register("notes")} placeholder="Context, decisions needed, etc." rows={2} />
      </div>
      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={mut.isPending}>
        {mut.isPending ? "Saving…" : "Add Task"}
      </Button>
    </form>
  );
}

// ─── Finance form ─────────────────────────────────────────────────────────────

interface FinanceForm {
  date: string;
  merchant: string;
  amount: string;
  category?: string;
  notes?: string;
  riskFlag: boolean;
}

function FinanceTab({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, reset, setValue } = useForm<FinanceForm>({
    defaultValues: { date: todayISO(), riskFlag: false },
  });
  const [riskFlag, setRiskFlag] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (data: FinanceForm) => {
      const r = await fetch("/api/cos/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, riskFlag }),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Finance item added" });
      qc.invalidateQueries({ queryKey: ["/api/cos/dashboard"] });
      reset();
      setRiskFlag(false);
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Could not save item", variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date</Label>
          <Input type="date" {...register("date", { required: true })} />
        </div>
        <div>
          <Label>Amount (£) *</Label>
          <Input type="text" inputMode="decimal" {...register("amount", { required: true })} placeholder="71.50" />
        </div>
      </div>
      <div>
        <Label>Merchant / Payee *</Label>
        <Input {...register("merchant", { required: true })} placeholder="e.g. Virgin Media" />
      </div>
      <div>
        <Label>Category</Label>
        <Select onValueChange={v => setValue("category", v)}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="subscription">Subscription</SelectItem>
            <SelectItem value="food">Food</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="utility">Utility</SelectItem>
            <SelectItem value="impulse">Impulse</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea {...register("notes")} placeholder="e.g. Increased from £50 — negotiate or switch" rows={2} />
      </div>
      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <Switch id="riskFlag" checked={riskFlag} onCheckedChange={setRiskFlag} />
        <Label htmlFor="riskFlag" className="text-sm text-amber-800 cursor-pointer">
          ⚠️ Flag as financial risk (overspend, surprise charge, needs action)
        </Label>
      </div>
      <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={mut.isPending}>
        {mut.isPending ? "Saving…" : "Add Finance Item"}
      </Button>
    </form>
  );
}

// ─── Health form ──────────────────────────────────────────────────────────────

interface HealthForm {
  date: string;
  sleepHours?: string;
  steps?: number;
  caffeineCount?: number;
  notes?: string;
}

function HealthTab({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, reset } = useForm<HealthForm>({
    defaultValues: { date: todayISO() },
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (data: HealthForm) => {
      const r = await fetch("/api/cos/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Health note logged" });
      qc.invalidateQueries({ queryKey: ["/api/cos/dashboard"] });
      reset();
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Could not save", variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4">
      <div>
        <Label>Date</Label>
        <Input type="date" {...register("date", { required: true })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Sleep (hours)</Label>
          <Input type="number" step="0.5" min="0" max="24" {...register("sleepHours")} placeholder="7.5" />
        </div>
        <div>
          <Label>Steps</Label>
          <Input type="number" min="0" {...register("steps", { valueAsNumber: true })} placeholder="8000" />
        </div>
        <div>
          <Label>Caffeine</Label>
          <Input type="number" min="0" max="20" {...register("caffeineCount", { valueAsNumber: true })} placeholder="2" />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea {...register("notes")} placeholder="Energy level, illness, exercise, stress..." rows={2} />
      </div>
      <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={mut.isPending}>
        {mut.isPending ? "Saving…" : "Log Health Data"}
      </Button>
    </form>
  );
}

// ─── Event form ───────────────────────────────────────────────────────────────

interface EventForm {
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  importance: string;
}

function EventTab({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, reset, setValue } = useForm<EventForm>({
    defaultValues: { startTime: nowISO(), importance: "normal" },
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (data: EventForm) => {
      const r = await fetch("/api/cos/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: "manual" }),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Event added" });
      qc.invalidateQueries({ queryKey: ["/api/cos/dashboard"] });
      reset();
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Could not save", variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4">
      <div>
        <Label>Title *</Label>
        <Input {...register("title", { required: true })} placeholder="e.g. School parents evening" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start time *</Label>
          <Input type="datetime-local" {...register("startTime", { required: true })} />
        </div>
        <div>
          <Label>End time</Label>
          <Input type="datetime-local" {...register("endTime")} />
        </div>
      </div>
      <div>
        <Label>Location</Label>
        <Input {...register("location")} placeholder="e.g. School hall, Zoom link" />
      </div>
      <div>
        <Label>Importance</Label>
        <Select defaultValue="normal" onValueChange={v => setValue("importance", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">🔴 High — cannot miss</SelectItem>
            <SelectItem value="normal">🟡 Normal</SelectItem>
            <SelectItem value="low">🟢 Low — optional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={mut.isPending}>
        {mut.isPending ? "Saving…" : "Add Event"}
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChiefOfStaffAdd() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const defaultTab = params.get("tab") || "task";

  function goBack() {
    setLocation("/chief-of-staff");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/chief-of-staff">
            <Button variant="ghost" size="sm" className="text-slate-500">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-600" /> Add Item
            </h1>
            <p className="text-xs text-slate-500">Log tasks, spending, health, or events</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="w-full mb-6 grid grid-cols-4">
                <TabsTrigger value="task" className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Task
                </TabsTrigger>
                <TabsTrigger value="finance" className="text-xs gap-1">
                  <DollarSign className="w-3 h-3" /> Finance
                </TabsTrigger>
                <TabsTrigger value="health" className="text-xs gap-1">
                  <Heart className="w-3 h-3" /> Health
                </TabsTrigger>
                <TabsTrigger value="event" className="text-xs gap-1">
                  <Calendar className="w-3 h-3" /> Event
                </TabsTrigger>
              </TabsList>
              <TabsContent value="task"><TaskTab onDone={goBack} /></TabsContent>
              <TabsContent value="finance"><FinanceTab onDone={goBack} /></TabsContent>
              <TabsContent value="health"><HealthTab onDone={goBack} /></TabsContent>
              <TabsContent value="event"><EventTab onDone={goBack} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
