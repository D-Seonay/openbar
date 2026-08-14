"use client";

import { addContribution, deleteContributionAction } from "@/app/actions";
import { login } from "@/app/login/actions";
import type { Contribution } from "@/lib/types";
import type { SessionUser } from "@/lib/session";
import type { RecipeAvailability } from "@/lib/cocktail-types";
import { useTransition } from "react";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { Badge, Button, Card, champClasses } from "@/components/ui";

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
      <Card className="max-w-md mx-auto text-center space-y-6 my-6 sm:my-10">
        <div className="w-16 h-16 rounded-2xl bg-paper-sunk border border-rule flex items-center justify-center text-4xl mx-auto">
          🎟️
        </div>
        <div>
          <h2 className="font-display text-[27px] text-ink">Rejoindre le Party Board</h2>
          <p className="text-[13px] text-ink-soft mt-2 leading-relaxed">
            Identifiez-vous par votre prénom pour découvrir ce qui est déjà au Bar, voir qui apporte quoi et promener vos verres dans le salon.
          </p>
        </div>
        <form action={login} className="flex flex-col gap-3">
          <input type="hidden" name="redirectTo" value={`/soirees/${slug}`} />
          <input
            name="username"
            required
            placeholder="Votre prénom"
            autoComplete="username"
            autoCapitalize="words"
            autoCorrect="off"
            className={`text-center ${champClasses}`}
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Code secret de la soirée (ou vide si public)"
            autoComplete="current-password"
            className={`text-center ${champClasses}`}
          />
          <Button type="submit" pleineLargeur>
            Entrer au Salon →
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-rule bg-paper-sunk p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-paper border border-rule flex items-center justify-center text-xl">
            👋
          </span>
          <div>
            <p className="text-[15px] text-ink font-semibold">
              Bienvenue sur le Party Board, <span className="text-terracotta">{session.username}</span> !
            </p>
            <p className="text-[13px] text-ink-soft">Coordonnez vos apports en direct avec les autres invités.</p>
          </div>
        </div>
        {session.vip && <Badge ton="alerte">👑 Privilège VIP Secret</Badge>}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Party Board Live Contributions (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] text-ink">Qui ramène quoi</h2>
              <Badge ton="neutre">
                {contributions.length} Contribution{contributions.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Quick 1-tap pledges */}
            <div className="space-y-2">
              <p className="text-[13px] uppercase tracking-caps text-ink-soft font-semibold">
                Promesses rapides en 1 clic :
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
                      className="tap-target inline-flex items-center px-3.5 rounded-xl bg-paper-sunk border border-rule text-[13px] text-ink font-semibold transition-colors hover:border-terracotta cursor-pointer"
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
              className="grid sm:grid-cols-[1fr_auto_auto] gap-2"
            >
              <input
                name="item"
                required
                placeholder="Ou autre : Rhum, Jus de Citron, Soft..."
                className={champClasses}
              />
              <input
                name="quantity"
                placeholder="Qté (ex: 2 btl)"
                className={`w-full sm:w-28 ${champClasses}`}
              />
              <Button type="submit">Promettre</Button>
            </form>

            {/* Contribution Live List */}
            {contributions.length === 0 ? (
              <div className="text-center py-8 rounded-xl bg-paper-sunk">
                <p className="text-[13px] text-ink-soft italic">Soyez le premier à ajouter un apport pour la soirée !</p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {contributions.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-rule bg-paper px-3.5 sm:px-4 py-3 flex items-start justify-between gap-3 text-[13px] text-ink"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span className="font-semibold text-terracotta">{c.user.username}</span>
                      <span className="text-ink-soft">apporte</span>
                      <span className="font-semibold text-ink break-words">{c.item}</span>
                      {c.quantity && <Badge ton="neutre">{c.quantity}</Badge>}
                    </div>
                    {c.user.id === session.sub && (
                      <button
                        onClick={() => startTransition(() => deleteContributionAction(slug, c.id))}
                        className="tap-target shrink-0 inline-flex items-center px-1.5 text-[13px] text-ink-soft hover:text-terracotta font-semibold transition-colors cursor-pointer"
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Already at the Bar Section */}
          <Card className="space-y-4">
            <h2 className="font-display text-[17px] text-ink">Déjà au Bar de l&apos;Hôte</h2>
            {stock.length === 0 ? (
              <p className="text-[13px] text-ink-soft italic">Aucune bouteille déclarée en stock.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {stock.map((b, i) => {
                  const style = getCategoryStyle(b.type as any);
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-rule bg-paper-sunk px-3.5 py-2.5 flex justify-between items-center text-[13px]"
                    >
                      <span className="font-semibold text-ink truncate mr-2 flex items-center gap-1.5">
                        <span>{style.icon}</span>
                        <span>{b.name}</span>
                      </span>
                      <Badge ton="neutre">{b.quantity}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Cocktails & VIP Secret Vault (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] text-ink">Cocktails Servis ce Soir</h2>
              <Badge ton="complet">{readyCocktails.length} Prêts</Badge>
            </div>

            {readyCocktails.length === 0 ? (
              <p className="text-[13px] text-ink-soft italic py-2">
                Aucun cocktail complet pour l&apos;instant. Apportez les ingrédients manquants pour enrichir la carte !
              </p>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {readyCocktails.map(({ recipe }) => (
                  <div key={recipe.id} className="rounded-xl border border-rule bg-paper-sunk p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-[15px] text-ink font-semibold">{recipe.name}</h3>
                      <Badge ton="neutre">{recipe.glass}</Badge>
                    </div>
                    <p className="text-[13px] text-ink-soft italic line-clamp-2">{recipe.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {recipe.tags.map((tag) => (
                        <span key={tag} className="text-[13px] px-2 py-0.5 rounded bg-paper text-ink-soft">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Secret VIP Vault if session is VIP */}
          {session.vip && (
            <Card className="space-y-4">
              <div>
                <h3 className="font-display text-[17px] text-ink">Le Salon Secret VIP</h3>
                <p className="text-[13px] text-ink-soft">Réservé aux membres initiés de la soirée</p>
              </div>

              {vipStock.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] text-terracotta uppercase tracking-caps font-semibold">
                    Alcools Rares de la Réserve
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2 text-[13px]">
                    {vipStock.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-rule bg-paper-sunk px-3 py-2 flex justify-between items-center text-ink"
                      >
                        <span className="font-semibold truncate mr-2">{b.name}</span>
                        <Badge ton="neutre">{b.quantity}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vipCocktails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] text-terracotta uppercase tracking-caps font-semibold">
                    Cocktails Rares Débloqués
                  </p>
                  <div className="space-y-2">
                    {vipCocktails.map(({ recipe }) => (
                      <div
                        key={recipe.id}
                        className="rounded-xl border border-rule bg-paper-sunk p-3 text-[13px] flex justify-between items-center"
                      >
                        <span className="font-display text-[15px] text-ink font-semibold">{recipe.name}</span>
                        <span className="text-terracotta text-[13px]">{recipe.glass}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
