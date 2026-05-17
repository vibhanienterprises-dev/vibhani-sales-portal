import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetLeadActivityQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

const emailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  templateKey: z.string().optional(),
});

interface EmailComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: number;
  leadEmail: string;
  leadName: string;
  onSent?: () => void;
}

export function EmailComposerModal({
  open,
  onOpenChange,
  leadId,
  leadEmail,
  leadName,
  onSent,
}: EmailComposerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: leadEmail || "",
      subject: "",
      body: "",
      templateKey: "blank",
    },
  });

  // Sync To email when modal is loaded
  useEffect(() => {
    if (open) {
      setError("");
      form.reset({
        to: leadEmail || "",
        subject: "",
        body: "",
        templateKey: "blank",
      });
    }
  }, [open, leadEmail, form]);

  const handleTemplateChange = (templateKey: string) => {
    let subject = "";
    let body = "";

    const name = leadName || "there";

    if (templateKey === "welcome") {
      subject = "Welcome to Vibhani Enterprises!";
      body = `Hi ${name},\n\nWelcome to Vibhani Enterprises! We are thrilled to partner with you. Our team is dedicated to providing you with premium engineering services, tools, and custom enterprise solutions.\n\nWarm regards,\nSales Team\nVibhani India`;
    } else if (templateKey === "amc_reminder") {
      subject = "AMC Renewal Reminder - Vibhani India Pvt Ltd";
      body = `Hi ${name},\n\nWe would like to remind you that your Annual Maintenance Contract (AMC) for Vibhani engineering services is due for renewal. Please review and process the renewal at your earliest convenience to ensure uninterrupted services.\n\nBest regards,\nAccounts & Renewal Team\nVibhani India`;
    } else if (templateKey === "follow_up") {
      subject = "Following up on our discussion - Vibhani";
      body = `Hi ${name},\n\nI hope you are doing well. I wanted to quickly follow up on our recent discussion regarding your engineering requirements. Please let us know if you have any questions or require further details.\n\nBest regards,\nSales Team\nVibhani India`;
    }

    form.setValue("subject", subject);
    form.setValue("body", body);
  };

  const onSubmit = async (values: z.infer<typeof emailSchema>) => {
    setSending(true);
    setError("");
    try {
      // 1. Trigger placeholder API endpoint
      const response = await customFetch<{ success: boolean; message: string }>("/api/email/send", {
        method: "POST",
        body: JSON.stringify({
          to: values.to,
          subject: values.subject,
          body: values.body,
          leadId: leadId,
        }),
      });

      if (!response || response.success === false) {
        throw new Error(response?.message || "Failed to deliver email");
      }

      toast({ 
        title: "Email sent successfully",
        description: `Sent: ${values.subject}`
      });

      // 2. Invalidate parent queries to trigger chronological ledger updates
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
      }

      if (onSent) onSent();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Email send error:", err);
      setError(err?.message || "Could not send email. Please check your network connection.");
      toast({ 
        title: "Error", 
        description: "Failed to send email composer payload.",
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] rounded-xl glassmorphism border-white/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Mail className="w-5 h-5 text-blue-500" />
            In-App Email Composer
          </DialogTitle>
          <DialogDescription>
            Send beautifully templated messages directly to <strong>{leadName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">To (Client Email)</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly className="bg-muted text-muted-foreground cursor-not-allowed font-medium font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="templateKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">Choose Template</FormLabel>
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); handleTemplateChange(v); }}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select email template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="blank">Blank Email</SelectItem>
                        <SelectItem value="welcome">Welcome to Vibhani</SelectItem>
                        <SelectItem value="amc_reminder">AMC Renewal Reminder</SelectItem>
                        <SelectItem value="follow_up">Follow-up Discussion</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">Subject Line</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter email subject line..." className="bg-background border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">Message Body</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      className="min-h-[220px] bg-background border-border font-sans text-sm focus-visible:ring-blue-500" 
                      placeholder="Compose your customized email body message here..." 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={sending} className="min-w-[130px] bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Email
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
