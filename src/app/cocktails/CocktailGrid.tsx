"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecipeAvailability } from "@/lib/cocktail-types";

interface CocktailGridProps {
  initialResults: RecipeAvailability[];
  isVip?: boolean;
}

export default function CocktailGrid({ initialResults, isVip = false }: CocktailGridProps) {
  const [activeFilter, setActiveFilter] = useState<"ready" | "vip" | "locked">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // If not VIP, completely strip out any VIP-dependent recipes
  const accessibleResults = useMemo(() => {
    return isVip ? initialResults : initialResults.filter((r) => !r.usesVip);
  }, [initialResults, isVip]);

  const filteredResults = useMemo(() => {
    return accessibleResults.filter((r) => {
      const matchesSearch =
        r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.recipe.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeFilter === "ready") {
        return r.makeable && !r.usesVip;
      } else if (activeFilter === "vip" && isVip) {
        return r.makeable && r.usesVip;
      } else {
        return !r.makeable;
      }
    });
  }, [accessibleResults, activeFilter, searchQuery, isVip]);

  const sortedResults = useMemo(() => {
    if (activeFilter === "locked") {
      return [...filteredResults].sort((a, b) => a.missingTags.length - b.missingTags.length);
    }
    return filteredResults;
  }, [filteredResults, activeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getGlassIcon = (glassType?: string) => {
    const glass = glassType?.toLowerCase() ?? "";
    if (glass.includes("coupe") || glass.includes("martini")) return "🍸";
    if (glass.includes("flûte") || glass.includes("bulles")) return "🥂";
    if (glass.includes("ballon")) return "🍷";
    if (glass.includes("cuivre") || glass.includes("mug")) return "🍺";
    if (glass.includes("tumbler") || glass.includes("old fashioned")) return "🥃";
    return "🍹";
  };

  const counts = useMemo(() => {
    return {
      ready: accessibleResults.filter((r) => r.makeable && !r.usesVip).length,
      vip: isVip ? accessibleResults.filter((r) => r.makeable && r.usesVip).length : 0,
      locked: accessibleResults.filter((r) => !r.makeable).length,
    };
  }, [accessibleResults, isVip]);

  return (
    <div className="space-y-8">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-3 rounded-2xl bg-paper border border-rule">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveFilter("ready")}
            className={`tap-target flex items-center gap-2 px-4 rounded-xl text-[13px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeFilter === "ready"
                ? "bg-terracotta text-paper"
                : "bg-paper-sunk border border-rule text-ink-soft hover:text-ink"
            }`}
          >
            <span>🟢 Prêts au Bar</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[13px] font-mono font-bold ${
                activeFilter === "ready" ? "bg-paper/20 text-paper" : "bg-paper-sunk text-ink"
              }`}
            >
              {counts.ready}
            </span>
          </button>

          {isVip && (
            <button
              onClick={() => setActiveFilter("vip")}
              className={`tap-target flex items-center gap-2 px-4 rounded-xl text-[13px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                activeFilter === "vip"
                  ? "bg-terracotta text-paper"
                  : "bg-paper-sunk border border-rule text-ink-soft hover:text-ink"
              }`}
            >
              <span>🔒 Avec Cave VIP</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[13px] font-mono font-bold ${
                  activeFilter === "vip" ? "bg-paper/20 text-paper" : "bg-paper-sunk text-ink"
                }`}
              >
                {counts.vip}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveFilter("locked")}
            className={`tap-target flex items-center gap-2 px-4 rounded-xl text-[13px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeFilter === "locked"
                ? "bg-terracotta text-paper"
                : "bg-paper-sunk border border-rule text-ink-soft hover:text-ink"
            }`}
          >
            <span>🔴 À Compléter</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[13px] font-mono font-bold ${
                activeFilter === "locked" ? "bg-paper/20 text-paper" : "bg-paper-sunk text-ink"
              }`}
            >
              {counts.locked}
            </span>
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-soft">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chercher un cocktail, ingrédient..."
            className="w-full pl-10 pr-4 min-h-[44px] rounded-xl bg-paper-sunk border border-rule text-[15px] text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-terracotta"
          />
        </div>
      </div>

      {/* Menu Accordion List */}
      <div className="space-y-3">
        {sortedResults.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-paper border border-rule">
            <p className="text-[27px] mb-3">🍸</p>
            <p className="text-ink font-semibold text-[15px]">Aucun cocktail ne correspond à votre filtre</p>
            <p className="text-[13px] text-ink-soft mt-1">Explorez les autres onglets ou ajustez votre recherche.</p>
          </div>
        ) : (
          sortedResults.map((item) => {
            const isExpanded = expandedId === item.recipe.id;
            const glassIcon = getGlassIcon(item.recipe.glass);

            return (
              <div
                key={item.recipe.id}
                className={`rounded-2xl border transition-colors overflow-hidden bg-paper ${
                  isExpanded ? "border-terracotta/40" : "border-rule hover:border-terracotta/40"
                }`}
              >
                {/* Menu Header Row */}
                <button
                  onClick={() => toggleExpand(item.recipe.id)}
                  className="tap-target w-full px-6 py-4 flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                        item.usesVip && isVip
                          ? "bg-paper-sunk border border-terracotta/40 text-terracotta"
                          : item.makeable
                          ? "bg-paper-sunk border border-done/35 text-done"
                          : "bg-paper-sunk border border-rule text-ink-soft"
                      }`}
                    >
                      {glassIcon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-display text-[17px] font-bold text-ink group-hover:text-terracotta transition-colors">
                          {item.recipe.name}
                        </h3>
                        {item.usesVip && isVip && (
                          <span className="text-[13px] uppercase font-bold bg-terracotta text-paper px-2 py-0.5 rounded">
                            VIP Secret
                          </span>
                        )}
                        {!item.makeable && (
                          <span className="text-[13px] font-mono text-warn bg-paper-sunk px-2 py-0.5 rounded border border-warn/35">
                            Manque {item.missingTags.length} ingrédient{item.missingTags.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-ink-soft mt-0.5 truncate max-w-md sm:max-w-xl">
                        {item.recipe.glass ? `${item.recipe.glass} · ` : ""}
                        {item.recipe.tags.join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[13px] uppercase tracking-wider font-bold hidden sm:inline-block ${
                        item.usesVip && isVip ? "text-terracotta" : item.makeable ? "text-done" : "text-ink-soft"
                      }`}
                    >
                      {item.makeable ? "Prêt à servir" : "À compléter"}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-transform duration-300 ${
                        isExpanded
                          ? "rotate-180 bg-paper-sunk border-terracotta/50 text-terracotta"
                          : "bg-paper-sunk border-rule text-ink-soft group-hover:text-ink"
                      }`}
                    >
                      ▼
                    </span>
                  </div>
                </button>

                {/* Expanded Menu Recipe Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="border-t border-rule bg-paper-sunk px-6 py-6 space-y-5"
                    >
                      {/* Ingredients Breakdown */}
                      <div>
                        <h4 className="text-[13px] uppercase tracking-caps text-ink-soft font-bold mb-3">
                          Ingrédients du Cocktail
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {item.recipe.tags.map((tag) => {
                            const isMissing = item.missingTags.includes(tag);
                            return (
                              <span
                                key={tag}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold border bg-paper ${
                                  isMissing ? "text-warn border-warn/35" : "text-done border-done/35"
                                }`}
                              >
                                <span>{isMissing ? "⚠️" : "✓"}</span>
                                <span>{tag}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Preparation Step-by-Step */}
                      <div className="rounded-xl bg-paper border border-rule p-4">
                        <h4 className="text-[13px] uppercase tracking-caps text-terracotta mb-2 font-bold flex items-center gap-2">
                          <span>📜 Guide de Mixologie</span>
                        </h4>
                        <p className="text-[15px] text-ink leading-relaxed whitespace-pre-line">
                          {item.recipe.instructions || "Ajoutez les ingrédients dans le verre avec des glaçons, mélangez doucement et servez."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
