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
      <section className="rounded-xl border border-orange/10 bg-ink-2/40 p-6 max-w-md mx-auto box-orange-glow text-center space-y-4 my-8">
        <div className="text-3xl">🔑</div>
        <div>
          <h2 className="font-display text-2xl text-cream">Qui es-tu ?</h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Entrez votre prénom pour consulter le stock disponible, voir ce qu&apos;il reste à ramener, et débloquer les boissons secrètes.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && identify()}
            placeholder="Votre prénom..."
            className="bg-ink border border-orange/15 rounded-xl px-3 py-2 text-xs flex-1 placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream text-center"
          />
          <button
            onClick={identify}
            className="bg-orange text-white font-medium rounded-xl px-4 py-2 text-xs hover:bg-orange-hover box-orange-glow transition-all"
          >
            Entrer
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* User profile header */}
      <div className="flex items-center justify-between rounded-xl border border-orange/15 bg-ink-2/50 p-4 box-orange-glow">
        <p className="text-xs text-cream flex items-center gap-2">
          <span>👋</span>
          <span>
            Ravi de vous voir, <strong className="text-orange">{name}</strong>
          </span>
          {isVip && (
            <span className="ml-2 text-gold font-bold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/20 text-[9px] uppercase tracking-wider animate-pulse">
              👑 Privilèges VIP Activés
            </span>
          )}
        </p>
        <button
          onClick={() => {
            window.localStorage.removeItem(storageKey);
            setName(null);
          }}
          className="text-[10px] text-muted hover:text-orange uppercase tracking-wider font-semibold transition-colors"
        >
          Se déconnecter
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column: Contributions and Inputs */}
        <div className="space-y-8">
          {/* Who brings what section */}
          <section className="bg-ink-2/20 border border-orange/10 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-orange/5 pb-2">
              <h2 className="font-display text-lg text-cream">Qui apporte quoi</h2>
              <span className="text-[10px] uppercase font-mono text-orange bg-orange/10 px-2 py-0.5 rounded border border-orange/20">
                {contributions.length} Contributions
              </span>
            </div>

            {contributions.length === 0 ? (
              <p className="text-muted text-xs italic py-4 text-center">Aucune bouteille promise pour l&apos;instant. Ouvrez le bal !</p>
            ) : (
              <ul className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {contributions.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-orange/5 bg-ink-2/60 px-3 py-2 flex items-center justify-between text-xs text-cream hover:border-orange/20 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-orange-dim">{c.guestName}</span>
                      <span className="text-muted/65">apporte</span>
                      <span className="font-medium text-cream">{c.item}</span>
                      {c.quantity && (
                        <span className="text-[10px] font-mono bg-orange-dark/25 px-1.5 py-0.5 rounded text-orange border border-orange-dark/30">
                          {c.quantity}
                        </span>
                      )}
                    </span>
                    {c.guestName.toLowerCase() === name.toLowerCase() && (
                      <button
                        onClick={() => startTransition(() => deleteContributionAction(slug, c.id))}
                        className="text-[10px] text-muted/50 hover:text-red-400 font-semibold uppercase tracking-wider transition-colors"
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
              className="mt-4 grid sm:grid-cols-[1fr_auto_auto] gap-2 pt-3 border-t border-orange/5"
            >
              <input
                name="item"
                required
                placeholder="Ex: Gin Hendrick's, Tonic, Citrons..."
                className="bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
              <input
                name="quantity"
                placeholder="Ex: 1 bouteille"
                className="bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream w-24"
              />
              <button
                type="submit"
                className="bg-orange text-white font-medium rounded-xl px-4 py-2 text-xs hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider font-semibold"
              >
                Partager
              </button>
            </form>
          </section>

          {/* Already on location section */}
          <section className="space-y-3">
            <h2 className="font-display text-lg text-cream border-b border-orange/5 pb-2">Déjà disponible sur place</h2>
            {stock.length === 0 ? (
              <p className="text-muted text-xs italic">Aucune bouteille déclarée en stock.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2 text-xs max-h-[220px] overflow-y-auto pr-1">
                {stock.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-orange/5 bg-ink-2/30 px-3 py-2 flex justify-between items-center text-cream"
                  >
                    <span className="font-medium truncate mr-2">{b.name}</span>
                    <span className="text-[10px] font-mono bg-orange-dark/15 border border-orange-dark/30 px-2 py-0.5 rounded text-orange">
                      Qté: {b.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Cocktail Offerings & VIP Reserve */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="font-display text-lg text-cream border-b border-orange/5 pb-2">Cocktails réalisables ce soir</h2>
            {readyCocktails.length === 0 ? (
              <p className="text-muted text-xs italic">Aucun cocktail n&apos;est réalisable avec les réserves actuelles. N&apos;hésitez pas à apporter des mixers !</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {readyCocktails.map(({ recipe }) => (
                  <div key={recipe.id} className="rounded-xl border border-orange/10 bg-ink-2/40 p-4 hover:border-orange/20 transition-all flex flex-col justify-between">
                    <div>
                      <p className="font-display text-base text-cream font-medium">{recipe.name}</p>
                      <p className="text-orange text-[10px] mt-0.5 uppercase tracking-wider font-mono">{recipe.glass}</p>
                    </div>
                    <p className="text-muted text-[10px] mt-2 line-clamp-2 italic">{recipe.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* VIP Section */}
          {isVip && (
            <section className="rounded-xl border border-gold/25 bg-brick-dark/10 p-5 space-y-4 box-orange-glow">
              <div className="flex items-center gap-2 border-b border-gold/15 pb-2">
                <span className="text-lg">🔒</span>
                <div>
                  <h3 className="font-display text-lg text-gold">Cabinet Secret VIP</h3>
                  <p className="text-[10px] text-muted">Disponible pour les initiés.</p>
                </div>
              </div>

              {vipStock.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">Alcools de la réserve</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {vipStock.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-gold/10 bg-ink/30 px-3 py-2 flex justify-between items-center text-cream"
                      >
                        <span className="font-medium truncate mr-2">{b.name}</span>
                        <span className="text-[9px] font-mono bg-gold/10 border border-gold/20 px-2 py-0.5 rounded text-gold font-bold">
                          {b.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vipCocktails.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">Cocktails VIP débloqués</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {vipCocktails.map(({ recipe }) => (
                      <div key={recipe.id} className="rounded-xl border border-gold/15 bg-ink/20 p-3 text-xs flex flex-col justify-between">
                        <div>
                          <p className="font-display text-sm text-cream font-medium">{recipe.name}</p>
                          <p className="text-gold text-[9px] uppercase tracking-wider font-mono">{recipe.glass}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

