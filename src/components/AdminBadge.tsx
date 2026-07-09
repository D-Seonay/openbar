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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-orange/15 border border-white/[0.08] hover:border-orange/40 text-xs font-semibold text-muted hover:text-orange transition-all duration-200"
        title="Se connecter en tant qu'administrateur"
      >
        <span>🔒</span>
        <span className="hidden sm:inline">Connexion Admin</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400 text-xs font-bold text-emerald-300 shadow-sm shadow-emerald-950/50 transition-all duration-200 cursor-pointer"
        title="Session Administrateur active"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-sm">👑</span>
        <span className="tracking-wide">Mode Admin</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop for closing */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            {/* Floating popover */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2.5 w-72 z-50 bg-ink-2/95 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl space-y-3.5"
            >
              <div className="flex items-start gap-3 border-b border-white/[0.08] pb-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                  👑
                </span>
                <div>
                  <h4 className="font-display text-sm font-bold text-cream">
                    Administrateur Connecté
                  </h4>
                  <p className="text-[11px] text-emerald-300/90 mt-0.5 font-medium">
                    Accès complet & édition déverrouillés
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Modification des stocks & rayons</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Création de cocktails & soirées</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Gestion des seuils d&apos;alerte</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <span>🔒</span>
                <span>{isPending ? "Déconnexion..." : "Verrouiller le bar (Déconnexion)"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
