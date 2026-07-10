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
});
