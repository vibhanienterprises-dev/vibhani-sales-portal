import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, customFetch } from "@workspace/api-client-react";
import { FileText, Plus, Search, Trash2, Edit2, Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  QuotationFormDialog, QuotationPreviewDialog,
  type Quotation, type QuotationLead, STATUS_COLORS, fmtINR,
} from "@/components/QuotationDialog";

export default function Quotations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingQ, setEditingQ] = useState<Quotation | undefined>();
  const [previewQ, setPreviewQ] = useState<Quotation | undefined>();

  const { data: settings } = useGetSettings();

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["quotations", statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return customFetch<Quotation[]>(`/api/quotations${params}`);
    },
  });

  const { data: leads = [] } = useQuery<QuotationLead[]>({
    queryKey: ["leads-for-quotation"],
    queryFn: () => customFetch<QuotationLead[]>("/api/leads?limit=200"),
  });

  const filtered = quotations.filter((q) =>
    !search ||
    q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    (q.leadName || "").toLowerCase().includes(search.toLowerCase())
  );

  const deleteQ = useMutation({
    mutationFn: (id: number) => customFetch(`/api/quotations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast({ title: "Quotation deleted" });
    },
  });

  const sendQ = useMutation({
    mutationFn: (id: number) => customFetch(`/api/quotations/${id}/send`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setPreviewQ(undefined);
      toast({ title: "Quotation marked as sent — lead stage updated to Quotation Sent" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      customFetch(`/api/quotations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast({ title: "Status updated" });
    },
  });

  const stats = {
    total: quotations.length,
    draft: quotations.filter((q) => q.status === "draft").length,
    sent: quotations.filter((q) => q.status === "sent").length,
    accepted: quotations.filter((q) => q.status === "accepted").length,
    totalValue: quotations.filter((q) => q.status === "accepted").reduce((s, q) => s + q.totalAmount, 0),
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 pb-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Quotations
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">GST-compliant quotations for your leads</p>
          </div>
          <Button onClick={() => { setEditingQ(undefined); setShowForm(true); }} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Quotation
          </Button>
        </div>

        {/* Stats */}
        <div className="px-6 pt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Draft", value: stats.draft, color: "text-muted-foreground" },
            { label: "Sent", value: stats.sent, color: "text-blue-400" },
            { label: "Accepted", value: stats.accepted, color: "text-green-400" },
            { label: "Won Value", value: fmtINR(stats.totalValue), color: "text-primary" },
          ].map((s) => (
            <Card key={s.label} className="py-3">
              <CardContent className="p-0 px-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-72">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search quotations…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3 mt-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No quotations yet</p>
              <p className="text-sm">Create your first GST-compliant quotation</p>
              <Button className="mt-4" onClick={() => { setEditingQ(undefined); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-2" /> New Quotation
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Quote #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q) => (
                    <TableRow key={q.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs text-muted-foreground">{q.quoteNumber}</TableCell>
                      <TableCell className="font-medium max-w-48 truncate">{q.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-36 truncate">
                        {q.leadName
                          ? <button className="hover:text-primary hover:underline" onClick={() => q.leadId && navigate(`/leads/${q.leadId}`)}>{q.leadName}</button>
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{q.gstType === "intra" ? "CGST+SGST" : "IGST"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={q.status} onValueChange={(v) => updateStatus.mutate({ id: q.id, status: v })}>
                          <SelectTrigger className={`h-7 text-xs w-28 border-0 ${STATUS_COLORS[q.status]}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["draft", "sent", "accepted", "rejected", "cancelled"].map((s) => (
                              <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">{fmtINR(q.totalAmount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-IN") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview" onClick={() => setPreviewQ(q)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditingQ(q); setShowForm(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {q.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400" title="Mark as Sent" onClick={() => sendQ.mutate(q.id)}>
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete"
                            onClick={() => { if (confirm(`Delete ${q.quoteNumber}?`)) deleteQ.mutate(q.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <QuotationFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditingQ(undefined); }}
          existing={editingQ}
          leads={leads}
          homeStateCode={settings?.homeStateCode ?? undefined}
        />
      )}

      {previewQ && (
        <QuotationPreviewDialog
          q={previewQ}
          onClose={() => setPreviewQ(undefined)}
          onSend={() => sendQ.mutate(previewQ.id)}
          settings={settings}
        />
      )}
    </div>
  );
}
