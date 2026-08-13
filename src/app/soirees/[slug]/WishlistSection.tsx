"use client";

import { useState, useTransition } from "react";
import { addWishlistItemAction, deleteWishlistItemAction, assignWishlistItemAction, unassignWishlistItemAction } from "@/app/actions";
import type { WishlistItem, WishlistItemAssignment } from "@/lib/types";

/**
 * Avatar for one assignee. `avatarUrl` is a relative `/uploads/...` path that
 * the Next rewrite proxies to the API, so it is used as-is. Users without a
 * picture fall back to their initials, same as the directory and the header.
 */
function AssigneeAvatar({ user }: { user: WishlistItemAssignment["user"] }) {
  const className =
    "w-6 h-6 rounded-full border border-ink ring-1 ring-white/[0.08] shrink-0 object-cover";

  if (!user.avatarUrl) {
    return (
      <span
        title={user.username}
        className={`${className} bg-ink-2 flex items-center justify-center font-display text-[9px] font-bold text-gold`}
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
    <li className="rounded-xl border border-white/[0.08] bg-ink/70 px-3.5 sm:px-4 py-3 space-y-2 text-xs text-cream hover:border-orange/30 transition-all">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-cream break-words">{wishlistItem.label}</span>
        <span className="flex items-center gap-2 shrink-0">
          {/* Only worth showing when the host asked for more than one person;
              a plain item would just read "0/1". */}
          {needed > 1 && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                isFull
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-orange/15 border-orange/30 text-orange"
              }`}
            >
              {isFull ? `✓ complet ${taken}/${needed}` : `${taken}/${needed} pris`}
            </span>
          )}
          {canManage && (
          <button
            disabled={isPending}
            onClick={() => startTransition(() => deleteWishlistItemAction(slug, wishlistItem.id))}
            className="tap-target-sm shrink-0 flex items-center px-1.5 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
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
            <span className="text-[10px] text-muted break-words min-w-0">
              Pris par {wishlistItem.assignments.map((a) => a.user.username).join(", ")}
            </span>
          </span>
        ) : (
          <span className="text-[10px] text-muted italic">Personne pour l&apos;instant</span>
        )}

        {isAssignedToMe ? (
          <button
            disabled={isPending}
            onClick={() => startTransition(() => unassignWishlistItemAction(slug, wishlistItem.id))}
            className="tap-target-sm shrink-0 flex items-center px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] hover:border-red-400/40 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Je ne peux plus
          </button>
        ) : isFull ? (
          <span className="shrink-0 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
            Complet
          </span>
        ) : (
          <button
            disabled={isPending}
            onClick={claim}
            className="tap-target-sm shrink-0 flex items-center px-2.5 py-1 rounded-lg bg-orange/15 hover:bg-orange/25 border border-orange/40 text-[10px] text-orange font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Je m&apos;en occupe
          </button>
        )}
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}
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
    <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange animate-pulse" />
          <h2 className="font-display text-xl font-bold text-cream">À ramener</h2>
        </div>
        <span className="text-xs font-mono font-bold text-orange bg-orange/15 px-3 py-1 rounded-full border border-orange/30">
          {items.length} Item{items.length !== 1 ? "s" : ""}
        </span>
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
            className="flex-1 min-w-0 bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs placeholder:text-muted/60 focus:outline-none focus:border-orange text-cream font-medium"
          />
          {/* How many guests are wanted on this item. 1 keeps the previous
              behaviour, so the field can simply be ignored. */}
          <label className="flex items-center gap-1.5 shrink-0">
            <span className="sr-only">Nombre de personnes souhaitées</span>
            <span aria-hidden className="text-xs text-muted">×</span>
            <input
              name="neededCount"
              type="number"
              min="1"
              max="50"
              step="1"
              defaultValue={1}
              inputMode="numeric"
              className="w-14 bg-ink border border-white/[0.12] rounded-xl px-2 py-2.5 text-xs text-center focus:outline-none focus:border-orange text-cream font-medium"
            />
          </label>
          <button
            type="submit"
            className="tap-target flex items-center justify-center bg-orange text-ink font-extrabold rounded-xl px-4 py-2.5 text-xs hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider cursor-pointer"
          >
            Ajouter
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 rounded-xl bg-ink/40 border border-white/[0.05]">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-muted text-xs italic">
            {canManage ? "Ajoute des choses à ramener pour tes invités." : "L'hôte n'a rien demandé pour l'instant."}
          </p>
        </div>
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
