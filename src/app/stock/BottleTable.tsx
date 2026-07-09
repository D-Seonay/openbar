"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle } from "@/lib/types";
import BottleListRow from "./BottleListRow";
import BottleGridCard from "./BottleGridCard";
import VipSecretSection from "./VipSecretSection";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

const GROCERY_AISLES = [
  { id: "", label: "🛒 Tous les rayons" },
  { id: "whisky", label: "🥃 Whiskies" },
  { id: "rhum", label: "🏴‍☠️ Rhums" },
  { id: "gin", label: "🍸 Gins" },
  { id: "vodka", label: "❄️ Vodkas" },
  { id: "tequila", label: "🌵 Tequilas" },
  { id: "liqueur", label: "✨ Liqueurs & Apéritifs" },
  { id: "vin", label: "🍷 Vins" },
  { id: "champagne", label: "🍾 Bulles & Champagnes" },
  { id: "biere", label: "🍺 Bières" },
  { id: "mixer", label: "🍋 Softs & Mixers" },
  { id: "autre", label: "📦 Autres" },
] as const;

export default function BottleTable({
  title,
  bottles,
  empty,
  bare,
  isAdmin = false,
}: {
  title?: string;
  bottles: Bottle[];
  empty: string;
  bare?: boolean;
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedAisle, setSelectedAisle] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [externalTrigger, setExternalTrigger] = useState(false);

  const handleSecretHeaderTap = () => {
    setSecretTapCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setExternalTrigger(true);
        return 0;
      }
      return next;
    });
  };

  const regularBottles = useMemo(() => bottles.filter((b) => !b.vip), [bottles]);
  const vipBottles = useMemo(() => bottles.filter((b) => b.vip), [bottles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regularBottles.filter((b) => {
      const matchesQuery =
        !q || b.name.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q));
      const matchesType = !selectedAisle || b.type === selectedAisle;
      return matchesQuery && matchesType;
    });
  }, [regularBottles, query, selectedAisle]);

  const totalFilteredLiters = useMemo(() => {
    return filtered.reduce((acc, b) => acc + calculateBottleTotalLiters(b), 0);
  }, [filtered]);

  const totalFilteredBottles = useMemo(() => {
    return filtered.reduce((acc, b) => acc + (b.quantity || 0), 0);
  }, [filtered]);

  const content =
    filtered.length === 0 ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-14 rounded-2xl border border-dashed border-white/[0.1] bg-ink-2/30"
      >
        <span className="text-4xl block mb-2">🏷️</span>
        <p className="text-cream font-medium text-base">Rayon vide</p>
        <p className="text-muted text-xs mt-1">
          {bottles.length === 0 ? empty : "Aucun article ne correspond à votre recherche dans ce rayon."}
        </p>
      </motion.div>
    ) : (
      <div className="space-y-4">
        {/* Market Aisle Header Bar with View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-4 py-3 rounded-xl bg-ink-2/70 border border-white/[0.08] text-cream uppercase tracking-caps font-semibold">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange" />
              Rayon sélectionné : {filtered.length} article{filtered.length > 1 ? "s" : ""}
            </span>
            <span className="text-muted/40 hidden sm:inline">•</span>
            <span className="text-muted">
              Volume total :{" "}
              <strong className="text-orange font-display text-base tracking-normal">
                {formatLiters(totalFilteredLiters)}
              </strong>{" "}
              <span className="text-[11px] font-mono text-muted/80">({totalFilteredBottles} btl)</span>
            </span>
          </div>

          {/* View Mode Toggle: Grid vs List */}
          <div className="flex items-center gap-1 bg-ink/80 p-1 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-orange text-ink font-bold shadow-sm"
                  : "text-muted hover:text-cream"
              }`}
              title="Affichage en Grille (Étalage Marché)"
            >
              <span>⊞</span>
              <span>Grille</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-orange text-ink font-bold shadow-sm"
                  : "text-muted hover:text-cream"
              }`}
              title="Affichage en Liste (Rayon Lignes)"
            >
              <span>☰</span>
              <span>Liste</span>
            </button>
          </div>
        </div>

        {/* Shelf items list or grid */}
        <AnimatePresence mode="popLayout">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((b, idx) => (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(idx * 0.04, 0.25),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <BottleGridCard bottle={b} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((b, idx) => (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(idx * 0.04, 0.25),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <BottleListRow bottle={b} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    );

  const body = (
    <div className="space-y-5">
      {bottles.length > 0 && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit, une marque, un arôme dans les rayons..."
              className="w-full bg-ink-2/80 border border-white/[0.1] rounded-xl px-4 py-3 pl-11 text-sm placeholder:text-muted/50 focus:outline-none focus:border-orange focus:bg-ink-2 transition-all duration-300 text-cream shadow-sm"
            />
            <span className="absolute left-4 top-3.5 text-muted/70 text-sm">🔍</span>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-3 text-xs text-muted hover:text-cream bg-white/[0.06] px-2 py-0.5 rounded"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Grocery Category Aisles Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {GROCERY_AISLES.map((aisle) => {
              const active = selectedAisle === aisle.id;
              return (
                <button
                  key={aisle.id}
                  onClick={() => setSelectedAisle(aisle.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-orange text-ink font-bold shadow-md box-orange-glow"
                      : "bg-ink-2/60 border border-white/[0.07] text-muted hover:text-cream hover:border-white/[0.15]"
                  }`}
                >
                  {aisle.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {content}

      {/* Secret VIP Prestige Section protected by extra password & v-i-p sequence */}
      <VipSecretSection
        vipBottles={vipBottles}
        isAdmin={isAdmin}
        viewMode={viewMode}
        externalModalTrigger={externalTrigger}
        onResetExternalTrigger={() => setExternalTrigger(false)}
      />
    </div>
  );

  if (bare) return body;

  return (
    <section className="space-y-4">
      {title && (
        <div
          onClick={handleSecretHeaderTap}
          className="flex items-center justify-between border-b border-white/[0.08] pb-3 select-none cursor-pointer group"
          title="Stock en cave (astuce : tapez v-i-p au clavier ou triple-tapez le titre sur mobile)"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-4 bg-orange group-active:bg-gold rounded-full transition-colors" />
            <h2 className="font-display text-2xl text-cream font-bold">{title}</h2>
          </div>
          {secretTapCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/40 text-[10px] text-gold font-bold">
              <span>Séquence secrète</span>
              <span>{secretTapCount}/3</span>
            </span>
          )}
        </div>
      )}
      {body}
    </section>
  );
}
