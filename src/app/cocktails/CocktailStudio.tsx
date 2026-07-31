"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { RecipeAvailability, CocktailRecipe } from "@/lib/cocktail-types";
import { deleteRecipeAction } from "@/app/actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import CreateRecipeModal from "./CreateRecipeModal";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 20;

interface CocktailStudioProps {
  initialResults: RecipeAvailability[];
  isVip?: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  allTags: string[];
  barId: string;
}

type FormModalState = { mode: "create" } | { mode: "edit"; recipe: CocktailRecipe } | null;

export default function CocktailStudio({
  initialResults,
  isVip = false,
  currentUserId,
  isAdmin = false,
  allTags,
  barId,
}: CocktailStudioProps) {
  const [activeTab, setActiveTab] = useState<"ready" | "vip" | "locked">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<FormModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Keep the page behind the recipe slide-over from scrolling under the finger.
  useEffect(() => {
    if (!selectedRecipeId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selectedRecipeId]);

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

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredResults, currentPage]);
  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);

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

  const canEditRecipe = (recipe: CocktailRecipe) =>
    Boolean(recipe.isCustom && (isAdmin || (currentUserId && recipe.createdById === currentUserId)));

  return (
    <div className="space-y-6 relative">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2.5 rounded-2xl bg-ink-2/90 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("ready")}
            className={`tap-target flex items-center px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
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
              className={`tap-target flex items-center px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
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
            className={`tap-target flex items-center px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "locked"
                ? "bg-orange text-ink font-extrabold shadow-md box-orange-glow"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            À Compléter <span className="font-bold">({counts.locked})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
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

          {isVip && (
            <button
              onClick={() => setFormModal({ mode: "create" })}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider bg-orange text-ink hover:bg-orange-hover transition-colors cursor-pointer"
            >
              ＋ Recette
            </button>
          )}
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
            {paginatedResults.map((item) => {
              const isSelected = selectedRecipeId === item.recipe.id;

              return (
                <div
                  key={item.recipe.id}
                  onClick={() => setSelectedRecipeId(item.recipe.id)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 transition-all duration-200 cursor-pointer ${
                    isSelected ? "bg-orange/15 border-l-4 border-l-orange" : "hover:bg-ink-2"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        item.makeable
                          ? item.usesVip && isVip
                            ? "bg-gold"
                            : "bg-emerald-400"
                          : "bg-muted/40"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-display font-bold text-base text-cream group-hover:text-orange transition-colors break-words">
                          {item.recipe.name}
                        </span>
                        {item.recipe.isCustom && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange/20 text-orange border border-orange/30">
                            Custom
                          </span>
                        )}
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
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {item.recipe.glass ? `${item.recipe.glass} · ` : ""}
                        {item.recipe.tags.join(" · ")}
                        {item.recipe.isCustom && item.recipe.createdByUsername
                          ? ` · par ${item.recipe.createdByUsername}`
                          : ""}
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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Slide-Over Warm Orange / Cream Recipe Spec Sheet Inspector, portaled to
          <body>: this component renders inside <main class="relative z-10">,
          which is a stacking context, so a z-50 drawer left in place is painted
          *under* the z-50 sticky header instead of covering the screen. */}
      {typeof document !== "undefined" &&
        createPortal(
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
              className="fixed top-0 right-0 h-dvh w-full max-w-lg bg-ink-2 border-l border-white/[0.1] z-50 p-5 sm:p-8 overflow-y-auto overscroll-contain flex flex-col justify-between shadow-2xl pb-safe"
            >
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-caps text-gold font-bold block">
                      Fiche de Mixologie
                    </span>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-cream mt-1 break-words">
                      {selectedItem.recipe.name}
                    </h2>
                    {selectedItem.recipe.isCustom && (
                      <span className="text-[10px] text-muted mt-1 block">
                        Recette custom
                        {selectedItem.recipe.createdByUsername ? ` · par ${selectedItem.recipe.createdByUsername}` : ""}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRecipeId(null)}
                    aria-label="Fermer"
                    className="w-10 h-10 shrink-0 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Glassware & Service Status */}
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 text-xs">
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

                {/* Detailed ingredients list */}
                {selectedItem.recipe.ingredientsList.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                      Ingrédients Détaillés
                    </span>
                    <ul className="space-y-1.5 text-xs text-cream list-disc list-inside">
                      {selectedItem.recipe.ingredientsList.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preparation Guide */}
                <div className="p-5 rounded-xl bg-ink border border-white/[0.08] space-y-2.5">
                  <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                    Guide de Mixologie & Préparation
                  </span>
                  <div className="text-cream text-xs sm:text-sm leading-relaxed space-y-2">
                    {selectedItem.recipe.instructions.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-1.5">
                        {selectedItem.recipe.instructions.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <p>
                        Mesurez les ingrédients avec précision, rafraîchissez au shaker ou au verre à mélange selon le spiritueux, puis servez dans un verre préalablement glacé.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="hidden sm:block text-muted">OpenBar · Carte Cocktails</span>
                <div className="flex flex-wrap items-center gap-2">
                  {canEditRecipe(selectedItem.recipe) && (
                    <>
                      <button
                        onClick={() => {
                          setFormModal({ mode: "edit", recipe: selectedItem.recipe });
                          setSelectedRecipeId(null);
                        }}
                        className="tap-target flex-1 sm:flex-none justify-center flex items-center px-4 py-2.5 rounded-xl bg-ink border border-orange/30 text-orange font-bold uppercase tracking-wider hover:bg-orange/10 transition-colors cursor-pointer"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: selectedItem.recipe.id, name: selectedItem.recipe.name })}
                        className="tap-target flex-1 sm:flex-none justify-center flex items-center px-4 py-2.5 rounded-xl bg-ink border border-red-500/30 text-red-400 font-bold uppercase tracking-wider hover:bg-red-950/20 transition-colors cursor-pointer"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedRecipeId(null)}
                    className="tap-target w-full sm:w-auto justify-center flex items-center px-5 py-2.5 rounded-xl bg-orange text-ink font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.aside>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {formModal && (
        <CreateRecipeModal
          mode={formModal.mode}
          allTags={allTags}
          initialRecipe={formModal.mode === "edit" ? formModal.recipe : undefined}
          onClose={() => setFormModal(null)}
          barId={barId}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title="Supprimer la recette ?"
        description={`Êtes-vous sûr de vouloir supprimer définitivement "${deleteTarget?.name}" ?`}
        isPending={isDeletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          startDeleteTransition(() => {
            deleteRecipeAction(id);
          });
          setSelectedRecipeId(null);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
