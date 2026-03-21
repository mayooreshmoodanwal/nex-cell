"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, Check, X, Loader2, Receipt, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function TreasurerPage() {
  const [requests, setRequests]   = useState<any[]>([]);
  const [expenses, setExpenses]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<string | null>(null);
  const [tab, setTab]             = useState<"payments" | "expenses">("payments");

  const csrf = () =>
    document.cookie.split(";").find((c) => c.trim().startsWith("csrf_token="))?.split("=")[1];

  const fetchAll = async () => {
    const [pr, ex] = await Promise.all([
      fetch("/api/treasurer/payment-requests").then((r) => r.json()),
      fetch("/api/treasurer/expenses").then((r) => r.json()),
    ]);
    setRequests(pr.data ?? []);
    setExpenses(ex.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const approvePayment = async (id: string) => {
    setActing("approve" + id);
    const res = await fetch(`/api/treasurer/payment-requests/${id}/approve`, {
      method: "POST",
      headers: { ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); } else { toast.success("Payment approved — wallet credited!"); fetchAll(); }
    setActing(null);
  };

  const rejectPayment = async (id: string) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    setActing("reject" + id);
    const res = await fetch(`/api/treasurer/payment-requests/${id}/reject`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
      body:    JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); } else { toast.success("Payment rejected."); fetchAll(); }
    setActing(null);
  };

  const approveExpense = async (id: string) => {
    setActing("approveE" + id);
    const res = await fetch(`/api/treasurer/expenses/${id}/approve`, {
      method: "POST",
      headers: { ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); } else { toast.success("Expense approved."); fetchAll(); }
    setActing(null);
  };

  const markRepaid = async (id: string) => {
    setActing("repaid" + id);
    const res = await fetch(`/api/treasurer/expenses/${id}/repaid`, {
      method: "POST",
      headers: { ...(csrf() ? { "x-csrf-token": csrf()! } : {}) },
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); } else { toast.success("Expense marked as repaid."); fetchAll(); }
    setActing(null);
  };

  const pendingPayments = requests.filter((r) => r.status === "pending");
  const pendingExpenses = expenses.filter((e) => e.status === "approved"); // approved but not repaid

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Financial panel</h1>
        <p className="text-slate-400 mt-1">Manage payment requests and expense reimbursements</p>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending payments", value: pendingPayments.length, color: "text-amber-400" },
          { label: "Total requests", value: requests.length, color: "text-cyan-400" },
          { label: "Awaiting repayment", value: pendingExpenses.length, color: "text-purple-400" },
          { label: "Total expenses", value: expenses.length, color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className={`text-2xl font-bold ${s.color} tabular-nums`}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["payments", "expenses"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${tab === t ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-navy-800 text-slate-400 hover:text-white border border-navy-700"}`}>
            {t === "payments" ? `Payment requests (${pendingPayments.length} pending)` : `Expenses (${pendingExpenses.length} to repay)`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
      ) : tab === "payments" ? (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="glass-card p-10 text-center text-slate-500">No payment requests yet</div>
          ) : requests.map((req) => (
            <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="glass-card p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium text-white">{req.userEmail ?? req.userName}</p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      ₹{req.amountInr} → <span className="text-cyan-400 font-medium">₥{req.amountMb?.toLocaleString()}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">UPI ID: <span className="font-mono text-slate-400">{req.upiTransactionId}</span></p>
                    <p className="text-xs text-slate-600">{req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={req.status === "pending" ? "badge-amber" : req.status === "approved" ? "badge-green" : "badge-red"}>
                      {req.status}
                    </span>
                    {req.proofUrl && (
                      <a href={req.proofUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                        <Receipt className="w-3 h-3" /> View proof
                      </a>
                    )}
                  </div>
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-3 pt-2 border-t border-navy-700">
                    <button onClick={() => approvePayment(req.id)} disabled={!!acting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 text-sm font-medium transition-all disabled:opacity-50">
                      {acting === "approve" + req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve & credit wallet
                    </button>
                    <button onClick={() => rejectPayment(req.id)} disabled={!!acting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm font-medium transition-all disabled:opacity-50">
                      {acting === "reject" + req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="glass-card p-10 text-center text-slate-500">No expense requests yet</div>
          ) : expenses.map((exp) => (
            <motion.div key={exp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="glass-card p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium text-white">{exp.userEmail ?? exp.userName}</p>
                    <p className="text-sm text-cyan-400 font-medium mt-0.5">₹{exp.amountInr}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{exp.description}</p>
                    <p className="text-xs text-slate-600">{exp.createdAt ? formatDistanceToNow(new Date(exp.createdAt), { addSuffix: true }) : ""}</p>
                  </div>
                  <span className={
                    exp.status === "pending"  ? "badge-amber" :
                    exp.status === "approved" ? "badge-cyan"  :
                    exp.status === "repaid"   ? "badge-green" : "badge-red"
                  }>{exp.status}</span>
                </div>
                <div className="flex gap-3 pt-2 border-t border-navy-700">
                  {exp.status === "pending" && (
                    <button onClick={() => approveExpense(exp.id)} disabled={!!acting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 text-sm font-medium transition-all disabled:opacity-50">
                      {acting === "approveE" + exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                  )}
                  {exp.status === "approved" && (
                    <button onClick={() => markRepaid(exp.id)} disabled={!!acting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 text-sm font-medium transition-all disabled:opacity-50">
                      {acting === "repaid" + exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Mark as repaid
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}