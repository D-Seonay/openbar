import { evaluateRecipes } from './cocktails.service';
import { COCKTAILS } from './cocktails.data';

interface TestBottle {
  quantity: number;
  tags: string[];
  vip: boolean;
}

function bottle(overrides: Partial<TestBottle>): TestBottle {
  return {
    quantity: overrides.quantity ?? 1,
    tags: overrides.tags ?? [],
    vip: overrides.vip ?? false,
  };
}

describe('evaluateRecipes', () => {
  it('marks a recipe makeable when every required tag is covered', () => {
    const bottles = [bottle({ tags: ['rhum blanc'] }), bottle({ tags: ['cola'] }), bottle({ tags: ['citron vert'] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === 'cuba-libre')!;
    expect(cubaLibre.makeable).toBe(true);
    expect(cubaLibre.missingTags).toEqual([]);
  });

  it('lists the missing tags for a recipe that cannot be made', () => {
    const bottles = [bottle({ tags: ['rhum blanc'] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === 'cuba-libre')!;
    expect(cubaLibre.makeable).toBe(false);
    expect(cubaLibre.missingTags).toEqual(['cola', 'citron vert']);
  });

  it('ignores bottles with zero quantity', () => {
    const bottles = [bottle({ tags: ['rhum blanc'], quantity: 0 })];
    const results = evaluateRecipes(bottles);
    const daiquiri = results.find((r) => r.recipe.id === 'daiquiri')!;
    expect(daiquiri.missingTags).toContain('rhum blanc');
  });

  it('prefers a non-VIP bottle over a VIP bottle covering the same tag', () => {
    const bottles = [bottle({ tags: ['whisky'], vip: true }), bottle({ tags: ['whisky'], vip: false }), bottle({ tags: ['cola'] })];
    const results = evaluateRecipes(bottles);
    const whiskyCoca = results.find((r) => r.recipe.id === 'whisky-coca')!;
    expect(whiskyCoca.makeable).toBe(true);
    expect(whiskyCoca.usesVip).toBe(false);
  });

  it('flags a recipe as VIP-only when only a VIP bottle covers a required tag', () => {
    const bottles = [bottle({ tags: ['whisky'], vip: true }), bottle({ tags: ['cola'] })];
    const results = evaluateRecipes(bottles);
    const whiskyCoca = results.find((r) => r.recipe.id === 'whisky-coca')!;
    expect(whiskyCoca.makeable).toBe(true);
    expect(whiskyCoca.usesVip).toBe(true);
  });

  it('matches tags case-insensitively', () => {
    const bottles = [bottle({ tags: ['RHUM Blanc'] }), bottle({ tags: ['Cola'] }), bottle({ tags: ['Citron Vert'] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === 'cuba-libre')!;
    expect(cubaLibre.makeable).toBe(true);
  });

  it('evaluates every recipe in the catalog', () => {
    const results = evaluateRecipes([]);
    expect(results).toHaveLength(COCKTAILS.length);
  });

  it('excludes VIP bottles entirely when includeVip is false, so missingTags stays consistent with makeable', () => {
    const bottles = [
      bottle({ tags: ['whisky'], vip: true }),
      bottle({ tags: ['cola'] }),
    ];
    const nonVipOnly = bottles.filter((b) => !b.vip);
    const results = evaluateRecipes(nonVipOnly);
    const whiskyCoca = results.find((r) => r.recipe.id === 'whisky-coca')!;
    expect(whiskyCoca.makeable).toBe(false);
    expect(whiskyCoca.usesVip).toBe(false);
    expect(whiskyCoca.missingTags).toEqual(['whisky']);
  });

  it('evaluates a custom recipe list when provided instead of the default catalog', () => {
    const customRecipe = {
      id: 'custom-1',
      name: 'Custom Punch',
      tags: ['rhum blanc'],
      ingredientsList: ['6cl rhum blanc'],
      instructions: ['Mélanger'],
      prepTime: '2 min',
      difficulty: 'Facile' as const,
      description: 'Une recette maison',
    };
    const bottles = [bottle({ tags: ['rhum blanc'] })];
    const results = evaluateRecipes(bottles, [customRecipe]);

    expect(results).toHaveLength(1);
    expect(results[0].recipe.id).toBe('custom-1');
    expect(results[0].makeable).toBe(true);
  });

  it('merges custom recipes alongside the official catalog when both are passed', () => {
    const customRecipe = {
      id: 'custom-2',
      name: 'Custom Sour',
      tags: ['whisky'],
      ingredientsList: ['5cl whisky'],
      instructions: ['Shaker'],
      prepTime: '3 min',
      difficulty: 'Moyen' as const,
      description: 'Une variante maison',
    };
    const results = evaluateRecipes([], [...COCKTAILS, customRecipe]);

    expect(results).toHaveLength(COCKTAILS.length + 1);
    expect(results.some((r) => r.recipe.id === 'custom-2')).toBe(true);
  });
});
