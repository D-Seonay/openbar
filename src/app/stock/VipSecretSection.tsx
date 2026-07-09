"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle } from "@/lib/types";
import { verifyVipPassword } from "@/app/actions";
import BottleGridCard from "./BottleGridCard";
import BottleListRow from "./BottleListRow";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

interface VipSecretSectionProps {
  vipBottles: Bottle[];
  isAdmin: boolean;
  viewMode?: "grid" | "list";
  externalModalTrigger?: boolean;
  onResetExternalTrigger?: () => void;
}

export default function VipSecretSection({
  vipBottles,
  isAdmin,
  viewMode = "grid",
  externalModalTrigger = false,
  onResetExternalTrigger,
}: VipSecretSectionProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [keyBuffer, setKeyBuffer] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalVipLiters = vipBottles.reduce(
    (acc, b) => acc + calculateBottleTotalLiters(b),
    0
  );

  // Listen for external trigger (e.g. mobile triple tap on header title)
  useEffect(() => {
    if (externalModalTrigger) {
      setError(false);
      setPassword("");
      setModalOpen(true);
      if (onResetExternalTrigger) onResetExternalTrigger();
    }
  }, [externalModalTrigger, onResetExternalTrigger]);

  // Global Keyboard Listener for 'v' -> 'i' -> 'p' sequence
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore keystrokes inside existing input fields
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const char = e.key.toLowerCase();
    if (char.length === 1 && char >= "a" && char <= "z") {
      setKeyBuffer((prev) => {
        const next = (prev + char).slice(-3);
        if (next === "vip") {
          setError(false);
          setPassword("");
          setModalOpen(true);
          return "";
        }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (vipBottles.length === 0) return null;

  return (
    <>
      {/* Once Unlocked: Reveal the VIP Section */}
      <AnimatePresence>
        {unlocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 space-y-6 border-t border-gold/30 pt-8"
          >
            {/* VIP Section Title Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ink-2 via-ink to-ink-2 border border-gold/40 shadow-2xl box-gold-glow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-2xl shrink-0">
                  🍾
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-gold tracking-tight">
                      Réserve Privée VIP
                    </h2>
                    <span className="text-[10px] uppercase tracking-caps bg-gold/20 border border-gold/40 text-gold font-bold px-2.5 py-0.5 rounded-full">
                      Cuvées Prestige • Déverrouillé
                    </span>
                  </div>
                  <p className="text-xs text-cream/70 mt-0.5">
                    {vipBottles.length} cuvée(s) d&apos;exception •{" "}
                    {formatLiters(totalVipLiters)} au total en cave secrète.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setUnlocked(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-muted hover:text-cream text-xs font-semibold border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🔒</span>
                <span>Masquer & Verrouiller</span>
              </button>
            </div>

            {/* Unlocked VIP Bottles Display */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vipBottles.map((bottle) => (
                  <BottleGridCard key={bottle.id} bottle={bottle} isAdmin={isAdmin} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {vipBottles.map((bottle) => (
                  <BottleListRow key={bottle.id} bottle={bottle} isAdmin={isAdmin} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secret Password Modal triggered by 'v-i-p' or mobile triple tap */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-ink-2/95 border border-gold/40 rounded-2xl p-6 sm:p-7 shadow-2xl box-gold-glow space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-gold/20 pb-4">
                <span className="w-11 h-11 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-xl shrink-0">
                  🗝️
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold text-gold">
                      Réserve Privée VIP
                    </h3>
                    <span className="text-[10px] uppercase font-bold bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                      Secret
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Séquence VIP détectée. Saisissez le mot de passe secret.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(false);
                  startTransition(async () => {
                    const ok = await verifyVipPassword(password);
                    if (ok) {
                      setUnlocked(true);
                      setModalOpen(false);
                      setPassword("");
                    } else {
                      setError(true);
                    }
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Mot de passe VIP (indice : vipnoa)..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-ink border border-gold/30 rounded-xl px-4 py-3 text-sm text-cream placeholder:text-muted/50 focus:outline-none focus:border-gold focus:bg-ink/80 text-center tracking-widest font-mono"
                  />
                  {error && (
                    <p className="text-red-400 text-xs font-semibold mt-2 text-center">
                      ❌ Mot de passe incorrect. Réessayez.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-cream transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !password.trim()}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-gold to-orange text-ink shadow-lg shadow-gold/20 hover:opacity-95 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isPending ? "Vérification..." : "Déverrouiller 🔓"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
