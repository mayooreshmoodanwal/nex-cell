"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, Clock, CheckCircle, XCircle, Upload } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }) };

export default function WalletClient({ walletData, paymentRequests }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amountInr: "", upiTransactionId: "", proofUrl: "" });
  const [submitting, setSubmitting] = useState(false);

  const balance = walletData?.wallet?.balanceMb ?? 0;
  const transactions = walletData?.transactions ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const csrfToken = document.cookie.split(";").find(c => c.trim().startsWith("csrf_token="))?.split("=")[1];
    try {
      const res = await fetch("/api/wallet/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ amountInr: Number(form.amountInr), upiTransactionId: form.upiTransactionId, proofUrl: form.proofUrl }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Payment request submitted for verification!");
      setShowForm(false);
      setForm({ amountInr: "", upiTransactionId: "", proofUrl: "" });
    } catch { toast.error("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { pending: "badge-amber", approved: "badge-green", rejected: "badge-red" };
    return <span className={map[status] ?? "badge-amber"}>{status}</span>;
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
        <h1 className="page-title">Wallet</h1>
        <p className="text-slate-400 mt-1">Your Mirai Bucks balance and transaction history</p>
      </motion.div>

      {/* Balance card */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #141B2D 0%, #0D1117 60%, #141B2D 100%)", border: "1px solid rgba(6,182,212,0.2)" }}>
          <div className="absolute inset-0 opacity-5" style={{ background: "radial-gradient(ellipse at top right, rgba(6,182,212,0.6) 0%, transparent 60%)" }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-cyan-400" />
              <span className="section-label">Total balance</span>
            </div>
            <div className="text-5xl font-black text-white mb-1" style={{ letterSpacing: "-0.02em" }}>
              <span className="text-cyan-400">₥</span>{balance.toLocaleString("en-IN")}
            </div>
            <p className="text-slate-400 text-sm">≈ ₹{(balance / 100).toFixed(2)} INR equivalent</p>
            <p className="text-slate-600 text-xs mt-1">1 INR = 100 Mirai Bucks (₥)</p>
            <button onClick={() => setShowForm(true)} className="btn-neon mt-5">
              <Plus className="w-4 h-4" /> Add Mirai Bucks
            </button>
          </div>
        </div>
      </motion.div>

      {/* Add MB form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" /> Submit payment request
          </h3>
          <p className="text-sm text-slate-400 mb-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
            Pay via UPI and submit the screenshot + transaction ID for verification by a treasurer.
            All payments require a screenshot proof.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Amount (INR) *</label>
              <input type="number" min="1" max="500" required value={form.amountInr}
                onChange={e => setForm(f => ({ ...f, amountInr: e.target.value }))}
                className="input-dark" placeholder="Enter amount in ₹ (max ₹500 per request)" />
              {form.amountInr && <p className="text-xs text-cyan-400 mt-1">= ₥{(Number(form.amountInr) * 100).toLocaleString()} Mirai Bucks</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">UPI Transaction ID *</label>
              <input type="text" required value={form.upiTransactionId}
                onChange={e => setForm(f => ({ ...f, upiTransactionId: e.target.value }))}
                className="input-dark" placeholder="e.g. 123456789012" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Payment screenshot URL *</label>
              <input type="url" required value={form.proofUrl}
                onChange={e => setForm(f => ({ ...f, proofUrl: e.target.value }))}
                className="input-dark" placeholder="Upload to Cloudinary and paste URL here" />
              <p className="text-xs text-slate-600 mt-1">Tip: Use /profile to upload images via our uploader</p>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-neon flex-1 disabled:opacity-50">{submitting ? "Submitting..." : "Submit request"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Transactions */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4">Transaction history</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No transactions yet</div>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-navy-800 transition-colors">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${tx.amountMb > 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {tx.amountMb > 0 ? <ArrowDownLeft className="w-4 h-4 text-green-400" /> : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{tx.description}</p>
                    <p className="text-xs text-slate-500">{format(new Date(tx.createdAt), "dd MMM yyyy, h:mm a")}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${tx.amountMb > 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.amountMb > 0 ? "+" : ""}₥{Math.abs(tx.amountMb).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Payment requests */}
      {paymentRequests.length > 0 && (
        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="glass-card p-5">
            <h2 className="font-semibold text-white mb-4">Payment requests</h2>
            <div className="space-y-3">
              {paymentRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-navy-800">
                  <div>
                    <p className="text-sm text-white">₹{req.amountInr} → ₥{req.amountMb.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">UPI: {req.upiTransactionId}</p>
                    <p className="text-xs text-slate-600">{formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</p>
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
