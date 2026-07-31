"use client";

import { useTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle } from "@/lib/types";
import { updateBottleThreshold, updateBottleQuantity } from "@/app/actions";
import BottlePreview from "./BottlePreview";

interface ManageAlertsModalProps {
  bottles: Bottle[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ManageAlertsModal({
  bottles,
  isOpen,
  onClose,
}: ManageAlertsModalProps) {
  const [isPending, startTransition] = useTransition();

  const alertedBottles = bottles.filter((b) => {
    const threshold = b.lowStockThreshold ?? 0.5;
    return threshold > 0 && b.quantity <= threshold;
  });

  const handleDismissAlert = (id: string) => {
    startTransition(() => {
      // Set threshold to 0 so it no longer triggers an alert
      updateBottleThreshold(id, 0);
    });
  };

  const handleDismissAllAlerts = () => {
    startTransition(() => {
      alertedBottles.forEach((b) => {
        updateBottleThreshold(b.id, 0);
      });
    });
  };

  const handleQuickRestock = (id: string) => {
    startTransition(() => {
      updateBottleQuantity(id, 1);
    });
  };

  if (!isOpen) return null;

  // Portaled to <body> to escape the `relative z-10` stacking context of
  // <main>, which would otherwise keep this modal underneath the sticky header.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/85 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-ink-2/95 border border-white/[0.09] rounded-2xl p-5 sm:p-7 shadow-2xl box-orange-glow space-y-5 sm:space-y-6 max-h-[85dvh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-xl">
                🚨
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg sm:text-2xl font-bold text-cream">
                  Alertes de Stock & Ruptures
                </h2>
                <p className="text-muted text-xs hidden sm:block">
                  Gérez ou désactivez les alertes pour vos bouteilles sous seuil.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-10 h-10 shrink-0 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-muted hover:text-cream flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 pr-1 scrollbar-thin">
            {alertedBottles.length === 0 ? (
              <div className="text-center py-12 bg-ink/40 rounded-xl border border-dashed border-white/[0.08]">
                <span className="text-4xl block mb-2">✨</span>
                <p className="text-cream font-bold">Aucune alerte active</p>
                <p className="text-muted text-xs mt-1">
                  Toutes vos bouteilles sont au-dessus de leur seuil d&apos;alerte ou ont été désactivées.
                </p>
              </div>
            ) : (
              alertedBottles.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-ink/70 border border-white/[0.07]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-12 flex items-center justify-center bg-ink rounded-lg p-1 border border-white/[0.08] shrink-0">
                      {b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt={b.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <BottlePreview
                          type={b.type}
                          quantity={b.quantity}
                          vip={b.vip}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold text-cream break-words">
                          {b.name}
                        </span>
                        {b.quantity === 0 ? (
                          <span className="text-[10px] bg-red-600/30 border border-red-500/40 text-red-300 px-2 py-0.5 rounded font-bold">
                            Épuisé
                          </span>
                        ) : (
                          <span className="text-[10px] bg-orange/20 border border-orange/30 text-orange px-2 py-0.5 rounded font-bold">
                            {b.quantity} restant
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted">
                        Seuil d&apos;alerte :{" "}
                        <strong className="text-cream">
                          {b.lowStockThreshold ?? 0.5}
                        </strong>{" "}
                        bouteille(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center shrink-0">
                    <button
                      onClick={() => handleQuickRestock(b.id)}
                      disabled={isPending}
                      className="tap-target-sm flex items-center justify-center text-xs px-3 py-1.5 rounded-lg bg-orange/15 hover:bg-orange text-orange hover:text-ink font-semibold border border-orange/30 transition-all cursor-pointer"
                      title="Ajouter 1 bouteille"
                    >
                      ⚡ +1
                    </button>
                    <button
                      onClick={() => handleDismissAlert(b.id)}
                      disabled={isPending}
                      className="tap-target-sm flex-1 sm:flex-none flex items-center justify-center text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-red-500/20 text-muted hover:text-red-400 border border-white/[0.08] hover:border-red-500/30 font-medium transition-all cursor-pointer"
                      title="Supprimer l'alerte pour cet article"
                    >
                      🔕 Supprimer l&apos;alerte
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-white/[0.08] pt-4 pb-safe-0">
            {alertedBottles.length > 0 ? (
              <button
                onClick={handleDismissAllAlerts}
                disabled={isPending}
                className="tap-target flex items-center justify-center text-xs px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold transition-all cursor-pointer"
              >
                🔕 Supprimer toutes les alertes ({alertedBottles.length})
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <button
              onClick={onClose}
              className="tap-target flex items-center justify-center text-xs px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-cream font-semibold transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
