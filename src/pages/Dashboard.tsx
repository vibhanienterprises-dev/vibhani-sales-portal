import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  useGetDashboardSummary, 
  useGetRecentActivity, 
  useGetPipelineValue 
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { ActivityItem } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Target, Zap } from "lucide-react";

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const fmt = (v: number) =>
  v >= 10_00_000 ? `₹${(v / 10_00_000).toFixed(1)}Cr`
  : v >= 1_00_000 ? `₹${(v / 1_00_000).toFixed(1)}L`
  : v >= 1_000   ? `₹${(v / 1_000).toFixed(0)}k`
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
  const { data: forecast, isLoading: isLoadingForecast } = useQuery<ForecastData>({
    queryKey: ["/api/dashboard/forecast"],
    queryFn: () => fetch("/api/dashboard/forecast").then(r => r.json()),
  });

  const formattedRevenueData = summary?.revenueByMonth?.map(item => ({
    month: item.month,
    revenue: item.revenue,
  })) || [];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
                <div className="grid grid-cols-3 gap-4">
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

                <div className="grid grid-cols-2 gap-6">
                  {/* 3-month projection */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">3-Month Revenue Projection</p>
                    <div className="h-52">
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
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Pipeline by Stage (Weighted)</p>
                    <div className="space-y-2.5">
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
