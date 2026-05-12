import { Sidebar } from "@/components/layout/Sidebar";
import { useListTasks, useCompleteTask, useCreateTask, useListLeads, customFetch } from "@workspace/api-client-react";
import { getListTasksQueryKey } from "@workspace/api-client-react";
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
import { TASK_TYPES, COMMUNICATION_TEMPLATES } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Phone, MessageCircle, Mail, Users, CheckSquare, AlertCircle, Plus, Calendar, Clock, Send, ExternalLink, MoreVertical } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CreateTaskBodyType } from "@workspace/api-client-react";
import { Link } from "wouter";
import { handleWhatsappClick } from "@/lib/communication";
import { EmailComposer } from "@/components/communication/EmailComposer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.nativeEnum(CreateTaskBodyType),
  dueDate: z.string().min(1, "Due date is required"),
  leadId: z.coerce.number().optional(),
});

export default function Tasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "upcoming" | "completed">("pending");

  const { data: pendingTasks, isLoading: pendingLoading } = useListTasks({ 
    // @ts-ignore - view is a custom param handled by backend
    view: "pending" 
  });
  const { data: upcomingTasks, isLoading: upcomingLoading } = useListTasks({ 
    // @ts-ignore
    view: "upcoming" 
  });
  const { data: completedTasks, isLoading: completedLoading } = useListTasks({ 
    // @ts-ignore
    view: "completed" 
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

  const [emailComposerData, setEmailComposerData] = useState<{ open: boolean; to: string; subject: string; body: string; leadId?: number }>({
    open: false,
    to: "",
    subject: "",
    body: "",
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
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ status: "pending" }) });
        toast({ title: "Task created successfully" });
      }
    });
  };

  const handleComplete = (id: number, checked: boolean) => {
    if (checked) {
      completeTask.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ status: "pending" }) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ status: "overdue" }) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ status: "completed" }) });
          toast({ title: "Task marked complete" });
        }
      });
    }
  };

  const CommunicationButtons = ({ task }: { task: any }) => {
    if (!task.leadId || (!task.leadPhone && !task.leadEmail)) return null;

    return (
      <div className="flex items-center gap-1">
        {task.leadPhone && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50">
                <MessageCircle className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Send WhatsApp</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COMMUNICATION_TEMPLATES.map((tmpl) => (
                <DropdownMenuItem key={tmpl.id} onClick={() => handleWhatsappClick(task.leadPhone, tmpl.whatsapp)}>
                  {tmpl.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => handleWhatsappClick(task.leadPhone, "")}>
                Custom Message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {task.leadEmail && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                <Mail className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Send Email</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COMMUNICATION_TEMPLATES.map((tmpl) => (
                <DropdownMenuItem key={tmpl.id} onClick={() => setEmailComposerData({ open: true, to: task.leadEmail || "", subject: tmpl.emailSubject, body: tmpl.emailBody, leadId: task.leadId })}>
                  {tmpl.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setEmailComposerData({ open: true, to: task.leadEmail || "", subject: "", body: "", leadId: task.leadId })}>
                Custom Email
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const TaskItem = ({ task }: { task: any }) => (
    <div key={task.id} className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors group">
      <Checkbox 
        checked={task.status === 'completed'} 
        onCheckedChange={(checked) => handleComplete(task.id, checked as boolean)} 
        disabled={task.status === 'completed'}
        className="mt-1 w-5 h-5"
      />
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </div>
        {task.description && <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</div>}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {task.leadName && (
            <Link href={`/leads/${task.leadId}`} className="hover:text-primary transition-colors flex items-center gap-1">
              <Users className="w-3 h-3" /> {task.leadName}
            </Link>
          )}
          <span className={`flex items-center gap-1 ${task.status === 'overdue' ? 'text-red-500 font-medium' : ''}`}>
            <Calendar className="w-3 h-3" /> {format(new Date(task.dueDate), "MMM d, yyyy")}
            {task.status === 'overdue' && " (Overdue)"}
          </span>
          <Badge variant="outline" className="text-[10px] uppercase">{task.type}</Badge>
        </div>
      </div>
      <CommunicationButtons task={task} />
    </div>
  );


  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 flex justify-between items-center border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage your follow-ups and history.</p>
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
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${activeTab === "pending" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Pending
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "pending" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {pendingTasks?.length || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${activeTab === "upcoming" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Upcoming
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "upcoming" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {upcomingTasks?.length || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${activeTab === "completed" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Completed
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "completed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {completedTasks?.length || 0}
              </span>
            </button>
          </div>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {activeTab === "pending" && (
            pendingLoading ? (
              <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
            ) : pendingTasks?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <CheckSquare className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">All caught up! No pending tasks.</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {pendingTasks.map((task: any) => <TaskItem key={task.id} task={task} />)}
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {activeTab === "upcoming" && (
            upcomingLoading ? (
              <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
            ) : upcomingTasks?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">No upcoming tasks scheduled.</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {upcomingTasks.map((task: any) => <TaskItem key={task.id} task={task} />)}
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {activeTab === "completed" && (
            completedLoading ? (
              <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
            ) : completedTasks?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">No completed tasks yet.</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {completedTasks.map((task) => <TaskItem key={task.id} task={task} />)}
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </main>
      <EmailComposer
        open={emailComposerData.open}
        onOpenChange={(open) => setEmailComposerData(prev => ({ ...prev, open }))}
        leadId={emailComposerData.leadId}
        defaultTo={emailComposerData.to}
        defaultSubject={emailComposerData.subject}
        defaultBody={emailComposerData.body}
      />
    </div>
  );
}
