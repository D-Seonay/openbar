import type { BottleType } from "./types";

export interface CategoryStyle {
  label: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorderHover: string;
  glowClass: string;
  accentColor: string;
}

export const CATEGORY_STYLES: Record<BottleType, CategoryStyle> = {
  whisky: {
    label: "Whisky & Bourbon",
    icon: "🥃",
    badgeBg: "bg-amber-950/60",
    badgeText: "text-amber-400",
    badgeBorder: "border-amber-500/30",
    cardBorderHover: "hover:border-amber-500/50",
    glowClass: "shadow-[0_0_20px_rgba(217,119,6,0.18)]",
    accentColor: "#D97706",
  },
  rhum: {
    label: "Rhum",
    icon: "🏴‍☠️",
    badgeBg: "bg-orange-950/60",
    badgeText: "text-orange-400",
    badgeBorder: "border-orange-500/30",
    cardBorderHover: "hover:border-orange-500/50",
    glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.18)]",
    accentColor: "#F59E0B",
  },
  gin: {
    label: "Gin Botanique",
    icon: "🌿",
    badgeBg: "bg-emerald-950/60",
    badgeText: "text-emerald-400",
    badgeBorder: "border-emerald-500/30",
    cardBorderHover: "hover:border-emerald-500/50",
    glowClass: "shadow-[0_0_20px_rgba(16,185,129,0.18)]",
    accentColor: "#10B981",
  },
  vodka: {
    label: "Vodka Givrée",
    icon: "❄️",
    badgeBg: "bg-slate-900/80",
    badgeText: "text-slate-300",
    badgeBorder: "border-slate-400/30",
    cardBorderHover: "hover:border-slate-400/50",
    glowClass: "shadow-[0_0_20px_rgba(148,163,184,0.18)]",
    accentColor: "#94A3B8",
  },
  tequila: {
    label: "Tequila & Mezcal",
    icon: "🌵",
    badgeBg: "bg-yellow-950/60",
    badgeText: "text-yellow-400",
    badgeBorder: "border-yellow-500/30",
    cardBorderHover: "hover:border-yellow-500/50",
    glowClass: "shadow-[0_0_20px_rgba(234,179,8,0.18)]",
    accentColor: "#EAB308",
  },
  vin: {
    label: "Vin d'Exception",
    icon: "🍷",
    badgeBg: "bg-rose-950/60",
    badgeText: "text-rose-400",
    badgeBorder: "border-rose-500/30",
    cardBorderHover: "hover:border-rose-500/50",
    glowClass: "shadow-[0_0_20px_rgba(225,29,72,0.18)]",
    accentColor: "#E11D48",
  },
  champagne: {
    label: "Champagne & Bulles",
    icon: "🍾",
    badgeBg: "bg-amber-900/50",
    badgeText: "text-amber-200",
    badgeBorder: "border-amber-300/30",
    cardBorderHover: "hover:border-amber-300/50",
    glowClass: "shadow-[0_0_20px_rgba(251,191,36,0.18)]",
    accentColor: "#FBBF24",
  },
  liqueur: {
    label: "Liqueur & Apéritif",
    icon: "🍸",
    badgeBg: "bg-red-950/60",
    badgeText: "text-red-400",
    badgeBorder: "border-red-500/30",
    cardBorderHover: "hover:border-red-500/50",
    glowClass: "shadow-[0_0_20px_rgba(244,63,94,0.18)]",
    accentColor: "#F43F5E",
  },
  biere: {
    label: "Bière & Malt",
    icon: "🍺",
    badgeBg: "bg-yellow-900/50",
    badgeText: "text-yellow-300",
    badgeBorder: "border-yellow-400/30",
    cardBorderHover: "hover:border-yellow-400/50",
    glowClass: "shadow-[0_0_20px_rgba(250,204,21,0.18)]",
    accentColor: "#FACC15",
  },
  mixer: {
    label: "Mixer & Soft",
    icon: "🍋",
    badgeBg: "bg-teal-950/60",
    badgeText: "text-teal-400",
    badgeBorder: "border-teal-500/30",
    cardBorderHover: "hover:border-teal-500/50",
    glowClass: "shadow-[0_0_20px_rgba(45,212,191,0.18)]",
    accentColor: "#2DD4BF",
  },
  autre: {
    label: "Autre Spiritueux",
    icon: "✨",
    badgeBg: "bg-stone-900/80",
    badgeText: "text-stone-300",
    badgeBorder: "border-stone-500/30",
    cardBorderHover: "hover:border-stone-400/50",
    glowClass: "shadow-[0_0_20px_rgba(168,162,158,0.18)]",
    accentColor: "#A8A29E",
  },
};

export function getCategoryStyle(type: BottleType): CategoryStyle {
  return (
    CATEGORY_STYLES[type] || {
      label: type,
      icon: "🥃",
      badgeBg: "bg-ink-2",
      badgeText: "text-gold",
      badgeBorder: "border-white/10",
      cardBorderHover: "hover:border-gold/40",
      glowClass: "",
      accentColor: "#E8A563",
    }
  );
}
