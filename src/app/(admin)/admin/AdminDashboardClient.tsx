"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Users, Calendar, FileText, DollarSign, ArrowRight, Shield, Settings, BookOpen } from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }) };

export default function AdminDashboardClient({ stats }: { stats: any }) {
  const statCards = [
    { label: "Total users",         value: stats.users,         icon: Users,    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Total events",        value: stats.events,        icon: Calendar, color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: "Registrations",       value: stats.registrations, icon: FileText, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
    { label: "₥ in circulation",    value: `₥${stats.totalMb.toLocaleString()}`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  ];

  const quickLinks = [
    { href: "/admin/users",      icon: Users,     label: "Manage users",       desc: "View, assign roles, credit wallets" },
    { href: "/admin/comments",   icon: FileText,  label: "Comment moderation", desc: "Approve or reject pending comments" },
    { href: "/admin/treasurer",  icon: DollarSign,label: "Financial panel",    desc: "Payment requests and expenses" },
    { href: "/admin/audit-logs", icon: Shield,    label: "Audit logs",         desc: "Full action history" },
    { href: "/admin/config",     icon: Settings,  label: "Platform settings",  desc: "Config, limits, toggles" },
  ];

  return (
    <div className="space-y-8">
      <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="page-title">Admin dashboard</h1>
        </div>
        <p className="text-slate-400">Full platform control and oversight</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} custom={i + 1} initial="hidden" animate="visible" variants={fadeUp}>
              <div className="glass-card p-5">
                <div className={`inline-flex p-2.5 rounded-xl border mb-3 ${s.bg}`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">{s.value}</div>
                <div className="text-sm text-slate-400 mt-0.5">{s.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div custom={5} initial="hidden" animate="visible" variants={fadeUp}>
        <h2 className="section-label mb-4">Quick access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link, i) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <div className="glass-card-hover p-5 cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-navy-800 border border-navy-700">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="font-medium text-white text-sm">{link.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
