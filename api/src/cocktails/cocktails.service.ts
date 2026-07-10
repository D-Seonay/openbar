import { Injectable } from '@nestjs/common';
import { BottlesService } from '../bottles/bottles.service';
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

export function evaluateRecipes(bottles: StockLike[]): RecipeAvailability[] {
  const inStock = bottles.filter((b) => b.quantity > 0);

  function bestMatch(tag: string) {
    const candidates = inStock.filter((b) => b.tags.map(normalize).includes(normalize(tag)));
    if (candidates.length === 0) return null;
    return candidates.find((b) => !b.vip) ?? candidates[0];
  }

  return COCKTAILS.map((recipe) => {
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
  constructor(private readonly bottlesService: BottlesService) {}

  async evaluate(): Promise<RecipeAvailability[]> {
    const bottles = await this.bottlesService.findAll();
    return evaluateRecipes(bottles);
  }
}
