import { Injectable } from '@nestjs/common';
import { BottlesService } from '../bottles/bottles.service';
import { RecipesService } from '../recipes/recipes.service';
import { COCKTAILS, type CocktailRecipe } from './cocktails.data';

export interface RecipeAvailability {
  recipe: CocktailRecipe;
  makeable: boolean;
  usesVip: boolean;
  missingTags: string[];
}

interface StockLike {
  quantity: number;
  tags: string[];
  vip: boolean;
}

function normalize(tag: string) {
  return tag.trim().toLowerCase();
}

export function evaluateRecipes(
  bottles: StockLike[],
  recipes: CocktailRecipe[] = COCKTAILS,
): RecipeAvailability[] {
  const inStock = bottles.filter((b) => b.quantity > 0);

  function bestMatch(tag: string) {
    const candidates = inStock.filter((b) => b.tags.map(normalize).includes(normalize(tag)));
    if (candidates.length === 0) return null;
    return candidates.find((b) => !b.vip) ?? candidates[0];
  }

  return recipes.map((recipe) => {
    const missingTags: string[] = [];
    let usesVip = false;
    for (const tag of recipe.tags) {
      const match = bestMatch(tag);
      if (!match) {
        missingTags.push(tag);
      } else if (match.vip) {
        usesVip = true;
      }
    }
    return { recipe, makeable: missingTags.length === 0, usesVip, missingTags };
  });
}

@Injectable()
export class CocktailsService {
  constructor(
    private readonly bottlesService: BottlesService,
    private readonly recipesService: RecipesService,
  ) {}

  async evaluate(barId: string, includeVip: boolean): Promise<RecipeAvailability[]> {
    const [bottles, customRecipes] = await Promise.all([
      this.bottlesService.findAll(barId, includeVip),
      this.recipesService.findVisible(barId, includeVip),
    ]);

    const mapped: CocktailRecipe[] = customRecipes.map((r) => ({
      id: r.id,
      name: r.name,
      glass: r.glass ?? undefined,
      tags: r.tags,
      ingredientsList: r.ingredientsList,
      instructions: r.instructions,
      prepTime: r.prepTime,
      difficulty: r.difficulty,
      description: r.description,
      isCustom: true,
      createdById: r.createdById,
      createdByUsername: r.createdBy.username,
      vip: r.vip,
    }));

    return evaluateRecipes(bottles, [...COCKTAILS, ...mapped]);
  }
}
