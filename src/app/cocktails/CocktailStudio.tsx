"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import type { RecipeAvailability, CocktailRecipe } from "@/lib/cocktail-types";
import { deleteRecipeAction } from "@/app/actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import CreateRecipeModal from "./CreateRecipeModal";
import Pagination from "@/components/Pagination";
import { Badge, Button, Card, EmptyState, Row, Sheet } from "@/components/ui";

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

const pilule = (active: boolean) =>
  `tap-target flex items-center px-4 rounded-xl text-[13px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
    active ? "bg-terracotta text-paper" : "bg-paper-sunk border border-rule text-ink-soft hover:text-ink"
  }`;

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

  const formTitle = formModal?.mode === "edit" ? "Modifier la recette" : "Nouvelle recette custom";

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2.5 rounded-2xl bg-paper border border-rule">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveTab("ready")} className={pilule(activeTab === "ready")}>
            Prêts au Bar <span className="opacity-80">({counts.ready})</span>
          </button>

          {isVip && (
            <button onClick={() => setActiveTab("vip")} className={pilule(activeTab === "vip")}>
              🔒 Avec Cave VIP <span className="opacity-80">({counts.vip})</span>
            </button>
          )}

          <button onClick={() => setActiveTab("locked")} className={pilule(activeTab === "locked")}>
            À Compléter <span className="opacity-80">({counts.locked})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-soft">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher cocktail, ingrédient..."
              className="w-full pl-10 pr-4 min-h-[44px] rounded-xl bg-paper-sunk border border-rule text-[15px] text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-terracotta"
            />
          </div>

          {isVip && (
            <Button onClick={() => setFormModal({ mode: "create" })} className="shrink-0">
              ＋ Recette
            </Button>
          )}
        </div>
      </div>

      {/* Recipe list */}
      {filteredResults.length === 0 ? (
        <EmptyState titre="Aucune recette" message="Aucune recette ne correspond à votre filtre." />
      ) : (
        <div className="space-y-3">
          {paginatedResults.map((item) => (
            <Card key={item.recipe.id} className="p-0 overflow-hidden">
              <div className="px-4">
                <Row
                  titre={item.recipe.name}
                  sousTitre={`${item.recipe.glass ? `${item.recipe.glass} · ` : ""}${item.recipe.tags.join(" · ")}${
                    item.recipe.isCustom && item.recipe.createdByUsername ? ` · par ${item.recipe.createdByUsername}` : ""
                  }`}
                  droite={
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {item.recipe.isCustom && <Badge ton="neutre">Custom</Badge>}
                      {item.usesVip && isVip && <Badge ton="alerte">VIP</Badge>}
                      {!item.makeable && (
                        <Badge ton="alerte">
                          {`(Manque ${item.missingTags.length} ingrédient${item.missingTags.length > 1 ? "s" : ""})`}
                        </Badge>
                      )}
                      <Badge ton={item.makeable ? "complet" : "neutre"}>
                        {item.makeable ? "Prêt à servir" : "À compléter"}
                      </Badge>
                    </div>
                  }
                  onClick={() => setSelectedRecipeId(item.recipe.id)}
                  chevron
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Recipe spec sheet */}
      <Sheet
        ouvert={selectedItem !== null}
        titre={selectedItem?.recipe.name ?? ""}
        onFermer={() => setSelectedRecipeId(null)}
      >
        {selectedItem && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-rule">
              <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold block">
                Fiche de Mixologie
              </span>
              {selectedItem.recipe.isCustom && (
                <span className="text-[13px] text-ink-soft mt-1 block">
                  Recette custom
                  {selectedItem.recipe.createdByUsername ? ` · par ${selectedItem.recipe.createdByUsername}` : ""}
                </span>
              )}
            </div>

            {/* Glassware & Service Status */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-paper-sunk border border-rule">
                <span className="text-[13px] uppercase tracking-caps text-ink-soft block">Verre conseillé</span>
                <span className="text-ink font-bold capitalize mt-1 block text-[15px]">
                  {selectedItem.recipe.glass || "Verre standard"}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-paper-sunk border border-rule">
                <span className="text-[13px] uppercase tracking-caps text-ink-soft block">Statut</span>
                <span
                  className={`font-bold mt-1 block text-[15px] ${
                    selectedItem.makeable ? "text-done" : "text-warn"
                  }`}
                >
                  {selectedItem.makeable ? "Réalisable ce soir" : "Ingrédient manquant"}
                </span>
              </div>
            </div>

            {/* Ingredients Audit */}
            <div className="space-y-3">
              <span className="text-[13px] uppercase tracking-caps text-terracotta font-bold block">
                Ingrédients de la Recette
              </span>
              <div className="space-y-2">
                {selectedItem.recipe.tags.map((tag) => {
                  const isMissing = selectedItem.missingTags.includes(tag);
                  return (
                    <div
                      key={tag}
                      className={`flex items-center justify-between p-3.5 rounded-xl border bg-paper-sunk ${
                        isMissing ? "border-warn/35" : "border-rule"
                      }`}
                    >
                      <span className="font-semibold capitalize text-[15px] text-ink">{tag}</span>
                      <span
                        className={`text-[13px] font-bold ${isMissing ? "text-warn" : "text-done"}`}
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
                <span className="text-[13px] uppercase tracking-caps text-terracotta font-bold block">
                  Ingrédients Détaillés
                </span>
                <ul className="space-y-1.5 text-[13px] text-ink list-disc list-inside">
                  {selectedItem.recipe.ingredientsList.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preparation Guide */}
            <div className="p-5 rounded-xl bg-paper-sunk border border-rule space-y-2.5">
              <span className="text-[13px] uppercase tracking-caps text-terracotta font-bold block">
                Guide de Mixologie & Préparation
              </span>
              <div className="text-ink text-[15px] leading-relaxed space-y-2">
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

            <div className="pt-6 border-t border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="hidden sm:block text-[13px] text-ink-soft">OpenBar · Carte Cocktails</span>
              <div className="flex flex-wrap items-center gap-2">
                {canEditRecipe(selectedItem.recipe) && (
                  <>
                    <Button
                      variant="discret"
                      onClick={() => {
                        setFormModal({ mode: "edit", recipe: selectedItem.recipe });
                        setSelectedRecipeId(null);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setDeleteTarget({ id: selectedItem.recipe.id, name: selectedItem.recipe.name })}
                    >
                      Supprimer
                    </Button>
                  </>
                )}
                <Button onClick={() => setSelectedRecipeId(null)}>Fermer</Button>
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet ouvert={formModal !== null} titre={formTitle} onFermer={() => setFormModal(null)}>
        {formModal && (
          <CreateRecipeModal
            mode={formModal.mode}
            allTags={allTags}
            initialRecipe={formModal.mode === "edit" ? formModal.recipe : undefined}
            onClose={() => setFormModal(null)}
            barId={barId}
          />
        )}
      </Sheet>

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
