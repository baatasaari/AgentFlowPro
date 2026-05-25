import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Building2, MessageSquare, Users, Zap, LogOut, AlertTriangle, CheckCircle } from "lucide-react";

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats } = useQuery<any>({ queryKey: ["/api/admin/stats"] });
  const { data: orgs = [] } = useQuery<any[]>({ queryKey: ["/api/admin/organizations"] });

  const suspendOrg = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/organizations/${id}/suspend`, { reason: "Suspended by admin" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/organizations"] }); toast({ title: "Organization suspended" }); },
  });

  const reactivateOrg = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/organizations/${id}/reactivate`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/organizations"] }); toast({ title: "Organization reactivated" }); },
  });

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: number; plan: string }) => apiRequest("PUT", `/api/admin/organizations/${id}/plan`, { plan }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/organizations"] }); toast({ title: "Plan updated" }); },
  });

  if (user?.role !== "super_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center"><AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" /><p className="font-semibold">Admin access required</p><Link href="/dashboard" className="text-primary hover:underline text-sm">Back to Dashboard</Link></div>
      </div>
    );
  }

  const planColor: Record<string, string> = { free: "secondary", starter: "outline", professional: "default", enterprise: "default" };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
          <span className="font-bold">AgentFlow</span>
          <Badge variant="destructive" className="text-xs">Admin</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><Button variant="outline" size="sm">My Dashboard</Button></Link>
          <Button variant="ghost" size="sm" onClick={() => { logout(); navigate("/"); }}><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Platform Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Total Organizations</p><p className="text-3xl font-bold">{stats?.totalOrganizations ?? 0}</p><p className="text-xs text-muted-foreground">{stats?.activeOrganizations ?? 0} active</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Total Agents</p><p className="text-3xl font-bold">{stats?.totalAgents ?? 0}</p><p className="text-xs text-muted-foreground">{stats?.activeAgents ?? 0} active</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Messages This Period</p><p className="text-3xl font-bold">{stats?.totalMessages?.toLocaleString() ?? 0}</p></CardContent></Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Plan Breakdown</p>
              <div className="text-xs mt-2 space-y-1">
                {stats?.planBreakdown && Object.entries(stats.planBreakdown).map(([plan, count]) => (
                  <div key={plan} className="flex justify-between"><span className="capitalize">{plan}</span><span className="font-bold">{count as number}</span></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations */}
        <Card>
          <CardHeader><CardTitle>All Organizations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orgs.map((org: any) => (
                <div key={org.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{org.name}</p>
                        <Badge variant={planColor[org.plan] as any || "secondary"} className="capitalize text-xs">{org.plan}</Badge>
                        {org.isSuspended && <Badge variant="destructive" className="text-xs">Suspended</Badge>}
                        {org.subscriptionStatus === "past_due" && <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Past Due</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">/{org.slug} · {org.agentCount} agents · {org.messagesThisPeriod}/{org.maxMonthlyMessages} messages</p>
                      {org.users?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Users: {org.users.map((u: any) => `${u.firstName || u.email} (${u.role})`).join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Joined {new Date(org.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {/* Change plan */}
                      <Select value={org.plan} onValueChange={plan => changePlan.mutate({ id: org.id, plan })}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      {org.isSuspended ? (
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 h-8" onClick={() => reactivateOrg.mutate(org.id)}>
                          <CheckCircle className="w-3 h-3 mr-1" />Reactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-destructive border-red-200 h-8" onClick={() => suspendOrg.mutate(org.id)}>
                          <AlertTriangle className="w-3 h-3 mr-1" />Suspend
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {orgs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No organizations yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
