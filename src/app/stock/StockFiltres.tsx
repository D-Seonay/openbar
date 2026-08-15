"use client";

import type { BottleType } from "@/lib/types";
import { Button } from "@/components/ui";

interface StockFiltresProps {
  isAdmin: boolean;
  isVip: boolean;
  activeUniverse: "bar" | "vip" | "shopping";
  onUniverseChange: (universe: "bar" | "vip" | "shopping") => void;
  normalCount: number;
  vipCount: number;
  shoppingCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: BottleType | "all";
  onCategoryChange: (category: BottleType | "all") => void;
  availableCategories: BottleType[];
  currentListCount: number;
  showCopier: boolean;
  showExporter: boolean;
  onScanner: () => void;
  onAjouter: () => void;
  onCopier: () => void;
  onExporter: () => void;
}

const pilule = (active: boolean) =>
  `tap-target flex items-center px-3 rounded-lg text-[13px] font-semibold transition-colors shrink-0 cursor-pointer ${
    active ? "bg-terracotta text-paper" : "bg-paper-sunk border border-rule text-ink-soft hover:text-ink"
  }`;

/** La recherche, les onglets bar/VIP/courses et les puces de catégorie —
 * purement contrôlé, tout l'état reste dans StockStudio. */
export default function StockFiltres({
  isAdmin,
  isVip,
  activeUniverse,
  onUniverseChange,
  normalCount,
  vipCount,
  shoppingCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  availableCategories,
  currentListCount,
  showCopier,
  showExporter,
  onScanner,
  onAjouter,
  onCopier,
  onExporter,
}: StockFiltresProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
        <button onClick={() => onUniverseChange("bar")} className={pilule(activeUniverse === "bar")}>
          Bar Principal <span className="opacity-80">({normalCount})</span>
        </button>
        {isVip && (
          <button onClick={() => onUniverseChange("vip")} className={pilule(activeUniverse === "vip")}>
            🔒 Réserve Privée VIP <span className="opacity-80">({vipCount})</span>
          </button>
        )}
        <button onClick={() => onUniverseChange("shopping")} className={pilule(activeUniverse === "shopping")}>
          🛒 Liste & Courses {shoppingCount > 0 && <span className="font-bold">({shoppingCount})</span>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <>
            <Button onClick={onScanner}>📷 Scanner</Button>
            <Button variant="discret" onClick={onAjouter}>
              + Ajouter au Stock
            </Button>
          </>
        )}
        {showCopier && (
          <Button variant="discret" onClick={onCopier}>📋 Copier la liste</Button>
        )}
        {showExporter && (
          <Button variant="discret" onClick={onExporter}>📥 Exporter en CSV</Button>
        )}
      </div>

      <div className="relative">
        <span aria-hidden className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-soft">
          🔍
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher une bouteille, tag (rhum, citron)..."
          className="w-full pl-10 pr-4 min-h-[44px] rounded-xl bg-paper-sunk border border-rule text-[15px] text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-terracotta"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
        <button onClick={() => onCategoryChange("all")} className={pilule(selectedCategory === "all")}>
          Toutes ({currentListCount})
        </button>
        {availableCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`${pilule(selectedCategory === cat)} capitalize`}
          >
            {cat}
          </button>
        ))}
      </div>
    </>
  );
}
