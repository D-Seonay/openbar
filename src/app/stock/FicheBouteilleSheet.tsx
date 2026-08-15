"use client";

import { useState, useTransition } from "react";
import type { Bottle } from "@/lib/types";
import { updateBottleImageAction, uploadBottleImage } from "@/app/actions";
import { Sheet, Button } from "@/components/ui";
import ImagePicker from "@/components/ImagePicker";
import BottleImage from "@/components/BottleImage";

const panneau = "p-4 rounded-xl bg-paper-sunk border border-rule";
const legende = "text-[13px] uppercase tracking-caps text-ink-soft font-bold block";

interface FicheBouteilleSheetProps {
  /** `null` ferme la feuille : voir <Sheet ouvert>. */
  bouteille: Bottle | null;
  isAdmin: boolean;
  onFermer: () => void;
  onEditer: () => void;
  onSupprimer: (bouteille: Bottle) => void;
}

/**
 * Vue de lecture seule d'une bouteille. N'accède à aucun état de StockStudio
 * autre que `bouteille` — la photo se gère et se commit ici, en local, plutôt
 * que d'être remontée au parent.
 */
export default function FicheBouteilleSheet({
  bouteille,
  isAdmin,
  onFermer,
  onEditer,
  onSupprimer,
}: FicheBouteilleSheetProps) {
  // Non-null uniquement pendant l'édition du champ photo ; remis à zéro une
  // fois enregistré pour que le picker retombe sur la valeur serveur.
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const saveBottleImage = (id: string, nextImageUrl: string) => {
    setImageError(null);
    startTransition(async () => {
      const res = await updateBottleImageAction(id, nextImageUrl);
      if (res?.error) {
        setImageError(res.error);
        return;
      }
      setImageDraft(null);
    });
  };

  return (
    <Sheet ouvert={bouteille !== null} titre={bouteille?.name ?? ""} onFermer={onFermer}>
      {bouteille && (
        <div className="space-y-5">
          {bouteille.imageUrl && (
            <div className={`flex justify-center ${panneau}`}>
              <div className="w-28 h-36 flex items-center justify-center overflow-hidden">
                <BottleImage bottle={bouteille} />
              </div>
            </div>
          )}

          {isAdmin && (
            <div className={panneau}>
              <ImagePicker
                key={bouteille.id}
                value={imageDraft ?? bouteille.imageUrl ?? ""}
                onChange={setImageDraft}
                onCommit={(next) => saveBottleImage(bouteille.id, next)}
                onUpload={uploadBottleImage}
                label={
                  bouteille.imageUrl
                    ? "Changer la photo (fichier local ou URL)"
                    : "Ajouter une photo (fichier local ou URL)"
                }
              />
              {imageError && <p className="text-[13px] text-terracotta mt-2">{imageError}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div className={panneau}>
              <span className="text-[13px] text-ink-soft block">Catégorie</span>
              <span className="text-ink font-bold capitalize mt-1 block">{bouteille.type}</span>
            </div>
            <div className={panneau}>
              <span className="text-[13px] text-ink-soft block">Quantité</span>
              <span className="text-terracotta font-bold mt-1 block">
                {bouteille.quantity} bouteille{bouteille.quantity > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className={`${panneau} space-y-3`}>
            <span className={legende}>Formats & Volumes enregistrés</span>
            {bouteille.volumes && bouteille.volumes.length > 0 ? (
              <div className="space-y-2">
                {bouteille.volumes.map((v, idx) => (
                  <div key={idx} className="flex justify-between text-ink">
                    <span>Format {v.size}</span>
                    <span className="text-terracotta font-bold">× {v.quantity} en stock</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ink-soft text-[13px]">Format standard 70cl</p>
            )}
          </div>

          <div className={`${panneau} space-y-3`}>
            <span className={legende}>Tags & Arômes associés</span>
            <div className="flex flex-wrap gap-2">
              {bouteille.tags.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg bg-paper border border-rule text-ink text-[13px] font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {bouteille.notes && (
            <div className={`${panneau} space-y-2`}>
              <span className={legende}>Notes / Emplacement en cave</span>
              <p className="text-ink text-[13px] leading-relaxed">{bouteille.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rule">
            {isAdmin ? (
              <Button variant="discret" onClick={() => onSupprimer(bouteille)}>
                Supprimer
              </Button>
            ) : (
              <span className="text-[13px] text-ink-soft">OpenBar · Studio Cave</span>
            )}
            {isAdmin && (
              <Button variant="discret" onClick={onEditer}>
                ✎ Modifier la fiche
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
