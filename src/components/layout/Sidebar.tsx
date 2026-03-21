"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Calendar, Archive, Wallet,
  Bell, User, Settings, Shield, Users,
  FileText, DollarSign, Menu, X,
} from "lucide-react";
import { useState } from "react";

interface SidebarUser {
  id:     string;
  email:  string;
  roles:  string[];
}

const NAV_ITEMS = [
  {
    group: "Main",
    items: [
      { href: "/dashboard",      icon: LayoutDashboard, label: "Dashboard",     roles: [] },
      { href: "/events",         icon: Calendar,         label: "Events",       roles: [] },
      { href: "/archive",        icon: Archive,          label: "Archive",      roles: [] },
      { href: "/wallet",         icon: Wallet,           label: "Wallet",       roles: [] },
      { href: "/notifications",  icon: Bell,             label: "Notifications",roles: [] },
    ],
  },
  {
    group: "Treasurer",
    items: [
      { href: "/admin/treasurer",icon: DollarSign,       label: "Finances",     roles: ["treasurer", "admin"] },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/admin",          icon: Shield,           label: "Admin Panel",  roles: ["admin"] },
      { href: "/admin/users",    icon: Users,            label: "Users",        roles: ["admin"] },
      { href: "/admin/comments", icon: FileText,         label: "Comments",     roles: ["admin"] },
      { href: "/admin/audit-logs",icon: FileText,        label: "Audit Logs",   roles: ["admin"] },
    ],
  },
  {
    group: "Account",
    items: [
      { href: "/profile",        icon: User,             label: "Profile",      roles: [] },
      { href: "/admin/config",   icon: Settings,         label: "Settings",     roles: ["admin"] },
    ],
  },
];

function hasAccess(userRoles: string[], requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some((r) => userRoles.includes(r));
}

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-navy-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <circle cx="10" cy="38" r="7" fill="url(#sg1)" />
            <circle cx="38" cy="10" r="6" fill="url(#sg2)" />
            <path d="M10 38 C10 24 24 14 38 10" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
            <defs>
              <radialGradient id="sg1"><stop stopColor="#22D3EE" /><stop offset="1" stopColor="#0EA5E9" /></radialGradient>
              <radialGradient id="sg2"><stop stopColor="#06B6D4" /><stop offset="1" stopColor="#0284C7" /></radialGradient>
            </defs>
          </svg>
          <div>
            <span className="text-lg font-black text-white">Nex<span className="gradient-text">Cell</span></span>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest -mt-0.5">Platform</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            hasAccess(user.roles, item.roles)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group}>
              <p className="section-label px-3 mb-2">{group.group}</p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon      = item.icon;
                  const isActive  = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                        ${isActive
                          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
                          : "text-slate-400 hover:text-white hover:bg-navy-800"
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-cyan-400" : ""}`} />
                      {item.label}
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-navy-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {user.email[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
            <p className="text-xs text-slate-500 capitalize">
              {user.roles.includes("admin") ? "Admin" :
               user.roles.includes("treasurer") ? "Treasurer" :
               user.roles.includes("member") ? "Member" : "Participant"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-navy-900 border-r border-navy-800 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-navy-900 border border-navy-800 text-white"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="lg:hidden fixed inset-0 z-50 flex"
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <motion.aside
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-64 h-full bg-navy-900 border-r border-navy-800 z-10"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </motion.aside>
        </motion.div>
      )}
    </>
  );
}
