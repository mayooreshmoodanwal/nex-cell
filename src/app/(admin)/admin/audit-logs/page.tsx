"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

const ACTION_COLORS: Record<string, string> = {
  WALLET_CREDITED:           "badge-green",
  WALLET_DEBITED:            "badge-red",
  PAYMENT_REQUEST_APPROVED:  "badge-green",
  PAYMENT_REQUEST_REJECTED:  "badge-red",
  PAYMENT_REQUEST_CREATED:   "badge-cyan",
  ROLE_ASSIGNED:             "badge-purple",
  ROLE_REVOKED:              "badge-amber",
  USER_LOGIN:                "badge-cyan",
  USER_CREATED:              "badge-green",
  USER_DELETED:              "badge-red",
  EVENT_CREATED:             "badge-cyan",
  EVENT_UPDATED:             "badge-amber",
  EVENT_DELETED:             "badge-red",
  EXPENSE_APPROVED:          "badge-green",
  EXPENSE_REJECTED:          "badge-red",
  EXPENSE_REPAID:            "badge-green",
  CONFIG_UPDATED:            "badge-purple",
  COMMENT_APPROVED:          "badge-green",
  COMMENT_REJECTED:          "badge-red",
};

export default function AuditLogsPage() {
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    fetch("/api/admin/audit-logs?limit=100")
      .then((r) => r.json())
      .then((d) => { setLogs(d.data ?? []); setLoading(false); });
  }, []);

  const filtered = logs.filter((l) =>
    !search ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entityType?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Audit logs</h1>
        <p className="text-slate-400 mt-1">Append-only record of every significant action</p>
      </motion.div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by action or entity..." className="input-dark pl-10" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No audit logs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Entity</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => (
                    <tr key={log.id}>
                      <td className="p-4">
                        <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                          {log.createdAt ? format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss") : "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`${ACTION_COLORS[log.action] ?? "badge-gray"} text-xs font-mono`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-sm text-slate-300 capitalize">{log.entityType}</p>
                          {log.entityId && (
                            <p className="text-xs text-slate-600 font-mono">{log.entityId.slice(0, 8)}…</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-slate-500 font-mono">
                          {log.actorId ? log.actorId.slice(0, 8) + "…" : "System"}
                        </span>
                      </td>
                      <td className="p-4">
                        {log.newValue && (
                          <pre className="text-xs text-slate-500 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                            {JSON.stringify(log.newValue)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}