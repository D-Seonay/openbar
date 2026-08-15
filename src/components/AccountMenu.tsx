"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/session";

interface AccountMenuProps {
  session: SessionUser | null;
  avatarUrl: string | null;
}

export default function AccountMenu({ session, avatarUrl }: AccountMenuProps) {
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
          className="tap-target flex items-center gap-1.5 px-3 py-2 rounded-xl bg-paper-sunk hover:bg-terracotta/15 border border-rule hover:border-terracotta/40 text-[13px] font-semibold text-ink-soft hover:text-terracotta transition-all duration-200 whitespace-nowrap"
        >
          {/* Short labels below sm so the pair fits a 360px header. */}
          <span className="sm:hidden">Connexion</span>
          <span className="hidden sm:inline">Se connecter</span>
        </Link>
        <Link
          href="/signup"
          className="tap-target flex items-center gap-1.5 px-3 py-2 rounded-xl bg-terracotta/15 hover:bg-terracotta/25 border border-terracotta/40 text-[13px] font-semibold text-terracotta transition-all duration-200 whitespace-nowrap"
        >
          <span className="sm:hidden">S&apos;inscrire</span>
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
        className={`group relative flex items-center justify-center w-11 h-11 rounded-full border transition-all duration-200 cursor-pointer overflow-hidden ${
          isAdmin
            ? "border-terracotta/40 hover:border-terracotta"
            : "border-rule hover:border-terracotta/40"
        }`}
        title={isAdmin ? "Session Administrateur active" : "Session active"}
      >
        {isAdmin && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 z-10">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terracotta opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terracotta border border-paper"></span>
          </span>
        )}
        {avatarUrl ? (
          <img src={avatarUrl} alt={session.username} className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center w-full h-full bg-paper-sunk text-[13px] font-bold text-terracotta font-display">
            {session.username.slice(0, 2).toUpperCase()}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Portaled: the header sets `backdrop-blur`, which would otherwise
                make it the containing block for this fixed overlay and shrink
                the dismiss area to the header strip. Only ever rendered after a
                click, so `document` is always available here. */}
            {typeof document !== "undefined" &&
              createPortal(
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />,
                document.body
              )}

            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-paper border border-rule p-3 z-50 text-left font-sans"
            >
              <div className="px-2 py-1.5 border-b border-rule mb-2">
                <span className="text-[13px] uppercase tracking-caps text-terracotta block font-semibold">
                  {isAdmin ? "Privilèges Administrateur" : "Compte"}
                </span>
                <span className="text-[13px] font-semibold text-ink mt-0.5 block">
                  {session.username}
                </span>
              </div>

              <Link
                href="/profil"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between tap-target px-2.5 py-2.5 rounded-xl text-[15px] font-medium text-ink hover:bg-paper-sunk transition-colors w-full mb-1"
              >
                <span>Mon profil</span>
                <span className="text-terracotta">→</span>
              </Link>

              {isAdmin && (
                <>
                  <div className="px-2 py-1.5 border-t border-rule mt-1 mb-1">
                    <span className="text-[13px] uppercase tracking-caps text-terracotta block font-semibold">
                      Administration
                    </span>
                  </div>
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between tap-target px-2.5 py-2.5 rounded-xl text-[15px] font-medium text-ink hover:bg-paper-sunk transition-colors w-full"
                  >
                    <span>Tableau de bord</span>
                  </Link>
                  <Link
                    href="/comptes"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between tap-target px-2.5 py-2.5 rounded-xl text-[15px] font-medium text-ink hover:bg-paper-sunk transition-colors w-full"
                  >
                    <span>Comptes</span>
                  </Link>
                  <Link
                    href="/admin/bars"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between tap-target px-2.5 py-2.5 rounded-xl text-[15px] font-medium text-ink hover:bg-paper-sunk transition-colors w-full mb-1"
                  >
                    <span>Tous les bars</span>
                  </Link>
                </>
              )}

              <div className="border-t border-rule mt-1 pt-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleLogout}
                  className="tap-target flex items-center justify-between w-full px-2.5 py-2.5 rounded-xl text-[15px] font-medium text-terracotta hover:bg-terracotta/10 transition-colors cursor-pointer"
                >
                  <span>{isPending ? "Déconnexion..." : "Se déconnecter"}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
