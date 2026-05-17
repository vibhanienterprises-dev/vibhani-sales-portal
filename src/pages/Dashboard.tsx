import { useState } from "react";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  useGetDashboardSummary, 
  useGetRecentActivity, 
  useGetPipelineValue,
  useListLeads,
  customFetch 
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { ActivityItem } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Target, Zap, Calendar, MessageCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleWhatsappClick } from "@/lib/communication";

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const fmt = (v: number) =>
  v >= 10_00_000 ? `₹${(v / 10_00_000).toFixed(1)}Cr`
  : v >= 1_00_000 ? `₹${(v / 1_00_000).toFixed(1)}L`
  : v >= 1_000   ? `₹${(v / 1_00_000).toFixed(0)}k`
  : `₹${v}`;

type ForecastData = {
  bestCase: number;
  expected: number;
  committed: number;
  stageBreakdown: { stage: string; label: string; probability: number; count: number; raw: number; weighted: number }[];
  projection: { month: string; forecast: number; pipeline: number; historical: number }[];
};

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: pipeline, isLoading: isLoadingPipeline } = useGetPipelineValue();
  const { data: leads, isLoading: isLoadingLeads } = useListLeads();
  const { data: forecast, isLoading: isLoadingForecast } = useQuery<ForecastData>({
    queryKey: ["/api/dashboard/forecast"],
    queryFn: () => customFetch<ForecastData>("/api/dashboard/forecast"),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);

  const handleSendAmcReminder = async (lead: any) => {
    if (!lead.phone || !lead.amcExpiryDate) {
      toast({ title: "Lead is missing phone number or AMC expiry date", variant: "destructive" });
      return;
    }
    setSendingReminderId(lead.id);
    try {
      const expiry = new Date(lead.amcExpiryDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffTime = expiry.getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      
      const messageText = `Hi ${lead.contactName || 'there'}, your Vibhani maintenance contract for ${lead.companyName} expires in ${daysRemaining} days (on ${expiry.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}). Please contact us to renew it.`;
      
      // 1. Open WhatsApp Web
      handleWhatsappClick(lead.phone, messageText);
      
      // 2. Call backend /api/whatsapp/send to record activity
      await customFetch("/api/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          phone: lead.phone,
          leadId: lead.id,
          customMessage: `Sent AMC Renewal Reminder (Expires in ${daysRemaining} days)`,
        }),
      });
      
      // 3. Invalidate queries to refresh activity immediately
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: `AMC Renewal Reminder sent to ${lead.companyName}` });
    } catch (err) {
      toast({ title: "Failed to log WhatsApp reminder activity", variant: "destructive" });
    } finally {
      setSendingReminderId(null);
    }
  };

  const upcomingRenewals = leads?.filter(lead => {
    if (!lead.amcExpiryDate) return false;
    const expiry = new Date(lead.amcExpiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);
    
    return expiry >= today && expiry <= thirtyDaysFromNow;
  }).sort((a, b) => new Date(a.amcExpiryDate!).getTime() - new Date(b.amcExpiryDate!).getTime()) || [];

  const formattedRevenueData = summary?.revenueByMonth?.map(item => ({
    month: item.month,
    revenue: item.revenue,
  })) || [];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-foreground">₹{summary?.totalRevenue?.toLocaleString('en-IN') || 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-foreground">{summary?.activeLeads || 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GST Payable (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-foreground">₹{summary?.gstPayable?.toLocaleString('en-IN') || 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Today</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-foreground">{summary?.tasksToday || 0}</div>}
              {summary?.overdueTasksCount ? <p className="text-xs text-destructive mt-1">{summary.overdueTasksCount} overdue</p> : null}
            </CardContent>
          </Card>
        </div>

        {/* Sales Forecast */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Sales Forecast
              <span className="ml-auto text-xs font-normal text-muted-foreground">Weighted by stage probability</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingForecast ? (
              <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>
            ) : (
              <div className="space-y-6">
                {/* Three headline metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-background/60 border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Committed</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{fmt(forecast?.committed ?? 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Quotation sent × 60%</p>
                  </div>
                  <div className="rounded-lg bg-background/60 border border-primary/30 p-4 ring-1 ring-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-primary" />
                      <span className="text-xs text-primary font-medium uppercase tracking-wider">Expected</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">{fmt(forecast?.expected ?? 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Probability-weighted total</p>
                  </div>
                  <div className="rounded-lg bg-background/60 border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Best Case</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">{fmt(forecast?.bestCase ?? 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">If all active leads close</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 3-month projection */}
                  <div className="w-full overflow-x-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-3">3-Month Revenue Projection</p>
                    <div className="h-52 min-w-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecast?.projection ?? []}>
                          <defs>
                            <linearGradient id="fgPipeline" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="fgHistorical" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={fmt} width={55} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                            formatter={(value: number, name: string) => [fmt(value), name === "pipeline" ? "Pipeline" : "Historical"]}
                          />
                          <Legend formatter={(v) => v === "pipeline" ? "Pipeline Contribution" : "Historical Avg"} />
                          <Area type="monotone" dataKey="historical" stackId="1" stroke="hsl(var(--chart-2))" fill="url(#fgHistorical)" strokeWidth={2} />
                          <Area type="monotone" dataKey="pipeline" stackId="1" stroke="hsl(var(--primary))" fill="url(#fgPipeline)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Stage probability breakdown */}
                  <div className="w-full overflow-x-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Pipeline by Stage (Weighted)</p>
                    <div className="space-y-2.5 min-w-[300px]">
                      {forecast?.stageBreakdown.filter(s => s.count > 0).map(s => {
                        const maxWeighted = Math.max(...(forecast.stageBreakdown.map(x => x.weighted)), 1);
                        const barWidth = Math.round((s.weighted / maxWeighted) * 100);
                        const colors: Record<string, string> = {
                          new: "bg-blue-500",
                          contacted: "bg-yellow-500",
                          quotation_sent: "bg-purple-500",
                          converted: "bg-green-500",
                        };
                        return (
                          <div key={s.stage}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{s.label} <span className="text-foreground/50">({s.probability}% prob)</span></span>
                              <span className="font-medium text-foreground">{fmt(s.weighted)} <span className="text-muted-foreground">/ {fmt(s.raw)}</span></span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${colors[s.stage] || "bg-primary"} transition-all`} style={{ width: `${barWidth}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {forecast?.stageBreakdown.every(s => s.count === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-4">No active leads with deal values yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming AMC Renewals Widget */}
        <Card className="mb-8 border-amber-500/20 bg-gradient-to-br from-card to-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Calendar className="w-5 h-5 text-amber-500 animate-pulse" />
              Upcoming AMC Renewals (Next 30 Days)
              <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Revenue at Risk
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLeads ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : upcomingRenewals.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-500/70" />
                <p className="font-medium text-foreground/80">All systems green!</p>
                <p className="text-xs max-w-sm">No maintenance contracts are expiring within the next 30 days.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/40">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {upcomingRenewals.map((lead: any) => {
                      const expiry = new Date(lead.amcExpiryDate);
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const diffTime = expiry.getTime() - today.getTime();
                      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                      
                      return (
                        <tr key={lead.id} className="hover:bg-muted/40 transition-colors group">
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            <Link href={`/leads/${lead.id}`} className="hover:text-primary flex items-center gap-1.5">
                              {lead.companyName}
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground font-medium">{lead.contactName || '-'}</td>
                          <td className="py-3.5 px-4 text-amber-600 font-semibold">
                            {expiry.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              daysRemaining <= 7 ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                              daysRemaining <= 15 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                              "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                            }`}>
                              {daysRemaining} days left
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendAmcReminder(lead)}
                              disabled={sendingReminderId === lead.id}
                              className="h-8 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 font-medium"
                            >
                              <MessageCircle className="w-4 h-4 mr-1.5 text-amber-500" />
                              {sendingReminderId === lead.id ? "Sending..." : "Send Reminder"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Revenue (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {isLoadingSummary ? (
                <div className="flex items-center justify-center h-full"><Skeleton className="h-full w-full" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000) + 'k' : value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }} 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {isLoadingPipeline ? (
                <div className="flex items-center justify-center h-full"><Skeleton className="h-full w-full" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pipeline || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="label"
                    >
                      {(pipeline || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string, props: any) => [`${value} leads (₹${props.payload.totalValue?.toLocaleString('en-IN')})`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
                {activity.map((item: ActivityItem) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded border border-border shadow-sm">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-foreground text-sm">{item.entityName || 'System'}</div>
                        <time className="font-medium text-xs text-muted-foreground">{format(new Date(item.createdAt), 'MMM d, h:mm a')}</time>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No recent activity</div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
