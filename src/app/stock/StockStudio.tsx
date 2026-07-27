"use client";

import { useState, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle, BottleType } from "@/lib/types";
import { updateBottleQuantity, deleteBottleAction } from "@/app/actions";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

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

  const quickAdjust = (id: string, currentQuantity: number, delta: number) => {
    startTransition(() => {
      updateBottleQuantity(id, currentQuantity + delta);
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
      {/* Top Lounge Filter Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2.5 rounded-2xl bg-ink-2/90 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveUniverse("bar");
              setSelectedCategory("all");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeUniverse === "bar"
                ? "bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold shadow-md box-orange-glow"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            Bar Principal <span className="opacity-80">({normalBottles.length})</span>
          </button>

          {isVip && (
            <button
              onClick={() => {
                setActiveUniverse("vip");
                setSelectedCategory("all");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeUniverse === "vip"
                  ? "bg-gradient-to-r from-gold to-amber-300 text-ink font-extrabold shadow-md gold-glow"
                  : "text-gold-dim hover:text-gold hover:bg-gold/10 border border-gold/20"
              }`}
            >
              🔒 Réserve Privée VIP <span className="opacity-80">({vipBottles.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setActiveUniverse("shopping");
              setSelectedCategory("all");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeUniverse === "shopping"
                ? "bg-red-500 text-white font-extrabold shadow-md"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            🛒 Liste & Courses{" "}
            {shoppingList.length > 0 && <span className="font-bold">({shoppingList.length})</span>}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-cream hover:bg-white text-ink text-xs font-extrabold uppercase transition-colors cursor-pointer shadow-sm"
            >
              + Ajouter au Stock
            </button>
          )}
          {activeUniverse === "shopping" && shoppingList.length > 0 && (
            <button
              onClick={copyShoppingList}
              className="px-3.5 py-2 rounded-xl bg-orange text-ink font-bold text-xs transition-colors cursor-pointer"
            >
              📋 Copier la liste
            </button>
          )}
        </div>
      </div>

      {/* Search Input & Category Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted text-sm">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une bouteille, tag (rhum, citron)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ink-2 border border-white/[0.1] text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange/60"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
              selectedCategory === "all"
                ? "bg-cream text-ink font-bold"
                : "bg-ink-2 text-muted border border-white/[0.08] hover:text-cream"
            }`}
          >
            Toutes ({currentList.length})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-orange text-ink font-bold shadow-sm"
                  : "bg-ink-2 text-muted border border-white/[0.08] hover:text-cream"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Master High-Density Inventory List */}
      <div className="rounded-2xl border border-white/[0.08] bg-ink-2/60 overflow-hidden shadow-xl">
        {filteredBottles.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            Aucune bouteille trouvée dans cette sélection.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredBottles.map((bottle) => {
              const isLow =
                bottle.lowStockThreshold != null && bottle.quantity <= bottle.lowStockThreshold;
              const totalLiters = calculateBottleTotalLiters(bottle);

              return (
                <div
                  key={bottle.id}
                  onClick={() => handleInspect(bottle)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 transition-all duration-200 cursor-pointer ${
                    selectedBottleId === bottle.id
                      ? "bg-orange/15 border-l-4 border-l-orange"
                      : "hover:bg-ink-2"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-caps text-gold-dim">
                      {bottle.type}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-display font-bold text-base text-cream group-hover:text-orange transition-colors">
                          {bottle.name}
                        </span>
                        {bottle.vip && isVip && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink shadow-sm">
                            VIP
                          </span>
                        )}
                        {isLow && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            Alerte stock
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{formatLiters(totalLiters)} en cave</span>
                        <span>·</span>
                        <span className="truncate max-w-xs sm:max-w-md">
                          {bottle.tags.map((t) => `#${t}`).join(" ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-white/[0.06]">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted">En stock :</span>
                      <span className="text-cream font-bold text-sm bg-ink px-2.5 py-1 rounded-lg border border-white/[0.08]">
                        {bottle.quantity} btl
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => quickAdjust(bottle.id, bottle.quantity, -1)}
                          disabled={bottle.quantity <= 0}
                          className="w-8 h-8 rounded-lg bg-ink hover:bg-white/[0.1] text-cream text-sm font-bold flex items-center justify-center disabled:opacity-30 border border-white/[0.08] transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() => quickAdjust(bottle.id, bottle.quantity, 1)}
                          className="w-8 h-8 rounded-lg bg-ink hover:bg-orange hover:text-ink text-cream text-sm font-bold flex items-center justify-center border border-white/[0.08] transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <span className="text-muted group-hover:text-orange transition-colors text-sm">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Warm Orange / Cream Inspector Pane */}
      <AnimatePresence>
        {drawerMode !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={handleCloseDrawer}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-ink-2 border-l border-white/[0.1] z-50 p-6 sm:p-8 overflow-y-auto flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-caps text-gold font-bold block">
                      {drawerMode === "add" ? "Enregistrer un arrivage" : "Fiche de cave"}
                    </span>
                    <h2 className="font-display text-2xl font-bold text-cream mt-1">
                      {drawerMode === "add" ? "Nouvelle Bouteille" : selectedBottle?.name}
                    </h2>
                  </div>
                  <button
                    onClick={handleCloseDrawer}
                    className="w-9 h-9 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
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
                  <div className="space-y-6 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-ink border border-white/[0.08]">
                        <span className="text-[10px] uppercase tracking-caps text-muted block">Catégorie</span>
                        <span className="text-cream font-bold capitalize mt-1 block text-base">
                          {selectedBottle.type}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-ink border border-white/[0.08]">
                        <span className="text-[10px] uppercase tracking-caps text-muted block">Quantité</span>
                        <span className="text-orange font-bold mt-1 block text-base">
                          {selectedBottle.quantity} bouteille{selectedBottle.quantity > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-ink border border-white/[0.08] space-y-3">
                      <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                        Formats & Volumes enregistrés
                      </span>
                      {selectedBottle.volumes && selectedBottle.volumes.length > 0 ? (
                        <div className="space-y-2">
                          {selectedBottle.volumes.map((v, idx) => (
                            <div key={idx} className="flex justify-between text-cream">
                              <span>Format {v.size}</span>
                              <span className="text-orange font-bold">× {v.quantity} en stock</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted text-xs">Format standard 70cl</p>
                      )}
                    </div>

                    <div className="p-5 rounded-xl bg-ink border border-white/[0.08] space-y-3">
                      <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                        Tags & Arômes associés
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedBottle.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-lg bg-ink-2 border border-white/[0.08] text-cream text-xs font-medium"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedBottle.notes && (
                      <div className="p-5 rounded-xl bg-ink border border-white/[0.08] space-y-2">
                        <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                          Notes / Emplacement en cave
                        </span>
                        <p className="text-cream text-xs leading-relaxed">
                          {selectedBottle.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs">
                {drawerMode === "inspect" && isAdmin && selectedBottle ? (
                  <button
                    onClick={() => setDeleteTarget({ id: selectedBottle.id, name: selectedBottle.name })}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Supprimer
                  </button>
                ) : (
                  <span className="text-muted">OpenBar · Studio Cave</span>
                )}
                <button
                  onClick={handleCloseDrawer}
                  className="px-5 py-2.5 rounded-xl bg-orange text-ink font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title="Supprimer la bouteille ?"
        description={`Êtes-vous sûr de vouloir supprimer définitivement "${deleteTarget?.name}" ?`}
        isPending={isDeletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          startDeleteTransition(() => {
            deleteBottleAction(id);
          });
          setDeleteTarget(null);
          handleCloseDrawer();
        }}
      />
    </div>
  );
}
