"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, LogOut, User, ChevronDown, Wallet } from "lucide-react";
import { toast } from "sonner";

interface NavbarUser { id: string; email: string; roles: string[]; }

export default function Navbar({ user }: { user: NavbarUser }) {
  const router = useRouter();
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Poll notification count every 30s
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications?limit=1");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.data?.unreadCount ?? 0);
        }
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const csrfToken = document.cookie
      .split(";").find((c) => c.trim().startsWith("csrf_token="))?.split("=")[1];
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
      });
    } finally {
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-navy-950/80 backdrop-blur-md border-b border-navy-800 flex items-center px-4 md:px-6 lg:px-8">
      <div className="flex items-center justify-between w-full">
        {/* Left — page breadcrumb placeholder */}
        <div className="hidden lg:block" />
        <div className="lg:hidden w-8" /> {/* Space for mobile menu button */}

        {/* Right — actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Wallet quick view */}
          <Link href="/wallet"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 transition-colors text-sm text-slate-300 hover:text-white"
          >
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium">Wallet</span>
          </Link>

          {/* Notifications */}
          <Link href="/notifications"
            className="relative p-2 rounded-lg hover:bg-navy-800 transition-colors text-slate-400 hover:text-white"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </Link>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-navy-800 border border-transparent hover:border-navy-700 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{user.email[0].toUpperCase()}</span>
              </div>
              <span className="hidden md:block text-sm font-medium text-slate-300 max-w-[120px] truncate">
                {user.email}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-navy-900 border border-navy-700 rounded-xl shadow-glass-lg z-20 overflow-hidden"
                  >
                    <div className="p-3 border-b border-navy-800">
                      <p className="text-xs font-medium text-white truncate">{user.email}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">
                        {user.roles.includes("admin") ? "Admin" :
                         user.roles.includes("treasurer") ? "Treasurer" :
                         user.roles.includes("member") ? "Member" : "Participant"}
                      </p>
                    </div>
                    <div className="p-1.5">
                      <Link href="/profile" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-navy-800 transition-colors">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
