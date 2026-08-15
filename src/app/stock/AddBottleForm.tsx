"use client";

import { useRef, useState, useTransition } from "react";
import { createBottle, uploadBottleImage } from "@/app/actions";
import type { BottleType, BottleVolume } from "@/lib/types";
import ImagePicker from "@/components/ImagePicker";
import { Button, Field, champClasses } from "@/components/ui";

const TYPES = [
  ["whisky", "Whisky"],
  ["rhum", "Rhum"],
  ["vodka", "Vodka"],
  ["gin", "Gin"],
  ["tequila", "Tequila"],
  ["liqueur", "Liqueur / apéritif"],
  ["vin", "Vin"],
  ["champagne", "Champagne / bulles"],
  ["biere", "Bière"],
  ["mixer", "Soft / mixer (tonic, jus, sirop...)"],
  ["autre", "Autre"],
] as const;

const INITIAL_VOLUMES: BottleVolume[] = [{ size: "70cl", quantity: 1 }];

/** Values a barcode scan can hand over to prefill this form. */
export interface BottlePrefill {
  barcode: string;
  name?: string;
  type?: BottleType;
  imageUrl?: string;
  size?: string;
}

export default function AddBottleForm({
  isVip = false,
  barId,
  onSuccess,
  prefill,
}: {
  isVip?: boolean;
  barId: string;
  onSuccess?: () => void;
  prefill?: BottlePrefill;
}) {
  const [volumes, setVolumes] = useState<BottleVolume[]>(
    prefill?.size ? [{ size: prefill.size, quantity: 1 }] : INITIAL_VOLUMES,
  );
  const [imageUrl, setImageUrl] = useState(prefill?.imageUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createBottle(barId, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);

      // Reset local state so the form is ready for a fresh entry.
      setVolumes(INITIAL_VOLUMES);
      setImageUrl("");
      formRef.current?.reset();

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSuccess?.();
      }, 1100);
    });
  };

  const addVolumeRow = () => {
    setVolumes([...volumes, { size: "1L", quantity: 1 }]);
  };

  const removeVolumeRow = (idx: number) => {
    setVolumes(volumes.filter((_, i) => i !== idx));
  };

  const updateVolume = (idx: number, field: keyof BottleVolume, value: string | number) => {
    const next = [...volumes];
    if (field === "quantity") {
      next[idx].quantity = Math.max(0, Number(value) || 0);
    } else {
      next[idx].size = String(value);
    }
    setVolumes(next);
  };

  return (
    // Pas de space-y-4 ici : chaque <Field> pose déjà son propre mb-4, et il
    // serait alors doublé (mb-4 + mt-4) entre deux champs adjacents. Les
    // quelques enfants non-Field portent donc leur mb-4 individuellement.
    <form ref={formRef} action={handleSubmit}>
      {/* Hidden input to pass volumes list as JSON */}
      <input type="hidden" name="volumes" value={JSON.stringify(volumes)} />
      {/* Carries the scanned code through to the API so a later scan of the
          same bottle resolves to this row instead of creating a duplicate. */}
      {prefill?.barcode && <input type="hidden" name="barcode" value={prefill.barcode} />}

      {prefill?.barcode && (
        <div className="mb-4 rounded-lg border border-rule bg-paper-sunk px-3 py-2 flex items-center gap-2">
          <span className="text-[15px]">🏷️</span>
          <span className="text-[13px] text-ink-soft">
            Code-barres scanné : <span className="font-mono text-ink">{prefill.barcode}</span>
          </span>
        </div>
      )}

      <Field label="Nom de la bouteille" htmlFor="add-bottle-name">
        <input
          id="add-bottle-name"
          name="name"
          defaultValue={prefill?.name ?? ""}
          placeholder="Ex: Gin Hendrick's"
          required
          className={champClasses}
        />
      </Field>

      <Field label="Type d'ingrédient" htmlFor="add-bottle-type">
        <select
          id="add-bottle-type"
          name="type"
          defaultValue={prefill?.type ?? "whisky"}
          className={`appearance-none ${champClasses}`}
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <div className="mb-4">
        <input type="hidden" name="imageUrl" value={imageUrl} />
        {/* The preview and its "Retirer" button live inside ImagePicker so the
            profile avatar and the bottle detail modal keep them too. */}
        <ImagePicker
          value={imageUrl}
          onChange={setImageUrl}
          onUpload={uploadBottleImage}
          label="Photo du produit (Fichier local ou URL)"
        />
      </div>

      {/* Volumes and quantities editor */}
      <div className="mb-4 space-y-3 border border-rule bg-paper-sunk p-4 rounded-xl">
        <div className="flex justify-between items-center border-b border-rule pb-2">
          <span className="text-[13px] uppercase tracking-caps text-ink-soft block">
            Formats en stock
          </span>
          <button
            type="button"
            onClick={addVolumeRow}
            className="tap-target px-2 text-[13px] uppercase tracking-caps text-terracotta font-semibold transition-colors"
          >
            ＋ Ajouter un format
          </button>
        </div>

        {volumes.length === 0 ? (
          <p className="text-[13px] text-ink-soft py-2">
            Aucun format configuré. La quantité générale sera de 0.
          </p>
        ) : (
          <div className="space-y-2">
            {volumes.map((vol, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 sm:gap-3 items-center">
                <input
                  type="text"
                  placeholder="Ex: 70cl, 1L, 1.5L"
                  value={vol.size}
                  required
                  onChange={(e) => updateVolume(idx, "size", e.target.value)}
                  className={`flex-1 min-w-0 basis-full sm:basis-0 ${champClasses}`}
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] text-ink-soft font-mono">Qté:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={vol.quantity}
                    required
                    onChange={(e) => updateVolume(idx, "quantity", e.target.value)}
                    className={`w-20 sm:w-16 text-center ${champClasses}`}
                  />
                </div>
                {volumes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVolumeRow(idx)}
                    className="tap-target flex items-center shrink-0 text-[13px] text-ink-soft hover:text-terracotta font-semibold px-2 transition-colors cursor-pointer"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Tags cocktail (séparés par virgules)" htmlFor="add-bottle-tags">
        <input
          id="add-bottle-tags"
          name="tags"
          placeholder="Ex: gin, citron vert, tonic"
          className={champClasses}
        />
      </Field>

      <Field label="Notes / Emplacement (Optionnel)" htmlFor="add-bottle-notes">
        <input
          id="add-bottle-notes"
          name="notes"
          placeholder="Ex: étagère du milieu, bar principal"
          className={champClasses}
        />
      </Field>

      <Field label="Seuil d'alerte (Optionnel)" htmlFor="add-bottle-threshold">
        <input
          id="add-bottle-threshold"
          name="lowStockThreshold"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          placeholder="Alerte si bouteilles <= X"
          className={champClasses}
        />
      </Field>

      {isVip && (
        <label className="mb-4 tap-target flex items-center gap-2.5 text-[15px] text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            name="vip"
            className="tap-target shrink-0 rounded border-rule accent-terracotta cursor-pointer"
          />
          <span className="font-medium">Réserver à la section VIP</span>
        </label>
      )}

      <Button type="submit" pleineLargeur disabled={isPending} className="mb-4">
        {isPending ? "Ajout en cours..." : "Ajouter au stock"}
      </Button>

      {error && (
        <div className="text-[13px] bg-paper-sunk border border-terracotta/30 rounded-xl p-3 text-terracotta text-center font-semibold">
          {error}
        </div>
      )}

      {saved && (
        <div className="text-[13px] bg-paper-sunk border border-done/35 rounded-xl p-3 text-done text-center font-semibold uppercase tracking-caps">
          ✓ Bouteille ajoutée !
        </div>
      )}
    </form>
  );
}
