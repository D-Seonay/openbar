"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { logout } from "@/app/login/actions";

interface AdminBadgeProps {
  isAdmin: boolean;
}

export default function AdminBadge({ isAdmin }: AdminBadgeProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(() => {
      logout();
    });
  };

  if (!isAdmin) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono font-medium text-zinc-400 hover:text-zinc-100 transition-all duration-200"
        title="Accès système administrateur"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        <span className="hidden sm:inline tracking-wider">LOGIN_SYS</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] font-mono font-bold text-zinc-200 transition-all duration-200 cursor-pointer"
        title="Session Administrateur active"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
        </span>
        <span className="tracking-wider">SYS_ADMIN</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 p-3 shadow-2xl z-50 text-left font-sans"
            >
              <div className="px-2 py-1.5 border-b border-zinc-800/80 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">
                  SYSTEM STATUS
                </span>
                <span className="text-xs font-semibold text-zinc-100 mt-0.5 block">
                  Session Privilégiée Active
                </span>
              </div>

              <Link
                href="/comptes"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors w-full"
              >
                <span>Gestion des comptes</span>
                <span className="font-mono text-[10px] text-zinc-500">→</span>
              </Link>

              <button
                type="button"
                disabled={isPending}
                onClick={handleLogout}
                className="mt-1 flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <span>{isPending ? "Déconnexion..." : "Fermer session"}</span>
                <span className="font-mono text-[10px]">ESC</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
