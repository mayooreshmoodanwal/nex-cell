"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminConfigPage() {
  const [configs, setConfigs]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [edits, setEdits]       = useState<Record<string, string>>({});

  const csrf = () =>
    document.cookie.split(";").find((c) => c.trim().startsWith("csrf_token="))?.split("=")[1];

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((d) => {
        const list = d.data ?? [];
        setConfigs(list);
        const initial: Record<string, string> = {};
        list.forEach((c: any) => { initial[c.key] = c.value; });
        setEdits(initial);
        setLoading(false);
      });
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    const res = await fetch("/api/admin/config", {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
      body:    JSON.stringify({ key, value: edits[key] }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); }
    else { toast.success("Config updated successfully"); }
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Platform settings</h1>
        <p className="text-slate-400 mt-1">Configure platform behaviour without code changes</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {configs.map((config, i) => (
              <motion.div key={config.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="glass-card p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="text-sm font-medium text-white font-mono">{config.key}</p>
                      {config.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={edits[config.key] ?? config.value}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [config.key]: e.target.value }))}
                      className="input-dark flex-1 text-sm font-mono"
                    />
                    <button
                      onClick={() => handleSave(config.key)}
                      disabled={!!saving || edits[config.key] === config.value}
                      className="btn-neon px-4 disabled:opacity-50 flex-shrink-0"
                    >
                      {saving === config.key
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Save className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}