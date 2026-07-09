"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bottle } from "@/lib/types";
import BottleTable from "./BottleTable";
import BottlePreview from "./BottlePreview";
import { updateBottleQuantity } from "@/app/actions";

interface StockTabsProps {
  normalBottles: Bottle[];
  vipBottles: Bottle[];
  addBottleForm: React.ReactNode;
}

export default function StockTabs({ normalBottles, vipBottles, addBottleForm }: StockTabsProps) {
  const [activeTab, setActiveTab] = useState<"stock" | "shopping" | "add">("stock");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // Find all bottles that need restocking
  const shoppingList = [...normalBottles, ...vipBottles].filter((b) => {
    const threshold = b.lowStockThreshold ?? 0.5;
    return b.quantity <= threshold;
  });

  const toggleChecked = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyShoppingList = async () => {
    const text = shoppingList
      .map((b) => `- ${b.name} (${b.type}) - quantité actuelle: ${b.quantity} (seuil: ${b.lowStockThreshold ?? 0.5})`)
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
    <div className="space-y-6">
      {/* Fresh Grocery Section Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-ink-2/80 border border-white/[0.08]">
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-caps transition-all cursor-pointer ${
            activeTab === "stock"
              ? "bg-orange text-ink font-bold shadow-md box-orange-glow"
              : "text-muted hover:text-cream hover:bg-white/[0.04]"
          }`}
        >
          <span>🏪 Rayons du Marché</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === "stock" ? "bg-ink/20 text-ink" : "bg-white/[0.07] text-cream"
          }`}>
            {normalBottles.length + vipBottles.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("add")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-caps transition-all cursor-pointer ${
            activeTab === "add"
              ? "bg-orange text-ink font-bold shadow-md box-orange-glow"
              : "text-muted hover:text-cream hover:bg-white/[0.04]"
          }`}
        >
          <span>➕ Nouvel Arrivage</span>
        </button>
        <button
          onClick={() => setActiveTab("shopping")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-caps transition-all cursor-pointer ${
            activeTab === "shopping"
              ? "bg-orange text-ink font-bold shadow-md box-orange-glow"
              : "text-muted hover:text-cream hover:bg-white/[0.04]"
          }`}
        >
          <span>🛒 Liste & Courses</span>
          {shoppingList.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "shopping" ? "bg-ink text-orange" : "bg-orange text-ink"
            }`}>
              {shoppingList.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === "stock" && (
            <div className="space-y-8">
              <BottleTable
                title="Stock en cave"
                bottles={normalBottles}
                empty="Votre cave est vide. Ajoutez votre première bouteille !"
              />

              {vipBottles.length > 0 && (
                <div className="rounded-2xl border border-gold/30 bg-brick-dark/25 p-6 space-y-4 shadow-lg">
                  <div className="flex items-center gap-3 border-b border-gold/20 pb-3">
                    <span className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-base">🔒</span>
                    <div>
                      <h2 className="font-display text-xl text-gold font-bold">Réserve Privée VIP</h2>
                      <p className="text-xs text-muted">
                        Visible uniquement par les convives VIP lors des soirées exclusives.
                      </p>
                    </div>
                  </div>
                  <BottleTable bottles={vipBottles} empty="Aucune bouteille VIP." bare />
                </div>
              )}
            </div>
          )}

          {activeTab === "add" && (
            <div className="max-w-2xl mx-auto bg-ink-2/70 border border-white/[0.08] p-6 sm:p-8 rounded-2xl box-orange-glow shadow-xl">
              <div className="mb-6 border-b border-white/[0.07] pb-4">
                <h2 className="font-display text-2xl font-bold text-cream">Nouvel Ingrédient en Cave</h2>
                <p className="text-muted text-xs mt-1">Ajoutez un spiritueux, une liqueur, un vin ou un soft à votre collection.</p>
              </div>
              {addBottleForm}
            </div>
          )}

          {activeTab === "shopping" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-display text-2xl font-bold text-cream">Liste d&apos;achats & courses</h2>
                  <p className="text-muted text-xs mt-0.5">Bouteilles épuisées ou sous votre seuil d&apos;alerte.</p>
                </div>
                {shoppingList.length > 0 && (
                  <button
                    onClick={copyShoppingList}
                    className="text-xs px-3.5 py-2 rounded-xl bg-orange text-ink font-semibold hover:bg-orange-hover box-orange-glow transition-all cursor-pointer"
                  >
                    📋 Copier la liste de courses
                  </button>
                )}
              </div>

              {shoppingList.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.1] bg-ink-2/20">
                  <span className="text-4xl block mb-2">🍹</span>
                  <p className="text-cream font-medium">Votre cave est parfaitement approvisionnée !</p>
                  <p className="text-muted text-xs mt-1">Aucune bouteille n&apos;est en rupture de stock.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {shoppingList.map((b) => (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        checkedItems[b.id]
                          ? "border-orange/20 bg-ink-2/20 opacity-60"
                          : "border-white/[0.07] bg-ink-2/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!checkedItems[b.id]}
                          onChange={() => toggleChecked(b.id)}
                          className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-orange cursor-pointer"
                        />
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-12 flex items-center justify-center bg-ink rounded-lg p-1 border border-white/[0.08] overflow-hidden">
                            {b.imageUrl ? (
                              <img src={b.imageUrl} alt={b.name} className="w-full h-full object-contain" />
                            ) : (
                              <BottlePreview type={b.type} quantity={b.quantity} vip={b.vip} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-display text-lg text-cream font-semibold ${
                                  checkedItems[b.id] ? "line-through text-muted" : ""
                                }`}
                              >
                                {b.name}
                              </span>
                              {b.vip && (
                                <span className="text-[10px] uppercase tracking-caps bg-gold text-ink px-1.5 py-0.5 rounded font-bold">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted">
                              <span className="capitalize font-medium text-orange">
                                {b.type}
                              </span>
                              <span>•</span>
                              <span>
                                En cave : <strong className="text-cream">{b.quantity} btl</strong> (seuil :{" "}
                                {b.lowStockThreshold ?? 0.5})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => quickRestock(b.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-orange/30 text-orange hover:bg-orange hover:text-ink font-semibold transition-all disabled:opacity-40 cursor-pointer"
                      >
                        ⚡ Réapprovisionner (+1)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
