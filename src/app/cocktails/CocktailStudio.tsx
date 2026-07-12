"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecipeAvailability } from "@/lib/cocktail-types";

interface CocktailStudioProps {
  initialResults: RecipeAvailability[];
  isVip?: boolean;
}

export default function CocktailStudio({ initialResults, isVip = false }: CocktailStudioProps) {
  const [activeTab, setActiveTab] = useState<"ready" | "vip" | "locked">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const accessibleResults = useMemo(() => {
    return isVip ? initialResults : initialResults.filter((r) => !r.usesVip);
  }, [initialResults, isVip]);

  const filteredResults = useMemo(() => {
    return accessibleResults.filter((r) => {
      const matchesSearch =
        r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.recipe.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === "ready") {
        return r.makeable && !r.usesVip;
      } else if (activeTab === "vip" && isVip) {
        return r.makeable && r.usesVip;
      } else {
        return !r.makeable;
      }
    });
  }, [accessibleResults, activeTab, searchQuery, isVip]);

  const selectedItem = useMemo(() => {
    if (!selectedRecipeId) return null;
    return accessibleResults.find((r) => r.recipe.id === selectedRecipeId) ?? null;
  }, [selectedRecipeId, accessibleResults]);

  const counts = useMemo(() => {
    return {
      ready: accessibleResults.filter((r) => r.makeable && !r.usesVip).length,
      vip: isVip ? accessibleResults.filter((r) => r.makeable && r.usesVip).length : 0,
      locked: accessibleResults.filter((r) => !r.makeable).length,
    };
  }, [accessibleResults, isVip]);

  return (
    <div className="space-y-6 relative">
      {/* Top OS Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab("ready")}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "ready"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            [01] PRÊTS À SERVIR <span className="text-emerald-400 font-bold">({counts.ready})</span>
          </button>

          {isVip && (
            <button
              onClick={() => setActiveTab("vip")}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "vip"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-zinc-500 hover:text-amber-400 hover:bg-zinc-900"
              }`}
            >
              [02] RECETTES VIP <span className="text-amber-400 font-bold">({counts.vip})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("locked")}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "locked"
                ? "bg-amber-400/10 text-amber-300 border border-amber-400/30"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            [03] À COMPLÉTER <span className="text-zinc-400 font-bold">({counts.locked})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-mono text-xs text-zinc-500">
            //
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer ingrédient ou nom..."
            className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      {/* Master Technical Recipe Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="py-16 text-center font-mono text-xs text-zinc-500">
            // AUCUNE RECETTE DISPONIBLE DANS CE FILTRE
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredResults.map((item) => {
              const isSelected = selectedRecipeId === item.recipe.id;
              return (
                <div
                  key={item.recipe.id}
                  onClick={() => setSelectedRecipeId(item.recipe.id)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 transition-colors cursor-pointer ${
                    isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.makeable
                          ? item.usesVip && isVip
                            ? "bg-amber-400"
                            : "bg-emerald-500"
                          : "bg-zinc-600"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100 group-hover:text-amber-300 transition-colors">
                          {item.recipe.name}
                        </span>
                        {item.usesVip && isVip && (
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            VIP
                          </span>
                        )}
                        {!item.makeable && (
                          <span className="font-mono text-[10px] text-zinc-500">
                            (-{item.missingTags.length} ing.)
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-zinc-500 mt-0.5 truncate max-w-sm sm:max-w-xl">
                        {item.recipe.glass ? `[${item.recipe.glass.toUpperCase()}] · ` : ""}
                        {item.recipe.tags.join(" / ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-2 sm:mt-0 font-mono text-xs">
                    <span
                      className={`text-[11px] font-bold ${
                        item.makeable ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {item.makeable ? "PRÊT À SERVIR" : "INCOMPLET"}
                    </span>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Technical Spec Sheet Inspector */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setSelectedRecipeId(null)}
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
                      // FICHE TECHNIQUE DE MIXOLOGIE
                    </span>
                    <h2 className="font-display text-2xl font-bold text-zinc-100 mt-1">
                      {selectedItem.recipe.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedRecipeId(null)}
                    className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 font-mono text-sm flex items-center justify-center cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Status & Glassware */}
                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">VERRE RECOMMANDE</span>
                    <span className="text-zinc-100 font-bold uppercase mt-1 block">
                      {selectedItem.recipe.glass || "STANDARD"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">STATUS DE SERVICE</span>
                    <span
                      className={`font-bold mt-1 block ${
                        selectedItem.makeable ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {selectedItem.makeable ? "RÉALISABLE" : "MANQUE COMPOSANT"}
                    </span>
                  </div>
                </div>

                {/* Ingredients Audit Protocol */}
                <div className="space-y-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block">
                    INVENTAIRE DES INGRÉDIENTS
                  </span>
                  <div className="space-y-2 font-mono text-xs">
                    {selectedItem.recipe.tags.map((tag) => {
                      const isMissing = selectedItem.missingTags.includes(tag);
                      return (
                        <div
                          key={tag}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isMissing
                              ? "bg-red-950/20 border-red-500/30 text-red-300"
                              : "bg-zinc-900/80 border-zinc-800 text-zinc-200"
                          }`}
                        >
                          <span className="font-semibold uppercase">{tag}</span>
                          <span className="text-[11px]">
                            {isMissing ? "[MANQUANT]" : "[EN CAVE]"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Preparation Guide Lab Protocol */}
                <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 block">
                    PROTOCOLE D&apos;ASSEMBLAGE
                  </span>
                  <p className="font-sans text-xs text-zinc-200 leading-relaxed whitespace-pre-line">
                    {selectedItem.recipe.instructions ||
                      "Mesurer les ingrédients au jigger, rafraîchir au shaker ou au verre à mélange selon le spiritueux, puis filtrer dans un verre préalablement glacé."}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-500">// BARDENOA MIXOLOGY STUDIO</span>
                <button
                  onClick={() => setSelectedRecipeId(null)}
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
