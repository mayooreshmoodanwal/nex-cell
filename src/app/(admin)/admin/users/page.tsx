"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Shield, Crown, User, Loader2, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  admin:       "badge-red",
  treasurer:   "badge-amber",
  member:      "badge-cyan",
  participant: "badge-gray",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin:       Crown,
  treasurer:   Shield,
  member:      User,
  participant: User,
};

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [acting, setActing]     = useState<string | null>(null);

  const csrf = () =>
    document.cookie.split(";").find((c) => c.trim().startsWith("csrf_token="))?.split("=")[1];

  useEffect(() => {
    fetch("/api/admin/users?limit=100")
      .then((r) => r.json())
      .then((d) => { setUsers(d.data ?? []); setLoading(false); });
  }, []);

  const handleRole = async (userId: string, role: string, action: "assign" | "revoke") => {
    setActing(userId + role);
    const res = await fetch("/api/users/role", {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
      body:    JSON.stringify({ userId, role, action }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); }
    else {
      toast.success(data.data?.message);
      // Refresh user list
      fetch("/api/admin/users?limit=100").then((r) => r.json()).then((d) => setUsers(d.data ?? []));
    }
    setActing(null);
  };

  const filtered = users.filter((u) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04 } }) };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Users</h1>
        <p className="text-slate-400 mt-1">Manage roles and view all registered users</p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..." className="input-dark pl-10" />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Roles</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4">Last login</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => (
                    <motion.tr key={user.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white">{user.email?.[0]?.toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{user.name ?? "—"}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.length > 0 ? user.roles.map((r: string) => (
                            <span key={r} className={`${ROLE_COLORS[r] ?? "badge-gray"} capitalize`}>{r}</span>
                          )) : <span className="badge-gray">participant</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-slate-500">
                          {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-slate-500">
                          {user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : "Never"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 flex-wrap">
                          {["member", "treasurer", "admin"].map((role) => {
                            const hasRole = user.roles?.includes(role);
                            const isActing = acting === user.id + role;
                            return (
                              <button key={role}
                                onClick={() => handleRole(user.id, role, hasRole ? "revoke" : "assign")}
                                disabled={!!acting}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all border disabled:opacity-50 ${
                                  hasRole
                                    ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20"
                                }`}
                              >
                                {isActing ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
                                {" "}{hasRole ? `Remove ${role}` : `Add ${role}`}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </motion.tr>
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