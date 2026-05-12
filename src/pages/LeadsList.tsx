import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListLeads, useCreateLead, useListTeamMembers, customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { INDIAN_STATES, LEAD_STAGES, LEAD_SOURCES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Building2, Upload, Download, User, UserCheck, Users, Tag, Trash2, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CreateLeadBodyStage } from "@workspace/api-client-react";
import { ImportLeadsModal } from "@/components/ImportLeadsModal";
import { useAuth } from "@workspace/replit-auth-web";
import { scoreLead, getScoreColor } from "@/lib/scoring";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  stateCode: z.string().optional(),
  industry: z.string().optional(),
  source: z.string().min(1, "Source is required"),
  stage: z.nativeEnum(CreateLeadBodyStage).optional(),
  dealValue: z.coerce.number().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
});

export default function LeadsList() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "date" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";

  const effectiveAssignee = myLeadsOnly
    ? user?.id
    : assigneeFilter !== "all"
    ? assigneeFilter
    : undefined;

  const { data: leads, isLoading } = useListLeads({
    search: search || undefined,
    stage: stageFilter !== "all" ? (stageFilter as any) : undefined,
    assignedTo: effectiveAssignee,
  });

  const { data: teamMembers } = useListTeamMembers();
  const createLead = useCreateLead();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "", contactName: "", email: "", phone: "", gstin: "",
      stateCode: "", industry: "", source: "Website", stage: "new",
      dealValue: 0, notes: "", assignedTo: user?.id ?? "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const stateName = INDIAN_STATES.find(s => s.code === values.stateCode)?.name;
    createLead.mutate({ data: { ...values, state: stateName } }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
        toast({ title: "Lead created successfully" });
      },
      onError: () => toast({ title: "Error creating lead", variant: "destructive" }),
    });
  };

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'new': return 'bg-blue-500/20 text-blue-500';
      case 'contacted': return 'bg-yellow-500/20 text-yellow-500';
      case 'quotation_sent': return 'bg-purple-500/20 text-purple-500';
      case 'converted': return 'bg-green-500/20 text-green-500';
      case 'lost': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getMemberName = (userId: string | null | undefined) => {
    if (!userId) return null;
    return teamMembers?.find(m => m.id === userId) ?? null;
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const toggleSort = (col: "score" | "date") => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const sortedLeads = leads ? [...leads].sort((a, b) => {
    if (!sortBy) return 0;
    const aScore = scoreLead(a as any).total;
    const bScore = scoreLead(b as any).total;
    const diff = sortBy === "score"
      ? aScore - bScore
      : new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    return sortDir === "desc" ? -diff : diff;
  }) : leads;

  const SortIcon = ({ col }: { col: "score" | "date" }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "desc"
      ? <ArrowDown className="w-3 h-3 ml-1 text-primary" />
      : <ArrowUp className="w-3 h-3 ml-1 text-primary" />;
  };

  const allIds = leads?.map(l => l.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = allIds.some(id => selectedIds.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkAction = async (payload: object) => {
    setIsBulkLoading(true);
    try {
      const data = await customFetch<any>("/api/leads/bulk-action", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds), ...payload }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      clearSelection();
      return data;
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkAssign = async (assignedTo: string | number | null) => {
    const data = await bulkAction({ action: "assign", assignedTo: assignedTo ? String(assignedTo) : null });
    if (data) {
      const name = assignedTo ? (teamMembers?.find(m => m.id === assignedTo)?.name ?? "member") : "nobody";
      toast({ title: `${data.updated} leads assigned to ${name}` });
    }
  };

  const handleBulkStage = async (stage: string) => {
    const label = LEAD_STAGES.find(s => s.value === stage)?.label ?? stage;
    const data = await bulkAction({ action: "stage", stage });
    if (data) toast({ title: `${data.updated} leads moved to ${label}` });
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    const data = await bulkAction({ action: "delete" });
    if (data) toast({ title: `${count} leads deleted`, variant: "destructive" });
    setBulkDeleteOpen(false);
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 flex justify-between items-center border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage your sales pipeline and active inquiries.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`${import.meta.env.VITE_API_URL}/api/leads/export`, "_blank")}
              className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> New Lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Lead</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="companyName" render={({ field }) => (
                        <FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="contactName" render={({ field }) => (
                        <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="gstin" render={({ field }) => (
                        <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="stateCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="source" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {LEAD_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="dealValue" render={({ field }) => (
                        <FormItem><FormLabel>Expected Value (₹)</FormLabel><FormControl><Input {...field} type="number" /></FormControl><FormMessage /></FormItem>
                      )} />
                      {isAdmin && teamMembers && teamMembers.length > 0 && (
                        <FormField control={form.control} name="assignedTo" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Assign To</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {teamMembers.map(m => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <span className="flex items-center gap-2">
                                      <span>{m.name}</span>
                                      {m.role === "admin" && <Badge variant="outline" className="text-[10px] py-0 h-4">Admin</Badge>}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={createLead.isPending}>
                      {createLead.isPending ? "Creating..." : "Save Lead"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <ImportLeadsModal open={importOpen} onOpenChange={setImportOpen} />

        <div className="p-8 flex-1 overflow-y-auto flex flex-col">
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button
              variant={myLeadsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setMyLeadsOnly(v => !v); if (!myLeadsOnly) setAssigneeFilter("all"); }}
              className={myLeadsOnly ? "bg-primary text-primary-foreground" : "border-dashed text-muted-foreground hover:text-foreground"}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              My Leads
              {myLeadsOnly && leads && (
                <span className="ml-2 bg-primary-foreground/20 text-primary-foreground rounded-full px-1.5 py-0 text-xs font-semibold">{leads.length}</span>
              )}
            </Button>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {LEAD_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && !myLeadsOnly && (
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by Rep" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {teamMembers?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {(myLeadsOnly || assigneeFilter !== "all" || stageFilter !== "all" || search) && (
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-8 px-2"
                onClick={() => { setMyLeadsOnly(false); setAssigneeFilter("all"); setStageFilter("all"); setSearch(""); }}>
                Clear filters
              </Button>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 animate-in slide-in-from-top-1">
              <span className="text-sm font-medium text-primary">{selectedCount} lead{selectedCount !== 1 ? "s" : ""} selected</span>
              <div className="flex-1" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 border-primary/30 text-primary hover:bg-primary/10" disabled={isBulkLoading}>
                    <Tag className="w-3.5 h-3.5 mr-1.5" /> Change Stage <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {LEAD_STAGES.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => handleBulkStage(s.value)}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${getStageColor(s.value).replace('text-', 'bg-').split(' ')[0]}`} />
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {isAdmin && teamMembers && teamMembers.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 border-primary/30 text-primary hover:bg-primary/10" disabled={isBulkLoading}>
                      <Users className="w-3.5 h-3.5 mr-1.5" /> Assign To <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {teamMembers.map(m => (
                      <DropdownMenuItem key={m.id} onClick={() => handleBulkAssign(m.id)}>
                        <Avatar className="w-5 h-5 mr-2">
                          <AvatarImage src={m.profileImageUrl ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{getInitials(m.name)}</AvatarFallback>
                        </Avatar>
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkAssign(null)} className="text-muted-foreground">
                      <User className="w-4 h-4 mr-2" /> Unassign
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {isAdmin && (
                <Button size="sm" variant="outline" disabled={isBulkLoading}
                  className="h-7 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                </Button>
              )}

              <Button size="sm" variant="ghost" className="h-7 text-muted-foreground hover:text-foreground" onClick={clearSelection}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <div className="border border-border rounded-lg bg-card flex-1 overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                        className="data-[state=indeterminate]:bg-primary/50"
                        data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                      />
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort("score")}
                        className="flex items-center text-xs font-medium uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        Score <SortIcon col="score" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({length: 5}).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-14" /></TableCell>
                      </TableRow>
                    ))
                  ) : leads?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No leads found. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLeads?.map(lead => {
                      const assignee = getMemberName(lead.assignedTo);
                      const isSelected = selectedIds.has(lead.id);
                      const score = scoreLead(lead as any);
                      const scoreColors = getScoreColor(score.label);
                      return (
                        <TableRow
                          key={lead.id}
                          className={`hover:bg-muted/50 cursor-pointer transition-colors group ${isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-checkbox]') || target.closest('a')) return;
                            if (selectedCount > 0) toggleOne(lead.id);
                          }}
                        >
                          <TableCell data-checkbox onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(lead.id)}
                              aria-label={`Select ${lead.companyName}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 w-full">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"}`}>
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{lead.companyName}</div>
                                {lead.gstin && <div className="text-xs text-muted-foreground font-mono mt-0.5">{lead.gstin}</div>}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{lead.contactName || '-'}</div>
                            <div className="text-xs text-muted-foreground">{lead.phone || lead.email || ''}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.state || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`border-0 ${getStageColor(lead.stage)}`}>
                              {LEAD_STAGES.find(s => s.value === lead.stage)?.label || lead.stage}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignee ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={assignee.profileImageUrl ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{getInitials(assignee.name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" /> Unassigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {lead.dealValue ? `₹${lead.dealValue.toLocaleString('en-IN')}` : '-'}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold cursor-default ${scoreColors.badge}`}>
                                    <span>{scoreColors.icon}</span>
                                    <span>{score.total}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs space-y-1 min-w-[160px]">
                                  <p className="font-semibold mb-1">Score Breakdown</p>
                                  <div className="flex justify-between"><span>Stage</span><span>+{score.stage}</span></div>
                                  <div className="flex justify-between"><span>Deal Value</span><span>+{score.dealValue}</span></div>
                                  <div className="flex justify-between"><span>GSTIN</span><span>+{score.gstin}</span></div>
                                  <div className="flex justify-between"><span>Contact Info</span><span>+{score.contact}</span></div>
                                  <div className="flex justify-between"><span>Profile</span><span>+{score.profile}</span></div>
                                  <div className="border-t border-border mt-1 pt-1 flex justify-between font-semibold">
                                    <span>Total</span><span>{score.total}/100</span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} lead{selectedCount !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} selected lead{selectedCount !== 1 ? "s" : ""} and all their activity history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
              Delete {selectedCount} lead{selectedCount !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
