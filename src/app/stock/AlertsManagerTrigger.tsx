"use client";

import { useState } from "react";
import type { Bottle } from "@/lib/types";
import ManageAlertsModal from "./ManageAlertsModal";

export default function AlertsManagerTrigger({
  bottles,
  lowStockCount,
}: {
  bottles: Bottle[];
  lowStockCount: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="tap-target bg-paper-sunk border border-rule hover:border-terracotta/40 rounded-2xl px-3.5 py-2 text-center min-w-[110px] cursor-pointer transition-all group"
        title="Cliquer pour gérer ou supprimer les alertes"
      >
        <span className="text-[13px] uppercase tracking-caps text-ink-soft group-hover:text-ink block font-semibold transition-colors flex items-center justify-center gap-1">
          <span>À Commander</span>
          {lowStockCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />}
        </span>
        <span className="font-display text-[17px] font-bold text-ink mt-1 block">
          {lowStockCount} <span className="text-[13px] font-normal text-ink-soft">réf.</span>
        </span>
        <span className="text-[13px] text-terracotta opacity-0 group-hover:opacity-100 transition-opacity block -mt-0.5">
          🔔 Gérer / Supprimer
        </span>
      </button>

      <ManageAlertsModal
        bottles={bottles}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
