"use client";

import { useState, useTransition } from "react";
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
      {/* Tab Selectors */}
      <div className="flex border-b border-orange/15 gap-2">
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 border-b-2 ${
            activeTab === "stock"
              ? "border-orange text-orange orange-glow"
              : "border-transparent text-muted hover:text-cream"
          }`}
        >
          📋 Inventaire ({normalBottles.length + vipBottles.length})
        </button>
        <button
          onClick={() => setActiveTab("add")}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 border-b-2 ${
            activeTab === "add"
              ? "border-orange text-orange orange-glow"
              : "border-transparent text-muted hover:text-cream"
          }`}
        >
          ➕ Ajouter
        </button>
        <button
          onClick={() => setActiveTab("shopping")}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 border-b-2 relative ${
            activeTab === "shopping"
              ? "border-orange text-orange orange-glow"
              : "border-transparent text-muted hover:text-cream"
          }`}
        >
          🛒 Courses
          {shoppingList.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orange text-white text-[9px] font-mono font-bold">
              {shoppingList.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "stock" && (
        <div className="space-y-8">
          <BottleTable
            title="Stock standard"
            bottles={normalBottles}
            empty="Votre bar est vide. Ajoutez votre première bouteille !"
          />

          {vipBottles.length > 0 && (
            <div className="rounded-xl border border-gold/25 bg-brick-dark/15 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gold/15 pb-2">
                <span className="text-xl">🔒</span>
                <div>
                  <h2 className="font-display text-xl text-gold">Réserve VIP</h2>
                  <p className="text-[10px] text-muted">
                    Visible uniquement par les convives VIP lors des soirées.
                  </p>
                </div>
              </div>
              <BottleTable bottles={vipBottles} empty="Aucune bouteille VIP." bare />
            </div>
          )}
        </div>
      )}

      {activeTab === "add" && (
        <div className="max-w-2xl mx-auto bg-ink-2/40 border border-orange/10 p-6 rounded-xl box-orange-glow">
          <div className="mb-4">
            <h2 className="font-display text-2xl text-cream">Nouvel Ingrédient</h2>
            <p className="text-muted text-xs">Ajouter un alcool, un liquoreux, ou un soft à votre bar.</p>
          </div>
          {addBottleForm}
        </div>
      )}

      {activeTab === "shopping" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-display text-2xl text-cream">Liste d&apos;achats</h2>
              <p className="text-muted text-xs">Bouteilles épuisées ou sous le seuil d&apos;alerte.</p>
            </div>
            {shoppingList.length > 0 && (
              <button
                onClick={copyShoppingList}
                className="text-xs px-3 py-2 rounded-xl bg-orange text-white hover:bg-orange-hover box-orange-glow transition-all"
              >
                📋 Copier la liste de courses
              </button>
            )}
          </div>

          {shoppingList.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-orange/15 bg-ink-2/10">
              <span className="text-4xl block mb-2">🍹</span>
              <p className="text-cream font-medium">Tout est parfaitement approvisionné !</p>
              <p className="text-muted text-xs mt-1">Aucune bouteille n&apos;est en rupture de stock.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {shoppingList.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    checkedItems[b.id]
                      ? "border-orange/20 bg-ink-2/20 opacity-60"
                      : "border-orange/10 bg-ink-2/40"
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
                      <div className="w-10 h-10 flex items-center justify-center bg-ink/50 rounded-lg p-1">
                        <BottlePreview type={b.type} quantity={b.quantity} vip={b.vip} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-display text-lg text-cream font-medium ${
                              checkedItems[b.id] ? "line-through text-muted" : ""
                            }`}
                          >
                            {b.name}
                          </span>
                          {b.vip && (
                            <span className="text-[9px] uppercase tracking-wide bg-gold text-ink px-1 py-0.5 rounded font-bold">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span className="capitalize font-mono text-[10px] text-orange-dim">
                            {b.type}
                          </span>
                          <span>•</span>
                          <span>
                            Actuel : <strong className="text-cream">{b.quantity}</strong> / seuil :{" "}
                            {b.lowStockThreshold ?? 0.5}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => quickRestock(b.id)}
                    disabled={isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-orange/20 text-orange hover:bg-orange hover:text-white transition-all disabled:opacity-40"
                  >
                    ⚡ Réapprovisionner (+1)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
