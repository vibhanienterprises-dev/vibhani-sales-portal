import { useAuth } from "@workspace/replit-auth-web";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  KanbanSquare, 
  CheckSquare, 
  Calculator, 
  MessageCircle, 
  Mail, 
  Settings,
  LogOut,
  Menu,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/NotificationBell";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/gst", label: "GST Tool", icon: Calculator },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV_ITEM = { href: "/admin", label: "Admin Panel", icon: ShieldCheck, adminOnly: true };

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const role = (user as any)?.role as string | undefined;
  const isAdmin = role === "admin";

  const navItems = isAdmin ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : BASE_NAV_ITEMS;

  const NavLinks = () => (
    <div className="flex flex-col space-y-1 w-full">
      {navItems.map((item) => {
        const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
            {Boolean("adminOnly" in item && (item as { adminOnly?: boolean }).adminOnly) && (
              <Badge variant="secondary" className="ml-auto text-xs px-1 py-0">
                Admin
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );

  const UserFooter = () => (
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {(user?.firstName || user?.email || "U")[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sidebar-foreground text-sm truncate">
            {user?.firstName || user?.email || "User"}
          </p>
          {isAdmin && (
            <p className="text-xs text-primary flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Admin
            </p>
          )}
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent"
        onClick={() => logout()}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Log Out
      </Button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="bg-primary text-primary-foreground p-1 rounded">V</span>
            Vibhani
          </h1>
          <NotificationBell />
        </div>
        <div className="flex-1 px-4 overflow-y-auto">
          <NavLinks />
        </div>
        <UserFooter />
      </div>

      {/* Mobile Header & Sheet */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-50">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="bg-primary text-primary-foreground px-1.5 rounded text-sm">V</span>
          Vibhani
        </h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar border-sidebar-border p-0 flex flex-col">
              <div className="p-6 border-b border-sidebar-border">
                <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground p-1 rounded">V</span>
                  Vibhani
                </h1>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                <NavLinks />
              </div>
              <UserFooter />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
