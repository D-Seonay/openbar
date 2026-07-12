"use client";

import { useState, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle, BottleType } from "@/lib/types";
import BottleTable from "./BottleTable";
import BottleGridCard from "./BottleGridCard";
import BottlePreview from "./BottlePreview";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { updateBottleQuantity } from "@/app/actions";

interface StockTabsProps {
  normalBottles: Bottle[];
  vipBottles: Bottle[];
  addBottleForm: React.ReactNode;
  isAdmin?: boolean;
}

export default function StockTabs({
  normalBottles,
  vipBottles,
  addBottleForm,
  isAdmin = false,
}: StockTabsProps) {
  const [activeTab, setActiveTab] = useState<"bar" | "vip" | "shopping" | "add">("bar");
  const [selectedCategory, setSelectedCategory] = useState<BottleType | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  // Find all bottles that need restocking
  const shoppingList = useMemo(() => {
    return [...normalBottles, ...vipBottles].filter((b) => {
      const threshold = b.lowStockThreshold ?? 0.5;
      return b.quantity <= threshold;
    });
  }, [normalBottles, vipBottles]);

  // Filtered lists
  const filterBottles = (list: Bottle[]) => {
    return list.filter((b) => {
      const matchesCat = selectedCategory === "all" || b.type === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  };

  const filteredNormal = useMemo(() => filterBottles(normalBottles), [normalBottles, selectedCategory, searchQuery]);
  const filteredVip = useMemo(() => filterBottles(vipBottles), [vipBottles, selectedCategory, searchQuery]);

  // Categories available in current active list
  const currentList = activeTab === "vip" ? vipBottles : normalBottles;
  const availableCategories = useMemo(() => {
    const set = new Set<BottleType>();
    currentList.forEach((b) => set.add(b.type));
    return Array.from(set);
  }, [currentList]);

  const toggleChecked = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyShoppingList = async () => {
    const text = shoppingList
      .map((b) => `- ${b.name} (${b.type}) - stock: ${b.quantity} (seuil: ${b.lowStockThreshold ?? 0.5})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("Liste copiée dans le presse-papiers !");
    } catch {
      alert("Impossible de copier la liste.");
    }
  };

  const quickRestock = (id: string) => {
    startTransition(() => {
      updateBottleQuantity(id, 1);
    });
  };

  return (
    <div className="space-y-8">
      {/* Primary 2-Universe Switcher (Bar Principal vs Réserve VIP + Add & Shopping) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-2xl bg-ink-2/90 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("bar");
              setSelectedCategory("all");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "bar"
                ? "bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold shadow-md box-orange-glow"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            <span>🍸 Bar Principal (Invités)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "bar" ? "bg-ink/20 text-ink" : "bg-white/[0.07] text-cream"
              }`}
            >
              {normalBottles.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("vip");
              setSelectedCategory("all");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "vip"
                ? "bg-gradient-to-r from-gold to-amber-300 text-ink font-extrabold shadow-md gold-glow"
                : "text-gold-dim hover:text-gold hover:bg-gold/10 border border-gold/20"
            }`}
          >
            <span>🔒 Réserve Privée VIP</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "vip" ? "bg-ink/20 text-ink" : "bg-gold/20 text-gold"
              }`}
            >
              {vipBottles.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("add")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "add"
                ? "bg-cream text-ink font-extrabold"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            <span>➕ Ajouter au Stock</span>
          </button>

          <button
            onClick={() => setActiveTab("shopping")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "shopping"
                ? "bg-red-500 text-white font-extrabold shadow-md"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            <span>🛒 Liste & Courses</span>
            {shoppingList.length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === "shopping" ? "bg-white/20 text-white" : "bg-red-500/20 text-red-400"
                }`}
              >
                {shoppingList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar for Bar Principal or VIP Universe */}
      {(activeTab === "bar" || activeTab === "vip") && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "vip"
                    ? "Rechercher dans la Réserve VIP..."
                    : "Rechercher une bouteille, tag (rhum, citron)..."
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ink-2 border border-white/[0.1] text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange/60"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-ink-2 border border-white/[0.08]">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  viewMode === "grid" ? "bg-white/[0.1] text-cream" : "text-muted hover:text-cream"
                }`}
              >
                Grille
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  viewMode === "table" ? "bg-white/[0.1] text-cream" : "text-muted hover:text-cream"
                }`}
              >
                Tableau
              </button>
            </div>
          </div>

          {/* Color Coded Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-cream text-ink font-bold shadow-sm"
                  : "bg-ink-2 text-muted border border-white/[0.08] hover:text-cream"
              }`}
            >
              Toutes ({currentList.length})
            </button>
            {availableCategories.map((cat) => {
              const style = getCategoryStyle(cat);
              const count = currentList.filter((b) => b.type === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? `${style.badgeBg} ${style.badgeText} border ${style.badgeBorder} shadow-md scale-105`
                      : "bg-ink-2 text-muted border border-white/[0.08] hover:text-cream"
                  }`}
                >
                  <span>{style.icon}</span>
                  <span>{style.label}</span>
                  <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      <AnimatePresence mode="wait">
        {activeTab === "bar" && (
          <motion.div
            key="bar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {filteredNormal.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-ink-2/40 border border-white/[0.06]">
                <p className="text-3xl mb-3">🥃</p>
                <p className="text-cream font-semibold">Aucune bouteille trouvée dans le Bar Principal</p>
                <p className="text-xs text-muted mt-1">Ajoutez un nouvel arrivage ou ajustez vos filtres.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
                {filteredNormal.map((bottle) => (
                  <BottleGridCard key={bottle.id} bottle={bottle} isAdmin={isAdmin} />
                ))}
              </div>
            ) : (
              <BottleTable bottles={filteredNormal} empty="Aucune bouteille dans le Bar Principal." isAdmin={isAdmin} />
            )}
          </motion.div>
        )}

        {activeTab === "vip" && (
          <motion.div
            key="vip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Exclusive Vault Banner */}
            <div className="rounded-2xl vip-vault-card p-6 border border-gold/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-caps text-gold font-bold bg-gold/15 px-3 py-1 rounded-full border border-gold/30 mb-2">
                  <span>🔒 Access Restricted</span>
                  <span>· Cave Privée</span>
                </span>
                <h3 className="font-display text-2xl text-cream font-bold">Le Coffre-Fort VIP</h3>
                <p className="text-xs text-gold-dim mt-1 max-w-xl">
                  Ces bouteilles d&apos;exception sont exclues du calcul standard des cocktails et réservées aux convives VIP lors de vos soirées.
                </p>
              </div>
            </div>

            {filteredVip.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-brick-dark/20 border border-gold/20">
                <p className="text-3xl mb-3">🔒</p>
                <p className="text-cream font-semibold">Votre Réserve VIP est actuellement vide</p>
                <p className="text-xs text-muted mt-1">Cochez l&apos;option &quot;Réserve VIP&quot; lors de l&apos;ajout d&apos;une bouteille rare.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
                {filteredVip.map((bottle) => (
                  <BottleGridCard key={bottle.id} bottle={bottle} isAdmin={isAdmin} />
                ))}
              </div>
            ) : (
              <BottleTable bottles={filteredVip} empty="Aucune bouteille VIP ne correspond au filtre." isAdmin={isAdmin} />
            )}
          </motion.div>
        )}

        {activeTab === "add" && (
          <motion.div
            key="add"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-2xl mx-auto rounded-2xl bg-ink-2 p-6 sm:p-8 border border-white/[0.08]"
          >
            <div className="mb-6">
              <span className="text-xs uppercase tracking-caps text-orange font-semibold">Réapprovisionnement</span>
              <h3 className="font-display text-2xl font-bold text-cream mt-1">Enregistrer un Arrivage</h3>
            </div>
            {addBottleForm}
          </motion.div>
        )}

        {activeTab === "shopping" && (
          <motion.div
            key="shopping"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl bg-ink-2 p-6 sm:p-8 border border-white/[0.08] space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
              <div>
                <span className="text-xs uppercase tracking-caps text-orange font-semibold">Alertes de Stock</span>
                <h3 className="font-display text-2xl font-bold text-cream mt-1">Liste des Courses</h3>
                <p className="text-xs text-muted mt-1">
                  Bouteilles sous leur seuil d&apos;alerte qui nécessitent d&apos;être réapprovisionnées.
                </p>
              </div>
              {shoppingList.length > 0 && (
                <button
                  onClick={copyShoppingList}
                  className="px-4 py-2.5 rounded-xl bg-orange text-ink text-xs font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors shadow-sm cursor-pointer shrink-0"
                >
                  📋 Copier la Liste
                </button>
              )}
            </div>

            {shoppingList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-3">✨</p>
                <p className="text-cream font-semibold">Votre cave est parfaitement approvisionnée !</p>
                <p className="text-xs text-muted mt-1">Aucune bouteille sous son seuil d&apos;alerte.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shoppingList.map((b) => {
                  const style = getCategoryStyle(b.type);
                  const isChecked = checkedItems[b.id] || false;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isChecked
                          ? "bg-ink/40 border-white/[0.05] opacity-50"
                          : b.vip
                          ? "bg-brick-dark/30 border-gold/30"
                          : "bg-ink border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChecked(b.id)}
                          className="w-4 h-4 rounded border-white/[0.2] bg-ink cursor-pointer accent-orange"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm ${
                                isChecked ? "line-through text-muted" : "text-cream font-bold"
                              }`}
                            >
                              {b.name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${style.badgeBg} ${style.badgeText} font-semibold`}
                            >
                              {style.icon} {style.label}
                            </span>
                            {b.vip && (
                              <span className="text-[10px] bg-gold text-ink px-1.5 py-0.5 rounded font-bold">VIP</span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-1">
                            Quantité en cave: <span className="text-orange font-bold">{b.quantity}</span> (seuil:{" "}
                            {b.lowStockThreshold ?? 0.5})
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => quickRestock(b.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-cream text-xs font-semibold border border-white/[0.1] transition-colors cursor-pointer"
                        >
                          +1 Rapide
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
