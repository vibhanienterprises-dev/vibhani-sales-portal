import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, X, Eye, Send, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type LineItem, type Quotation, type QuotationLead,
  GST_RATES, STATUS_COLORS, fmtINR, computeLineItem, computeTotals, emptyItem,
} from "@/lib/quotation-helpers";

// Re-export types so consumers can import from one place
export type { LineItem, Quotation, QuotationLead };
export { STATUS_COLORS, fmtINR };

// ─── Line Item Row ─────────────────────────────────────────────────────────────
function LineItemRow({
  item, gstType, onChange, onRemove,
}: { item: LineItem; gstType: "intra" | "inter"; onChange: (u: LineItem) => void; onRemove: () => void }) {
  const update = (patch: Partial<LineItem>) => onChange(computeLineItem({ ...item, ...patch }, gstType));
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-2">
        <Input value={item.description} onChange={(e) => update({ description: e.target.value })} placeholder="Item description" className="h-8 text-sm" />
      </td>
      <td className="py-2 pr-2 w-28">
        <Input value={item.hsnCode} onChange={(e) => update({ hsnCode: e.target.value })} placeholder="HSN" className="h-8 text-sm" />
      </td>
      <td className="py-2 pr-2 w-20">
        <Input type="number" min={0} value={item.quantity} onChange={(e) => update({ quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-sm text-right" />
      </td>
      <td className="py-2 pr-2 w-28">
        <Input type="number" min={0} value={item.unitPrice} onChange={(e) => update({ unitPrice: parseFloat(e.target.value) || 0 })} className="h-8 text-sm text-right" />
      </td>
      <td className="py-2 pr-2 w-24">
        <Select value={String(item.gstRate)} onValueChange={(v) => update({ gstRate: parseFloat(v) })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="py-2 pr-2 w-28 text-right text-sm font-mono">{fmtINR(item.amount)}</td>
      <td className="py-2 text-right text-sm font-mono text-primary">{fmtINR(gstType === "intra" ? item.cgst + item.sgst : item.igst)}</td>
      <td className="py-2 pl-2 w-8">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}><X className="w-3.5 h-3.5" /></Button>
      </td>
    </tr>
  );
}

// ─── Quotation Form Dialog ─────────────────────────────────────────────────────
export function QuotationFormDialog({
  open, onClose, existing, leads, homeStateCode, defaultLeadId,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Quotation;
  leads: QuotationLead[];
  homeStateCode?: string;
  defaultLeadId?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [gstType, setGstType] = useState<"intra" | "inter">("intra");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 days net");
  const [validUntil, setValidUntil] = useState("");

  const selectedLead = leads.find((l) => String(l.id) === leadId);

  useEffect(() => {
    if (selectedLead?.stateCode && homeStateCode) {
      setGstType(selectedLead.stateCode === homeStateCode ? "intra" : "inter");
    }
  }, [selectedLead, homeStateCode]);

  useEffect(() => {
    setItems((prev) => prev.map((item) => computeLineItem(item, gstType)));
  }, [gstType]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setLeadId(existing.leadId ? String(existing.leadId) : "");
      setGstType(existing.gstType);
      setItems(existing.lineItems.length ? existing.lineItems : [emptyItem()]);
      setNotes(existing.notes || "");
      setPaymentTerms(existing.paymentTerms || "30 days net");
      setValidUntil(existing.validUntil || "");
    } else {
      setTitle("");
      setLeadId(defaultLeadId ? String(defaultLeadId) : "");
      setGstType("intra");
      setItems([emptyItem()]);
      setNotes("");
      setPaymentTerms("30 days net");
      setValidUntil("");
    }
  }, [existing, open, defaultLeadId]);

  const { subtotal, totalGst, totalAmount } = computeTotals(items);

  const updateItem = useCallback((idx: number, updated: LineItem) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  }, []);
  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        leadId: leadId && leadId !== "none" ? parseInt(leadId) : undefined,
        lineItems: items,
        notes: notes || undefined,
        paymentTerms: paymentTerms || undefined,
        validUntil: validUntil || undefined,
        subtotal,
        totalGst,
        totalAmount,
        gstType,
      };
      const url = existing ? `/api/quotations/${existing.id}` : "/api/quotations";
      const method = existing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast({ title: existing ? "Quotation updated" : "Quotation created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save quotation", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {existing ? `Edit ${existing.quoteNumber}` : "New Quotation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Quotation Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Website Development Proposal" />
            </div>
            <div className="space-y-1.5">
              <Label>GST Type</Label>
              <Select value={gstType} onValueChange={(v) => setGstType(v as "intra" | "inter")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intra">Intra-State (CGST + SGST)</SelectItem>
                  <SelectItem value="inter">Inter-State (IGST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Lead / Client</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger><SelectValue placeholder="Select lead (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead linked</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.companyName}{l.stateCode ? ` (${l.stateCode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLead && (
                <p className="text-xs text-muted-foreground">
                  {selectedLead.gstin ? `GSTIN: ${selectedLead.gstin}` : "No GSTIN"}{" • "}
                  GST: <strong className="text-foreground">{gstType === "intra" ? "CGST+SGST" : "IGST"}</strong>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 30 days net" />
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Line Items</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyItem()])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Description</th>
                    <th className="text-left py-2 px-2 font-medium w-28">HSN Code</th>
                    <th className="text-right py-2 px-2 font-medium w-20">Qty</th>
                    <th className="text-right py-2 px-2 font-medium w-28">Unit Price (₹)</th>
                    <th className="text-left py-2 px-2 font-medium w-24">GST %</th>
                    <th className="text-right py-2 px-2 font-medium w-28">Amount</th>
                    <th className="text-right py-2 pr-2 font-medium w-24">{gstType === "intra" ? "CGST+SGST" : "IGST"}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 px-2">
                  {items.map((item, idx) => (
                    <LineItemRow key={item.id} item={item} gstType={gstType} onChange={(u) => updateItem(idx, u)} onRemove={() => removeItem(idx)} />
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No items yet — click "Add Item" to start</div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <div className="w-72 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{fmtINR(subtotal)}</span></div>
                {gstType === "intra" ? (
                  <>
                    <div className="flex justify-between text-muted-foreground"><span>CGST</span><span className="font-mono">{fmtINR(totalGst / 2)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>SGST</span><span className="font-mono">{fmtINR(totalGst / 2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted-foreground"><span>IGST</span><span className="font-mono">{fmtINR(totalGst)}</span></div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span><span className="font-mono text-primary">{fmtINR(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Notes / Terms</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes, terms and conditions, bank details..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !title.trim() || items.length === 0}>
            {save.isPending ? "Saving…" : existing ? "Update Quotation" : "Create Quotation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview Dialog ────────────────────────────────────────────────────────────
export function QuotationPreviewDialog({
  q, onClose, onSend, settings,
}: { q: Quotation; onClose: () => void; onSend: () => void; settings: any }) {
  const { subtotal, totalGst, totalAmount } = computeTotals(q.lineItems);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" /> {q.quoteNumber} Preview
          </DialogTitle>
        </DialogHeader>

        <div className="bg-card border border-border rounded-lg p-6 space-y-5 text-sm font-sans">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{settings?.companyName || "Your Company"}</h2>
              {settings?.companyGstin && <p className="text-muted-foreground text-xs mt-0.5">GSTIN: {settings.companyGstin}</p>}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary">{q.quoteNumber}</p>
              {q.validUntil && <p className="text-xs text-muted-foreground">Valid until: {new Date(q.validUntil).toLocaleDateString("en-IN")}</p>}
              <Badge className={`mt-1 text-xs ${STATUS_COLORS[q.status]}`}>{q.status.toUpperCase()}</Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">From</p>
              <p className="font-medium">{settings?.companyName || "Your Company"}</p>
              {settings?.homeStateName && <p className="text-muted-foreground">{settings.homeStateName}</p>}
            </div>
            {q.leadName && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Bill To</p>
                <p className="font-medium">{q.leadName}</p>
                {q.leadGstin && <p className="text-muted-foreground">GSTIN: {q.leadGstin}</p>}
              </div>
            )}
          </div>

          <p className="text-lg font-semibold">{q.title}</p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left pb-2">#</th>
                <th className="text-left pb-2">Description</th>
                <th className="text-left pb-2">HSN</th>
                <th className="text-right pb-2">Qty</th>
                <th className="text-right pb-2">Rate</th>
                <th className="text-right pb-2">GST%</th>
                <th className="text-right pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.lineItems.map((item, i) => (
                <tr key={item.id} className="border-b border-border/30">
                  <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-2">{item.description}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{item.hsnCode || "—"}</td>
                  <td className="py-1.5 pr-2 text-right">{item.quantity}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{fmtINR(item.unitPrice)}</td>
                  <td className="py-1.5 pr-2 text-right">{item.gstRate}%</td>
                  <td className="py-1.5 text-right font-mono">{fmtINR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{fmtINR(subtotal)}</span></div>
              {q.gstType === "intra" ? (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>CGST</span><span className="font-mono">{fmtINR(totalGst / 2)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>SGST</span><span className="font-mono">{fmtINR(totalGst / 2)}</span></div>
                </>
              ) : (
                <div className="flex justify-between text-muted-foreground"><span>IGST</span><span className="font-mono">{fmtINR(totalGst)}</span></div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="font-mono text-primary">{fmtINR(totalAmount)}</span></div>
            </div>
          </div>

          {q.paymentTerms && <p className="text-xs text-muted-foreground"><strong>Payment Terms:</strong> {q.paymentTerms}</p>}
          {q.notes && <div className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-border pt-3">{q.notes}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              const base = import.meta.env.BASE_URL.replace(/\/$/, "");
              window.open(`${base}/quotations/${q.id}/print`, "_blank");
            }}
          >
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          {q.status === "draft" && (
            <Button onClick={onSend} className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Mark as Sent
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
