import { Sidebar } from "@/components/layout/Sidebar";
import { useParams } from "wouter";
import { 
  useGetLead, 
  useListContacts, 
  useListTasks, 
  useUpdateLead,
  useUpdateLeadStage,
  useSendWhatsapp,
  useSendEmail,
  useListWhatsappTemplates,
  useListEmailTemplates,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useCreateTask,
  useListTeamMembers,
  useAssignLead,
  useGetLeadActivity,
  customFetch,
} from "@workspace/api-client-react";
import { getGetLeadQueryKey, getListContactsQueryKey, getListTasksQueryKey, getGetLeadActivityQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { validateGstinFormat, LEAD_STAGES, LEAD_SOURCES, TASK_TYPES, INDIAN_STATES, COMMUNICATION_TEMPLATES } from "@/lib/constants";
import { Building2, Mail, MessageCircle, Phone, Calendar, CheckSquare, Plus, User, Clock, ArrowRightLeft, FileText, CheckCircle2, UserCheck, Flame, StickyNote, RefreshCw, Filter, UserPlus, Send, Eye, Trash2, Edit2, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { handleWhatsappClick } from "@/lib/communication";
import { EmailComposer } from "@/components/communication/EmailComposer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  QuotationFormDialog, QuotationPreviewDialog,
  type Quotation, type QuotationLead, STATUS_COLORS, fmtINR,
} from "@/components/QuotationDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { UpdateLeadStageBodyStage, CreateTaskBodyType } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { scoreLead, getScoreColor } from "@/lib/scoring";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const leadSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  stateCode: z.string().optional(),
  industry: z.string().optional(),
  source: z.string().optional(),
  dealValue: z.coerce.number().optional(),
  notes: z.string().optional(),
});

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.nativeEnum(CreateTaskBodyType),
  dueDate: z.string().min(1, "Due date is required"),
});

const whatsappSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  templateId: z.coerce.number().optional(),
  customMessage: z.string().optional(),
});


