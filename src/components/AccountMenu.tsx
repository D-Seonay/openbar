"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/session";

interface AccountMenuProps {
  session: SessionUser | null;
}

export default function AccountMenu({ session }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(() => {
      logout();
    });
  };

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-orange/15 border border-white/[0.08] hover:border-orange/40 text-xs font-semibold text-muted hover:text-orange transition-all duration-200"
        >
          <span className="hidden sm:inline">Se connecter</span>
        </Link>
        <Link
          href="/signup"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-xs font-semibold text-orange transition-all duration-200"
        >
          <span className="hidden sm:inline">Créer un compte</span>
        </Link>
      </div>
    );
  }

  const isAdmin = session.role === "ADMIN";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer ${
          isAdmin
            ? "bg-gradient-to-r from-orange/20 to-gold/15 border-orange/40 hover:border-orange text-cream"
            : "bg-white/[0.04] border-white/[0.08] hover:border-orange/40 text-muted hover:text-cream"
        }`}
        title={isAdmin ? "Session Administrateur active" : "Session active"}
      >
        {isAdmin && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange"></span>
          </span>
        )}
        <span className="tracking-wide">{isAdmin ? "Mode Admin" : session.username}</span>
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
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-ink-2/95 backdrop-blur-xl border border-white/[0.1] p-3 shadow-2xl z-50 text-left font-sans"
            >
              <div className="px-2 py-1.5 border-b border-white/[0.08] mb-2">
                <span className="text-[10px] uppercase tracking-caps text-gold block font-semibold">
                  {isAdmin ? "Privilèges Administrateur" : "Compte"}
                </span>
                <span className="text-xs font-semibold text-cream mt-0.5 block">
                  {session.username}
                </span>
              </div>

              <Link
                href="/profil"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-cream hover:bg-white/[0.06] transition-colors w-full"
              >
                <span>Mon profil</span>
                <span className="text-orange">→</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/comptes"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-cream hover:bg-white/[0.06] transition-colors w-full"
                >
                  <span>Gestion des comptes</span>
                  <span className="text-orange">→</span>
                </Link>
              )}

              <button
                type="button"
                disabled={isPending}
                onClick={handleLogout}
                className="mt-1 flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <span>{isPending ? "Déconnexion..." : "Se déconnecter"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
