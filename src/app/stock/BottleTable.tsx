"use client";

import { useMemo, useState } from "react";
import type { Bottle } from "@/lib/types";
import BottleRow from "./BottleRow";

const TYPE_OPTIONS = [
  ["", "Tous les types"],
  ["whisky", "Whisky"],
  ["rhum", "Rhum"],
  ["vodka", "Vodka"],
  ["gin", "Gin"],
  ["tequila", "Tequila"],
  ["liqueur", "Liqueur / apéritif"],
  ["vin", "Vin"],
  ["champagne", "Champagne / bulles"],
  ["biere", "Bière"],
  ["mixer", "Soft / mixer"],
  ["autre", "Autre"],
] as const;

export default function BottleTable({
  title,
  bottles,
  empty,
  bare,
}: {
  title?: string;
  bottles: Bottle[];
  empty: string;
  bare?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bottles.filter((b) => {
      const matchesQuery =
        !q || b.name.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q));
      const matchesType = !type || b.type === type;
      return matchesQuery && matchesType;
    });
  }, [bottles, query, type]);

  const content =
    filtered.length === 0 ? (
      <div className="text-center py-10 rounded-xl border border-dashed border-orange/10 bg-ink-2/20">
        <p className="text-muted text-sm">{bottles.length === 0 ? empty : "Aucune bouteille ne correspond aux critères de recherche."}</p>
      </div>
    ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((b) => (
          <BottleRow key={b.id} bottle={b} />
        ))}
      </div>
    );

  const body = (
    <div className="space-y-4">
      {bottles.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une bouteille ou un ingrédient..."
              className="w-full bg-ink-2/60 border border-orange/10 rounded-xl px-4 py-2.5 pl-10 text-sm placeholder:text-muted/50 focus:outline-none focus:border-orange focus:bg-ink-2 transition-all duration-300"
            />
            <span className="absolute left-3.5 top-3 text-muted/65 text-sm">🔍</span>
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-ink-2/60 border border-orange/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange focus:bg-ink-2 transition-all duration-300 text-cream"
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value} className="bg-ink">
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {content}
    </div>
  );

  if (bare) return body;

  return (
    <section className="space-y-4">
      {title && (
        <div className="flex items-center gap-3 border-b border-orange/10 pb-2">
          <span className="w-1.5 h-3 bg-orange rounded-full" />
          <h2 className="font-display text-xl text-cream">{title}</h2>
        </div>
      )}
      {body}
    </section>
  );
}