export default function LeadDetail() {
  const { id } = useParams();
  const leadId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";

  const { data: lead, isLoading: isLoadingLead } = useGetLead(leadId, {
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId) }
  });

  const { data: contacts, isLoading: isLoadingContacts } = useListContacts({ leadId }, {
    query: { enabled: !!leadId, queryKey: getListContactsQueryKey({ leadId }) }
  });

  const { data: tasks, isLoading: isLoadingTasks } = useListTasks({ leadId }, {
    query: { enabled: !!leadId, queryKey: getListTasksQueryKey({ leadId }) }
  });

  const { data: waTemplates } = useListWhatsappTemplates();
  const { data: emailTemplates } = useListEmailTemplates();
  const { data: teamMembers } = useListTeamMembers();
  const { data: activity, isLoading: isLoadingActivity } = useGetLeadActivity(leadId, {
    query: { enabled: !!leadId, queryKey: getGetLeadActivityQueryKey(leadId) }
  });

  const updateLeadStage = useUpdateLeadStage();
  const updateLead = useUpdateLead();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const createTask = useCreateTask();
  const sendWhatsapp = useSendWhatsapp();
  const sendEmail = useSendEmail();
  const assignLead = useAssignLead();

  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<{ id: number; name: string; designation?: string; email?: string; phone?: string; whatsapp?: string } | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | undefined>();
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | undefined>();
  const [emailComposerData, setEmailComposerData] = useState<{ open: boolean; to: string; subject: string; body: string }>({
    open: false,
    to: "",
    subject: "",
    body: "",
  });

  const { data: leadQuotations = [], isLoading: isLoadingQuotations } = useQuery<Quotation[]>({
    queryKey: ["quotations", "lead", leadId],
    queryFn: () => customFetch<Quotation[]>(`/api/quotations?leadId=${leadId}`),
    enabled: !!leadId,
  });

  const sendQuotation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/quotations/${id}/send`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations", "lead", leadId] });
      setPreviewQuotation(undefined);
      toast({ title: "Quotation marked as sent" });
    },
  });

  const deleteQuotation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/quotations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations", "lead", leadId] });
      toast({ title: "Quotation deleted" });
    },
  });

  const contactForm = useForm<z.infer<typeof contactSchema>>({ resolver: zodResolver(contactSchema), defaultValues: { name: "", designation: "", email: "", phone: "", whatsapp: "", isPrimary: false } });
  const taskForm = useForm<z.infer<typeof taskSchema>>({ resolver: zodResolver(taskSchema), defaultValues: { title: "", description: "", type: "call", dueDate: new Date().toISOString().split('T')[0] } });
  const waForm = useForm<z.infer<typeof whatsappSchema>>({ resolver: zodResolver(whatsappSchema), defaultValues: { phone: "", templateId: 0, customMessage: "" } });

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await customFetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: noteText.trim() }),
      });
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
      toast({ title: "Note added to timeline" });
    } catch {
      toast({ title: "Failed to save note", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const editLeadForm = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: { companyName: "", contactName: "", email: "", phone: "", gstin: "", stateCode: "", industry: "", source: "", dealValue: 0, notes: "" },
  });

  const editContactForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", designation: "", email: "", phone: "", whatsapp: "" },
  });

  const openEditLead = () => {
    if (!lead) return;
    editLeadForm.reset({
      companyName: lead.companyName ?? "",
      contactName: lead.contactName ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      gstin: lead.gstin ?? "",
      stateCode: lead.stateCode ?? "",
      industry: lead.industry ?? "",
      source: lead.source ?? "",
      dealValue: lead.dealValue ?? 0,
      notes: lead.notes ?? "",
    });
    setEditLeadOpen(true);
  };

  const onEditLeadSubmit = (values: z.infer<typeof leadSchema>) => {
    const stateName = INDIAN_STATES.find(s => s.code === values.stateCode)?.name;
    updateLead.mutate({ id: leadId, data: { ...values, state: stateName } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetLeadQueryKey(leadId), data);
        setEditLeadOpen(false);
        toast({ title: "Lead updated successfully" });
      },
      onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
    });
  };

  const onContactSubmit = (values: z.infer<typeof contactSchema>) => {
    createContact.mutate({ data: { ...values, leadId } }, {
      onSuccess: () => {
        setContactOpen(false);
        contactForm.reset();
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey({ leadId }) });
        queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
        toast({ title: "Contact added" });
      }
    });
  };

  const openEditContact = (contact: NonNullable<typeof contacts>[number]) => {
    setEditingContact(contact as any);
    editContactForm.reset({
      name: contact.name ?? "",
      designation: contact.designation ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      whatsapp: contact.whatsapp ?? "",
    });
  };

  const onEditContactSubmit = (values: z.infer<typeof contactSchema>) => {
    if (!editingContact) return;
    updateContact.mutate({ id: editingContact.id, data: { ...values } }, {
      onSuccess: () => {
        setEditingContact(null);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey({ leadId }) });
        toast({ title: "Contact updated" });
      },
      onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
    });
  };

  const onDeleteContact = (contactId: number) => {
    deleteContact.mutate({ id: contactId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey({ leadId }) });
        toast({ title: "Contact removed" });
      },
      onError: () => toast({ title: "Failed to remove contact", variant: "destructive" }),
    });
  };

  const onTaskSubmit = (values: z.infer<typeof taskSchema>) => {
    createTask.mutate({ data: { ...values, leadId } }, {
      onSuccess: () => {
        setTaskOpen(false);
        taskForm.reset();
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ leadId }) });
        toast({ title: "Task created" });
      }
    });
  };

  const onWaSubmit = (values: z.infer<typeof whatsappSchema>) => {
    const payload = {
      leadId,
      phone: values.phone,
      ...(values.templateId ? { templateId: values.templateId } : {}),
      ...(values.customMessage ? { customMessage: values.customMessage } : {})
    };
    sendWhatsapp.mutate({ data: payload }, {
      onSuccess: () => {
        setWaOpen(false);
        waForm.reset();
        toast({ title: "WhatsApp message sent" });
      }
    });
  };

  const handleStageChange = (stage: UpdateLeadStageBodyStage) => {
    updateLeadStage.mutate({ id: leadId, data: { stage } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetLeadQueryKey(leadId), data);
        toast({ title: "Stage updated" });
      }
    });
  };

  const handleAssign = (assignedTo: string) => {
    const value = assignedTo === "__unassigned__" ? null : assignedTo;
    assignLead.mutate({ id: leadId, data: { assignedTo: value } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetLeadQueryKey(leadId), data);
        toast({ title: value ? "Lead assigned" : "Lead unassigned" });
      }
    });
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const assignee = teamMembers?.find(m => m.id === lead?.assignedTo);

  if (isLoadingLead) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-8"><Skeleton className="h-12 w-64 mb-8" /><Skeleton className="h-64 w-full" /></main>
      </div>
    );
  }

  if (!lead) return <div>Lead not found</div>;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-start mb-8 border-b border-border pb-6">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              {(() => {
                const score = scoreLead(lead as any);
                const scoreColors = getScoreColor(score.label);
                return (
                  <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 flex-wrap">
                    {lead.companyName}
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase tracking-wider text-xs">
                      {LEAD_STAGES.find(s => s.value === lead.stage)?.label || lead.stage}
                    </Badge>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-semibold cursor-default ${scoreColors.badge}`}>
                            <span>{scoreColors.icon}</span>
                            <span>{score.total}/100</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs space-y-1 min-w-[180px]">
                          <p className="font-semibold mb-1 text-sm">Lead Score Breakdown</p>
                          <div className="flex justify-between"><span>Stage progress</span><span className="font-medium">+{score.stage}</span></div>
                          <div className="flex justify-between"><span>Deal value</span><span className="font-medium">+{score.dealValue}</span></div>
                          <div className="flex justify-between"><span>GSTIN verified</span><span className="font-medium">+{score.gstin}</span></div>
                          <div className="flex justify-between"><span>Contact info</span><span className="font-medium">+{score.contact}</span></div>
                          <div className="flex justify-between"><span>Profile complete</span><span className="font-medium">+{score.profile}</span></div>
                          <div className="border-t border-border mt-1 pt-1 flex justify-between font-semibold text-sm">
                            <span>Total</span><span>{score.total} / 100</span>
                          </div>
                          <div className="mt-1 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${scoreColors.bar}`} style={{ width: `${score.total}%` }} />
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h1>
                );
              })()}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {lead.state && <span>{lead.state}</span>}
                {lead.industry && <span>• {lead.industry}</span>}
                <span>• {lead.source}</span>
                {lead.dealValue && <span className="font-medium text-foreground">• ₹{lead.dealValue.toLocaleString('en-IN')}</span>}
              </div>
              {lead.gstin && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">GSTIN:</span> 
                  <span className="font-mono">{lead.gstin}</span>
                  {validateGstinFormat(lead.gstin) ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1 py-0 h-4">VALID FORMAT</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] px-1 py-0 h-4">INVALID FORMAT</Badge>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Assigned to:</span>
                {isAdmin ? (
                  <Select
                    value={lead.assignedTo ?? "__unassigned__"}
                    onValueChange={handleAssign}
                    disabled={assignLead.isPending}
                  >
                    <SelectTrigger className="h-7 text-xs border-dashed w-auto min-w-[140px] gap-1">
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="w-4 h-4">
                            <AvatarImage src={assignee.profileImageUrl ?? undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                              {getInitials(assignee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{assignee.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>Unassigned</span>
                        </div>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <User className="w-3 h-3" /> Unassigned
                        </span>
                      </SelectItem>
                      {teamMembers?.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={m.profileImageUrl ?? undefined} />
                              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                {getInitials(m.name)}
                              </AvatarFallback>
                            </Avatar>
                            {m.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={assignee.profileImageUrl ?? undefined} />
                        <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                          {getInitials(assignee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" /> Unassigned
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={openEditLead}
            >
              <Edit2 className="w-4 h-4 mr-2" /> Edit Lead
            </Button>

            <Button
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => { setEditingQuotation(undefined); setQuotationOpen(true); }}
            >
              <FileText className="w-4 h-4 mr-2" /> New Quotation
            </Button>

            <Select value={lead.stage} onValueChange={(val) => handleStageChange(val as UpdateLeadStageBodyStage)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Change Stage" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp <ChevronDown className="w-3 h-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Send WhatsApp</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COMMUNICATION_TEMPLATES.map((tmpl) => (
                  <DropdownMenuItem key={tmpl.id} onClick={() => handleWhatsappClick(lead.phone || "", tmpl.whatsapp)}>
                    {tmpl.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { waForm.setValue("phone", lead.phone || ""); setWaOpen(true); }}>
                  Custom Message...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white">
                  <Mail className="w-4 h-4 mr-2" /> Email <ChevronDown className="w-3 h-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Send Email</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COMMUNICATION_TEMPLATES.map((tmpl) => (
                  <DropdownMenuItem key={tmpl.id} onClick={() => setEmailComposerData({ open: true, to: lead.email || "", subject: tmpl.emailSubject, body: tmpl.emailBody })}>
                    {tmpl.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEmailComposerData({ open: true, to: lead.email || "", subject: "", body: "" })}>
                  Compose Custom...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Keep hidden dialogs for custom messages if needed, but the main interaction is now one-click */}
            <Dialog open={waOpen} onOpenChange={setWaOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Send WhatsApp Message</DialogTitle></DialogHeader>
                <Form {...waForm}>
                  <form onSubmit={waForm.handleSubmit(onWaSubmit)} className="space-y-4">
                    <FormField control={waForm.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Phone Number *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={waForm.control} name="templateId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template (Optional)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v ? parseInt(v) : 0)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="0">No template (Custom message)</SelectItem>
                            {waTemplates?.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={waForm.control} name="customMessage" render={({ field }) => (
                      <FormItem><FormLabel>Custom Message</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl></FormItem>
                    )} />
                    <Button type="submit" disabled={sendWhatsapp.isPending} className="w-full">Send Message</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6 lg:w-[780px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts?.length || 0})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks?.length || 0})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activity?.length || 0})</TabsTrigger>
            <TabsTrigger value="quotations">Quotes ({leadQuotations.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Contact Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.contactName || '-'}</span>
                  </div>
                </CardContent>
              </Card>

              {lead.notes && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{lead.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <div className="flex justify-end mb-4">
              <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Contact</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
                  <Form {...contactForm}>
                    <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
                      <FormField control={contactForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={contactForm.control} name="designation" render={({ field }) => (
                        <FormItem><FormLabel>Designation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={contactForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl></FormItem>
                      )} />
                      <FormField control={contactForm.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={contactForm.control} name="whatsapp" render={({ field }) => (
                        <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createContact.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts?.map(contact => (
                <Card key={contact.id} className="group relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{contact.name}</div>
                        <div className="text-sm text-muted-foreground mb-2">{contact.designation || 'No designation'}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEditContact(contact)} title="Edit contact">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 text-destructive hover:text-destructive border-destructive/30" onClick={() => onDeleteContact(contact.id)} title="Remove contact">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      {contact.email && (
                        <div className="flex items-center justify-between group/email">
                          <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-muted-foreground" /> {contact.email}</div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/email:opacity-100 transition-opacity">
                                <Send className="w-3 h-3 text-blue-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {COMMUNICATION_TEMPLATES.map((tmpl) => (
                                <DropdownMenuItem key={tmpl.id} onClick={() => setEmailComposerData({ open: true, to: contact.email || "", subject: tmpl.emailSubject, body: tmpl.emailBody })}>
                                  {tmpl.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      {(contact.phone || contact.whatsapp) && (
                        <div className="flex items-center justify-between group/wa">
                          <div className="flex items-center gap-2 text-green-500"><MessageCircle className="w-3 h-3" /> {contact.whatsapp || contact.phone}</div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/wa:opacity-100 transition-opacity">
                                <Send className="w-3 h-3 text-green-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {COMMUNICATION_TEMPLATES.map((tmpl) => (
                                <DropdownMenuItem key={tmpl.id} onClick={() => handleWhatsappClick(contact.whatsapp || contact.phone || "", tmpl.whatsapp)}>
                                  {tmpl.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {contacts?.length === 0 && <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg border-dashed">No contacts found</div>}
            </div>

            {/* Edit Contact Dialog */}
            <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
                <Form {...editContactForm}>
                  <form onSubmit={editContactForm.handleSubmit(onEditContactSubmit)} className="space-y-4">
                    <FormField control={editContactForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={editContactForm.control} name="designation" render={({ field }) => (
                      <FormItem><FormLabel>Designation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={editContactForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={editContactForm.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={editContactForm.control} name="whatsapp" render={({ field }) => (
                      <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingContact(null)}>Cancel</Button>
                      <Button type="submit" className="flex-1" disabled={updateContact.isPending}>
                        {updateContact.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <div className="flex justify-end mb-4">
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Task</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
                  <Form {...taskForm}>
                    <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                      <FormField control={taskForm.control} name="title" render={({ field }) => (
                        <FormItem><FormLabel>Title *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={taskForm.control} name="type" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={taskForm.control} name="dueDate" render={({ field }) => (
                        <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={taskForm.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createTask.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {tasks?.map(task => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-card border rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckSquare className={`w-5 h-5 mt-0.5 ${task.status === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <div>
                      <div className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 uppercase tracking-wider"><Badge variant="outline" className="text-[10px]">{task.type}</Badge></span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tasks?.length === 0 && <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed">No tasks found</div>}
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="mt-6">
             <Card>
               <CardContent className="p-6">
                 <Textarea 
                   defaultValue={lead.notes} 
                   className="min-h-[200px] border-none focus-visible:ring-0 p-0 resize-none text-base bg-transparent" 
                   placeholder="Add notes about this lead..."
                   onBlur={(e) => {
                     if (e.target.value !== lead.notes) {
                       updateLeadStage.mutate({ id: leadId, data: { ...lead, notes: e.target.value } as any });
                     }
                   }}
                 />
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <div className="space-y-4">
              {/* Add Note */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-2 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border shrink-0 bg-amber-500/10 border-amber-500/30 text-amber-500 mt-0.5">
                      <StickyNote className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 flex gap-2">
                      <Textarea
                        placeholder="Add a note to the timeline… (e.g. 'Called, will follow up Friday')"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote();
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={saveNote}
                        disabled={!noteText.trim() || savingNote}
                        className="shrink-0 self-end"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {savingNote ? "Saving…" : "Add Note"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Activity Timeline
                      {activity && <span className="text-xs font-normal text-muted-foreground ml-1">({activity.length})</span>}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1.5"
                      onClick={() => queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) })}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh
                    </Button>
                  </div>
                  {/* Filter pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { key: "all", label: "All" },
                      { key: "stage", label: "Stage Changes", types: ["stage_changed", "lead_created"] },
                      { key: "messages", label: "Messages", types: ["email_sent", "whatsapp_sent"] },
                      { key: "tasks", label: "Tasks", types: ["task_created", "task_completed"] },
                      { key: "contacts", label: "Contacts", types: ["contact_added"] },
                      { key: "notes", label: "Notes", types: ["note_added"] },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setActivityFilter(f.key)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          activityFilter === f.key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingActivity ? (
                    <div className="space-y-4">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : (() => {
                    const FILTER_TYPES: Record<string, string[]> = {
                      stage: ["stage_changed", "lead_created"],
                      messages: ["email_sent", "whatsapp_sent"],
                      tasks: ["task_created", "task_completed"],
                      contacts: ["contact_added"],
                      notes: ["note_added"],
                    };
                    const filtered = (activity ?? []).filter(item =>
                      activityFilter === "all" || (FILTER_TYPES[activityFilter] ?? []).includes(item.type)
                    );

                    const ICON_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
                      lead_created:   { icon: <Plus className="w-3.5 h-3.5" />,           color: "text-emerald-500",  bg: "bg-emerald-500/10 border-emerald-500/30",  label: "Lead Created" },
                      stage_changed:  { icon: <ArrowRightLeft className="w-3.5 h-3.5" />, color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/30",        label: "Stage Changed" },
                      lead_updated:   { icon: <FileText className="w-3.5 h-3.5" />,       color: "text-yellow-500",  bg: "bg-yellow-500/10 border-yellow-500/30",    label: "Lead Updated" },
                      lead_assigned:  { icon: <UserCheck className="w-3.5 h-3.5" />,      color: "text-orange-500",  bg: "bg-orange-500/10 border-orange-500/30",    label: "Assigned" },
                      whatsapp_sent:  { icon: <MessageCircle className="w-3.5 h-3.5" />,  color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30",      label: "WhatsApp" },
                      email_sent:     { icon: <Mail className="w-3.5 h-3.5" />,           color: "text-sky-400",     bg: "bg-sky-400/10 border-sky-400/30",          label: "Email" },
                      task_created:   { icon: <Calendar className="w-3.5 h-3.5" />,       color: "text-violet-500",  bg: "bg-violet-500/10 border-violet-500/30",    label: "Task Created" },
                      task_completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />,   color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30",  label: "Task Done" },
                      contact_added:  { icon: <UserPlus className="w-3.5 h-3.5" />,       color: "text-pink-400",    bg: "bg-pink-400/10 border-pink-400/30",        label: "Contact" },
                      note_added:     { icon: <StickyNote className="w-3.5 h-3.5" />,     color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/30",      label: "Note" },
                    };

                    function relativeTime(date: Date): string {
                      const diff = Date.now() - date.getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return "just now";
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.floor(hrs / 24);
                      if (days < 7) return `${days}d ago`;
                      return format(date, "MMM d");
                    }

                    function dayLabel(date: Date): string {
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(today.getDate() - 1);
                      if (date.toDateString() === today.toDateString()) return "Today";
                      if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
                      return format(date, "MMMM d, yyyy");
                    }

                    // Group by calendar day
                    const groups: { day: string; items: typeof filtered }[] = [];
                    for (const item of filtered) {
                      const label = dayLabel(new Date(item.createdAt));
                      const last = groups[groups.length - 1];
                      if (last && last.day === label) last.items.push(item);
                      else groups.push({ day: label, items: [item] });
                    }

                    return filtered.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                        <Filter className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No activity matches this filter</p>
                        <p className="text-xs mt-1">Try "All" to see everything</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {groups.map((group) => (
                          <div key={group.day}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{group.day}</div>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                            <div className="relative">
                              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                              <div className="space-y-0">
                                {group.items.map((item, idx) => {
                                  const isLast = idx === group.items.length - 1;
                                  const cfg = ICON_CONFIG[item.type] ?? {
                                    icon: <Clock className="w-3.5 h-3.5" />,
                                    color: "text-muted-foreground",
                                    bg: "bg-muted border-border",
                                    label: item.type,
                                  };
                                  const isNote = item.type === "note_added";
                                  return (
                                    <div key={item.id} className={`relative flex gap-4 ${isLast ? "" : "pb-5"}`}>
                                      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border shrink-0 ${cfg.bg} ${cfg.color}`}>
                                        {cfg.icon}
                                      </div>
                                      <div className="flex-1 pt-0.5 min-w-0">
                                        {isNote ? (
                                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-foreground leading-relaxed">
                                            {item.description}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-foreground leading-snug">{item.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-xs text-muted-foreground">{relativeTime(new Date(item.createdAt))}</span>
                                          <span className="text-xs text-muted-foreground/50">·</span>
                                          <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt), "h:mm a")}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="quotations" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Quotations
                </h3>
                <Button size="sm" onClick={() => { setEditingQuotation(undefined); setQuotationOpen(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Quotation
                </Button>
              </div>

              {isLoadingQuotations ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
              ) : leadQuotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                  <FileText className="w-10 h-10 mb-2 opacity-30" />
                  <p className="font-medium text-sm">No quotations yet</p>
                  <p className="text-xs mt-0.5">Create a GST quotation for this lead</p>
                  <Button size="sm" className="mt-3" onClick={() => { setEditingQuotation(undefined); setQuotationOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create Quotation
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {leadQuotations.map((q) => (
                    <div key={q.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{q.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="font-mono">{q.quoteNumber}</span>
                            <span>•</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status]}`}>{q.status}</span>
                            {q.validUntil && <><span>•</span><span>Valid till {new Date(q.validUntil).toLocaleDateString("en-IN")}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold font-mono text-primary">{fmtINR(q.totalAmount)}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview" onClick={() => setPreviewQuotation(q)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditingQuotation(q); setQuotationOpen(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {q.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400" title="Mark as Sent" onClick={() => sendQuotation.mutate(q.id)}>
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete"
                            onClick={() => { if (confirm(`Delete ${q.quoteNumber}?`)) deleteQuotation.mutate(q.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {quotationOpen && (
          <QuotationFormDialog
            open={quotationOpen}
            onClose={() => { setQuotationOpen(false); setEditingQuotation(undefined); queryClient.invalidateQueries({ queryKey: ["quotations", "lead", leadId] }); }}
            existing={editingQuotation}
            leads={lead ? [{ id: lead.id, companyName: lead.companyName, gstin: lead.gstin ?? undefined, stateCode: lead.stateCode ?? undefined, state: lead.state ?? undefined }] as QuotationLead[] : []}
            defaultLeadId={leadId}
          />
        )}

        {previewQuotation && (
          <QuotationPreviewDialog
            q={previewQuotation}
            onClose={() => setPreviewQuotation(undefined)}
            onSend={() => sendQuotation.mutate(previewQuotation.id)}
            settings={null}
          />
        )}

        {/* Edit Lead Dialog */}
        <Dialog open={editLeadOpen} onOpenChange={setEditLeadOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
            <Form {...editLeadForm}>
              <form onSubmit={editLeadForm.handleSubmit(onEditLeadSubmit)} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={editLeadForm.control} name="companyName" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Company Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="contactName" render={({ field }) => (
                    <FormItem><FormLabel>Primary Contact Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="gstin" render={({ field }) => (
                    <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} className="uppercase" /></FormControl></FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="stateCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="industry" render={({ field }) => (
                    <FormItem><FormLabel>Industry</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="source" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {LEAD_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={editLeadForm.control} name="dealValue" render={({ field }) => (
                    <FormItem><FormLabel>Deal Value (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={editLeadForm.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                )} />
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditLeadOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={updateLead.isPending}>
                    {updateLead.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </main>
      <Toaster />
      <EmailComposer
        open={emailComposerData.open}
        onOpenChange={(open) => setEmailComposerData(prev => ({ ...prev, open }))}
        leadId={leadId}
        defaultTo={emailComposerData.to}
        defaultSubject={emailComposerData.subject}
        defaultBody={emailComposerData.body}
      />
    </div>
  );
}
