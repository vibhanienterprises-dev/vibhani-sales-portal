import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { type Quotation, fmtINR, computeTotals } from "@/lib/quotation-helpers";

interface Settings {
  companyName?: string;
  companyGstin?: string;
  homeStateName?: string;
  homeStateCode?: string;
}

function numberToWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (n === 0) return "Zero";

  function below1000(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + below1000(num % 100) : "");
  }

  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);

  let result = "";
  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const rest = intPart % 1000;

  if (crore) result += below1000(crore) + " Crore ";
  if (lakh) result += below1000(lakh) + " Lakh ";
  if (thousand) result += below1000(thousand) + " Thousand ";
  if (rest) result += below1000(rest);

  result = result.trim() + " Rupees";
  if (decPart) result += " and " + below1000(decPart) + " Paise";
  return result + " Only";
}

export default function QuotationPrint() {
  const { id } = useParams<{ id: string }>();

  const { data: quotation, isLoading: loadingQ } = useQuery<Quotation>({
    queryKey: ["quotation-print", id],
    queryFn: () => customFetch<Quotation>(`/api/quotations/${id}`),
    enabled: !!id,
  });

  const { data: settings, isLoading: loadingS } = useQuery<Settings>({
    queryKey: ["settings-print"],
    queryFn: () => customFetch<Settings>("/api/settings"),
  });

  const isLoading = loadingQ || loadingS;

  useEffect(() => {
    if (!isLoading && quotation && settings) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading, quotation, settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen font-sans text-gray-500">
        <div>Preparing quotation…</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex items-center justify-center h-screen font-sans text-red-500">
        Quotation not found.
      </div>
    );
  }

  const { subtotal, totalGst, totalAmount } = computeTotals(quotation.lineItems);
  const isIntra = quotation.gstType === "intra";
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: white; color: #111; }
        @media print {
          @page { size: A4; margin: 12mm 14mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .page { max-width: 800px; margin: 0 auto; padding: 32px; background: white; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
        .company-name { font-size: 22px; font-weight: 700; color: #111; }
        .company-meta { font-size: 12px; color: #6b7280; margin-top: 4px; line-height: 1.5; }
        .quote-meta { text-align: right; }
        .quote-number { font-size: 20px; font-weight: 700; color: #d97706; }
        .quote-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }
        .quote-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .valid-until { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
        .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
        .party-name { font-size: 14px; font-weight: 600; color: #111; }
        .party-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .title-bar { font-size: 16px; font-weight: 600; color: #111; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead tr { background: #1f2937; color: white; }
        thead th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; letter-spacing: 0.3px; }
        thead th.right { text-align: right; }
        tbody tr { border-bottom: 1px solid #f3f4f6; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        tbody td { padding: 7px 10px; color: #374151; }
        tbody td.right { text-align: right; font-family: 'Courier New', monospace; }
        tbody td.center { text-align: center; }
        .totals-section { display: flex; justify-content: flex-end; margin-top: 16px; }
        .totals-box { width: 260px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6; }
        .totals-row.total { font-size: 16px; font-weight: 700; color: #111; border-top: 2px solid #1f2937; border-bottom: none; margin-top: 4px; padding-top: 8px; }
        .totals-row.total .amt { color: #d97706; }
        .amount-words { margin-top: 12px; font-size: 11px; color: #6b7280; font-style: italic; padding: 8px 12px; background: #fffbeb; border-left: 3px solid #d97706; border-radius: 0 4px 4px 0; }
        .footer-section { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .notes-box { font-size: 11px; color: #6b7280; white-space: pre-wrap; line-height: 1.6; }
        .notes-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
        .signature-box { text-align: right; }
        .signature-line { border-top: 1px solid #d1d5db; margin-top: 48px; padding-top: 6px; font-size: 11px; color: #9ca3af; }
        .gst-badge { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #dbeafe; color: #1d4ed8; font-weight: 600; margin-top: 2px; }
        .print-btn { position: fixed; bottom: 24px; right: 24px; display: flex; gap: 10px; }
        .btn { padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
        .btn-primary { background: #d97706; color: white; }
        .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
        .btn:hover { opacity: 0.9; }
        .gst-summary { margin-top: 16px; font-size: 11px; }
        .gst-summary table { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
        .gst-summary thead tr { background: #f3f4f6; }
        .gst-summary thead th { color: #374151; padding: 6px 10px; }
        .gst-summary tbody td { padding: 6px 10px; color: #6b7280; }
        .gst-summary .total-row td { font-weight: 600; color: #111; background: #f9fafb; }
      `}</style>

      <div className="page">
        {/* Header */}
        <div className="header">
          <div>
            <div className="company-name">{settings?.companyName || "Your Company"}</div>
            {settings?.companyGstin && <div className="company-meta">GSTIN: {settings.companyGstin}</div>}
            {settings?.homeStateName && <div className="company-meta">{settings.homeStateName}</div>}
          </div>
          <div className="quote-meta">
            <div className="quote-label">Tax Invoice / Quotation</div>
            <div className="quote-number">{quotation.quoteNumber}</div>
            <div className="quote-date">Date: {today}</div>
            {quotation.validUntil && (
              <div className="valid-until">Valid until: {new Date(quotation.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
            )}
            <div style={{ marginTop: 6 }}>
              <span className="gst-badge">{isIntra ? "CGST + SGST (Intra-State)" : "IGST (Inter-State)"}</span>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="parties">
          <div>
            <div className="party-label">From (Seller)</div>
            <div className="party-name">{settings?.companyName || "Your Company"}</div>
            {settings?.companyGstin && <div className="party-meta">GSTIN: {settings.companyGstin}</div>}
            {settings?.homeStateName && <div className="party-meta">{settings.homeStateName}</div>}
          </div>
          <div>
            <div className="party-label">To (Buyer)</div>
            {quotation.leadName ? (
              <>
                <div className="party-name">{quotation.leadName}</div>
                {quotation.leadGstin && <div className="party-meta">GSTIN: {quotation.leadGstin}</div>}
                {quotation.leadStateCode && <div className="party-meta">State Code: {quotation.leadStateCode}</div>}
              </>
            ) : (
              <div className="party-meta" style={{ fontStyle: "italic" }}>No client linked</div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="title-bar">{quotation.title}</div>

        {/* Line Items */}
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Description</th>
              <th style={{ width: 70 }}>HSN</th>
              <th className="right" style={{ width: 44 }}>Qty</th>
              <th className="right" style={{ width: 90 }}>Rate (₹)</th>
              <th className="right" style={{ width: 80 }}>Amount (₹)</th>
              {isIntra ? (
                <>
                  <th className="right" style={{ width: 70 }}>CGST</th>
                  <th className="right" style={{ width: 70 }}>SGST</th>
                </>
              ) : (
                <th className="right" style={{ width: 80 }}>IGST</th>
              )}
              <th className="right" style={{ width: 90 }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lineItems.map((item, i) => {
              const itemTotal = item.amount + item.cgst + item.sgst + item.igst;
              return (
                <tr key={item.id}>
                  <td className="center" style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.description || "—"}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{item.gstRate}% GST</div>
                  </td>
                  <td style={{ color: "#9ca3af", fontFamily: "monospace" }}>{item.hsnCode || "—"}</td>
                  <td className="right">{item.quantity}</td>
                  <td className="right">{fmtINR(item.unitPrice)}</td>
                  <td className="right">{fmtINR(item.amount)}</td>
                  {isIntra ? (
                    <>
                      <td className="right" style={{ color: "#059669" }}>{fmtINR(item.cgst)}</td>
                      <td className="right" style={{ color: "#059669" }}>{fmtINR(item.sgst)}</td>
                    </>
                  ) : (
                    <td className="right" style={{ color: "#2563eb" }}>{fmtINR(item.igst)}</td>
                  )}
                  <td className="right" style={{ fontWeight: 600 }}>{fmtINR(itemTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* GST Summary */}
        <div className="gst-summary" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>GST Rate</th>
                <th className="right">Taxable Amount</th>
                {isIntra ? (
                  <>
                    <th className="right">CGST</th>
                    <th className="right">SGST</th>
                  </>
                ) : (
                  <th className="right">IGST</th>
                )}
                <th className="right">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(quotation.lineItems.map(i => i.gstRate))).sort().map(rate => {
                const rateItems = quotation.lineItems.filter(i => i.gstRate === rate);
                const taxable = rateItems.reduce((s, i) => s + i.amount, 0);
                const cgst = rateItems.reduce((s, i) => s + i.cgst, 0);
                const sgst = rateItems.reduce((s, i) => s + i.sgst, 0);
                const igst = rateItems.reduce((s, i) => s + i.igst, 0);
                return (
                  <tr key={rate}>
                    <td>{rate}%</td>
                    <td className="right">{fmtINR(taxable)}</td>
                    {isIntra ? (
                      <>
                        <td className="right">{fmtINR(cgst)}</td>
                        <td className="right">{fmtINR(sgst)}</td>
                      </>
                    ) : (
                      <td className="right">{fmtINR(igst)}</td>
                    )}
                    <td className="right">{fmtINR(cgst + sgst + igst)}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total</td>
                <td className="right">{fmtINR(subtotal)}</td>
                {isIntra ? (
                  <>
                    <td className="right">{fmtINR(totalGst / 2)}</td>
                    <td className="right">{fmtINR(totalGst / 2)}</td>
                  </>
                ) : (
                  <td className="right">{fmtINR(totalGst)}</td>
                )}
                <td className="right">{fmtINR(totalGst)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="totals-section">
          <div className="totals-box">
            <div className="totals-row"><span>Subtotal</span><span>{fmtINR(subtotal)}</span></div>
            {isIntra ? (
              <>
                <div className="totals-row"><span>CGST</span><span>{fmtINR(totalGst / 2)}</span></div>
                <div className="totals-row"><span>SGST</span><span>{fmtINR(totalGst / 2)}</span></div>
              </>
            ) : (
              <div className="totals-row"><span>IGST</span><span>{fmtINR(totalGst)}</span></div>
            )}
            <div className="totals-row total">
              <span>Grand Total</span>
              <span className="amt">{fmtINR(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="amount-words">
          Amount in Words: <strong>{numberToWords(totalAmount)}</strong>
        </div>

        {/* Footer */}
        <div className="footer-section">
          <div>
            {quotation.paymentTerms && (
              <div style={{ marginBottom: 12 }}>
                <div className="notes-label">Payment Terms</div>
                <div className="notes-box">{quotation.paymentTerms}</div>
              </div>
            )}
            {quotation.notes && (
              <div>
                <div className="notes-label">Notes & Terms</div>
                <div className="notes-box">{quotation.notes}</div>
              </div>
            )}
            {!quotation.paymentTerms && !quotation.notes && (
              <div className="notes-box" style={{ fontStyle: "italic" }}>
                This is a computer-generated quotation. No signature required.
              </div>
            )}
          </div>
          <div className="signature-box">
            <div className="signature-line">
              Authorised Signatory<br />
              {settings?.companyName || "Your Company"}
            </div>
          </div>
        </div>
      </div>

      {/* Print / Close buttons (hidden during print) */}
      <div className="print-btn no-print">
        <button className="btn btn-secondary" onClick={() => window.close()}>Close</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save PDF</button>
      </div>
    </>
  );
}
