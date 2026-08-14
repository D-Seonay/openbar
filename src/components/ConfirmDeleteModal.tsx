"use client";

import ModalShell from "./ModalShell";
import { Button } from "@/components/ui";

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
      <Button variant="discret" onClick={onCancel} disabled={isPending}>
        Annuler
      </Button>
      <Button variant="danger" onClick={onConfirm} disabled={isPending}>
        {isPending ? pendingLabel : confirmLabel}
      </Button>
    </ModalShell>
  );
}
