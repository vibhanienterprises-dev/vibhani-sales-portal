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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetLeadActivityQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Paperclip, X } from "lucide-react";
import { useRef } from "react";

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
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => customFetch<any[]>("/api/email/templates")
  });

  const { data: authData, isLoading: isLoadingAuth } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => customFetch<{ user: any, isAuthenticated: boolean }>("/api/auth/user")
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => customFetch<any>("/api/settings")
  });

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: defaultTo || "",
      subject: defaultSubject || "",
      body: defaultBody || "",
      templateId: "",
    },
  });

  // Sync form with props when they change or modal opens
  useEffect(() => {
    if (open) {
      setSelectedFiles([]);
      form.reset({
        to: defaultTo || "",
        subject: defaultSubject || "",
        body: defaultBody || "",
        templateId: "",
      });
    }
  }, [open, defaultTo, defaultSubject, defaultBody, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
      const formData = new FormData();
      formData.append("to", values.to);
      formData.append("subject", values.subject);
      formData.append("body", values.body);
      if (values.templateId) formData.append("templateId", values.templateId);
      if (leadId) formData.append("leadId", leadId.toString());
      
      selectedFiles.forEach(file => {
        formData.append("attachments", file);
      });

      await customFetch("/api/email/send", {
        method: "POST",
        body: formData,
      });

      toast({ title: "Email sent successfully" });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Email send error:", error);
      toast({ 
        title: "Error", 
        description: "Could not send email. Please check SMTP settings.",
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  };

  const isLoading = isLoadingAuth || isLoadingSettings;

  const fromEmail = (authData?.user?.role?.toUpperCase() === 'SALES' || authData?.user?.role === 'sales')
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

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</FormLabel>
                <Input value={fromEmail} readOnly className="bg-muted font-medium" />
              </div>

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
                          {Array.isArray(templates) && templates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id?.toString() || ""}>{t.name}</SelectItem>
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
                      <Textarea {...field} className="min-h-[180px]" placeholder="Type your message here..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-medium">Attachments</FormLabel>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                    Attach Files
                  </Button>
                </div>
                
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                
                {selectedFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-xs border border-border group">
                        <span className="truncate max-w-[150px] font-medium">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                        <button type="button" onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">No files attached</div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={sending} className="min-w-[120px]">
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Email
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
