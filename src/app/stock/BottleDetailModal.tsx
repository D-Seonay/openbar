"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import type { Bottle, BottleVolume } from "@/lib/types";
import { updateBottleVolumes, updateBottleThreshold, deleteBottleAction, uploadBottleImage, editBottleAction } from "@/app/actions";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import BottleImage from "@/components/BottleImage";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import ImagePicker from "@/components/ImagePicker";

interface BottleDetailModalProps {
  bottle: Bottle;
  onClose: () => void;
  isAdmin?: boolean;
}

export default function BottleDetailModal({ bottle, onClose, isAdmin = false }: BottleDetailModalProps) {
  const [volumes, setVolumes] = useState<BottleVolume[]>(bottle.volumes ?? []);
  const [imageUrl, setImageUrl] = useState(bottle.imageUrl ?? "");
  const [newSize, setNewSize] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [threshold, setThreshold] = useState(
    bottle.lowStockThreshold != null ? String(bottle.lowStockThreshold) : ""
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleImageChange = (newImg: string) => {
    setImageUrl(newImg);
    startTransition(() => {
      updateBottleVolumes(bottle.id, volumes, newImg);
    });
  };

  const totalLiters = calculateBottleTotalLiters({ ...bottle, volumes });
  const totalBottles = calculateTotalBottlesCount({ ...bottle, volumes });

  const changeVolumeQty = (idx: number, delta: number) => {
    const nextVols = [...volumes];
    nextVols[idx].quantity = Math.max(0, nextVols[idx].quantity + delta);
    const totalQty = nextVols.reduce((sum, v) => sum + v.quantity, 0);

    if (totalQty === 0 && totalBottles > 0) {
      if (window.confirm(`La bouteille "${bottle.name}" est maintenant vide.\nVoulez-vous la supprimer définitivement du stock ?\n(Cliquez sur "Annuler" pour la conserver grisée dans votre inventaire)`)) {
        startTransition(() => {
          deleteBottleAction(bottle.id);
          onClose();
        });
        return;
      }
    }

    setVolumes(nextVols);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, imageUrl);
    });
  };

  const removeFormat = (idx: number) => {
    const nextVols = volumes.filter((_, i) => i !== idx);
    const totalQty = nextVols.reduce((sum, v) => sum + v.quantity, 0);

    if (totalQty === 0 && totalBottles > 0) {
      if (window.confirm(`La bouteille "${bottle.name}" est maintenant vide.\nVoulez-vous la supprimer définitivement du stock ?\n(Cliquez sur "Annuler" pour la conserver grisée dans votre inventaire)`)) {
        startTransition(() => {
          deleteBottleAction(bottle.id);
          onClose();
        });
        return;
      }
    }

    setVolumes(nextVols);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, imageUrl);
    });
  };

  const addFormat = () => {
    if (!newSize.trim()) return;
    const nextVols = [...volumes, { size: newSize.trim(), quantity: newQty }];
    setVolumes(nextVols);
    setNewSize("");
    setNewQty(1);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, imageUrl);
    });
  };

  const saveThreshold = (raw: string) => {
    setThreshold(raw);
    const parsed = raw.trim() === "" ? null : Number(raw.trim());
    if (parsed !== null && Number.isNaN(parsed)) return;
    startTransition(() => {
      updateBottleThreshold(bottle.id, parsed);
    });
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: bottle.name,
    type: bottle.type,
    notes: bottle.notes || "",
    vip: bottle.vip,
  });

  const handleSaveEdit = () => {
    if (!editForm.name.trim()) return;
    startTransition(() => {
      editBottleAction(bottle.id, {
        name: editForm.name.trim(),
        type: editForm.type as any,
        notes: editForm.notes.trim() || undefined,
        vip: editForm.vip,
      }).then(() => {
        setIsEditing(false);
      });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg bg-ink-2/95 border border-white/[0.09] rounded-2xl p-6 sm:p-7 shadow-2xl box-orange-glow space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-cream text-sm w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          title="Fermer"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex gap-4 items-start">
          <div className="w-20 h-24 flex-shrink-0 bg-ink rounded-lg border border-orange/20 flex items-center justify-center overflow-hidden p-1.5 relative mt-1">
            <BottleImage bottle={bottle} />
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-cream focus:outline-none focus:border-orange font-display text-xl"
                  placeholder="Nom de la bouteille"
                  autoFocus
                />
                <div className="flex gap-3">
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                    className="bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm text-cream focus:outline-none focus:border-orange flex-1"
                  >
                    {["whisky", "rhum", "vodka", "gin", "tequila", "liqueur", "vin", "champagne", "biere", "mixer", "autre"].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-cream cursor-pointer border border-orange/20 rounded-lg px-3 py-2 bg-ink">
                    <input
                      type="checkbox"
                      checked={editForm.vip}
                      onChange={(e) => setEditForm({ ...editForm, vip: e.target.checked })}
                      className="accent-gold w-4 h-4"
                    />
                    VIP
                  </label>
                </div>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm text-cream placeholder:text-muted/50 focus:outline-none focus:border-orange"
                  placeholder="Notes (facultatif)"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-muted hover:text-cream px-3 py-1.5 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isPending || !editForm.name.trim()}
                    className="text-xs bg-orange text-white px-4 py-1.5 rounded-lg font-bold hover:bg-orange-hover transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative group">
                <div className="flex items-center justify-between gap-2 flex-wrap pr-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-2xl text-cream">{bottle.name}</h2>
                    {bottle.vip && (
                      <span className="text-[10px] uppercase tracking-caps bg-gold text-ink px-2 py-0.5 rounded font-bold">
                        VIP
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="absolute right-0 top-1 text-muted hover:text-cream opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Modifier les infos"
                    >
                      ✎
                    </button>
                  )}
                </div>
                <p className="text-xs uppercase tracking-caps text-orange font-mono mt-1">
                  {bottle.type}
                </p>
                {bottle.notes && (
                  <p className="text-xs text-muted italic mt-1">{bottle.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Highlighted Stock Summary Badge */}
        <div className="bg-ink border border-orange/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-caps text-gold-dim">Stock total en cave</p>
            <p className="font-display text-3xl text-orange mt-0.5">
              {formatLiters(totalLiters)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-orange/15 border border-orange/30 text-cream font-mono px-3 py-1.5 rounded-lg">
              {totalBottles} bouteille{totalBottles > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Detailed Breakdown list of bottles */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-caps text-gold-dim border-b border-orange/10 pb-2">
            Détail par format & bouteille
          </h3>

          {volumes.length === 0 ? (
            <p className="text-xs text-muted italic py-2">
              Aucun format spécifique renseigné ({bottle.quantity} bouteille{bottle.quantity > 1 ? "s" : ""} par défaut).
            </p>
          ) : (
            <div className="space-y-2">
              {volumes.map((vol, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between bg-ink/70 border border-orange/15 rounded-lg px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cream font-mono">Bouteille {vol.size}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-ink-2 px-2 py-1 rounded border border-orange/20">
                      <button
                        onClick={() => changeVolumeQty(idx, -1)}
                        disabled={isPending}
                        className="w-6 h-6 rounded bg-orange/15 hover:bg-orange text-cream hover:text-ink font-bold transition-colors text-xs flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-mono text-sm font-bold text-cream">
                        {vol.quantity}
                      </span>
                      <button
                        onClick={() => changeVolumeQty(idx, 1)}
                        disabled={isPending}
                        className="w-6 h-6 rounded bg-orange/15 hover:bg-orange text-cream hover:text-ink font-bold transition-colors text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeFormat(idx)}
                      disabled={isPending}
                      className="text-muted hover:text-red-400 p-1 transition-colors text-xs font-bold"
                      title="Retirer ce format"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add a new bottle size */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              placeholder="Nouveau format (ex: 1.5L, 70cl...)"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className="flex-1 bg-ink border border-orange/20 rounded-lg px-3 py-2 text-xs text-cream placeholder:text-muted/50 focus:outline-none focus:border-orange"
            />
            <button
              type="button"
              onClick={addFormat}
              disabled={isPending || !newSize.trim()}
              className="bg-orange/20 text-orange border border-orange/30 hover:bg-orange hover:text-ink font-semibold rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-40"
            >
              ＋ Ajouter une bouteille
            </button>
          </div>
        </div>

        {/* Local / URL Image Picker */}
        <div className="pt-3 border-t border-orange/10">
          <ImagePicker
            value={imageUrl}
            onChange={handleImageChange}
            onUpload={uploadBottleImage}
            label="Modifier la photo (Fichier local ou URL)"
          />
        </div>

        {/* Footer / Threshold / Delete */}
        {isAdmin && (
          <div className="pt-4 border-t border-orange/15 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <label className="text-muted">Alerte stock bas :</label>
              <input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => saveThreshold(e.target.value)}
                placeholder="Seuil"
                className="w-16 bg-ink border border-orange/20 rounded-lg px-2 py-1 text-center text-cream focus:outline-none focus:border-orange"
              />
            </div>

            <button
              onClick={() => setConfirmDeleteOpen(true)}
              className="text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-950/20 transition-colors cursor-pointer"
            >
              Supprimer la fiche
            </button>
          </div>
        )}

        <ConfirmDeleteModal
          isOpen={confirmDeleteOpen}
          title="Supprimer la bouteille ?"
          description={`Êtes-vous sûr de vouloir supprimer définitivement "${bottle.name}" de votre cave ?`}
          isPending={isPending}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            startTransition(async () => {
              const res = await deleteBottleAction(bottle.id);
              if (res?.error) {
                alert(res.error);
              } else {
                setConfirmDeleteOpen(false);
                onClose();
              }
            });
          }}
        />
      </motion.div>
    </motion.div>
  );
}
