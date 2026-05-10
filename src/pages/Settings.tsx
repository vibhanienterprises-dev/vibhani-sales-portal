import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Building2, MessageCircle, Mail, Save, Bell, Send, Clock, Zap, AlertTriangle, CheckCircle, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES } from "@/lib/constants";
import { UpdateSettingsBodyWhatsappProvider } from "@workspace/api-client-react";

const companySchema = z.object({
  companyName: z.string().optional(),
  companyGstin: z.string().optional(),
  homeStateCode: z.string().optional(),
});

const whatsappSchema = z.object({
  whatsappProvider: z.nativeEnum(UpdateSettingsBodyWhatsappProvider).optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioWhatsappNumber: z.string().optional(),
  interaktApiKey: z.string().optional(),
});

const smtpSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFromEmail: z.string().email().optional().or(z.literal("")),
  smtpFromName: z.string().optional(),
});

const digestSchema = z.object({
  digestEnabled: z.string().optional(),
  digestEmail: z.string().email().optional().or(z.literal("")),
  digestTime: z.string().optional(),
});

const automationSchema = z.object({
  staleReminderEnabled: z.string().optional(),
  staleReminderDays: z.coerce.number().min(1).max(90).optional(),
  staleReminderTask: z.string().optional(),
});

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sendingDigest, setSendingDigest] = useState(false);
  const [checkingStale, setCheckingStale] = useState(false);
  const [staleResult, setStaleResult] = useState<{ checked: number; reminded: number; message: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const formsInitialized = useRef(false);

  const companyForm = useForm<z.infer<typeof companySchema>>({ resolver: zodResolver(companySchema) });
  const whatsappForm = useForm<z.infer<typeof whatsappSchema>>({ resolver: zodResolver(whatsappSchema) });
  const smtpForm = useForm<z.infer<typeof smtpSchema>>({ resolver: zodResolver(smtpSchema) });
  const digestForm = useForm<z.infer<typeof digestSchema>>({ resolver: zodResolver(digestSchema) });
  const automationForm = useForm<z.infer<typeof automationSchema>>({ resolver: zodResolver(automationSchema) });

  const waProvider = whatsappForm.watch("whatsappProvider");

  const resetAllForms = (s: NonNullable<typeof settings>) => {
    companyForm.reset({
      companyName: s.companyName || "",
      companyGstin: s.companyGstin || "",
      homeStateCode: s.homeStateCode || "",
    });
    whatsappForm.reset({
      whatsappProvider: s.whatsappProvider || "mock",
      twilioAccountSid: s.twilioAccountSid || "",
      twilioAuthToken: s.twilioAuthToken || "",
      twilioWhatsappNumber: s.twilioWhatsappNumber || "",
      interaktApiKey: s.interaktApiKey || "",
    });
    smtpForm.reset({
      smtpHost: s.smtpHost || "",
      smtpPort: s.smtpPort || 587,
      smtpUser: s.smtpUser || "",
      smtpPassword: s.smtpPassword || "",
      smtpFromEmail: s.smtpFromEmail || "",
      smtpFromName: s.smtpFromName || "",
    });
    digestForm.reset({
      digestEnabled: s.digestEnabled || "false",
      digestEmail: s.digestEmail || "",
      digestTime: s.digestTime || "08:00",
    });
    automationForm.reset({
      staleReminderEnabled: s.staleReminderEnabled || "false",
      staleReminderDays: s.staleReminderDays ?? 7,
      staleReminderTask: s.staleReminderTask || "whatsapp",
    });
  };

  useEffect(() => {
    if (settings && !formsInitialized.current) {
      formsInitialized.current = true;
      resetAllForms(settings);
    }
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkStaleNow = async () => {
    setCheckingStale(true);
    setStaleResult(null);
    try {
      const res = await fetch("/api/stale-leads/check-now", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStaleResult(data);
      toast({ title: data.message });
    } catch {
      toast({ title: "Failed to run stale check", variant: "destructive" });
    } finally {
      setCheckingStale(false);
    }
  };

  const sendDigestNow = async () => {
    setSendingDigest(true);
    try {
      const res = await fetch("/api/digest/send-now", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Test digest sent", description: "Check your email (or server logs if SMTP isn't configured yet)." });
    } catch {
      toast({ title: "Failed to send digest", variant: "destructive" });
    } finally {
      setSendingDigest(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to change password", variant: "destructive" });
      } else {
        toast({ title: "Password changed successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast({ title: "Network error — please try again", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const onUpdate = (values: any) => {
    let stateName = undefined;
    if (values.homeStateCode) {
      stateName = INDIAN_STATES.find(s => s.code === values.homeStateCode)?.name;
    }
    updateSettings.mutate({ data: { ...values, ...(stateName ? { homeStateName: stateName } : {}) } }, {
      onSuccess: (saved) => {
        queryClient.setQueryData(getGetSettingsQueryKey(), saved);
        toast({ title: "Settings updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-8"><Skeleton className="h-12 w-64 mb-8" /><Skeleton className="h-96 w-full max-w-3xl" /></main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your company profile and integrations.</p>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          <Tabs defaultValue="company" className="max-w-4xl">
            <TabsList className="grid w-full grid-cols-6 mb-8">
              <TabsTrigger value="company" className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Company</TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</TabsTrigger>
              <TabsTrigger value="smtp" className="flex items-center gap-2"><Mail className="w-4 h-4" /> SMTP</TabsTrigger>
              <TabsTrigger value="digest" className="flex items-center gap-2"><Bell className="w-4 h-4" /> Digest</TabsTrigger>
              <TabsTrigger value="automation" className="flex items-center gap-2"><Zap className="w-4 h-4" /> Automation</TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2"><Lock className="w-4 h-4" /> Security</TabsTrigger>
            </TabsList>
            
            <TabsContent value="company">
              <Card>
                <CardHeader>
                  <CardTitle>Company Details</CardTitle>
                  <CardDescription>Your business information used for GST calculations and invoicing.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...companyForm}>
                    <form onSubmit={companyForm.handleSubmit(onUpdate)} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField control={companyForm.control} name="companyName" render={({ field }) => (
                          <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={companyForm.control} name="companyGstin" render={({ field }) => (
                          <FormItem><FormLabel>Company GSTIN</FormLabel><FormControl><Input {...field} className="uppercase" /></FormControl></FormItem>
                        )} />
                        <FormField control={companyForm.control} name="homeStateCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Home State</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" disabled={updateSettings.isPending}><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp">
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp Integration</CardTitle>
                  <CardDescription>Configure your WhatsApp Business API provider.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...whatsappForm}>
                    <form onSubmit={whatsappForm.handleSubmit(onUpdate)} className="space-y-6">
                      <FormField control={whatsappForm.control} name="whatsappProvider" render={({ field }) => (
                        <FormItem className="max-w-md">
                          <FormLabel>Provider</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="mock">Mock (Development)</SelectItem>
                              <SelectItem value="twilio">Twilio</SelectItem>
                              <SelectItem value="interakt">Interakt</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      
                      {waProvider === "twilio" && (
                        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in pt-4 border-t border-border">
                          <FormField control={whatsappForm.control} name="twilioAccountSid" render={({ field }) => (
                            <FormItem><FormLabel>Account SID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={whatsappForm.control} name="twilioAuthToken" render={({ field }) => (
                            <FormItem><FormLabel>Auth Token</FormLabel><FormControl><Input type="password" {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={whatsappForm.control} name="twilioWhatsappNumber" render={({ field }) => (
                            <FormItem><FormLabel>WhatsApp Number</FormLabel><FormControl><Input placeholder="whatsapp:+1234567890" {...field} /></FormControl></FormItem>
                          )} />
                        </div>
                      )}

                      {waProvider === "interakt" && (
                        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in pt-4 border-t border-border">
                          <FormField control={whatsappForm.control} name="interaktApiKey" render={({ field }) => (
                            <FormItem className="col-span-2 max-w-md"><FormLabel>Interakt API Key</FormLabel><FormControl><Input type="password" {...field} /></FormControl></FormItem>
                          )} />
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button type="submit" disabled={updateSettings.isPending}><Save className="w-4 h-4 mr-2" /> Save Config</Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="smtp">
              <Card>
                <CardHeader>
                  <CardTitle>SMTP Email Configuration</CardTitle>
                  <CardDescription>Set up SMTP to send emails directly from your own domain.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...smtpForm}>
                    <form onSubmit={smtpForm.handleSubmit(onUpdate)} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField control={smtpForm.control} name="smtpHost" render={({ field }) => (
                          <FormItem><FormLabel>SMTP Host</FormLabel><FormControl><Input placeholder="smtp.gmail.com" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={smtpForm.control} name="smtpPort" render={({ field }) => (
                          <FormItem><FormLabel>SMTP Port</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={smtpForm.control} name="smtpUser" render={({ field }) => (
                          <FormItem><FormLabel>SMTP Username</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={smtpForm.control} name="smtpPassword" render={({ field }) => (
                          <FormItem><FormLabel>SMTP Password / App Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={smtpForm.control} name="smtpFromEmail" render={({ field }) => (
                          <FormItem><FormLabel>From Email Address</FormLabel><FormControl><Input type="email" placeholder="sales@yourcompany.com" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={smtpForm.control} name="smtpFromName" render={({ field }) => (
                          <FormItem><FormLabel>From Name</FormLabel><FormControl><Input placeholder="Your Company Sales" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" disabled={updateSettings.isPending}><Save className="w-4 h-4 mr-2" /> Save Config</Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="digest">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Daily Digest Email</CardTitle>
                    <CardDescription>
                      Receive a morning summary every day with today's tasks, overdue items, hot leads, and your pipeline snapshot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...digestForm}>
                      <form onSubmit={digestForm.handleSubmit(onUpdate)} className="space-y-6">
                        <FormField
                          control={digestForm.control}
                          name="digestEnabled"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                                <Switch
                                  checked={field.value === "true"}
                                  onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                                />
                                <div>
                                  <Label className="text-sm font-medium">Enable Daily Digest</Label>
                                  <p className="text-xs text-muted-foreground mt-0.5">Send a daily email summary at the configured time</p>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />

                        <div className="grid md:grid-cols-2 gap-6">
                          <FormField control={digestForm.control} name="digestEmail" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Recipient Email</FormLabel>
                              <FormControl><Input type="email" placeholder="admin@yourcompany.com" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={digestForm.control} name="digestTime" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Send Time (24h, India IST)</FormLabel>
                              <FormControl><Input type="time" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={sendDigestNow}
                            disabled={sendingDigest}
                            className="flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            {sendingDigest ? "Sending…" : "Send Test Digest Now"}
                          </Button>
                          <Button type="submit" disabled={updateSettings.isPending}>
                            <Save className="w-4 h-4 mr-2" /> Save Digest Settings
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex gap-4 items-start">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-1">What's in the digest?</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>📋 <strong>Today's follow-ups</strong> — all pending tasks due today</li>
                          <li>⚠️ <strong>Overdue tasks</strong> — everything past due that needs attention</li>
                          <li>🔥 <strong>Hot leads</strong> — top scoring leads to prioritise</li>
                          <li>📊 <strong>Pipeline snapshot</strong> — lead counts and weighted expected revenue by stage</li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-3">
                          Requires SMTP to be configured under the SMTP tab to send real emails.
                          Use "Send Test Digest Now" to preview in server logs even without SMTP.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="automation">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Follow-up Reminders</CardTitle>
                    <CardDescription>
                      Automatically create follow-up tasks and send notifications when leads go quiet for too long.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...automationForm}>
                      <form onSubmit={automationForm.handleSubmit(onUpdate)} className="space-y-6">

                        <FormField
                          control={automationForm.control}
                          name="staleReminderEnabled"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                                <Switch
                                  checked={field.value === "true"}
                                  onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                                />
                                <div>
                                  <Label className="text-sm font-medium">Enable Follow-up Reminders</Label>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Automatically detect leads with no recent activity and create follow-up tasks
                                  </p>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />

                        <div className="grid md:grid-cols-2 gap-6">
                          <FormField control={automationForm.control} name="staleReminderDays" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Days without contact</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-2">
                                  <Input type="number" min={1} max={90} {...field} className="w-24" />
                                  <span className="text-sm text-muted-foreground">days</span>
                                </div>
                              </FormControl>
                              <p className="text-xs text-muted-foreground">Trigger a reminder after this many days of silence (1–90)</p>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={automationForm.control} name="staleReminderTask" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Follow-up task type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="whatsapp">
                                    <div className="flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5 text-green-500" /> WhatsApp</div>
                                  </SelectItem>
                                  <SelectItem value="call">
                                    <div className="flex items-center gap-2"><Bell className="w-3.5 h-3.5 text-blue-500" /> Phone Call</div>
                                  </SelectItem>
                                  <SelectItem value="email">
                                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-sky-500" /> Email</div>
                                  </SelectItem>
                                  <SelectItem value="meeting">
                                    <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-purple-500" /> Meeting</div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">Type of task created when a lead goes stale</p>
                            </FormItem>
                          )} />
                        </div>

                        {/* Manual trigger + result */}
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={checkStaleNow}
                              disabled={checkingStale}
                              className="flex items-center gap-2"
                            >
                              <Zap className="w-4 h-4" />
                              {checkingStale ? "Checking…" : "Run Check Now"}
                            </Button>
                            <Button type="submit" disabled={updateSettings.isPending}>
                              <Save className="w-4 h-4 mr-2" /> Save Automation Settings
                            </Button>
                          </div>

                          {staleResult && (
                            <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                              staleResult.reminded > 0
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                                : "bg-green-500/10 border-green-500/30 text-green-300"
                            }`}>
                              {staleResult.reminded > 0
                                ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                                : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                              }
                              <span>{staleResult.message}</span>
                            </div>
                          )}
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex gap-4 items-start">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">How follow-up reminders work</h4>
                        <ul className="text-sm text-muted-foreground space-y-1.5">
                          <li>🔍 <strong>Runs every 6 hours</strong> — automatically scans all active leads (New, Contacted, Quotation Sent)</li>
                          <li>📅 <strong>Checks last activity</strong> — looks at emails, WhatsApp, stage changes, notes, and task completions</li>
                          <li>✅ <strong>Creates a task</strong> — schedules a follow-up task for tomorrow if no recent activity</li>
                          <li>🔔 <strong>Sends a notification</strong> — in-app alert appears in your notification bell</li>
                          <li>🚫 <strong>No duplicates</strong> — skips leads that already have pending tasks or were recently reminded</li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-3">
                          Use "Run Check Now" to trigger the scan immediately and see results without waiting for the next scheduled run.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="security">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-primary" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your account password. You'll need your current password to make changes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                      <div className="space-y-1.5">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="currentPassword"
                            type={showPasswords ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter your current password"
                            required
                            className="pr-10"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPasswords((v) => !v)}
                            tabIndex={-1}
                          >
                            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type={showPasswords ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          required
                          autoComplete="new-password"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                          id="confirmPassword"
                          type={showPasswords ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          required
                          autoComplete="new-password"
                        />
                      </div>

                      <Button type="submit" disabled={changingPassword} className="gap-2">
                        {changingPassword
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                          : <><Save className="w-4 h-4" /> Update Password</>}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex gap-4 items-start">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Password security tips</h4>
                        <ul className="text-sm text-muted-foreground space-y-1.5">
                          <li>🔐 Use at least <strong>12 characters</strong> mixing letters, numbers, and symbols</li>
                          <li>🚫 Never share your password with anyone, including your admin</li>
                          <li>🔄 Change your password if you suspect it has been compromised</li>
                          <li>📋 Use a password manager to generate and store strong passwords</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </main>
    </div>
  );
}
