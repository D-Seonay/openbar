"use client";

import { addContribution, deleteContributionAction } from "@/app/actions";
import { login } from "@/app/login/actions";
import type { Contribution } from "@/lib/types";
import type { SessionUser } from "@/lib/session";
import type { RecipeAvailability } from "@/lib/cocktail-types";
import { useTransition } from "react";
import { getCategoryStyle } from "@/lib/categoryStyles";

interface StockLine {
  name: string;
  type: string;
  quantity: number;
}

export default function GuestPanel({
  slug,
  session,
  contributions,
  stock,
  vipStock,
  readyCocktails,
  vipCocktails,
}: {
  slug: string;
  session: SessionUser | null;
  contributions: Contribution[];
  stock: StockLine[];
  vipStock: StockLine[];
  readyCocktails: RecipeAvailability[];
  vipCocktails: RecipeAvailability[];
}) {
  const [isPending, startTransition] = useTransition();

  const QUICK_ITEMS = [
    { label: "Citrons Verts 🍋", item: "Citrons Verts", qty: "1 filet" },
    { label: "Tonic & Soda 🥤", item: "Tonic & Eau Gazeuse", qty: "2 bouteilles" },
    { label: "Glaçons 🧊", item: "Glaçons", qty: "1 sachet" },
    { label: "Menthe Fraîche 🌿", item: "Menthe Fraîche", qty: "1 bouquet" },
  ];

  if (!session) {
    return (
      <section className="rounded-2xl border border-orange/20 bg-ink-2/80 p-8 max-w-md mx-auto box-orange-glow text-center space-y-6 my-10 backdrop-blur-xl">
        <div className="w-16 h-16 rounded-2xl bg-orange/15 border border-orange/30 flex items-center justify-center text-4xl mx-auto shadow-md">
          🎟️
        </div>
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-cream">Rejoindre le Party Board</h2>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Identifiez-vous par votre prénom pour découvrir ce qui est déjà au Bar, voir qui apporte quoi et promener vos verres dans le salon.
          </p>
        </div>
        <form action={login} className="flex flex-col gap-3">
          <input type="hidden" name="redirectTo" value={`/soirees/${slug}`} />
          <input
            name="username"
            required
            placeholder="Votre prénom"
            className="bg-ink border border-white/[0.12] rounded-xl px-4 py-3 text-sm placeholder:text-muted/50 focus:outline-none focus:border-orange focus:bg-ink-2/50 transition-all text-cream text-center font-medium shadow-inner"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Code secret de la soirée (ou vide si public)"
            className="bg-ink border border-white/[0.12] rounded-xl px-4 py-3 text-sm placeholder:text-muted/50 focus:outline-none focus:border-orange focus:bg-ink-2/50 transition-all text-cream text-center font-medium shadow-inner"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold rounded-xl px-5 py-3.5 text-xs uppercase tracking-widest hover:brightness-110 box-orange-glow transition-all cursor-pointer"
          >
            Entrer au Salon →
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-orange/20 bg-gradient-to-r from-ink-2 via-ink-2 to-ink p-5 box-orange-glow">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-orange/20 border border-orange/30 flex items-center justify-center text-xl">
            👋
          </span>
          <div>
            <p className="text-sm text-cream font-bold">
              Bienvenue sur le Party Board, <span className="text-orange">{session.username}</span> !
            </p>
            <p className="text-xs text-muted">Coordonnez vos apports en direct avec les autres invités.</p>
          </div>
        </div>
        {session.vip && (
          <span className="text-gold font-bold bg-gold/15 px-3 py-1 rounded-full border border-gold/30 text-[10px] uppercase tracking-wider animate-pulse self-start sm:self-auto">
            👑 Privilège VIP Secret
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Party Board Live Contributions (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-6 space-y-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange animate-pulse" />
                <h2 className="font-display text-xl font-bold text-cream">Qui ramène quoi</h2>
              </div>
              <span className="text-xs font-mono font-bold text-orange bg-orange/15 px-3 py-1 rounded-full border border-orange/30">
                {contributions.length} Contribution{contributions.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Quick 1-tap pledges */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-caps text-muted font-bold">
                ⚡ Promesses rapides en 1 clic :
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_ITEMS.map((qi) => (
                  <form
                    key={qi.label}
                    action={async () => {
                      const fd = new FormData();
                      fd.append("item", qi.item);
                      fd.append("quantity", qi.qty);
                      await addContribution(slug, fd);
                    }}
                  >
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-ink/70 hover:bg-orange/20 border border-white/[0.1] hover:border-orange/40 text-xs text-cream font-semibold transition-all cursor-pointer active:scale-95"
                    >
                      + {qi.label}
                    </button>
                  </form>
                ))}
              </div>
            </div>

            {/* Custom Input Form */}
            <form
              action={async (formData: FormData) => {
                await addContribution(slug, formData);
              }}
              className="grid sm:grid-cols-[1fr_auto_auto] gap-2 pt-2"
            >
              <input
                name="item"
                required
                placeholder="Ou autre : Rhum, Jus de Citron, Soft..."
                className="bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs placeholder:text-muted/60 focus:outline-none focus:border-orange text-cream font-medium"
              />
              <input
                name="quantity"
                placeholder="Qté (ex: 2 btl)"
                className="bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs placeholder:text-muted/60 focus:outline-none focus:border-orange text-cream font-medium w-28"
              />
              <button
                type="submit"
                className="bg-orange text-ink font-extrabold rounded-xl px-4 py-2.5 text-xs hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider cursor-pointer"
              >
                Promettre
              </button>
            </form>

            {/* Contribution Live List */}
            {contributions.length === 0 ? (
              <div className="text-center py-8 rounded-xl bg-ink/40 border border-white/[0.05]">
                <p className="text-2xl mb-2">🎁</p>
                <p className="text-muted text-xs italic">Soyez le premier à ajouter un apport pour la soirée !</p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {contributions.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/[0.08] bg-ink/70 px-4 py-3 flex items-center justify-between text-xs text-cream hover:border-orange/30 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-orange">{c.user.username}</span>
                      <span className="text-muted">apporte</span>
                      <span className="font-semibold text-cream">{c.item}</span>
                      {c.quantity && (
                        <span className="text-[10px] font-mono bg-orange/15 px-2 py-0.5 rounded text-orange font-bold border border-orange/30">
                          {c.quantity}
                        </span>
                      )}
                    </div>
                    {c.user.id === session.sub && (
                      <button
                        onClick={() => startTransition(() => deleteContributionAction(slug, c.id))}
                        className="text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Already at the Bar Section */}
          <section className="rounded-2xl border border-white/[0.08] bg-ink-2/60 p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-cream border-b border-white/[0.08] pb-2 flex items-center gap-2">
              <span>🍸</span>
              <span>Déjà au Bar de l&apos;Hôte</span>
            </h2>
            {stock.length === 0 ? (
              <p className="text-muted text-xs italic">Aucune bouteille déclarée en stock.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {stock.map((b, i) => {
                  const style = getCategoryStyle(b.type as any);
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.07] bg-ink/60 px-3.5 py-2.5 flex justify-between items-center text-xs"
                    >
                      <span className="font-semibold text-cream truncate mr-2 flex items-center gap-1.5">
                        <span>{style.icon}</span>
                        <span>{b.name}</span>
                      </span>
                      <span className="text-[10px] font-mono bg-white/[0.07] px-2 py-0.5 rounded text-cream font-bold">
                        {b.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Cocktails & VIP Secret Vault (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <h2 className="font-display text-lg font-bold text-cream flex items-center gap-2">
                <span>🍹</span>
                <span>Cocktails Servis ce Soir</span>
              </h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                {readyCocktails.length} Prêts
              </span>
            </div>

            {readyCocktails.length === 0 ? (
              <p className="text-muted text-xs italic py-4">
                Aucun cocktail complet pour l&apos;instant. Apportez les ingrédients manquants pour enrichir la carte !
              </p>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {readyCocktails.map(({ recipe }) => (
                  <div
                    key={recipe.id}
                    className="rounded-xl border border-white/[0.08] bg-ink/70 p-4 hover:border-orange/30 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base text-cream font-bold">{recipe.name}</h3>
                      <span className="text-[10px] uppercase font-mono text-orange bg-orange/15 px-2 py-0.5 rounded">
                        {recipe.glass}
                      </span>
                    </div>
                    <p className="text-xs text-muted italic line-clamp-2">{recipe.description}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {recipe.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-cream/80">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Secret VIP Vault if session is VIP */}
          {session.vip && (
            <section className="rounded-2xl vip-vault-card p-6 border border-gold/40 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 border-b border-gold/20 pb-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <h3 className="font-display text-lg text-gold font-bold">Le Salon Secret VIP</h3>
                  <p className="text-[10px] text-gold-dim">Réservé aux membres initiés de la soirée</p>
                </div>
              </div>

              {vipStock.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gold uppercase tracking-wider font-bold">Alcools Rares de la Réserve</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {vipStock.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-gold/20 bg-ink/60 px-3 py-2 flex justify-between items-center text-cream"
                      >
                        <span className="font-semibold truncate mr-2">{b.name}</span>
                        <span className="text-[10px] font-mono bg-gold/20 px-2 py-0.5 rounded text-gold font-bold">
                          {b.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vipCocktails.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] text-gold uppercase tracking-wider font-bold">Cocktails Rares Débloqués</p>
                  <div className="space-y-2">
                    {vipCocktails.map(({ recipe }) => (
                      <div
                        key={recipe.id}
                        className="rounded-xl border border-gold/25 bg-ink/40 p-3 text-xs flex justify-between items-center"
                      >
                        <span className="font-display text-sm text-cream font-bold">{recipe.name}</span>
                        <span className="text-gold text-[10px] uppercase font-mono">{recipe.glass}</span>
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
