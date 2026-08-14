"use client";

import { useState } from "react";
import { createRecipe, updateRecipe } from "@/app/actions";
import type { CocktailRecipe } from "@/lib/cocktail-types";
import { Button, Field, champClasses } from "@/components/ui";

const DIFFICULTIES = ["Facile", "Moyen", "Expert"] as const;

interface CreateRecipeModalProps {
  mode: "create" | "edit";
  allTags: string[];
  initialRecipe?: CocktailRecipe;
  onClose: () => void;
  barId: string;
}

// Rendu à l'intérieur du <Sheet> de CocktailStudio, qui porte déjà le titre
// et le bouton de fermeture : ce composant n'expose que le formulaire.
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
    <form
      action={action}
      onSubmit={handleSubmit}
      className="grid sm:grid-cols-2 gap-x-4"
    >
      <input type="hidden" name="ingredientsList" value={JSON.stringify(ingredientsList.filter(Boolean))} />
      <input type="hidden" name="instructions" value={JSON.stringify(instructions.filter(Boolean))} />

      <div className="sm:col-span-2">
        <Field label="Nom du cocktail" htmlFor="recipe-name">
          <input
            id="recipe-name"
            name="name"
            defaultValue={initialRecipe?.name}
            placeholder="Ex: Le Punch d'Orange"
            required
            className={champClasses}
          />
        </Field>
      </div>

      <Field label="Verre conseillé" htmlFor="recipe-glass">
        <input
          id="recipe-glass"
          name="glass"
          defaultValue={initialRecipe?.glass}
          placeholder="Ex: Verre à mojito"
          required
          className={champClasses}
        />
      </Field>

      <Field label="Temps de préparation" htmlFor="recipe-prepTime">
        <input
          id="recipe-prepTime"
          name="prepTime"
          defaultValue={initialRecipe?.prepTime}
          placeholder="Ex: 5 min"
          required
          className={champClasses}
        />
      </Field>

      <Field label="Difficulté" htmlFor="recipe-difficulty">
        <select
          id="recipe-difficulty"
          name="difficulty"
          defaultValue={initialRecipe?.difficulty ?? "Moyen"}
          className={`appearance-none ${champClasses}`}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d} className="bg-paper">
              {d}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-end mb-4">
        <label className="tap-target flex items-center gap-2.5 text-[15px] text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            name="vip"
            defaultChecked={initialRecipe?.vip}
            className="tap-target shrink-0 rounded border-rule accent-terracotta cursor-pointer"
          />
          <span className="font-medium">Réserver à la section VIP</span>
        </label>
      </div>

      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="recipe-description">
          <textarea
            id="recipe-description"
            name="description"
            defaultValue={initialRecipe?.description}
            placeholder="Une courte description de la recette"
            required
            rows={2}
            className={champClasses}
          />
        </Field>
      </div>

      <div className="sm:col-span-2 mb-4 space-y-2 border border-rule bg-paper-sunk p-4 rounded-xl">
        <label className="text-[13px] uppercase tracking-caps text-ink-soft block">
          Ingrédients de faisabilité (tags de cave)
        </label>
        {allTags.length === 0 ? (
          <p className="text-[13px] text-ink-soft">Aucun tag de bouteille disponible dans la cave.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {allTags.map((tag) => (
              <label key={tag} className="tap-target flex items-center gap-2 text-[13px] text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="tags"
                  value={tag}
                  checked={selectedTags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                  className="tap-target shrink-0 rounded border-rule accent-terracotta cursor-pointer"
                />
                <span className="capitalize">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="sm:col-span-2 mb-4 space-y-3 border border-rule bg-paper-sunk p-4 rounded-xl">
        <div className="flex justify-between items-center border-b border-rule pb-2">
          <label className="text-[13px] uppercase tracking-caps text-ink-soft block">
            Ingrédients détaillés (avec quantités)
          </label>
          <button
            type="button"
            onClick={() => addLine(ingredientsList, setIngredientsList)}
            className="tap-target px-2 text-[13px] uppercase tracking-caps text-terracotta font-semibold transition-colors"
          >
            ＋ Ajouter une ligne
          </button>
        </div>
        {ingredientsList.map((line, idx) => (
          <div key={idx} className="flex gap-2 items-center min-w-0">
            <input
              type="text"
              value={line}
              placeholder="Ex: 6cl rhum blanc"
              onChange={(e) => updateLine(ingredientsList, setIngredientsList, idx, e.target.value)}
              className={`flex-1 ${champClasses}`}
            />
            {ingredientsList.length > 1 && (
              <button
                type="button"
                onClick={() => removeLine(ingredientsList, setIngredientsList, idx)}
                className="tap-target shrink-0 text-[13px] text-ink-soft hover:text-terracotta font-semibold px-2 transition-colors"
              >
                Retirer
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sm:col-span-2 mb-4 space-y-3 border border-rule bg-paper-sunk p-4 rounded-xl">
        <div className="flex justify-between items-center border-b border-rule pb-2">
          <label className="text-[13px] uppercase tracking-caps text-ink-soft block">Étapes de préparation</label>
          <button
            type="button"
            onClick={() => addLine(instructions, setInstructions)}
            className="tap-target px-2 text-[13px] uppercase tracking-caps text-terracotta font-semibold transition-colors"
          >
            ＋ Ajouter une étape
          </button>
        </div>
        {instructions.map((line, idx) => (
          <div key={idx} className="flex gap-2 items-center min-w-0">
            <input
              type="text"
              value={line}
              placeholder="Ex: Piler la menthe avec le sucre"
              onChange={(e) => updateLine(instructions, setInstructions, idx, e.target.value)}
              className={`flex-1 ${champClasses}`}
            />
            {instructions.length > 1 && (
              <button
                type="button"
                onClick={() => removeLine(instructions, setInstructions, idx)}
                className="tap-target shrink-0 text-[13px] text-ink-soft hover:text-terracotta font-semibold px-2 transition-colors"
              >
                Retirer
              </button>
            )}
          </div>
        ))}
      </div>

      {validationError && (
        <div className="sm:col-span-2 mb-4 text-[13px] bg-paper-sunk border border-terracotta/30 rounded-xl p-3 text-terracotta text-center font-semibold" role="alert">
          {validationError}
        </div>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" pleineLargeur>
          {mode === "edit" ? "Enregistrer les modifications" : "Créer la recette"}
        </Button>
      </div>
    </form>
  );
}
