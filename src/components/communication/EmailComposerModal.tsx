import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField,
  FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetLeadActivityQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

// ── Form schema ──────────────────────────────────────────────────────────────
const emailSchema = z.object({
  to:          z.string().email("A valid recipient email is required"),
  subject:     z.string().min(1, "Subject is required"),
  body:        z.string().min(1, "Message body is required"),
  templateKey: z.string().optional(),
});
type EmailFormValues = z.infer<typeof emailSchema>;

// ── Template definitions ────────────────────────────────────────────────────
type TemplateKey = "blank" | "welcome" | "amc_reminder" | "follow_up";

function buildTemplate(key: TemplateKey, leadName: string) {
  const name = leadName || "there";
  switch (key) {
    case "welcome":
      return {
        subject: "Welcome to Vibhani Enterprises!",
        body: `Hi ${name},\n\nWelcome to Vibhani Enterprises! We are thrilled to partner with you and are dedicated to delivering premium engineering services and custom enterprise solutions to support your growth.\n\nDo not hesitate to reach out if there is anything we can do for you.\n\nWarm regards,\nSales Team\nVibhani India`,
      };
    case "amc_reminder":
      return {
        subject: "AMC Renewal Reminder — Vibhani India Pvt Ltd",
        body: `Hi ${name},\n\nThis is a gentle reminder that your Annual Maintenance Contract (AMC) with Vibhani India is approaching its renewal date.\n\nTo ensure uninterrupted service continuity, please process the renewal at your earliest convenience. Our team is happy to assist with any queries.\n\nBest regards,\nService & Accounts Team\nVibhani India Pvt Ltd`,
      };
    case "follow_up":
      return {
        subject: "Following Up on Our Recent Discussion — Vibhani",
        body: `Hi ${name},\n\nI hope you are doing well! I wanted to quickly follow up on our recent discussion about your engineering requirements and see if you have had a chance to review our proposal.\n\nPlease feel free to reply to this email or call us directly. We look forward to hearing from you.\n\nBest regards,\nSales Team\nVibhani India`,
      };
    default: // "blank"
      return { subject: "", body: "" };
  }
}

// ── Component ────────────────────────────────────────────────────────────────
interface EmailComposerModalProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  leadId?:        number;
  leadEmail:      string;
  leadName:       string;
  onSent?:        () => void;
}

export function EmailComposerModal({
  open, onOpenChange, leadId, leadEmail, leadName, onSent,
}: EmailComposerModalProps) {
  const { toast }        = useToast();
  const queryClient      = useQueryClient();
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { to: leadEmail || "", subject: "", body: "", templateKey: "blank" },
  });

  // Reset form every time modal opens
  useEffect(() => {
    if (open) {
      setSendStatus("idle");
      setErrorMsg("");
      form.reset({ to: leadEmail || "", subject: "", body: "", templateKey: "blank" });
    }
  }, [open, leadEmail, form]);

  // Apply template when dropdown changes
  const handleTemplateChange = (key: string) => {
    const { subject, body } = buildTemplate(key as TemplateKey, leadName);
    form.setValue("subject", subject);
    form.setValue("body", body);
  };

  // ── Send handler ──────────────────────────────────────────────────────────
  const onSubmit = async (values: EmailFormValues) => {
    setSending(true);
    setSendStatus("idle");
    setErrorMsg("");

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("vibhani_token") : null;

      // POST JSON to the CRM backend SMTP engine using standard fetch
      const response = await fetch(`${apiUrl}/api/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to:      values.to,
          subject: values.subject,
          body:    values.body,
          leadId:  leadId ?? undefined,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error ?? errJson?.message ?? "Failed to send email");
      }

      const result = await response.json().catch(() => ({ success: true }));

      if (result && result.success === false) {
        throw new Error(result?.error ?? result?.message ?? "Server returned failure");
      }

      // ── Success path ─────────────────────────────────────────────────────
      setSendStatus("success");
      toast({
        title: "Email Sent!",
        description: `"${values.subject}" delivered to ${values.to}`,
      });

      // Invalidate activity timeline so it refreshes immediately
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
      }

      if (onSent) onSent();

      // Small delay so the user sees the success state, then close
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err: any) {
      // ── Error path ───────────────────────────────────────────────────────
      const msg = err?.message ?? "Could not deliver email. Check SMTP settings on Render.";
      setSendStatus("error");
      setErrorMsg(msg);
      toast({
        title: "Email Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] w-[96vw] rounded-2xl border border-white/10 bg-background shadow-2xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 text-blue-500 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            Compose Email
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Send a message to <strong className="text-foreground">{leadName || leadEmail}</strong> via your configured SMTP server.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

            {/* ── Row 1: To + Template ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* To: read-only */}
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        className="bg-muted/60 text-muted-foreground font-mono text-sm cursor-not-allowed border-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Template dropdown */}
              <FormField
                control={form.control}
                name="templateKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Template
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => { field.onChange(v); handleTemplateChange(v); }}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Pick a template…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="blank">✏️ Blank — Start fresh</SelectItem>
                        <SelectItem value="welcome">👋 Welcome to Vibhani</SelectItem>
                        <SelectItem value="amc_reminder">🔔 AMC Renewal Reminder</SelectItem>
                        <SelectItem value="follow_up">📞 Follow-up Discussion</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Subject ──────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject Line</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter a clear, descriptive subject…"
                      className="bg-background border-border focus-visible:ring-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Message body ──────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Body</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={9}
                      placeholder="Type your email message here…"
                      className="bg-background border-border resize-none font-sans text-sm leading-relaxed focus-visible:ring-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Status banners ───────────────────────────────────────── */}
            {sendStatus === "success" && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 px-3 py-2 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Email delivered successfully!
              </div>
            )}
            {sendStatus === "error" && errorMsg && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ── Footer ───────────────────────────────────────────────── */}
            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sending || sendStatus === "success"}
                className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : sendStatus === "success" ? (
                  <><CheckCircle2 className="w-4 h-4" /> Sent!</>
                ) : (
                  <><Mail className="w-4 h-4" /> Send Email</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
