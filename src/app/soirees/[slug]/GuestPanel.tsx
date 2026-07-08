"use client";

import { useEffect, useState, useTransition } from "react";
import { addContribution, deleteContributionAction } from "@/app/actions";
import type { Contribution } from "@/lib/types";
import type { RecipeAvailability } from "@/lib/cocktails";

interface StockLine {
  name: string;
  type: string;
  quantity: number;
}

export default function GuestPanel({
  slug,
  vipNames,
  contributions,
  stock,
  vipStock,
  readyCocktails,
  vipCocktails,
}: {
  slug: string;
  vipNames: string[];
  contributions: Contribution[];
  stock: StockLine[];
  vipStock: StockLine[];
  readyCocktails: RecipeAvailability[];
  vipCocktails: RecipeAvailability[];
}) {
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const storageKey = `bardenoa:${slug}:name`;

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    // Reading a client-only localStorage value on mount; there is no way to know it during SSR/first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setName(saved);
  }, [storageKey]);

  function identify() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    window.localStorage.setItem(storageKey, trimmed);
    setName(trimmed);
  }

  const isVip = !!name && vipNames.some((v) => v.toLowerCase() === name.trim().toLowerCase());

  if (!name) {
    return (
      <section className="rounded-xl border border-gold/25 bg-brick-dark/40 p-6">
        <h2 className="font-display text-xl text-gold mb-2">Qui es-tu ?</h2>
        <p className="text-sm text-muted mb-4">
          Entre ton prénom pour voir ce qu&apos;il reste à ramener (et débloquer l&apos;accès VIP si tu es
          sur la liste).
        </p>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && identify()}
            placeholder="Ton prénom"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm flex-1 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <button
            onClick={identify}
            className="bg-gold text-ink font-medium rounded-lg px-4 py-2 text-sm hover:bg-cream transition-colors"
          >
            C&apos;est moi
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between rounded-xl border border-cream/10 bg-ink-2 p-4">
        <p className="text-sm text-cream">
          Salut <span className="font-medium">{name}</span> 👋
          {isVip && <span className="ml-2 text-gold">🥂 Accès VIP débloqué</span>}
        </p>
        <button
          onClick={() => {
            window.localStorage.removeItem(storageKey);
            setName(null);
          }}
          className="text-xs text-muted hover:text-cream"
        >
          Pas toi ?
        </button>
      </div>

      <section>
        <h2 className="font-display text-xl text-cream mb-4">Déjà sur place</h2>
        {stock.length === 0 ? (
          <p className="text-muted text-sm">Rien de noté pour l&apos;instant.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {stock.map((b, i) => (
              <li
                key={i}
                className="rounded-lg border border-cream/10 bg-ink-2 px-3 py-2 flex justify-between text-cream"
              >
                <span>{b.name}</span>
                <span className="text-muted">{b.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-cream mb-4">Qui ramène quoi</h2>
        {contributions.length === 0 ? (
          <p className="text-muted text-sm">Personne n&apos;a encore rien noté. Sois le premier !</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contributions.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-cream/10 bg-ink-2 px-3 py-2 flex items-center justify-between text-cream"
              >
                <span>
                  <span className="font-medium text-gold">{c.guestName}</span> apporte {c.item}
                  {c.quantity ? ` (${c.quantity})` : ""}
                </span>
                {c.guestName.toLowerCase() === name.toLowerCase() && (
                  <button
                    onClick={() => startTransition(() => deleteContributionAction(slug, c.id))}
                    className="text-xs text-muted hover:text-red-400"
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          action={async (formData: FormData) => {
            formData.set("guestName", name);
            await addContribution(slug, formData);
          }}
          className="mt-4 grid sm:grid-cols-[1fr_auto_auto] gap-2"
        >
          <input
            name="item"
            required
            placeholder="Ce que tu ramènes (ex: Gin Hendrick's)"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <input
            name="quantity"
            placeholder="Quantité"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm w-28 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <button
            type="submit"
            className="bg-gold text-ink font-medium rounded-lg px-4 py-2 text-sm hover:bg-cream transition-colors"
          >
            J&apos;apporte ça
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-xl text-cream mb-4">Cocktails prévus</h2>
        {readyCocktails.length === 0 ? (
          <p className="text-muted text-sm">Rien de calculable pour l&apos;instant.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {readyCocktails.map(({ recipe }) => (
              <div key={recipe.id} className="rounded-lg border border-cream/10 bg-ink-2 p-3 text-sm">
                <p className="font-medium text-cream">{recipe.name}</p>
                <p className="text-gold-dim text-xs mt-1">{recipe.tags.join(" · ")}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {isVip && (
        <section className="rounded-xl border border-gold/25 bg-brick-dark/40 p-6">
          <h2 className="font-display text-xl text-gold mb-4">Réserve VIP</h2>
          {vipStock.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-2 text-sm mb-4">
              {vipStock.map((b, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-gold/20 bg-ink/20 px-3 py-2 flex justify-between text-cream"
                >
                  <span>{b.name}</span>
                  <span className="text-muted">{b.quantity}</span>
                </li>
              ))}
            </ul>
          )}
          {vipCocktails.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {vipCocktails.map(({ recipe }) => (
                <div key={recipe.id} className="rounded-lg border border-gold/20 bg-ink/20 p-3 text-sm">
                  <p className="font-medium text-cream">{recipe.name}</p>
                  <p className="text-gold-dim text-xs mt-1">{recipe.tags.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
