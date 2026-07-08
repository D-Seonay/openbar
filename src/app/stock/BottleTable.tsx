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
      <p className="text-muted text-sm">{bottles.length === 0 ? empty : "Aucune bouteille ne correspond."}</p>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gold-dim text-xs uppercase tracking-caps border-b border-cream/10">
            <th className="py-2 font-medium">Bouteille</th>
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 font-medium">Quantité</th>
            <th className="py-2 font-medium">Alerte</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b) => (
            <BottleRow key={b.id} bottle={b} />
          ))}
        </tbody>
      </table>
    );

  const body = (
    <>
      {bottles.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom ou un tag..."
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm flex-1 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {content}
    </>
  );

  if (bare) return body;

  return (
    <section>
      {title && <h2 className="font-display text-xl text-cream mb-4">{title}</h2>}
      {body}
    </section>
  );
}
