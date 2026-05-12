import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { customFetch } from "@workspace/api-client-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  ShieldCheck,
  UserCheck,
  TrendingUp,
  IndianRupee,
  Target,
  CheckSquare,
  UserX,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  AlertTriangle,
  KeyRound,
  Settings2,
  History,
} from "lucide-react";

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  createdAt: string;
}

interface TeamUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: "admin" | "sales" | "marketing";
  isActive: boolean;
  createdAt: string;
  leadCount: number;
  taskCount: number;
  convertedCount: number;
  totalDealValue: number;
}

interface TeamStats {
  totalUsers: number;
  admins: number;
  sales: number;
  marketing: number;
  activeUsers: number;
  perRep: {
    userId: string;
    name: string;
    role: string;
    isActive: boolean;
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    totalDealValue: number;
    totalTasks: number;
  }[];
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function getDisplayName(user: TeamUser) {
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.email ?? "Unknown";
}

function getInitials(user: TeamUser) {
  if (user.firstName) return user.firstName[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: TeamUser | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setPassword(""); setError(""); setShowPassword(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await customFetch(`/api/admin/users/${user!.id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: password }),
      });
      toast({ title: `Password reset for ${getDisplayName(user!)}` });
      reset();
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user ? getDisplayName(user) : ""}</strong>. Share it with them directly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password">New Password</Label>
            <div className="relative">
              <Input
                id="rp-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting…</> : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "sales" | "marketing">("sales");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail("");
    setPassword(""); setRole("sales"); setError("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await customFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName, lastName, role }),
      });
      toast({ title: `User ${email} created successfully` });
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Create a login for a new sales rep or admin. Share the credentials with them directly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cu-firstName">First Name</Label>
              <Input id="cu-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Rajan" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-lastName">Last Name</Label>
              <Input id="cu-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mehta" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email *</Label>
            <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rajan@company.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password *</Label>
            <div className="relative">
              <Input
                id="cu-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "sales" | "marketing")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales Rep</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<TeamUser | null>(null);
  const [auditLimit, setAuditLimit] = useState(50);

  const { data: users = [], isLoading: usersLoading } = useQuery<TeamUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => customFetch<TeamUser[]>("/api/admin/users"),
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs", auditLimit],
    queryFn: () => customFetch<AuditLog[]>(`/api/admin/audit-logs?limit=${auditLimit}`),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<TeamStats>({
    queryKey: ["/api/admin/team-stats"],
    queryFn: () => customFetch<TeamStats>("/api/admin/team-stats"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "sales" | "marketing" }) =>
      customFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team-stats"] });
      toast({ title: "Role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      customFetch(`/api/admin/users/${userId}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team-stats"] });
      toast({
        title: variables.isActive ? "User activated successfully" : "User deactivated successfully",
      });
    },
    onError: () => {
      toast({ title: "Failed to update user status", variant: "destructive" });
    },
  });

  const totalPipelineValue = users.reduce((s, u) => s + u.totalDealValue, 0);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-7 w-7 text-primary" />
                Admin Panel
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your sales team, roles, and view performance across all reps.
              </p>
            </div>
            <Button onClick={() => setShowCreateUser(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Team Member
            </Button>
          </div>

          <CreateUserDialog
            open={showCreateUser}
            onOpenChange={setShowCreateUser}
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/team-stats"] });
            }}
          />
          <ResetPasswordDialog
            user={resetPasswordUser}
            onClose={() => setResetPasswordUser(null)}
          />

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Team Members</p>
                    <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admins</p>
                    <p className="text-2xl font-bold">{stats?.admins ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{stats?.activeUsers ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <IndianRupee className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pipeline Value</p>
                    <p className="text-xl font-bold">{formatCurrency(totalPipelineValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.perRep && stats.perRep.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4" /> Leads
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Target className="h-4 w-4" /> Converted
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-4 w-4" /> Rate
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CheckSquare className="h-4 w-4" /> Tasks
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Deal Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.perRep.map((rep) => (
                      <TableRow key={rep.userId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {rep.name[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{rep.name}</p>
                              <Badge
                                variant={rep.role === "admin" ? "default" : rep.role === "marketing" ? "outline" : "secondary"}
                                className="text-xs"
                              >
                                {rep.role === "admin" ? "Admin" : rep.role === "marketing" ? "Marketing" : "Sales"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{rep.totalLeads}</TableCell>
                        <TableCell className="text-center font-medium text-green-600">{rep.convertedLeads}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              rep.conversionRate >= 50
                                ? "default"
                                : rep.conversionRate >= 25
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {rep.conversionRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">{rep.totalTasks}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">
                          {formatCurrency(rep.totalDealValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No performance data yet. Assign leads to team members to track their progress.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Team Members Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No team members found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Converted</TableHead>
                      <TableHead>Deal Value</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isSelf = user.id === (currentUser as { id?: string })?.id;
                      return (
                        <TableRow key={user.id} className={!user.isActive ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                {getInitials(user)}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {getDisplayName(user)}
                                  {isSelf && (
                                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Joined {new Date(user.createdAt).toLocaleDateString("en-IN")}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.email ?? "—"}
                          </TableCell>
                          <TableCell className="font-medium">{user.leadCount}</TableCell>
                          <TableCell className="font-medium text-green-600">{user.convertedCount}</TableCell>
                          <TableCell className="font-semibold text-green-700">
                            {formatCurrency(user.totalDealValue)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(val) =>
                                roleMutation.mutate({ userId: user.id, role: val as "admin" | "sales" | "marketing" })
                              }
                              disabled={isSelf || roleMutation.isPending}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> Admin
                                  </div>
                                </SelectItem>
                                <SelectItem value="sales">
                                  <div className="flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" /> Sales
                                  </div>
                                </SelectItem>
                                <SelectItem value="marketing">
                                  <div className="flex items-center gap-1">
                                    <Target className="h-3 w-3" /> Marketing
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!isSelf && (
                              <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setResetPasswordUser(user)}
                                title="Reset password"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={
                                      user.isActive
                                        ? "text-destructive hover:text-destructive"
                                        : "text-green-600 hover:text-green-700"
                                    }
                                    disabled={activeMutation.isPending}
                                  >
                                    {user.isActive ? (
                                      <UserX className="h-4 w-4" />
                                    ) : (
                                      <UserPlus className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {user.isActive ? "Deactivate User" : "Activate User"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {user.isActive
                                        ? `Deactivate ${getDisplayName(user)}? They will not be able to log in.`
                                        : `Reactivate ${getDisplayName(user)}? They will regain access.`}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        activeMutation.mutate({ userId: user.id, isActive: !user.isActive })
                                      }
                                      className={
                                        user.isActive
                                          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          : ""
                                      }
                                    >
                                      {user.isActive ? "Deactivate" : "Activate"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {/* Access Audit Log */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Access Log
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  {[25, 50, 100].map((n) => (
                    <Button
                      key={n}
                      variant={auditLimit === n ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setAuditLimit(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No access events recorded yet. Events appear here as users log in and out.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <AuditActionBadge action={log.action} />
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {log.userEmail ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {log.ipAddress ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {log.details ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}

function AuditActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    login:            { label: "Login",            icon: <LogIn className="h-3 w-3" />,        className: "bg-green-100 text-green-800 border-green-200" },
    failed_login:     { label: "Failed Login",     icon: <AlertTriangle className="h-3 w-3" />, className: "bg-red-100 text-red-800 border-red-200" },
    logout:           { label: "Logout",           icon: <LogOut className="h-3 w-3" />,       className: "bg-slate-100 text-slate-700 border-slate-200" },
    account_setup:    { label: "Account Setup",    icon: <Settings2 className="h-3 w-3" />,    className: "bg-blue-100 text-blue-800 border-blue-200" },
    password_changed: { label: "Password Changed", icon: <KeyRound className="h-3 w-3" />,     className: "bg-amber-100 text-amber-800 border-amber-200" },
    password_reset:   { label: "Password Reset",   icon: <KeyRound className="h-3 w-3" />,     className: "bg-purple-100 text-purple-800 border-purple-200" },
  };
  const entry = map[action] ?? { label: action, icon: null, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${entry.className}`}>
      {entry.icon}
      {entry.label}
    </span>
  );
}
