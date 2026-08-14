import type { BottleType } from "./types";

export interface CategoryStyle {
  label: string;
  icon: string;
}

export const CATEGORY_STYLES: Record<BottleType, CategoryStyle> = {
  whisky: {
    label: "Whisky & Bourbon",
    icon: "🥃",
  },
  rhum: {
    label: "Rhum",
    icon: "🏴‍☠️",
  },
  gin: {
    label: "Gin Botanique",
    icon: "🌿",
  },
  vodka: {
    label: "Vodka Givrée",
    icon: "❄️",
  },
  tequila: {
    label: "Tequila & Mezcal",
    icon: "🌵",
  },
  vin: {
    label: "Vin d'Exception",
    icon: "🍷",
  },
  champagne: {
    label: "Champagne & Bulles",
    icon: "🍾",
  },
  liqueur: {
    label: "Liqueur & Apéritif",
    icon: "🍸",
  },
  biere: {
    label: "Bière & Malt",
    icon: "🍺",
  },
  mixer: {
    label: "Mixer & Soft",
    icon: "🍋",
  },
  autre: {
    label: "Autre Spiritueux",
    icon: "✨",
  },
};

export function getCategoryStyle(type: BottleType): CategoryStyle {
  return (
    CATEGORY_STYLES[type] || {
      label: type,
      icon: "🥃",
    }
  );
}
