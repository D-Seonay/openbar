"use client";

import { useState, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle, BottleType } from "@/lib/types";
import { updateBottleQuantity } from "@/app/actions";
import { calculateTotalBottlesCount, calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

interface StockStudioProps {
  normalBottles: Bottle[];
  vipBottles: Bottle[];
  addBottleForm: React.ReactNode;
  isAdmin?: boolean;
  isVip?: boolean;
}

export default function StockStudio({
  normalBottles,
  vipBottles,
  addBottleForm,
  isAdmin = false,
  isVip = false,
}: StockStudioProps) {
  const [activeUniverse, setActiveUniverse] = useState<"bar" | "vip" | "shopping">("bar");
  const [selectedCategory, setSelectedCategory] = useState<BottleType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<"inspect" | "add" | null>(null);
  const [, startTransition] = useTransition();

  // Find accessible bottles needing restock
  const shoppingList = useMemo(() => {
    const listToScan = isVip ? [...normalBottles, ...vipBottles] : normalBottles;
    return listToScan.filter((b) => {
      const threshold = b.lowStockThreshold ?? 0.5;
      return b.quantity <= threshold;
    });
  }, [normalBottles, vipBottles, isVip]);

  const currentList = activeUniverse === "vip" && isVip ? vipBottles : normalBottles;

  const availableCategories = useMemo(() => {
    const set = new Set<BottleType>();
    currentList.forEach((b) => set.add(b.type));
    return Array.from(set);
  }, [currentList]);

  const filteredBottles = useMemo(() => {
    if (activeUniverse === "shopping") {
      return shoppingList.filter((b) => {
        const matchesCat = selectedCategory === "all" || b.type === selectedCategory;
        const matchesSearch =
          searchQuery.trim() === "" ||
          b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCat && matchesSearch;
      });
    }

    return currentList.filter((b) => {
      const matchesCat = selectedCategory === "all" || b.type === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [activeUniverse, currentList, shoppingList, selectedCategory, searchQuery]);

  const selectedBottle = useMemo(() => {
    if (!selectedBottleId) return null;
    const all = isVip ? [...normalBottles, ...vipBottles] : normalBottles;
    return all.find((b) => b.id === selectedBottleId) ?? null;
  }, [selectedBottleId, normalBottles, vipBottles, isVip]);

  const handleInspect = (bottle: Bottle) => {
    setSelectedBottleId(bottle.id);
    setDrawerMode("inspect");
  };

  const handleOpenAdd = () => {
    setSelectedBottleId(null);
    setDrawerMode("add");
  };

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setSelectedBottleId(null);
  };

  const quickAdjust = (id: string, delta: number) => {
    startTransition(() => {
      updateBottleQuantity(id, delta);
    });
  };

  const copyShoppingList = async () => {
    const text = shoppingList
      .map((b) => `- ${b.name} (${b.type}) : stock=${b.quantity} (seuil: ${b.lowStockThreshold ?? 0.5})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("Liste copiée dans le presse-papiers !");
    } catch {
      alert("Impossible de copier la liste.");
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Top OS Command & Filter Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setActiveUniverse("bar");
              setSelectedCategory("all");
            }}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeUniverse === "bar"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            [01] BAR PRINCIPAL <span className="text-zinc-500">({normalBottles.length})</span>
          </button>

          {isVip && (
            <button
              onClick={() => {
                setActiveUniverse("vip");
                setSelectedCategory("all");
              }}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeUniverse === "vip"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-zinc-500 hover:text-amber-400 hover:bg-zinc-900"
              }`}
            >
              [02] CAVE VIP <span className="text-amber-500/70">({vipBottles.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setActiveUniverse("shopping");
              setSelectedCategory("all");
            }}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeUniverse === "shopping"
                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            [03] COURSES & ALERTES{" "}
            {shoppingList.length > 0 && <span className="text-red-400 font-bold">({shoppingList.length})</span>}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-extrabold uppercase transition-colors cursor-pointer"
            >
              + NOUVELLE RÉFÉRENCE
            </button>
          )}
          {activeUniverse === "shopping" && shoppingList.length > 0 && (
            <button
              onClick={copyShoppingList}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs transition-colors cursor-pointer"
            >
              📋 COPIER
            </button>
          )}
        </div>
      </div>

      {/* Search Input & Technical Category Switches */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-mono text-xs text-zinc-500">
            //
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Recherche instantanée (nom, tag)..."
            className="w-full pl-8 pr-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase transition-colors shrink-0 cursor-pointer ${
              selectedCategory === "all"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            TOUTES
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase transition-colors shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Master High-Density Technical Inventory Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        {filteredBottles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-mono text-xs text-zinc-500">// AUCUNE RÉFÉRENCE DANS CETTE VUE</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredBottles.map((bottle) => {
              const isLow =
                bottle.lowStockThreshold != null && bottle.quantity <= bottle.lowStockThreshold;
              const totalLiters = calculateBottleTotalLiters(bottle);

              return (
                <div
                  key={bottle.id}
                  onClick={() => handleInspect(bottle)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 transition-colors cursor-pointer ${
                    selectedBottleId === bottle.id
                      ? "bg-zinc-800/60"
                      : "hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-16 shrink-0 font-mono text-[10px] uppercase text-zinc-500">
                      [{bottle.type.slice(0, 4)}]
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100 group-hover:text-amber-300 transition-colors">
                          {bottle.name}
                        </span>
                        {bottle.vip && isVip && (
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            VIP
                          </span>
                        )}
                        {isLow && (
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            LOW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 font-mono text-[11px] text-zinc-500">
                        <span>{formatLiters(totalLiters)}</span>
                        <span>·</span>
                        <span className="truncate max-w-xs sm:max-w-md">
                          {bottle.tags.join(" ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between sm:justify-end gap-6 mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-zinc-800/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-zinc-500">EN CAVE:</span>
                      <span className="text-zinc-100 font-bold">{bottle.quantity} btl</span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => quickAdjust(bottle.id, -1)}
                          disabled={bottle.quantity <= 0}
                          className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30 transition-colors"
                        >
                          -
                        </button>
                        <button
                          onClick={() => quickAdjust(bottle.id, 1)}
                          className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <span className="font-mono text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Right-Hand Technical Inspector Pane */}
      <AnimatePresence>
        {drawerMode !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={handleCloseDrawer}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-[#0a0a0c] border-l border-zinc-800 z-50 p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block">
                      {drawerMode === "add" ? "// ENREGISTREMENT SYSTÈME" : "// INSPECTEUR TECHNQIUE"}
                    </span>
                    <h2 className="font-display text-xl font-bold text-zinc-100 mt-1">
                      {drawerMode === "add" ? "Nouvelle Référence" : selectedBottle?.name}
                    </h2>
                  </div>
                  <button
                    onClick={handleCloseDrawer}
                    className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 font-mono text-sm flex items-center justify-center cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {drawerMode === "add" && (
                  <div className="space-y-4">
                    {addBottleForm}
                  </div>
                )}

                {drawerMode === "inspect" && selectedBottle && (
                  <div className="space-y-6 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 block">CATÉGORIE</span>
                        <span className="text-zinc-100 font-bold uppercase mt-1 block">
                          {selectedBottle.type}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 block">QUANTITÉ TOTALE</span>
                        <span className="text-zinc-100 font-bold mt-1 block">
                          {selectedBottle.quantity} BOUTEILLES
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                      <span className="text-[10px] text-zinc-500 block uppercase">
                        Détail des formats & volumes
                      </span>
                      {selectedBottle.volumes && selectedBottle.volumes.length > 0 ? (
                        <div className="space-y-2">
                          {selectedBottle.volumes.map((v, idx) => (
                            <div key={idx} className="flex justify-between text-zinc-300">
                              <span>Format : {v.size}</span>
                              <span className="text-amber-400 font-bold">× {v.quantity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-zinc-400">Format standard 70cl</p>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
                      <span className="text-[10px] text-zinc-500 block uppercase">Tags & Attributs</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBottle.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[11px]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedBottle.notes && (
                      <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
                        <span className="text-[10px] text-zinc-500 block uppercase">Notes / Emplacement</span>
                        <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                          {selectedBottle.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-500">// BARDENOA ARCHITECTURE</span>
                <button
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  FERMER [ESC]
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
