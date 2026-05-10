import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePreviewLeadsImport,
  useConfirmLeadsImport,
  type ImportPreviewRow,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileDown, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_CSV = `company_name,gstin,state_code,industry,source,contact_person,phone,email,deal_value
Tata Consultancy Services,27AABCT1234C1ZP,27,it,referral,Ravi Kumar,9876543210,ravi@tcs.com,500000
Infosys Limited,29AAACI4765E1ZX,29,it,website,Priya Sharma,9812345678,priya@infosys.com,750000
Reliance Retail,,GJ,retail,cold_call,Amit Patel,9898989898,amit@reliance.com,1200000
Mahindra & Mahindra,,MH,manufacturing,exhibition,Suresh Nair,9900123456,suresh@mahindra.com,900000`;

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bizcrm-leads-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: ImportPreviewRow["status"] }) {
  if (status === "valid") return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Valid</Badge>;
  if (status === "duplicate") return <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">Duplicate</Badge>;
  return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Error</Badge>;
}

type Step = "upload" | "preview" | "done";

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export function ImportLeadsModal({ open, onOpenChange }: ImportLeadsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<{
    rows: ImportPreviewRow[];
    totalRows: number;
    validRows: number;
    duplicateRows: number;
    errorRows: number;
    sessionToken: string;
  } | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const previewMutation = usePreviewLeadsImport();
  const confirmMutation = useConfirmLeadsImport();

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast({ title: "Invalid file", description: "Please upload a .csv file", variant: "destructive" });
        return;
      }
      previewMutation.mutate(
        { file: file as unknown as string } as any,
        {
          onSuccess: (data) => {
            setPreviewData(data);
            setStep("preview");
          },
          onError: () => {
            toast({ title: "Upload failed", description: "Could not parse the CSV file", variant: "destructive" });
          },
        },
      );
    },
    [previewMutation, toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleConfirm = () => {
    if (!previewData) return;
    confirmMutation.mutate(
      { sessionToken: previewData.sessionToken, skipDuplicates } as any,
      {
        onSuccess: (data) => {
          setResult(data);
          setStep("done");
          void queryClient.invalidateQueries({ queryKey: ["listLeads"] });
          void queryClient.invalidateQueries({ queryKey: ["getLeadStats"] });
        },
        onError: () => {
          toast({ title: "Import failed", description: "Please try again", variant: "destructive" });
        },
      },
    );
  };

  const handleClose = () => {
    setStep("upload");
    setPreviewData(null);
    setResult(null);
    setSkipDuplicates(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-[#0f1729] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">
            {step === "upload" && "Import Leads from CSV"}
            {step === "preview" && "Review Import Preview"}
            {step === "done" && "Import Complete"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-5 py-2">
            <div
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-amber-400 bg-amber-400/5"
                  : "border-white/20 hover:border-amber-400/50 hover:bg-white/5",
              )}
            >
              <Upload className="mx-auto mb-3 text-amber-400" size={40} />
              <p className="text-white font-medium mb-1">
                {previewMutation.isPending ? "Uploading…" : "Drop your CSV here or click to browse"}
              </p>
              <p className="text-gray-400 text-sm">Maximum 5 MB · UTF-8 encoded</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            <div className="bg-white/5 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium text-amber-400">Expected CSV columns:</p>
              <p className="text-gray-300 font-mono text-xs leading-relaxed">
                company_name · gstin · state_code · industry · source · contact_person · phone · email · deal_value
              </p>
              <p className="text-gray-400 text-xs">
                Only <span className="text-white">company_name</span> is required. GSTIN is validated automatically.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCSV}
              className="self-start border-white/20 text-gray-300 hover:text-white hover:bg-white/10"
            >
              <FileDown size={14} className="mr-2" />
              Download Sample Template
            </Button>
          </div>
        )}

        {step === "preview" && previewData && (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-white">{previewData.totalRows}</p>
                <p className="text-xs text-gray-400">Total rows</p>
              </div>
              <div className="bg-emerald-600/10 rounded-lg p-3 text-center border border-emerald-600/20">
                <p className="text-xl font-bold text-emerald-400">{previewData.validRows}</p>
                <p className="text-xs text-gray-400">Ready to import</p>
              </div>
              <div className="bg-amber-600/10 rounded-lg p-3 text-center border border-amber-600/20">
                <p className="text-xl font-bold text-amber-400">{previewData.duplicateRows}</p>
                <p className="text-xs text-gray-400">Duplicates (GSTIN)</p>
              </div>
              <div className="bg-red-600/10 rounded-lg p-3 text-center border border-red-600/20">
                <p className="text-xl font-bold text-red-400">{previewData.errorRows}</p>
                <p className="text-xs text-gray-400">Validation errors</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="skip-dup"
                checked={skipDuplicates}
                onCheckedChange={setSkipDuplicates}
              />
              <Label htmlFor="skip-dup" className="text-sm text-gray-300 cursor-pointer">
                Skip duplicate GSTIN leads (recommended)
              </Label>
            </div>

            <div className="overflow-auto flex-1 rounded-lg border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400 w-12">#</TableHead>
                    <TableHead className="text-gray-400">Company</TableHead>
                    <TableHead className="text-gray-400">GSTIN</TableHead>
                    <TableHead className="text-gray-400">Industry</TableHead>
                    <TableHead className="text-gray-400">Deal Value</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.map((row) => (
                    <TableRow
                      key={row.rowIndex}
                      className={cn(
                        "border-white/5",
                        row.status === "error" && "bg-red-900/10",
                        row.status === "duplicate" && "bg-amber-900/10",
                      )}
                    >
                      <TableCell className="text-gray-500 text-xs">{row.rowIndex}</TableCell>
                      <TableCell className="text-white font-medium text-sm">{row.companyName || <span className="text-gray-500 italic">empty</span>}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-300">{row.gstin || "—"}</TableCell>
                      <TableCell className="text-gray-300 text-xs capitalize">{row.industry || "—"}</TableCell>
                      <TableCell className="text-gray-300 text-xs">
                        {row.dealValue != null ? `₹${row.dealValue.toLocaleString("en-IN")}` : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell className="text-red-400 text-xs max-w-48">
                        {row.errors.length > 0 ? row.errors.join("; ") : row.isDuplicate ? `Exists as lead #${row.existingLeadId}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                className="border-white/20 text-gray-300 hover:text-white"
              >
                <RefreshCw size={14} className="mr-2" />
                Re-upload
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending || previewData.validRows === 0}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              >
                {confirmMutation.isPending
                  ? "Importing…"
                  : `Import ${skipDuplicates ? previewData.validRows : previewData.validRows + previewData.duplicateRows} leads`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <CheckCircle2 size={56} className="text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white mb-1">Import Complete</p>
              <p className="text-gray-400">Your leads have been added to Vibhani</p>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
              <div className="bg-emerald-600/10 rounded-lg p-3 border border-emerald-600/20">
                <p className="text-2xl font-bold text-emerald-400">{result.imported}</p>
                <p className="text-xs text-gray-400">Imported</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-300">{result.skipped}</p>
                <p className="text-xs text-gray-400">Skipped</p>
              </div>
              <div className="bg-red-600/10 rounded-lg p-3 border border-red-600/20">
                <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                <p className="text-xs text-gray-400">Failed</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="w-full bg-red-900/20 rounded-lg p-3 text-left border border-red-600/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-red-400" />
                  <p className="text-red-400 text-sm font-medium">Failed rows</p>
                </div>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-300">{e}</p>
                ))}
              </div>
            )}
            <Button
              onClick={handleClose}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
