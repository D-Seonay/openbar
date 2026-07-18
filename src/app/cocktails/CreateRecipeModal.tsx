"use client";

import { useState } from "react";
import { createRecipe, updateRecipe } from "@/app/actions";
import type { CocktailRecipe } from "@/lib/cocktail-types";

const DIFFICULTIES = ["Facile", "Moyen", "Expert"] as const;

interface CreateRecipeModalProps {
  mode: "create" | "edit";
  allTags: string[];
  initialRecipe?: CocktailRecipe;
  onClose: () => void;
  barId: string;
}

export default function CreateRecipeModal({ mode, allTags, initialRecipe, onClose, barId }: CreateRecipeModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialRecipe?.tags ?? []);
  const [ingredientsList, setIngredientsList] = useState<string[]>(initialRecipe?.ingredientsList ?? [""]);
  const [instructions, setInstructions] = useState<string[]>(initialRecipe?.instructions ?? [""]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const updateLine = (list: string[], setList: (v: string[]) => void, idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    setList(next);
  };

  const addLine = (list: string[], setList: (v: string[]) => void) => setList([...list, ""]);

  const removeLine = (list: string[], setList: (v: string[]) => void, idx: number) =>
    setList(list.filter((_, i) => i !== idx));

  const action = mode === "edit" && initialRecipe ? updateRecipe.bind(null, initialRecipe.id) : createRecipe.bind(null, barId);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const hasTag = selectedTags.length > 0;
    const hasIngredient = ingredientsList.some((line) => line.trim() !== "");
    const hasInstruction = instructions.some((line) => line.trim() !== "");

    if (!hasTag || !hasIngredient || !hasInstruction) {
      e.preventDefault();
      setValidationError(
        "Sélectionnez au moins un ingrédient de faisabilité, une ligne d'ingrédient détaillé et une étape de préparation."
      );
      return;
    }

    setValidationError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-ink-2/95 border border-orange/20 rounded-2xl p-6 sm:p-7 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
          <h3 className="font-display text-xl font-bold text-cream">
            {mode === "edit" ? "Modifier la recette" : "Nouvelle recette custom"}
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
          >
            ×
          </button>
        </div>

        <form action={action} onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <input type="hidden" name="ingredientsList" value={JSON.stringify(ingredientsList.filter(Boolean))} />
          <input type="hidden" name="instructions" value={JSON.stringify(instructions.filter(Boolean))} />

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Nom du cocktail</label>
            <input
              name="name"
              defaultValue={initialRecipe?.name}
              placeholder="Ex: Le Punch de Noa"
              required
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Verre conseillé</label>
            <input
              name="glass"
              defaultValue={initialRecipe?.glass}
              placeholder="Ex: Verre à mojito"
              required
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Temps de préparation</label>
            <input
              name="prepTime"
              defaultValue={initialRecipe?.prepTime}
              placeholder="Ex: 5 min"
              required
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Difficulté</label>
            <select
              name="difficulty"
              defaultValue={initialRecipe?.difficulty ?? "Moyen"}
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d} className="bg-ink">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2.5 text-sm text-gold cursor-pointer select-none">
              <input
                type="checkbox"
                name="vip"
                defaultChecked={initialRecipe?.vip}
                className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-gold cursor-pointer"
              />
              <span className="font-medium">Réserver à la section VIP</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Description</label>
            <textarea
              name="description"
              defaultValue={initialRecipe?.description}
              placeholder="Une courte description de la recette"
              required
              rows={2}
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div className="sm:col-span-2 space-y-2 border border-orange/15 bg-ink/40 p-4 rounded-xl">
            <label className="text-xs uppercase tracking-caps text-gold-dim block">
              Ingrédients de faisabilité (tags de cave)
            </label>
            {allTags.length === 0 ? (
              <p className="text-xs text-muted/65">Aucun tag de bouteille disponible dans la cave.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {allTags.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 text-xs text-cream cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag}
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="w-4 h-4 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-orange cursor-pointer"
                    />
                    <span className="capitalize">{tag}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 space-y-3 border border-orange/15 bg-ink/40 p-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-orange/5 pb-2">
              <label className="text-xs uppercase tracking-caps text-gold-dim block">
                Ingrédients détaillés (avec quantités)
              </label>
              <button
                type="button"
                onClick={() => addLine(ingredientsList, setIngredientsList)}
                className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-semibold transition-colors"
              >
                ＋ Ajouter une ligne
              </button>
            </div>
            {ingredientsList.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={line}
                  placeholder="Ex: 6cl rhum blanc"
                  onChange={(e) => updateLine(ingredientsList, setIngredientsList, idx, e.target.value)}
                  className="flex-1 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                {ingredientsList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(ingredientsList, setIngredientsList, idx)}
                    className="text-xs text-muted hover:text-red-400 font-semibold px-2 py-1 transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="sm:col-span-2 space-y-3 border border-orange/15 bg-ink/40 p-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-orange/5 pb-2">
              <label className="text-xs uppercase tracking-caps text-gold-dim block">Étapes de préparation</label>
              <button
                type="button"
                onClick={() => addLine(instructions, setInstructions)}
                className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-semibold transition-colors"
              >
                ＋ Ajouter une étape
              </button>
            </div>
            {instructions.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={line}
                  placeholder="Ex: Piler la menthe avec le sucre"
                  onChange={(e) => updateLine(instructions, setInstructions, idx, e.target.value)}
                  className="flex-1 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                {instructions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(instructions, setInstructions, idx)}
                    className="text-xs text-muted hover:text-red-400 font-semibold px-2 py-1 transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>

          {validationError && (
            <p className="sm:col-span-2 text-xs text-red-400 font-semibold">{validationError}</p>
          )}

          <button
            type="submit"
            className="sm:col-span-2 bg-orange text-ink font-semibold rounded-lg py-2.5 hover:bg-cream transition-colors mt-2 uppercase tracking-caps text-xs duration-350 cursor-pointer"
          >
            {mode === "edit" ? "Enregistrer les modifications" : "Créer la recette"}
          </button>
        </form>
      </div>
    </div>
  );
}
