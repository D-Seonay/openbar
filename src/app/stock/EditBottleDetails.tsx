"use client";

import { useState, useTransition } from "react";
import { editBottleAction } from "@/app/actions";
import type { Bottle, BottleType } from "@/lib/types";

const TYPES: [BottleType, string][] = [
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
];

/**
 * Rename, recategorise, re-note or (un)mark a bottle VIP after creation.
 *
 * Quantity, formats and photo are edited elsewhere in the drawer and are
 * deliberately left out: they save on every click, whereas these fields want a
 * deliberate "Enregistrer" — a half-typed name should not reach the server.
 */
export default function EditBottleDetails({
  bottle,
  canSeeVip,
}: {
  bottle: Bottle;
  canSeeVip: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: bottle.name,
    type: bottle.type,
    notes: bottle.notes ?? "",
    vip: bottle.vip,
  });

  const close = () => {
    // Reset, so reopening never shows a previous abandoned edit.
    setForm({ name: bottle.name, type: bottle.type, notes: bottle.notes ?? "", vip: bottle.vip });
    setError(null);
    setIsOpen(false);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      setError("Le nom ne peut pas être vide.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await editBottleAction(bottle.id, {
        name,
        type: form.type,
        notes: form.notes.trim() || undefined,
        vip: form.vip,
      });
      if (res?.error) setError(res.error);
      else setIsOpen(false);
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="tap-target-sm w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs text-cream font-bold uppercase tracking-wider transition-colors cursor-pointer"
      >
        ✎ Modifier la fiche
      </button>
    );
  }

  const inputClass =
    "w-full bg-ink-2 border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-cream placeholder:text-muted/50 focus:outline-none focus:border-orange";

  return (
    <div className="p-4 rounded-xl bg-ink border border-orange/25 space-y-3">
      <span className="text-xs uppercase tracking-caps text-gold font-bold block">
        Modifier la fiche
      </span>

      <div>
        <label className="text-[10px] uppercase tracking-caps text-muted mb-1 block">Nom</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
          autoFocus
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-caps text-muted mb-1 block">Catégorie</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as BottleType })}
          className={inputClass}
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value} className="bg-ink">
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-caps text-muted mb-1 block">
          Notes / emplacement
        </label>
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Ex: étagère du milieu"
          className={inputClass}
        />
      </div>

      {/* Only offered to someone who can already see the VIP shelf: otherwise
          the control would let them move a bottle somewhere they cannot look. */}
      {canSeeVip && (
        <label className="flex items-center gap-2.5 text-xs text-gold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.vip}
            onChange={(e) => setForm({ ...form, vip: e.target.checked })}
            className="w-4 h-4 rounded border-orange/30 bg-ink accent-gold cursor-pointer"
          />
          Réserver à la section VIP
        </label>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <button
          onClick={close}
          disabled={isPending}
          className="tap-target-sm flex items-center justify-center px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs text-cream font-semibold transition-colors cursor-pointer disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          onClick={save}
          disabled={isPending}
          className="tap-target-sm flex items-center justify-center px-4 py-2 rounded-xl bg-orange text-ink text-xs font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
