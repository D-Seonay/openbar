"use client";

import { useRef, useState, useTransition } from "react";
import { createBottle, uploadBottleImage } from "@/app/actions";
import type { BottleVolume } from "@/lib/types";
import ImagePicker from "@/components/ImagePicker";

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

export default function AddBottleForm({
  isVip = false,
  barId,
  onSuccess,
}: {
  isVip?: boolean;
  barId: string;
  onSuccess?: () => void;
}) {
  const [volumes, setVolumes] = useState<BottleVolume[]>(INITIAL_VOLUMES);
  const [imageUrl, setImageUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createBottle(barId, formData);

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
    <form ref={formRef} action={handleSubmit} className="grid sm:grid-cols-2 gap-4">
      {/* Hidden input to pass volumes list as JSON */}
      <input type="hidden" name="volumes" value={JSON.stringify(volumes)} />

      <div className="sm:col-span-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Nom de la bouteille</label>
        <input
          name="name"
          placeholder="Ex: Gin Hendrick's"
          required
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Type d&apos;ingrédient</label>
        <select
          name="type"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value} className="bg-ink">
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <ImagePicker value={imageUrl} onChange={setImageUrl} onUpload={uploadBottleImage} label="Photo du produit (Fichier local ou URL)" />
        {imageUrl && (
          <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-ink/80 border border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-11 bg-ink rounded-lg p-1 border border-white/[0.08] overflow-hidden">
                <img 
                  src={
                    imageUrl.startsWith('/uploads/') 
                      ? `${process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3001'}${imageUrl}`
                      : imageUrl
                  } 
                  alt="Aperçu" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <div>
                <span className="text-xs font-medium text-cream block">Aperçu de l&apos;image sélectionnée</span>
                <span className="text-[10px] text-orange font-mono truncate max-w-[200px] block">
                  {imageUrl.startsWith("data:") ? "Image locale convertie" : imageUrl}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 cursor-pointer"
            >
              Retirer
            </button>
          </div>
        )}
      </div>

      {/* Volumes and quantities editor */}
      <div className="sm:col-span-2 space-y-3 border border-orange/15 bg-ink/40 p-4 rounded-xl">
        <div className="flex justify-between items-center border-b border-orange/5 pb-2">
          <label className="text-xs uppercase tracking-caps text-gold-dim block">Formats en stock</label>
          <button
            type="button"
            onClick={addVolumeRow}
            className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-semibold transition-colors"
          >
            ＋ Ajouter un format
          </button>
        </div>

        {volumes.length === 0 ? (
          <p className="text-xs text-muted/65 py-2">Aucun format configuré. La quantité générale sera de 0.</p>
        ) : (
          <div className="space-y-2">
            {volumes.map((vol, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Ex: 70cl, 1L, 1.5L"
                  value={vol.size}
                  required
                  onChange={(e) => updateVolume(idx, "size", e.target.value)}
                  className="flex-1 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted font-mono">Qté:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={vol.quantity}
                    required
                    onChange={(e) => updateVolume(idx, "quantity", e.target.value)}
                    className="w-16 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-center text-cream focus:outline-none focus:border-orange"
                  />
                </div>
                {volumes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVolumeRow(idx)}
                    className="text-xs text-muted hover:text-red-400 font-semibold px-2 py-1 transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Tags cocktail (séparés par virgules)</label>
        <input
          name="tags"
          placeholder="Ex: gin, citron vert, tonic"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Notes / Emplacement (Optionnel)</label>
        <input
          name="notes"
          placeholder="Ex: étagère du milieu, bar principal"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Seuil d&apos;alerte (Optionnel)</label>
        <input
          name="lowStockThreshold"
          type="number"
          min="0"
          step="1"
          placeholder="Alerte si bouteilles <= X"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      {isVip && (
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2.5 text-sm text-gold cursor-pointer select-none">
            <input 
              type="checkbox" 
              name="vip" 
              className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-gold cursor-pointer" 
            />
            <span className="font-medium">Réserver à la section VIP</span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="sm:col-span-2 bg-orange text-ink font-semibold rounded-lg py-2.5 hover:bg-cream transition-colors mt-2 uppercase tracking-caps text-xs duration-350 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Ajout en cours..." : "Ajouter au stock"}
      </button>

      {saved && (
        <div className="sm:col-span-2 text-xs bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-center font-semibold uppercase tracking-caps">
          ✓ Bouteille ajoutée !
        </div>
      )}
    </form>
  );
}
