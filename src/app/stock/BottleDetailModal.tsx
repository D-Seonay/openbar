"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import type { Bottle, BottleVolume } from "@/lib/types";
import { updateBottleVolumes, updateBottleThreshold, deleteBottleAction } from "@/app/actions";
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
    setVolumes(nextVols);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, imageUrl);
    });
  };

  const removeFormat = (idx: number) => {
    const nextVols = volumes.filter((_, i) => i !== idx);
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
        <div className="flex gap-4 items-center">
          <div className="w-20 h-24 flex-shrink-0 bg-ink rounded-lg border border-orange/20 flex items-center justify-center overflow-hidden p-1.5 relative">
            <BottleImage bottle={bottle} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl text-cream">{bottle.name}</h2>
              {bottle.vip && (
                <span className="text-[10px] uppercase tracking-caps bg-gold text-ink px-2 py-0.5 rounded font-bold">
                  VIP
                </span>
              )}
            </div>
            <p className="text-xs uppercase tracking-caps text-orange font-mono mt-1">
              {bottle.type}
            </p>
            {bottle.notes && (
              <p className="text-xs text-muted italic mt-1">{bottle.notes}</p>
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
            startTransition(() => {
              deleteBottleAction(bottle.id);
              onClose();
            });
          }}
        />
      </motion.div>
    </motion.div>
  );
}
