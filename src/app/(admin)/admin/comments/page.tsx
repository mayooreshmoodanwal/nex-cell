"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Check, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);

  const csrf = () =>
    document.cookie.split(";").find((c) => c.trim().startsWith("csrf_token="))?.split("=")[1];

  const fetchComments = () => {
    fetch("/api/admin/comments")
      .then((r) => r.json())
      .then((d) => { setComments(d.data ?? []); setLoading(false); });
  };

  useEffect(() => { fetchComments(); }, []);

  const moderate = async (id: string, action: "approve" | "reject", reason?: string) => {
    setActing(id + action);
    const res = await fetch(`/api/comments/${id}/moderate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
      body:    JSON.stringify({ action, reason }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); }
    else { toast.success(data.data?.message); fetchComments(); }
    setActing(null);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Comment moderation</h1>
        <p className="text-slate-400 mt-1">Review and approve pending comments</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="glass-card p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No pending comments</p>
              <p className="text-xs text-slate-600 mt-1">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">{comments.length} pending review</p>
              {comments.map((comment, i) => (
                <motion.div key={comment.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{comment.userName?.[0]?.toUpperCase() ?? "U"}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{comment.userName ?? "Unknown"}</p>
                          <p className="text-xs text-slate-500">
                            on <span className="text-cyan-400">{comment.eventTitle}</span> ·{" "}
                            {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : ""}
                          </p>
                        </div>
                      </div>
                      <span className="badge-amber flex-shrink-0">Pending</span>
                    </div>

                    <p className="text-sm text-slate-300 mb-4 p-3 rounded-lg bg-navy-900 border border-navy-700">
                      {comment.body}
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => moderate(comment.id, "approve")}
                        disabled={!!acting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {acting === comment.id + "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Reason for rejection (optional):");
                          moderate(comment.id, "reject", reason ?? undefined);
                        }}
                        disabled={!!acting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {acting === comment.id + "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}