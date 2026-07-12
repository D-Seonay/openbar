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
      {/* Search & Luxury Bar Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-3 rounded-2xl bg-ink-2/90 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveFilter("ready")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeFilter === "ready"
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-ink font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            <span>🟢 Prêts au Bar</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeFilter === "ready" ? "bg-ink/20 text-ink" : "bg-white/[0.07] text-cream"
              }`}
            >
              {counts.ready}
            </span>
          </button>

          {isVip && (
            <button
              onClick={() => setActiveFilter("vip")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeFilter === "vip"
                  ? "bg-gradient-to-r from-gold to-amber-300 text-ink font-extrabold shadow-md gold-glow"
                  : "text-gold-dim hover:text-gold hover:bg-gold/10 border border-gold/20"
              }`}
            >
              <span>🔒 Avec Cave VIP</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeFilter === "vip" ? "bg-ink/20 text-ink" : "bg-gold/20 text-gold"
                }`}
              >
                {counts.vip}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveFilter("locked")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeFilter === "locked"
                ? "bg-orange text-ink font-extrabold shadow-md box-orange-glow"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            <span>🔴 À Compléter</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeFilter === "locked" ? "bg-ink/20 text-ink" : "bg-white/[0.07] text-cream"
              }`}
            >
              {counts.locked}
            </span>
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted text-sm">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chercher un cocktail, ingrédient..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ink border border-white/[0.1] text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange/60"
          />
        </div>
      </div>

      {/* Luxury Bar Menu Accordion List */}
      <div className="space-y-3">
        {sortedResults.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-ink-2/40 border border-white/[0.06]">
            <p className="text-4xl mb-3">🍸</p>
            <p className="text-cream font-semibold text-base">Aucun cocktail ne correspond à votre filtre</p>
            <p className="text-xs text-muted mt-1">Explorez les autres onglets ou ajustez votre recherche.</p>
          </div>
        ) : (
          sortedResults.map((item) => {
            const isExpanded = expandedId === item.recipe.id;
            const glassIcon = getGlassIcon(item.recipe.glass);

            return (
              <div
                key={item.recipe.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? item.usesVip && isVip
                      ? "bg-brick-dark/40 border-gold/40 shadow-xl"
                      : item.makeable
                      ? "bg-ink-2 border-orange/40 shadow-xl"
                      : "bg-ink-2 border-white/[0.15] shadow-lg"
                    : item.usesVip && isVip
                    ? "bg-brick-dark/25 border-gold/25 hover:border-gold/50"
                    : item.makeable
                    ? "bg-ink-2/70 border-white/[0.08] hover:border-orange/40"
                    : "bg-ink-2/40 border-white/[0.05] opacity-85 hover:opacity-100"
                }`}
              >
                {/* Luxury Menu Header Row */}
                <button
                  onClick={() => toggleExpand(item.recipe.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105 ${
                        item.usesVip && isVip
                          ? "bg-gold/20 border border-gold/40 text-gold"
                          : item.makeable
                          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                          : "bg-white/[0.04] border border-white/[0.08] text-muted"
                      }`}
                    >
                      {glassIcon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-display text-lg sm:text-xl font-bold text-cream group-hover:text-orange transition-colors">
                          {item.recipe.name}
                        </h3>
                        {item.usesVip && isVip && (
                          <span className="text-[10px] uppercase font-bold bg-gold text-ink px-2 py-0.5 rounded shadow-sm">
                            VIP Secret
                          </span>
                        )}
                        {!item.makeable && (
                          <span className="text-[10px] font-mono text-orange bg-orange/15 px-2 py-0.5 rounded border border-orange/30">
                            Manque {item.missingTags.length} ingrédient{item.missingTags.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 truncate max-w-md sm:max-w-xl">
                        {item.recipe.glass ? `${item.recipe.glass} · ` : ""}
                        {item.recipe.tags.join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs uppercase tracking-wider font-bold hidden sm:inline-block ${
                        item.usesVip && isVip
                          ? "text-gold"
                          : item.makeable
                          ? "text-emerald-400"
                          : "text-muted"
                      }`}
                    >
                      {item.makeable ? "Prêt à servir" : "À compléter"}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-transform duration-300 ${
                        isExpanded
                          ? "rotate-180 bg-orange/20 border-orange/50 text-orange"
                          : "bg-white/[0.05] border-white/[0.1] text-muted group-hover:text-cream"
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
                      className="border-t border-white/[0.08] bg-ink/50 px-6 py-6 space-y-5"
                    >
                      {/* Ingredients Breakdown */}
                      <div>
                        <h4 className="text-xs uppercase tracking-caps text-muted font-bold mb-3">
                          Ingrédients du Cocktail
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {item.recipe.tags.map((tag) => {
                            const isMissing = item.missingTags.includes(tag);
                            return (
                              <span
                                key={tag}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                                  isMissing
                                    ? "bg-red-950/50 text-red-300 border-red-500/30"
                                    : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
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
                      <div className="rounded-xl bg-ink-2/80 border border-white/[0.07] p-4">
                        <h4 className="text-xs uppercase tracking-caps text-gold mb-2 font-bold flex items-center gap-2">
                          <span>📜 Guide de Mixologie</span>
                        </h4>
                        <p className="text-sm text-cream leading-relaxed whitespace-pre-line">
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
