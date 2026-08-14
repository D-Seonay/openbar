"use client";

import { useTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle } from "@/lib/types";
import { updateBottleThreshold, updateBottleQuantity } from "@/app/actions";
import BottlePreview from "./BottlePreview";
import { Button, Badge } from "@/components/ui";

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
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-paper border border-rule rounded-2xl p-5 sm:p-7 space-y-5 sm:space-y-6 max-h-[85dvh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-rule pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-paper-sunk border border-terracotta/30 flex items-center justify-center text-xl">
                🚨
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-[17px] sm:text-[27px] text-ink">
                  Alertes de Stock & Ruptures
                </h2>
                <p className="text-ink-soft text-[13px] hidden sm:block">
                  Gérez ou désactivez les alertes pour vos bouteilles sous seuil.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="tap-target shrink-0 rounded-full bg-paper-sunk hover:bg-rule text-ink-soft hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 pr-1">
            {alertedBottles.length === 0 ? (
              <div className="text-center py-12 bg-paper-sunk rounded-xl border border-dashed border-rule">
                <span className="text-4xl block mb-2">✨</span>
                <p className="text-ink font-bold">Aucune alerte active</p>
                <p className="text-ink-soft text-[13px] mt-1">
                  Toutes vos bouteilles sont au-dessus de leur seuil d&apos;alerte ou ont été désactivées.
                </p>
              </div>
            ) : (
              alertedBottles.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-paper-sunk border border-rule"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-12 flex items-center justify-center bg-paper rounded-lg p-1 border border-rule shrink-0">
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
                        <span className="font-display text-[15px] text-ink break-words">
                          {b.name}
                        </span>
                        {b.quantity === 0 ? (
                          <Badge ton="alerte">Épuisé</Badge>
                        ) : (
                          <Badge ton="alerte">{b.quantity} restant</Badge>
                        )}
                      </div>
                      <p className="text-[13px] text-ink-soft">
                        Seuil d&apos;alerte :{" "}
                        <strong className="text-ink">
                          {b.lowStockThreshold ?? 0.5}
                        </strong>{" "}
                        bouteille(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center shrink-0">
                    <Button
                      variant="discret"
                      onClick={() => handleQuickRestock(b.id)}
                      disabled={isPending}
                      className="text-[13px] px-3"
                      title="Ajouter 1 bouteille"
                    >
                      ⚡ +1
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleDismissAlert(b.id)}
                      disabled={isPending}
                      className="flex-1 sm:flex-none text-[13px] px-3"
                      title="Supprimer l'alerte pour cet article"
                    >
                      🔕 Supprimer l&apos;alerte
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-rule pt-4 pb-safe-0">
            {alertedBottles.length > 0 ? (
              <Button variant="danger" onClick={handleDismissAllAlerts} disabled={isPending}>
                🔕 Supprimer toutes les alertes ({alertedBottles.length})
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <Button variant="discret" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
