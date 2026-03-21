"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Save, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const csrf = () => document.cookie.split(";").find(c => c.trim().startsWith("csrf_token="))?.split("=")[1];

  useEffect(() => {
    fetch("/api/users/me").then(r => r.json()).then(d => { setProfile(d.data); setName(d.data?.name ?? ""); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH", headers: { "Content-Type": "application/json", ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
      body: JSON.stringify({ name }),
    });
    if (res.ok) toast.success("Profile updated!"); else toast.error("Failed to update");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure? This will permanently delete your account.")) return;
    setDeleting(true);
    await fetch("/api/users/me", { method: "DELETE", headers: { ...(csrf() ? { "x-csrf-token": csrf()! } : {}) } });
    toast.success("Account deleted");
    router.push("/login");
  };

  if (!profile) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="page-title">Profile</h1>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-2xl font-black text-white">{profile.email?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="font-semibold text-white">{profile.name || "No name set"}</p>
            <p className="text-sm text-slate-400">{profile.email}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {profile.roles?.map((r: string) => (
                <span key={r} className="badge-cyan text-[10px] capitalize">{r}</span>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Display name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-dark" placeholder="Your name" />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-neon w-full disabled:opacity-50">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save changes</>}
        </button>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-5 border border-red-500/10">
        <h3 className="font-medium text-red-400 mb-2">Danger zone</h3>
        <p className="text-xs text-slate-500 mb-3">Once deleted, your account cannot be recovered. Your wallet and event history will be anonymised.</p>
        <button onClick={handleDelete} disabled={deleting} className="btn-danger">
          {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete my account</>}
        </button>
      </motion.div>
    </div>
  );
}
