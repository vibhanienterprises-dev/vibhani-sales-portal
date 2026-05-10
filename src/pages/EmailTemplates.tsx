import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate } from "@workspace/api-client-react";
import { getListEmailTemplatesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Edit, Trash2, Monitor } from "lucide-react";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  category: z.string().optional(),
  body: z.string().min(1, "Message body is required"),
});

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: templates, isLoading } = useListEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      subject: "",
      category: "Sales",
      body: "",
    },
  });

  const onSubmit = (values: z.infer<typeof templateSchema>) => {
    if (editingId) {
      updateTemplate.mutate({ id: editingId, data: values }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
          toast({ title: "Template updated successfully" });
        }
      });
    } else {
      createTemplate.mutate({ data: values }, {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
          toast({ title: "Template created successfully" });
        }
      });
    }
  };

  const handleEdit = (template: any) => {
    setEditingId(template.id);
    form.reset({
      name: template.name,
      subject: template.subject,
      category: template.category || "",
      body: template.body,
    });
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
          toast({ title: "Template deleted" });
        }
      });
    }
  };

  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBody, setPreviewBody] = useState("");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 flex justify-between items-center border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Email Templates</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage your standardized email campaigns.</p>
          </div>
          
          <Dialog open={open} onOpenChange={(val) => {
            if (!val) {
              setEditingId(null);
              form.reset();
            }
            setOpen(val);
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Template" : "Create New Template"}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Template Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} placeholder="e.g. Sales, Follow-up, Invoice" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject Line *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                setPreviewSubject(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="body" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message Body *</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              rows={12} 
                              onChange={(e) => {
                                field.onChange(e);
                                setPreviewBody(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createTemplate.isPending || updateTemplate.isPending}>
                        {editingId ? "Update Template" : "Save Template"}
                      </Button>
                    </form>
                  </Form>
                </div>
                
                <div className="hidden md:flex flex-col bg-muted/20 rounded-xl border border-border p-4">
                  <div className="text-sm text-muted-foreground mb-4 font-medium flex items-center gap-2"><Monitor className="w-4 h-4" /> Live Preview</div>
                  
                  {/* Email mock */}
                  <div className="w-full h-full bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                    <div className="border-b border-gray-200 p-4 bg-gray-50 text-gray-800 space-y-2 text-sm">
                      <div><span className="text-gray-500 font-medium w-16 inline-block">From:</span> you@bizcrm.com</div>
                      <div><span className="text-gray-500 font-medium w-16 inline-block">To:</span> client@example.com</div>
                      <div><span className="text-gray-500 font-medium w-16 inline-block">Subject:</span> <span className="font-bold">{previewSubject || "Your Subject Line"}</span></div>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto text-gray-800 text-sm whitespace-pre-wrap font-sans">
                      {previewBody || "Your email content will appear here..."}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
          ) : templates?.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">No email templates</h3>
              <p className="text-muted-foreground mt-1 mb-4">Create your first email template to save time.</p>
              <Button onClick={() => setOpen(true)}>Create Template</Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {templates?.map((template: any) => (
                <Card key={template.id} className="flex flex-col">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-foreground">{template.name}</CardTitle>
                        {template.category && <Badge variant="secondary" className="mt-2 text-xs">{template.category}</Badge>}
                      </div>
                      <Mail className="w-5 h-5 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="py-4 flex-1">
                    <div className="text-sm font-medium text-foreground mb-2 line-clamp-1 border-b border-border pb-2">Subj: {template.subject}</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{template.body}</p>
                  </CardContent>
                  <CardFooter className="pt-3 border-t border-border/50 flex justify-end gap-2 bg-muted/10">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id)}><Trash2 className="w-4 h-4" /></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
