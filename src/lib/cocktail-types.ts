export interface CocktailRecipe {
  id: string;
  name: string;
  glass?: string;
  tags: string[];
  ingredientsList: string[];
  instructions: string[];
  prepTime: string;
  difficulty: "Facile" | "Moyen" | "Expert";
  description: string;
  isCustom?: boolean;
  createdById?: string;
  createdByUsername?: string;
  vip?: boolean;
}

export interface RecipeAvailability {
  recipe: CocktailRecipe;
  makeable: boolean;
  usesVip: boolean;
  missingTags: string[];
}
