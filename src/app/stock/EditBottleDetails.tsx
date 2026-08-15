"use client";

import { useState, useTransition } from "react";
import { editBottleAction } from "@/app/actions";
import type { Bottle, BottleType, BottleVolume } from "@/lib/types";
import { Button, Field, champClasses } from "@/components/ui";

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
 * Only the photo is handled elsewhere, by the picker on the fiche: an upload
 * has its own progress and failure states, and it commits as soon as a file
 * is chosen rather than waiting for this form's "Enregistrer".
 *
 * Everything here saves on that explicit button rather than on each
 * keystroke, so a half-typed name never reaches the server. This component no
 * longer owns its own open/closed state — the enclosing `EditionSheet` does
 * that now — so `onFermer` is called both on "Annuler" and after a
 * successful save, exactly where the old internal `close()` used to collapse
 * the form back down.
 */
export default function EditBottleDetails({
  bottle,
  canSeeVip,
  onFermer,
}: {
  bottle: Bottle;
  canSeeVip: boolean;
  onFermer: () => void;
}) {
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
      else onFermer();
    });
  };

  const total = form.volumes.reduce((sum, v) => sum + (v.quantity || 0), 0);

  return (
    // Pas de space-y-4 ici : chaque <Field> pose déjà son propre mb-4, et il
    // serait alors doublé (mb-4 + mt-4) entre deux champs adjacents. Les
    // quelques enfants non-Field portent donc leur mb-4 individuellement.
    <div>
      <Field label="Nom" htmlFor="edit-bottle-name">
        <input
          id="edit-bottle-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={champClasses}
          autoFocus
        />
      </Field>

      <Field label="Catégorie" htmlFor="edit-bottle-type">
        <select
          id="edit-bottle-type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as BottleType })}
          className={`appearance-none ${champClasses}`}
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes / emplacement" htmlFor="edit-bottle-notes">
        <input
          id="edit-bottle-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Ex: étagère du milieu"
          className={champClasses}
        />
      </Field>

      <Field label="Tags cocktail (séparés par des virgules)" htmlFor="edit-bottle-tags">
        <input
          id="edit-bottle-tags"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Ex: gin, citron vert, tonic"
          className={champClasses}
        />
      </Field>

      {/* Formats drive the total, so the count is shown rather than typed. */}
      <div className="mb-4 space-y-2 border border-rule rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink">Formats en stock</span>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, volumes: [...f.volumes, { size: "70cl", quantity: 1 }] }))
            }
            className="tap-target px-2 text-[13px] uppercase tracking-caps text-terracotta font-bold cursor-pointer"
          >
            ＋ Ajouter
          </button>
        </div>

        {form.volumes.length === 0 ? (
          <p className="text-[13px] text-ink-soft">
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
                  className={`flex-1 min-w-0 basis-full sm:basis-0 ${champClasses}`}
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
                  className={`w-20 shrink-0 text-center ${champClasses}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, volumes: f.volumes.filter((_, i) => i !== idx) }))
                  }
                  className="tap-target shrink-0 flex items-center px-2 text-[13px] text-ink-soft hover:text-terracotta font-bold uppercase cursor-pointer"
                >
                  Retirer
                </button>
              </div>
            ))}
            <p className="text-[13px] text-ink-soft">
              Total : <span className="text-terracotta font-bold">{total}</span> bouteille
              {total > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
        <Field label="Seuil d'alerte" htmlFor="edit-bottle-threshold">
          <input
            id="edit-bottle-threshold"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            placeholder="Aucun"
            className={champClasses}
          />
        </Field>
        <Field label="Code-barres" htmlFor="edit-bottle-barcode">
          <input
            id="edit-bottle-barcode"
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            placeholder="Aucun"
            inputMode="numeric"
            className={champClasses}
          />
        </Field>
      </div>

      {/* Only offered to someone who can already see the VIP shelf: otherwise
          the control would let them move a bottle somewhere they cannot look. */}
      {canSeeVip && (
        <label className="mb-4 tap-target flex items-center gap-2.5 text-[15px] text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.vip}
            onChange={(e) => setForm({ ...form, vip: e.target.checked })}
            className="tap-target shrink-0 rounded border-rule accent-terracotta cursor-pointer"
          />
          Réserver à la section VIP
        </label>
      )}

      {error && <p className="mb-4 text-[13px] text-terracotta">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <Button variant="discret" onClick={onFermer} disabled={isPending}>
          Annuler
        </Button>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
