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
      <div
        onClick={() => setModalOpen(true)}
        className="bg-ink/80 border border-white/[0.08] hover:border-orange/40 rounded-2xl p-3.5 text-center min-w-[110px] cursor-pointer transition-all group box-orange-glow-hover"
        title="Cliquer pour gérer ou supprimer les alertes"
      >
        <span className="text-[10px] uppercase tracking-caps text-muted group-hover:text-cream block font-semibold transition-colors flex items-center justify-center gap-1">
          <span>À Commander</span>
          {lowStockCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />}
        </span>
        <span className="font-display text-2xl font-bold text-cream mt-1 block">
          {lowStockCount} <span className="text-xs font-normal text-muted">réf.</span>
        </span>
        <span className="text-[9px] text-orange opacity-0 group-hover:opacity-100 transition-opacity block -mt-0.5">
          🔔 Gérer / Supprimer
        </span>
      </div>

      <ManageAlertsModal
        bottles={bottles}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
