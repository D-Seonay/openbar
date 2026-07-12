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
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2.5 rounded-2xl bg-ink-2/90 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("ready")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "ready"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-ink font-extrabold shadow-md"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            Prêts au Bar <span className="font-bold">({counts.ready})</span>
          </button>

          {isVip && (
            <button
              onClick={() => setActiveTab("vip")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "vip"
                  ? "bg-gradient-to-r from-gold to-amber-300 text-ink font-extrabold shadow-md gold-glow"
                  : "text-gold-dim hover:text-gold hover:bg-gold/10 border border-gold/20"
              }`}
            >
              🔒 Avec Cave VIP <span className="font-bold">({counts.vip})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("locked")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "locked"
                ? "bg-orange text-ink font-extrabold shadow-md box-orange-glow"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            À Compléter <span className="font-bold">({counts.locked})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted text-sm">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chercher cocktail, ingrédient..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-ink-2 border border-white/[0.1] text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange/60"
          />
        </div>
      </div>

      {/* Master Mixology Recipe Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-ink-2/60 overflow-hidden shadow-xl">
        {filteredResults.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            Aucune recette ne correspond à votre filtre.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredResults.map((item) => {
              const isSelected = selectedRecipeId === item.recipe.id;
              return (
                <div
                  key={item.recipe.id}
                  onClick={() => setSelectedRecipeId(item.recipe.id)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 transition-all duration-200 cursor-pointer ${
                    isSelected ? "bg-orange/15 border-l-4 border-l-orange" : "hover:bg-ink-2"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        item.makeable
                          ? item.usesVip && isVip
                            ? "bg-gold"
                            : "bg-emerald-400"
                          : "bg-muted/40"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-display font-bold text-base text-cream group-hover:text-orange transition-colors">
                          {item.recipe.name}
                        </span>
                        {item.usesVip && isVip && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink shadow-sm">
                            VIP
                          </span>
                        )}
                        {!item.makeable && (
                          <span className="text-xs text-orange font-semibold">
                            (Manque {item.missingTags.length} ingrédient{item.missingTags.length > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 truncate max-w-sm sm:max-w-xl">
                        {item.recipe.glass ? `${item.recipe.glass} · ` : ""}
                        {item.recipe.tags.join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-2 sm:mt-0 text-xs">
                    <span
                      className={`font-bold uppercase tracking-wider ${
                        item.makeable ? "text-emerald-400" : "text-muted"
                      }`}
                    >
                      {item.makeable ? "Prêt à servir" : "À compléter"}
                    </span>
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

      {/* Slide-Over Warm Orange / Cream Recipe Spec Sheet Inspector */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setSelectedRecipeId(null)}
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
                      Fiche de Mixologie
                    </span>
                    <h2 className="font-display text-2xl font-bold text-cream mt-1">
                      {selectedItem.recipe.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedRecipeId(null)}
                    className="w-9 h-9 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Glassware & Service Status */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-ink border border-white/[0.08]">
                    <span className="text-[10px] uppercase tracking-caps text-muted block">Verre conseillé</span>
                    <span className="text-cream font-bold capitalize mt-1 block text-sm">
                      {selectedItem.recipe.glass || "Verre standard"}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-ink border border-white/[0.08]">
                    <span className="text-[10px] uppercase tracking-caps text-muted block">Statut</span>
                    <span
                      className={`font-bold mt-1 block text-sm ${
                        selectedItem.makeable ? "text-emerald-400" : "text-orange"
                      }`}
                    >
                      {selectedItem.makeable ? "Réalisable ce soir" : "Ingrédient manquant"}
                    </span>
                  </div>
                </div>

                {/* Ingredients Audit */}
                <div className="space-y-3">
                  <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                    Ingrédients de la Recette
                  </span>
                  <div className="space-y-2 text-xs">
                    {selectedItem.recipe.tags.map((tag) => {
                      const isMissing = selectedItem.missingTags.includes(tag);
                      return (
                        <div
                          key={tag}
                          className={`flex items-center justify-between p-3.5 rounded-xl border ${
                            isMissing
                              ? "bg-red-950/20 border-red-500/30 text-red-300"
                              : "bg-ink border-white/[0.08] text-cream"
                          }`}
                        >
                          <span className="font-semibold capitalize text-sm">{tag}</span>
                          <span
                            className={`text-xs font-bold ${
                              isMissing ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {isMissing ? "Manquant en cave" : "✓ En cave"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Preparation Guide */}
                <div className="p-5 rounded-xl bg-ink border border-white/[0.08] space-y-2.5">
                  <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                    Guide de Mixologie & Préparation
                  </span>
                  <p className="text-cream text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                    {selectedItem.recipe.instructions ||
                      "Mesurez les ingrédients avec précision, rafraîchissez au shaker ou au verre à mélange selon le spiritueux, puis servez dans un verre préalablement glacé."}
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-muted">Le Bar de Noa · Carte Cocktails</span>
                <button
                  onClick={() => setSelectedRecipeId(null)}
                  className="px-5 py-2.5 rounded-xl bg-orange text-ink font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
