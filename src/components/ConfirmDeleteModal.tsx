"use client";

import ModalShell from "./ModalShell";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  /** Defaults suit a deletion; override for an action that is not one. */
  icon?: string;
  confirmLabel?: string;
  pendingLabel?: string;
}

/**
 * Replaces `confirm()` for anything destructive.
 *
 * Kept as its own component rather than folded into `ModalShell` so callers
 * cannot accidentally ship a destructive dialog without a cancel button.
 */
export default function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isPending,
  icon = "🗑️",
  confirmLabel = "Confirmer la suppression",
  pendingLabel = "Suppression...",
}: ConfirmDeleteModalProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onDismiss={isPending ? undefined : onCancel}
      accent="danger"
      icon={icon}
      title={title}
      description={description}
    >
      <button
        onClick={onCancel}
        disabled={isPending}
        className="tap-target flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-cream transition-colors cursor-pointer disabled:opacity-50"
      >
        Annuler
      </button>
      <button
        onClick={onConfirm}
        disabled={isPending}
        className="tap-target flex items-center justify-center px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer disabled:opacity-50"
      >
        {isPending ? pendingLabel : confirmLabel}
      </button>
    </ModalShell>
  );
}
