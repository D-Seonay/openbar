"use client";

import { useState, useTransition } from "react";
import { addWishlistItemAction, deleteWishlistItemAction, assignWishlistItemAction, unassignWishlistItemAction } from "@/app/actions";
import type { WishlistItem, WishlistItemAssignment } from "@/lib/types";
import { Badge, Button, EmptyState, champClasses } from "@/components/ui";

/**
 * Avatar for one assignee. `avatarUrl` is a relative `/uploads/...` path that
 * the Next rewrite proxies to the API, so it is used as-is. Users without a
 * picture fall back to their initials, same as the directory and the header.
 */
function AssigneeAvatar({ user }: { user: WishlistItemAssignment["user"] }) {
  const className = "w-6 h-6 rounded-full border border-paper shrink-0 object-cover";

  if (!user.avatarUrl) {
    return (
      <span
        title={user.username}
        className={`${className} bg-paper-sunk flex items-center justify-center font-display text-[13px] font-bold text-terracotta`}
      >
        {user.username.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img src={user.avatarUrl} alt={user.username} title={user.username} className={className} />
  );
}

function WishlistItemRow({
  slug,
  wishlistItem,
  canManage,
  currentUserId,
}: {
  slug: string;
  wishlistItem: WishlistItem;
  canManage: boolean;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isAssignedToMe = wishlistItem.assignments.some((a) => a.user.id === currentUserId);

  const taken = wishlistItem.assignments.length;
  const needed = wishlistItem.neededCount;
  const isFull = taken >= needed;

  const claim = () => {
    setError(null);
    startTransition(async () => {
      const res = await assignWishlistItemAction(slug, wishlistItem.id);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <li className="rounded-xl border border-rule bg-paper px-3.5 sm:px-4 py-3 space-y-2 text-[13px] text-ink">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-ink break-words">{wishlistItem.label}</span>
        <span className="flex items-center gap-2 shrink-0">
          {/* Only worth showing when the host asked for more than one person;
              a plain item would just read "0/1". */}
          {needed > 1 && (
            <Badge ton={isFull ? "complet" : "alerte"}>
              {isFull ? `✓ complet ${taken}/${needed}` : `${taken}/${needed} pris`}
            </Badge>
          )}
          {canManage && (
            <button
              disabled={isPending}
              onClick={() => startTransition(() => deleteWishlistItemAction(slug, wishlistItem.id))}
              className="tap-target inline-flex items-center px-1.5 text-[13px] text-ink-soft hover:text-terracotta font-semibold transition-colors cursor-pointer"
            >
              Retirer
            </button>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {wishlistItem.assignments.length > 0 ? (
          <span className="flex items-center gap-2 min-w-0">
            {/* Overlapped so a long guest list stays compact on a phone. */}
            <span className="flex -space-x-2 shrink-0">
              {wishlistItem.assignments.map((a) => (
                <AssigneeAvatar key={a.id} user={a.user} />
              ))}
            </span>
            <span className="text-[13px] text-ink-soft break-words min-w-0">
              Pris par {wishlistItem.assignments.map((a) => a.user.username).join(", ")}
            </span>
          </span>
        ) : (
          <span className="text-[13px] text-ink-soft italic">Personne pour l&apos;instant</span>
        )}

        {isAssignedToMe ? (
          <button
            disabled={isPending}
            onClick={() => startTransition(() => unassignWishlistItemAction(slug, wishlistItem.id))}
            className="tap-target inline-flex items-center px-2.5 rounded-lg bg-paper-sunk border border-rule text-[13px] text-ink-soft hover:text-terracotta font-semibold transition-colors cursor-pointer"
          >
            Je ne peux plus
          </button>
        ) : isFull ? (
          <span className="shrink-0 text-[13px] text-done font-semibold">Complet</span>
        ) : (
          <button
            disabled={isPending}
            onClick={claim}
            className="tap-target inline-flex items-center px-2.5 rounded-lg bg-terracotta/10 border border-terracotta/40 text-[13px] text-terracotta font-semibold transition-colors cursor-pointer"
          >
            Je m&apos;en occupe
          </button>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-terracotta" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export default function WishlistSection({
  slug,
  items,
  canManage,
  currentUserId,
}: {
  slug: string;
  items: WishlistItem[];
  canManage: boolean;
  currentUserId: string;
}) {
  return (
    <section className="rounded-xl bg-paper border border-rule p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] text-ink">À ramener</h2>
        <Badge ton="neutre">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {canManage && (
        <form
          action={async (formData: FormData) => {
            await addWishlistItemAction(slug, formData);
          }}
          className="flex gap-2"
        >
          <input
            name="label"
            required
            placeholder="Ex: sacs de glaçons"
            className={`flex-1 min-w-0 ${champClasses}`}
          />
          {/* How many guests are wanted on this item. 1 keeps the previous
              behaviour, so the field can simply be ignored. */}
          <label className="flex items-center gap-1.5 shrink-0">
            <span className="sr-only">Nombre de personnes souhaitées</span>
            <span aria-hidden className="text-[13px] text-ink-soft">×</span>
            <input
              name="neededCount"
              type="number"
              min="1"
              max="50"
              step="1"
              defaultValue={1}
              inputMode="numeric"
              className={`w-16 text-center ${champClasses}`}
            />
          </label>
          <Button type="submit">Ajouter</Button>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState
          titre="Rien à ramener"
          message={
            canManage
              ? "Ajoute des choses à ramener pour tes invités."
              : "L'hôte n'a rien demandé pour l'instant."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((wishlistItem) => (
            <WishlistItemRow
              key={wishlistItem.id}
              slug={slug}
              wishlistItem={wishlistItem}
              canManage={canManage}
              currentUserId={currentUserId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
