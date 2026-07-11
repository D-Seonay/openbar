"use client";

import { useState, useMemo } from "react";
import type { RecipeAvailability } from "@/lib/cocktail-types";
import ShoppingList from "./ShoppingList";

interface CocktailGridProps {
  initialResults: RecipeAvailability[];
}

export default function CocktailGrid({ initialResults }: CocktailGridProps) {
  const [activeFilter, setActiveFilter] = useState<"ready" | "vip" | "locked">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredResults = useMemo(() => {
    return initialResults.filter((r) => {
      const matchesSearch =
        r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.recipe.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeFilter === "ready") {
        return r.makeable && !r.usesVip;
      } else if (activeFilter === "vip") {
        return r.makeable && r.usesVip;
      } else {
        return !r.makeable;
      }
    });
  }, [initialResults, activeFilter, searchQuery]);

  // Sort locked recipes by how many ingredients are missing (closer to completion first)
  const sortedResults = useMemo(() => {
    if (activeFilter === "locked") {
      return [...filteredResults].sort((a, b) => a.missingTags.length - b.missingTags.length);
    }
    return filteredResults;
  }, [filteredResults, activeFilter]);

  // All missing tags across locked recipes for shopping list helper
  const allMissingTags = useMemo(() => {
    const missing = initialResults
      .filter((r) => !r.makeable)
      .flatMap((r) => r.missingTags);
    return Array.from(new Set(missing)).sort();
  }, [initialResults]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getGlassIcon = (glassType?: string) => {
    const glass = glassType?.toLowerCase() ?? "";
    if (glass.includes("coupe") || glass.includes("martini")) return "🍸";
    if (glass.includes("flûte") || glass.includes("bulles")) return "🥂";
    if (glass.includes("ballon")) return "🍷";
    if (glass.includes("cuivre")) return "🍺";
    if (glass.includes("tumbler") || glass.includes("old fashioned")) return "🥃";
    return "🍹";
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-ink-2/30 p-4 rounded-xl border border-orange/10">
        {/* Filter buttons */}
        <div className="flex gap-1.5 w-full md:w-auto">
          <button
            onClick={() => {
              setActiveFilter("ready");
              setExpandedId(null);
            }}
            className={`flex-1 md:flex-initial px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${
              activeFilter === "ready"
                ? "bg-orange text-white box-orange-glow"
                : "bg-ink/50 text-muted hover:text-cream border border-orange/5"
            }`}
          >
            🍹 Prêts à servir ({initialResults.filter((r) => r.makeable && !r.usesVip).length})
          </button>
          <button
            onClick={() => {
              setActiveFilter("vip");
              setExpandedId(null);
            }}
            className={`flex-1 md:flex-initial px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${
              activeFilter === "vip"
                ? "bg-gold text-ink font-bold box-orange-glow"
                : "bg-ink/50 text-muted hover:text-cream border border-orange/5"
            }`}
          >
            🔒 VIP ({initialResults.filter((r) => r.makeable && r.usesVip).length})
          </button>
          <button
            onClick={() => {
              setActiveFilter("locked");
              setExpandedId(null);
            }}
            className={`flex-1 md:flex-initial px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${
              activeFilter === "locked"
                ? "bg-brick text-cream hover:bg-brick-light"
                : "bg-ink/50 text-muted hover:text-cream border border-orange/5"
            }`}
          >
            🛒 Courses ({initialResults.filter((r) => !r.makeable).length})
          </button>
        </div>

        {/* Search */}
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par nom ou ingrédient..."
          className="w-full md:w-64 bg-ink/75 border border-orange/10 rounded-lg px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange transition-all text-cream"
        />
      </div>

      {/* Shopping List helper in course mode */}
      {activeFilter === "locked" && allMissingTags.length > 0 && (
        <div className="flex justify-between items-center bg-brick-dark/15 border border-orange/10 p-4 rounded-xl">
          <div>
            <p className="text-sm font-medium text-cream">Besoin de réapprovisionner ?</p>
            <p className="text-xs text-muted">Copiez tous les ingrédients manquants pour faire vos courses.</p>
          </div>
          <ShoppingList items={allMissingTags} />
        </div>
      )}

      {/* Main Grid */}
      {sortedResults.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-orange/10 bg-ink-2/10">
          <span className="text-4xl block mb-2">🍹</span>
          <p className="text-cream font-medium">Aucun cocktail ne correspond.</p>
          <p className="text-muted text-xs mt-1">Essayez d&apos;ajuster vos critères de recherche ou de compléter votre stock.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sortedResults.map(({ recipe, makeable, usesVip, missingTags }) => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div
                key={recipe.id}
                onClick={() => toggleExpand(recipe.id)}
                className={`group rounded-xl border p-5 cursor-pointer transition-all duration-300 ${
                  isExpanded
                    ? "border-orange md:col-span-2 bg-ink-2/65"
                    : usesVip
                    ? "border-gold/20 bg-brick-dark/10 hover:border-gold/45"
                    : "border-orange/10 bg-ink-2/40 hover:border-orange/30"
                } box-orange-glow-hover flex flex-col justify-between`}
              >
                <div>
                  {/* Top line Info */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getGlassIcon(recipe.glass)}</span>
                        <h3 className="font-display text-xl text-cream font-medium">
                          {recipe.name}
                        </h3>
                        {usesVip && (
                          <span className="text-[9px] uppercase tracking-wide bg-gold text-ink px-1.5 py-0.5 rounded font-bold">
                            VIP
                          </span>
                        )}
                        {!makeable && (
                          <span className="text-[9px] uppercase tracking-wide bg-brick text-cream px-1.5 py-0.5 rounded font-medium">
                            Il manque {missingTags.length} ingrédient{missingTags.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-orange uppercase tracking-widest mt-1 font-mono">
                        {recipe.glass ?? "Verre standard"} • {recipe.prepTime} • {recipe.difficulty}
                      </p>
                    </div>
                    <span className="text-orange text-xs opacity-40 group-hover:opacity-100 transition-opacity">
                      {isExpanded ? "▲ Réduire" : "▼ Recette"}
                    </span>
                  </div>

                  {/* Quick description */}
                  <p className="text-muted text-xs mt-3 leading-relaxed">
                    {recipe.description}
                  </p>

                  {/* Summary tags */}
                  {!isExpanded && (
                    <div className="flex flex-wrap gap-1 mt-4">
                      {recipe.tags.map((t) => {
                        const isMissing = !makeable && missingTags.includes(t.toLowerCase());
                        return (
                          <span
                            key={t}
                            className={`text-[9px] px-2 py-0.5 rounded-full border ${
                              isMissing
                                ? "border-red-500/20 bg-red-950/15 text-red-400"
                                : "border-orange/10 bg-ink/40 text-muted"
                            }`}
                          >
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Expanded Full Recipe Detail Drawer */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-orange/10 grid md:grid-cols-5 gap-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                    {/* Left: Ingredients */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="text-[10px] uppercase tracking-wider text-orange font-bold">
                        Ingrédients requis
                      </h4>
                      <ul className="space-y-1.5">
                        {recipe.ingredientsList.map((ingredient, idx) => {
                          // Simple matching to see if user has the ingredient tags
                          const isMissing = recipe.tags.some(
                            (tag) =>
                              ingredient.toLowerCase().includes(tag) &&
                              missingTags.includes(tag)
                          );

                          return (
                            <li key={idx} className="flex gap-2 items-start text-xs">
                              <span className={isMissing ? "text-red-500" : "text-orange"}>
                                {isMissing ? "❌" : "✓"}
                              </span>
                              <span className={isMissing ? "text-muted line-through" : "text-cream"}>
                                {ingredient}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Right: Prep Instructions */}
                    <div className="md:col-span-3 space-y-3">
                      <h4 className="text-[10px] uppercase tracking-wider text-orange font-bold">
                        Instructions de préparation
                      </h4>
                      <ol className="space-y-2 list-decimal list-inside text-xs leading-relaxed text-muted">
                        {recipe.instructions.map((step, idx) => (
                          <li key={idx} className="pl-1">
                            <span className="text-cream">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
