"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Bottle } from "@/lib/types";
import BottleGridCard from "./BottleGridCard";
import BottleListRow from "./BottleListRow";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

interface VipSecretSectionProps {
  vipBottles: Bottle[];
  viewMode?: "grid" | "list";
}

export default function VipSecretSection({
  vipBottles,
  viewMode = "grid",
}: VipSecretSectionProps) {
  const totalVipLiters = vipBottles.reduce(
    (acc, b) => acc + calculateBottleTotalLiters(b),
    0
  );

  if (vipBottles.length === 0) return null;

  return (
    <AnimatePresence>
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
                  Cuvées Prestige
                </span>
              </div>
              <p className="text-xs text-cream/70 mt-0.5">
                {vipBottles.length} cuvée(s) d&apos;exception •{" "}
                {formatLiters(totalVipLiters)} au total en cave secrète.
              </p>
            </div>
          </div>
        </div>

        {/* VIP Bottles Display */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vipBottles.map((bottle) => (
              <BottleGridCard key={bottle.id} bottle={bottle} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {vipBottles.map((bottle) => (
              <BottleListRow key={bottle.id} bottle={bottle} />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
