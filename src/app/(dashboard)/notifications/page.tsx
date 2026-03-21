"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications?limit=50")
      .then(r => r.json())
      .then(d => { setNotifications(d.data?.notifications ?? []); setUnread(d.data?.unreadCount ?? 0); setLoading(false); });
  }, []);

  const markAll = async () => {
    const csrf = document.cookie.split(";").find(c => c.trim().startsWith("csrf_token="))?.split("=")[1];
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) }, body: JSON.stringify({ markAll: true }) });
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
    setUnread(0);
    toast.success("All notifications marked as read");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          {unread > 0 && <p className="text-slate-400 mt-1">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn-ghost text-sm gap-2">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <div className={`flex gap-3 p-4 rounded-xl border transition-colors ${!n.isRead ? "bg-cyan-500/5 border-cyan-500/15" : "glass-card border-transparent"}`}>
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.isRead ? "bg-cyan-400" : "bg-transparent"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{n.body}</p>
                  <p className="text-xs text-slate-600 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
