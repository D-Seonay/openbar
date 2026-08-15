"use client";

import { useState, useTransition } from "react";
import type { BarMember } from "@/lib/types";
import { toggleMemberVipAction, removeMemberAction, changeMemberRoleAction } from "@/app/bar-actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { Badge, Button, Row } from "@/components/ui";

function formatBirthday(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/**
 * One member of the bar: identity (from the old /annuaire) plus, for the
 * owner only, the management actions (from the old /membres). `canManage`
 * is computed once by the page from `activeBar.myRole === "OWNER"` — a
 * simple member never receives it as true, so the buttons never render for
 * them regardless of what this component does internally.
 *
 * No default value on purpose: this gates member management actions, so a
 * caller that forgets to pass it should fail to compile rather than
 * silently render the buttons for everyone. Every caller (including
 * src/app/admin/bars/[id]/page.tsx, outside this task's scope) passes it
 * explicitly.
 */
export default function MemberRow({
  barId,
  member,
  canManage,
}: {
  barId: string;
  member: BarMember;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  const details = [
    member.user.birthday ? `🎂 ${formatBirthday(member.user.birthday)}` : null,
    member.user.favoriteDrink ? `🍹 ${member.user.favoriteDrink}` : null,
    member.user.allergies ? `⚠️ ${member.user.allergies}` : null,
  ].filter((entry): entry is string => entry !== null);

  return (
    <div className="rounded-xl border border-rule bg-paper overflow-hidden">
      <div className="px-4">
        <Row
          titre={
            <span className="flex items-center gap-3 min-w-0">
              {member.user.avatarUrl ? (
                <img
                  src={member.user.avatarUrl}
                  alt={member.user.username}
                  className="w-9 h-9 shrink-0 rounded-xl object-cover border border-rule"
                />
              ) : (
                <span className="w-9 h-9 shrink-0 rounded-xl bg-paper-sunk border border-rule flex items-center justify-center font-display text-[15px] font-bold text-terracotta">
                  {member.user.username.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="truncate min-w-0">{member.user.username}</span>
            </span>
          }
          sousTitre={details.length > 0 ? details.join(" · ") : "Profil non renseigné."}
          droite={
            <span className="flex items-center gap-1.5">
              <Badge>{member.role === "OWNER" ? "Propriétaire" : "Membre"}</Badge>
              {member.vip && <Badge ton="alerte">VIP</Badge>}
            </span>
          }
        />
      </div>

      {deleteError && <p className="px-4 pb-2 -mt-1 text-[13px] text-terracotta">{deleteError}</p>}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-rule">
          <Button
            variant="discret"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setDeleteError(null);
                const role = member.role === "OWNER" ? "MEMBER" : "OWNER";
                const result = await changeMemberRoleAction(barId, member.id, role);
                if (result.error) setDeleteError(result.error);
              })
            }
          >
            {member.role === "OWNER" ? "Rétrograder membre" : "Promouvoir proprio"}
          </Button>
          <Button
            variant={member.vip ? "principal" : "discret"}
            disabled={isPending}
            onClick={() => startTransition(() => toggleMemberVipAction(barId, member.id, !member.vip))}
          >
            {member.vip ? "Retirer VIP" : "Accorder VIP"}
          </Button>
          <Button
            variant="discret"
            disabled={isPending}
            onClick={() => setIsConfirmingRemove(true)}
          >
            Révoquer
          </Button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isConfirmingRemove}
        title="Révoquer ce membre ?"
        description={`${member.user.username} perdra l'accès à ce bar.`}
        confirmLabel="Révoquer"
        pendingLabel="Révocation..."
        isPending={isPending}
        onCancel={() => setIsConfirmingRemove(false)}
        onConfirm={() =>
          startTransition(async () => {
            setDeleteError(null);
            const result = await removeMemberAction(barId, member.id);
            if (result.error) setDeleteError(result.error);
            setIsConfirmingRemove(false);
          })
        }
      />
    </div>
  );
}
