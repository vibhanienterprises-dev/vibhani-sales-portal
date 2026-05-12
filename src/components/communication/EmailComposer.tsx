import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

const emailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  templateId: z.string().optional(),
});

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: number;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
}

export function EmailComposer({ 
  open, 
  onOpenChange, 
  leadId, 
  defaultTo = "", 
  defaultSubject = "", 
  defaultBody = "" 
}: EmailComposerProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => customFetch<any[]>("/api/email/templates")
  });

  const { data: authData } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => customFetch<{ user: any, isAuthenticated: boolean }>("/api/auth/user")
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => customFetch<any>("/api/settings")
  });

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: defaultTo,
      subject: defaultSubject,
      body: defaultBody,
      templateId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        to: defaultTo,
        subject: defaultSubject,
        body: defaultBody,
        templateId: "",
      });
    }
  }, [open, defaultTo, defaultSubject, defaultBody, form]);

  const handleTemplateChange = (templateId: string) => {
    const template = templates?.find((t: any) => t.id.toString() === templateId);
    if (template) {
      form.setValue("subject", template.subject);
      form.setValue("body", template.body);
    }
  };

  const onSubmit = async (values: z.infer<typeof emailSchema>) => {
    setSending(true);
    try {
      const res = await customFetch("/api/email/send", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          leadId,
          templateId: values.templateId ? parseInt(values.templateId) : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to send email");

      toast({ title: "Email sent successfully" });
      onOpenChange(false);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Could not send email. Please check SMTP settings.",
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  };

  const fromEmail = (authData?.user?.role?.toUpperCase() === 'SALES' || authData?.user?.role === 'sales_rep')
    ? settings?.smtpFromEmail || settings?.smtpUser || "sales@company.com" 
    : authData?.user?.email || "user@company.com";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 p-3 rounded-md mb-4 border border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sending From</div>
          <div className="text-sm font-medium text-foreground">{fromEmail}</div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl><Input {...field} placeholder="recipient@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template (Optional)</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); handleTemplateChange(v); }}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates?.map((t: any) => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                        ))}
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
                  <FormLabel>Subject</FormLabel>
                  <FormControl><Input {...field} placeholder="Email subject" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-[200px]" placeholder="Type your message here..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Send Email
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
