import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type NotificationItem,
} from "@workspace/api-client-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifIcon({ type }: { type: NotificationItem["type"] }) {
  const colours: Record<string, string> = {
    task_overdue: "text-red-400",
    task_due: "text-amber-400",
    lead_reminder: "text-blue-400",
    system: "text-gray-400",
  };
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full shrink-0 mt-1.5",
        type === "task_overdue" ? "bg-red-400" : type === "task_due" ? "bg-amber-400" : "bg-blue-400",
      )}
    />
  );
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useListNotifications(
    {},
    { query: { refetchInterval: 30_000 } } as any,
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // --- Robust polling for real-time notification updates ---
  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "";
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("vibhani_token") : null;
        
        const response = await fetch(`${apiUrl}/api/notifications`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        });
        if (response.ok) {
          void queryClient.invalidateQueries({ queryKey: ["listNotifications"] });
        }
      } catch (error) {
        console.error("Polling error", error);
      }
    };

    fetchUpdates(); // Initial fetch
    const intervalId = setInterval(fetchUpdates, 30000); // Poll every 30 seconds
    return () => clearInterval(intervalId);
  }, [queryClient]);

  const handleMarkOne = (id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["listNotifications"] });
      },
    });
  };

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["listNotifications"] });
      },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-80 p-0 bg-[#0f1729] border-white/10 text-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-white/5"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Bell className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">No notifications yet</p>
              <p className="text-xs text-gray-600 mt-1">Tasks due soon will appear here</p>
            </div>
          ) : (
            notifications.slice(0, 20).map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "flex gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group",
                  !notif.isRead && "bg-amber-500/5",
                )}
                onClick={() => !notif.isRead && handleMarkOne(notif.id)}
              >
                <NotifIcon type={notif.type} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm leading-snug",
                    notif.isRead ? "text-gray-400" : "text-white font-medium",
                  )}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{notif.body}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-600">{timeAgo(notif.createdAt)}</span>
                    {notif.taskId && (
                      <Link
                        href="/tasks"
                        onClick={() => setOpen(false)}
                        className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View task <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
                {!notif.isRead && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-white/10 text-center">
            <span className="text-xs text-gray-600">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
