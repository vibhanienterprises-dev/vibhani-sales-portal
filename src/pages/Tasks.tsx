import { Sidebar } from "@/components/layout/Sidebar";
import { customFetch } from "@workspace/api-client-react";
import { useGetTodaysTasks, useCompleteTask, useCreateTask, useListLeads, customFetch } from "@workspace/api-client-react";
import { getGetTodaysTasksQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TASK_TYPES } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Phone, MessageCircle, Mail, Users, CheckSquare, AlertCircle, Plus, Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CreateTaskBodyType } from "@workspace/api-client-react";
import { Link } from "wouter";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.nativeEnum(CreateTaskBodyType),
  dueDate: z.string().min(1, "Due date is required"),
  leadId: z.coerce.number().optional(),
});

interface UpcomingTasks {
  calls: any[];
  whatsapp: any[];
  emails: any[];
  meetings: any[];
  other: any[];
  all: any[];
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");

  const { data: tasks, isLoading } = useGetTodaysTasks();
  const { data: upcomingTasks, isLoading: upcomingLoading } = useQuery<UpcomingTasks>({
    queryKey: ["/api/tasks/upcoming"],
    queryFn: () => customFetch<UpcomingTasks>("/api/tasks/upcoming"),
    refetchInterval: 60_000,
  });
  const { data: leads } = useListLeads();
  const completeTask = useCompleteTask();
  const createTask = useCreateTask();

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "call",
      dueDate: new Date().toISOString().split('T')[0],
      leadId: 0,
    },
  });

  const onSubmit = (values: z.infer<typeof taskSchema>) => {
    createTask.mutate({ 
      data: { 
        ...values, 
        leadId: values.leadId || undefined 
      } 
    }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetTodaysTasksQueryKey() });
        toast({ title: "Task created successfully" });
      }
    });
  };

  const handleComplete = (id: number, checked: boolean) => {
    if (checked) {
      completeTask.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTodaysTasksQueryKey() });
          toast({ title: "Task marked complete" });
        }
      });
    }
  };

  const TaskList = ({ items, icon: Icon, title, emptyMessage }: any) => (
    <Card className="mb-6">
      <CardHeader className="py-4 border-b border-border bg-card/50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          {title}
          <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary">{items?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="divide-y divide-border">
            {items?.map((task: any) => (
              <div key={task.id} className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors group">
                <Checkbox 
                  checked={task.status === 'completed'} 
                  onCheckedChange={(checked) => handleComplete(task.id, checked as boolean)} 
                  className="mt-1 w-5 h-5"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{task.title}</div>
                  {task.description && <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</div>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {task.leadName && (
                      <Link href={`/leads/${task.leadId}`} className="hover:text-primary transition-colors flex items-center gap-1">
                        <Users className="w-3 h-3" /> {task.leadName}
                      </Link>
                    )}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 flex justify-between items-center border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1 text-sm">Your daily action items and follow-ups.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="leadId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Lead (Optional)</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a lead" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          {leads?.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.companyName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createTask.isPending}>
                    {createTask.isPending ? "Creating..." : "Save Task"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="px-8 pt-4 border-b border-border">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${activeTab === "today" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Today
              {tasks && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "today" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{tasks.totalPending ?? 0}</span>}
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${activeTab === "upcoming" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Upcoming (Next 7 Days)
              {upcomingTasks && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "upcoming" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{upcomingTasks.all.length}</span>}
            </button>
          </div>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {activeTab === "today" && (
            isLoading ? (
              <div className="space-y-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                  {tasks?.overdue && tasks.overdue.length > 0 && (
                    <Card className="border-red-500/50 bg-red-500/5 shadow-red-500/10">
                      <CardHeader className="py-4 border-b border-red-500/20">
                        <CardTitle className="text-lg flex items-center gap-2 text-red-500">
                          <AlertCircle className="w-5 h-5" />
                          Overdue
                          <Badge variant="destructive" className="ml-2">{tasks.overdue.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-red-500/10">
                          {tasks.overdue.map((task: any) => (
                            <div key={task.id} className="p-4 flex items-start gap-4">
                              <Checkbox
                                checked={task.status === 'completed'}
                                onCheckedChange={(checked) => handleComplete(task.id, checked as boolean)}
                                className="mt-1 w-5 h-5 border-red-500/50 data-[state=checked]:bg-red-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground">{task.title}</div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-red-400">
                                  {task.leadName && <span>{task.leadName}</span>}
                                  <span className="font-bold flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <TaskList items={tasks?.calls} icon={Phone} title="Calls Today" emptyMessage="No calls scheduled for today" />
                  <TaskList items={tasks?.whatsapp} icon={MessageCircle} title="WhatsApp Follow-ups" emptyMessage="No WhatsApp follow-ups scheduled" />
                </div>
                <div className="space-y-6">
                  <TaskList items={tasks?.emails} icon={Mail} title="Emails to Send" emptyMessage="No emails scheduled" />
                  <TaskList items={tasks?.meetings} icon={Users} title="Meetings" emptyMessage="No meetings scheduled" />
                  <TaskList items={(tasks as any)?.other} icon={CheckSquare} title="Other Tasks" emptyMessage="No other tasks" />
                </div>
              </div>
            )
          )}

          {activeTab === "upcoming" && (
            upcomingLoading ? (
              <div className="space-y-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
            ) : upcomingTasks?.all.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">No upcoming tasks in the next 7 days</p>
                <p className="text-muted-foreground/60 text-sm mt-1">Schedule tasks on a lead to see them here</p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                  <TaskList items={upcomingTasks?.calls} icon={Phone} title="Upcoming Calls" emptyMessage="No calls in the next 7 days" />
                  <TaskList items={upcomingTasks?.whatsapp} icon={MessageCircle} title="Upcoming WhatsApp" emptyMessage="No WhatsApp tasks" />
                </div>
                <div className="space-y-6">
                  <TaskList items={upcomingTasks?.emails} icon={Mail} title="Upcoming Emails" emptyMessage="No emails scheduled" />
                  <TaskList items={upcomingTasks?.meetings} icon={Users} title="Upcoming Meetings" emptyMessage="No meetings" />
                  <TaskList items={upcomingTasks?.other} icon={CheckSquare} title="Other Upcoming" emptyMessage="No other tasks" />
                </div>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
