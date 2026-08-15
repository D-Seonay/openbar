"use client";

import { useState, useTransition } from "react";
import type { AccountUser } from "@/lib/types";
import { toggleRoleAction, toggleVipAction, resetPasswordAction, deleteUserAction } from "./actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { Badge, Button, Row } from "@/components/ui";

export default function UserRow({ user }: { user: AccountUser }) {
  const [isPending, startTransition] = useTransition();
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);

  return (
    <div className="rounded-xl border border-rule bg-paper overflow-hidden">
      <div className="px-4">
        <Row
          titre={
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-paper-sunk border border-rule flex items-center justify-center font-display text-[15px] font-bold text-terracotta">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <span
                className={`truncate min-w-0 ${user.isArchived ? "text-ink-soft line-through" : "text-ink"}`}
              >
                {user.isArchived ? "Compte archivé" : user.username}
              </span>
            </span>
          }
          droite={
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              <Badge>{user.role}</Badge>
              {user.vip && <Badge ton="complet">VIP</Badge>}
              {user.isArchived && <Badge ton="alerte">Archivé</Badge>}
            </span>
          }
        />
      </div>

      {resetResult && (
        <p className="px-4 pb-2 -mt-1 text-[13px] text-done font-mono">
          Nouveau mot de passe :{" "}
          <code className="bg-paper-sunk px-2 py-0.5 rounded border border-done/35">{resetResult}</code>
        </p>
      )}
      {deleteError && <p className="px-4 pb-2 -mt-1 text-[13px] text-terracotta">{deleteError}</p>}

      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-rule">
        <Button
          variant="discret"
          disabled={isPending || user.isArchived}
          onClick={() =>
            startTransition(() => toggleRoleAction(user.id, user.role === "ADMIN" ? "USER" : "ADMIN"))
          }
        >
          {user.role === "ADMIN" ? "Rétrograder User" : "Promouvoir Admin"}
        </Button>
        <Button
          variant={user.vip ? "principal" : "discret"}
          disabled={isPending || user.isArchived}
          onClick={() => startTransition(() => toggleVipAction(user.id, !user.vip))}
        >
          {user.vip ? "Retirer accès VIP" : "Accorder VIP"}
        </Button>
        <Button
          variant="discret"
          disabled={isPending || user.isArchived}
          onClick={() =>
            startTransition(async () => {
              const password = await resetPasswordAction(user.id);
              setResetResult(password);
            })
          }
        >
          Réinitialiser MDP
        </Button>
        <Button
          variant="danger"
          disabled={isPending || user.isArchived}
          onClick={() => setIsConfirmingArchive(true)}
        >
          Archiver
        </Button>
      </div>

      {/* Archiving is reversible-ish and is not a deletion, so the dialog says
          so rather than reusing the "supprimer définitivement" wording. */}
      <ConfirmDeleteModal
        isOpen={isConfirmingArchive}
        icon="📦"
        title="Archiver ce compte ?"
        description={`Le compte de ${user.username} sera archivé. Les bars dont il est l'unique propriétaire seront désactivés.`}
        confirmLabel="Archiver le compte"
        pendingLabel="Archivage..."
        isPending={isPending}
        onCancel={() => setIsConfirmingArchive(false)}
        onConfirm={() =>
          startTransition(async () => {
            setDeleteError(null);
            const result = await deleteUserAction(user.id);
            if (result.error) setDeleteError(result.error);
            setIsConfirmingArchive(false);
          })
        }
      />
    </div>
  );
}
