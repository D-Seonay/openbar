import type { Bottle } from "./types";

export interface CocktailRecipe {
  id: string;
  name: string;
  glass?: string;
  tags: string[]; // required ingredient tags (lowercase)
  instructions: string;
}

// Static recipe book. Tags are matched against Bottle.tags (lowercase) in stock.
export const COCKTAILS: CocktailRecipe[] = [
  {
    id: "mojito",
    name: "Mojito",
    glass: "Long drink",
    tags: ["rhum blanc", "citron vert", "menthe", "sucre", "soda"],
    instructions:
      "Écraser menthe, sucre et citron vert au fond du verre. Ajouter le rhum, glace pilée, compléter au soda et mélanger.",
  },
  {
    id: "cuba-libre",
    name: "Cuba Libre",
    glass: "Long drink",
    tags: ["rhum blanc", "cola", "citron vert"],
    instructions: "Rhum + glaçons, compléter au cola, un trait de citron vert.",
  },
  {
    id: "daiquiri",
    name: "Daiquiri",
    glass: "Coupe",
    tags: ["rhum blanc", "citron vert", "sucre"],
    instructions: "Shaker rhum, jus de citron vert, sirop de sucre avec glace, filtrer.",
  },
  {
    id: "pina-colada",
    name: "Piña Colada",
    glass: "Long drink",
    tags: ["rhum blanc", "ananas", "coco"],
    instructions: "Mixer rhum, jus d'ananas et crème de coco avec de la glace.",
  },
  {
    id: "old-fashioned",
    name: "Old Fashioned",
    glass: "Tumbler",
    tags: ["whisky", "sucre", "angostura"],
    instructions: "Sucre imbibé d'angostura à écraser, ajouter whisky et un gros glaçon, remuer.",
  },
  {
    id: "whisky-coca",
    name: "Whisky-Coca",
    glass: "Long drink",
    tags: ["whisky", "cola"],
    instructions: "Whisky sur glace, compléter au cola.",
  },
  {
    id: "godfather",
    name: "Godfather",
    glass: "Tumbler",
    tags: ["whisky", "amaretto"],
    instructions: "Whisky et amaretto à parts égales sur glace.",
  },
  {
    id: "gin-tonic",
    name: "Gin Tonic",
    glass: "Ballon",
    tags: ["gin", "tonic", "citron vert"],
    instructions: "Gin sur glace, compléter au tonic, une rondelle de citron vert.",
  },
  {
    id: "negroni",
    name: "Negroni",
    glass: "Tumbler",
    tags: ["gin", "vermouth rouge", "campari"],
    instructions: "Gin, vermouth rouge et Campari à parts égales sur glace, zeste d'orange.",
  },
  {
    id: "martini",
    name: "Dry Martini",
    glass: "Coupe",
    tags: ["gin", "vermouth sec"],
    instructions: "Gin et vermouth sec bien froids, servir avec une olive ou un zeste.",
  },
  {
    id: "moscow-mule",
    name: "Moscow Mule",
    glass: "Tasse en cuivre",
    tags: ["vodka", "ginger beer", "citron vert"],
    instructions: "Vodka, jus de citron vert, compléter au ginger beer sur glace.",
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan",
    glass: "Coupe",
    tags: ["vodka", "triple sec", "citron vert", "cranberry"],
    instructions: "Shaker vodka, triple sec, jus de cranberry, jus de citron vert.",
  },
  {
    id: "screwdriver",
    name: "Screwdriver",
    glass: "Long drink",
    tags: ["vodka", "orange"],
    instructions: "Vodka sur glace, compléter au jus d'orange.",
  },
  {
    id: "espresso-martini",
    name: "Espresso Martini",
    glass: "Coupe",
    tags: ["vodka", "cafe", "sucre"],
    instructions: "Shaker vodka, café expresso froid et sirop de sucre avec glace, filtrer.",
  },
  {
    id: "margarita",
    name: "Margarita",
    glass: "Coupe givrée",
    tags: ["tequila", "triple sec", "citron vert", "sel"],
    instructions: "Shaker tequila, triple sec, jus de citron vert. Verre givré au sel.",
  },
  {
    id: "tequila-sunrise",
    name: "Tequila Sunrise",
    glass: "Long drink",
    tags: ["tequila", "orange", "grenadine"],
    instructions: "Tequila et jus d'orange sur glace, ajouter la grenadine qui coule au fond.",
  },
  {
    id: "spritz",
    name: "Aperol Spritz",
    glass: "Ballon",
    tags: ["aperol", "prosecco", "soda"],
    instructions: "3 parts prosecco, 2 parts Aperol, 1 trait de soda, sur glace, tranche d'orange.",
  },
  {
    id: "kir-royal",
    name: "Kir Royal",
    glass: "Flûte",
    tags: ["champagne", "creme de cassis"],
    instructions: "Un trait de crème de cassis, compléter au champagne.",
  },
  {
    id: "french-75",
    name: "French 75",
    glass: "Flûte",
    tags: ["gin", "champagne", "citron", "sucre"],
    instructions: "Shaker gin, jus de citron, sucre, verser et compléter au champagne.",
  },
  {
    id: "sidecar",
    name: "Sidecar",
    glass: "Coupe",
    tags: ["cognac", "triple sec", "citron"],
    instructions: "Shaker cognac, triple sec, jus de citron avec glace, filtrer.",
  },
  {
    id: "manhattan",
    name: "Manhattan",
    glass: "Coupe",
    tags: ["whisky", "vermouth rouge", "angostura"],
    instructions: "Whisky, vermouth rouge et angostura sur glace, mélanger, filtrer.",
  },
  {
    id: "amaretto-sour",
    name: "Amaretto Sour",
    glass: "Tumbler",
    tags: ["amaretto", "citron", "sucre"],
    instructions: "Shaker amaretto, jus de citron, sirop de sucre avec glace.",
  },
];

export interface RecipeAvailability {
  recipe: CocktailRecipe;
  makeable: boolean;
  usesVip: boolean;
  missingTags: string[];
}

function normalize(tag: string) {
  return tag.trim().toLowerCase();
}

export function evaluateRecipes(bottles: Bottle[]): RecipeAvailability[] {
  const inStock = bottles.filter((b) => b.quantity > 0);

  function bestMatch(tag: string) {
    const candidates = inStock.filter((b) => b.tags.map(normalize).includes(normalize(tag)));
    if (candidates.length === 0) return null;
    // Prefer a non-VIP bottle if one covers the tag, so we don't gate common cocktails.
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
    return {
      recipe,
      makeable: missingTags.length === 0,
      usesVip,
      missingTags,
    };
  });
}

export function recipesForTag(tag: string): CocktailRecipe[] {
  const norm = normalize(tag);
  return COCKTAILS.filter((r) => r.tags.map(normalize).includes(norm));
}
