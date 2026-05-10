// ─── Shared Quotation Types ───────────────────────────────────────────────────
export interface LineItem {
  id: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Quotation {
  id: number;
  quoteNumber: string;
  leadId?: number;
  leadName?: string;
  leadGstin?: string;
  leadStateCode?: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "cancelled";
  lineItems: LineItem[];
  notes?: string;
  paymentTerms?: string;
  validUntil?: string;
  subtotal: number;
  totalGst: number;
  totalAmount: number;
  gstType: "intra" | "inter";
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLead {
  id: number;
  companyName: string;
  gstin?: string;
  stateCode?: string;
  state?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const GST_RATES = [0, 5, 12, 18, 28];

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/20 text-blue-400",
  accepted: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  cancelled: "bg-orange-500/20 text-orange-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function fmtINR(v: number) {
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function computeLineItem(item: Partial<LineItem>, gstType: "intra" | "inter"): LineItem {
  const qty = item.quantity ?? 0;
  const price = item.unitPrice ?? 0;
  const rate = item.gstRate ?? 18;
  const amount = qty * price;
  const gstAmt = (amount * rate) / 100;
  const half = gstAmt / 2;
  return {
    id: item.id || crypto.randomUUID(),
    description: item.description || "",
    hsnCode: item.hsnCode || "",
    quantity: qty,
    unitPrice: price,
    gstRate: rate,
    amount,
    cgst: gstType === "intra" ? half : 0,
    sgst: gstType === "intra" ? half : 0,
    igst: gstType === "inter" ? gstAmt : 0,
  };
}

export function computeTotals(items: LineItem[]) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const totalGst = items.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
  return { subtotal, totalGst, totalAmount: subtotal + totalGst };
}

export const emptyItem = (): LineItem =>
  computeLineItem({ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, gstRate: 18 }, "intra");
