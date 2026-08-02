"use client";

import { useTransition } from "react";
import { addWishlistItemAction, deleteWishlistItemAction, assignWishlistItemAction, unassignWishlistItemAction } from "@/app/actions";
import type { WishlistItem } from "@/lib/types";

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
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange animate-pulse" />
          <h2 className="font-display text-xl font-bold text-cream">À ramener</h2>
        </div>
        <span className="text-xs font-mono font-bold text-orange bg-orange/15 px-3 py-1 rounded-full border border-orange/30">
          {items.length} Item{items.length > 1 ? "s" : ""}
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
            placeholder="Ex: 2 sacs de glaçons"
            className="flex-1 bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs placeholder:text-muted/60 focus:outline-none focus:border-orange text-cream font-medium"
          />
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
            <li
              key={wishlistItem.id}
              className="rounded-xl border border-white/[0.08] bg-ink/70 px-3.5 sm:px-4 py-3 space-y-2 text-xs text-cream hover:border-orange/30 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-cream break-words">{wishlistItem.label}</span>
                {canManage && (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteWishlistItemAction(slug, wishlistItem.id))}
                    className="tap-target-sm shrink-0 flex items-center px-1.5 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Retirer
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                {wishlistItem.assignments.length > 0 ? (
                  <span className="text-[10px] text-muted">
                    Pris par {wishlistItem.assignments.map((a) => a.user.username).join(", ")}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted italic">Personne pour l&apos;instant</span>
                )}

                {wishlistItem.assignments.some((a) => a.user.id === currentUserId) ? (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => unassignWishlistItemAction(slug, wishlistItem.id))}
                    className="tap-target-sm shrink-0 flex items-center px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] hover:border-red-400/40 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Je ne peux plus
                  </button>
                ) : (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => assignWishlistItemAction(slug, wishlistItem.id))}
                    className="tap-target-sm shrink-0 flex items-center px-2.5 py-1 rounded-lg bg-orange/15 hover:bg-orange/25 border border-orange/40 text-[10px] text-orange font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Je m&apos;en occupe
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
