"use client";

import { useState, useTransition } from "react";
import { editBottleAction } from "@/app/actions";
import type { Bottle, BottleType, BottleVolume } from "@/lib/types";

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
 * Edit every field of an existing bottle.
 *
 * Only the photo is handled elsewhere, by the picker just above: an upload has
 * its own progress and failure states, and it commits as soon as a file is
 * chosen rather than waiting for this form's "Enregistrer".
 *
 * Everything here saves on that explicit button rather than on each keystroke,
 * so a half-typed name never reaches the server.
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

  const initial = () => ({
    name: bottle.name,
    type: bottle.type,
    notes: bottle.notes ?? "",
    vip: bottle.vip,
    tags: bottle.tags.join(", "),
    barcode: bottle.barcode ?? "",
    threshold: bottle.lowStockThreshold != null ? String(bottle.lowStockThreshold) : "",
    volumes: (bottle.volumes ?? []).map((v) => ({ ...v })),
  });

  const [form, setForm] = useState(initial);

  const close = () => {
    // Reset, so reopening never shows a previous abandoned edit.
    setForm(initial());
    setError(null);
    setIsOpen(false);
  };

  const setVolume = (index: number, patch: Partial<BottleVolume>) => {
    setForm((f) => ({
      ...f,
      volumes: f.volumes.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      setError("Le nom ne peut pas être vide.");
      return;
    }

    const volumes = form.volumes
      .map((v) => ({ size: v.size.trim(), quantity: Math.max(0, v.quantity) }))
      .filter((v) => v.size);

    const rawThreshold = form.threshold.trim();
    const threshold = rawThreshold === "" ? null : Number(rawThreshold);
    if (threshold !== null && !Number.isFinite(threshold)) {
      setError("Le seuil d'alerte doit être un nombre.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await editBottleAction(bottle.id, {
        name,
        type: form.type,
        notes: form.notes.trim() || undefined,
        vip: form.vip,
        tags: form.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        lowStockThreshold: threshold,
        barcode: form.barcode.trim(),
        volumes,
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
  const labelClass = "text-[10px] uppercase tracking-caps text-muted mb-1 block";

  const total = form.volumes.reduce((sum, v) => sum + (v.quantity || 0), 0);

  return (
    <div className="p-4 rounded-xl bg-ink border border-orange/25 space-y-3">
      <span className="text-xs uppercase tracking-caps text-gold font-bold block">
        Modifier la fiche
      </span>

      <div>
        <label className={labelClass}>Nom</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
          autoFocus
        />
      </div>

      <div>
        <label className={labelClass}>Catégorie</label>
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
        <label className={labelClass}>Notes / emplacement</label>
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Ex: étagère du milieu"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Tags cocktail (séparés par des virgules)</label>
        <input
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Ex: gin, citron vert, tonic"
          className={inputClass}
        />
      </div>

      {/* Formats drive the total, so the count is shown rather than typed. */}
      <div className="space-y-2 border border-white/[0.08] rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <label className={`${labelClass} mb-0`}>Formats en stock</label>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, volumes: [...f.volumes, { size: "70cl", quantity: 1 }] }))
            }
            className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-bold cursor-pointer"
          >
            ＋ Ajouter
          </button>
        </div>

        {form.volumes.length === 0 ? (
          <p className="text-[11px] text-muted/70">
            Aucun format. La quantité passera à 0 — ajoute un format pour la définir.
          </p>
        ) : (
          <div className="space-y-2">
            {form.volumes.map((vol, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <input
                  value={vol.size}
                  onChange={(e) => setVolume(idx, { size: e.target.value })}
                  placeholder="70cl"
                  className="flex-1 min-w-0 basis-full sm:basis-0 bg-ink-2 border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={vol.quantity}
                  onChange={(e) =>
                    setVolume(idx, { quantity: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-20 shrink-0 bg-ink-2 border border-white/[0.12] rounded-lg px-2 py-1.5 text-xs text-center text-cream focus:outline-none focus:border-orange"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, volumes: f.volumes.filter((_, i) => i !== idx) }))
                  }
                  className="tap-target-sm shrink-0 flex items-center px-2 text-[10px] text-muted hover:text-red-400 font-bold uppercase cursor-pointer"
                >
                  Retirer
                </button>
              </div>
            ))}
            <p className="text-[10px] text-muted/70">
              Total : <span className="text-orange font-bold">{total}</span> bouteille
              {total > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Seuil d&apos;alerte</label>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            placeholder="Aucun"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Code-barres</label>
          <input
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            placeholder="Aucun"
            inputMode="numeric"
            className={inputClass}
          />
        </div>
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
