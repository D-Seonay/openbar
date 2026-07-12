import Link from "next/link";
import { listBottles, listEvents, evaluateCocktails } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import { getCategoryStyle } from "@/lib/categoryStyles";
import type { BottleType } from "@/lib/types";

export default async function HomePage() {
  const [bottles, events, availability, session] = await Promise.all([
    listBottles(),
    listEvents(),
    evaluateCocktails(),
    getSession(),
  ]);

  const isVipOrAdmin = Boolean(session?.vip || session?.role === "ADMIN");

  // Only consider accessible bottles for non-VIPs
  const accessibleBottles = isVipOrAdmin ? bottles : bottles.filter((b) => !b.vip);

  const stockCount = bottles.filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const lowStock = accessibleBottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => (a.quantity - a.lowStockThreshold!) - (b.quantity - b.lowStockThreshold!));
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];

  // Category counts
  const categories: BottleType[] = ["whisky", "rhum", "gin", "vodka", "tequila", "vin", "champagne", "liqueur"];
  const categoryCounts = categories.map((cat) => {
    const count = accessibleBottles.filter((b) => b.type === cat && b.quantity > 0).length;
    return { type: cat, count, style: getCategoryStyle(cat) };
  }).filter((c) => c.count > 0);

  return (
    <PageTransition className="space-y-10">
      {/* Hero Cocktail Club Spotlight */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-2 border border-white/[0.08] shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
        <div
          className="absolute inset-0 opacity-80 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(232,165,99,0.18) 0%, rgba(255,107,53,0.1) 40%, rgba(17,13,12,0) 75%), radial-gradient(circle at 20% 80%, rgba(61,35,26,0.3) 0%, rgba(17,13,12,0) 60%)",
          }}
        />
        <div className="relative z-10 grid lg:grid-cols-12 gap-8 p-8 sm:p-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-caps text-gold px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1]">
              <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
              {isVipOrAdmin ? "Cave Privée & Salon Lounge" : "Salon de Mixologie & Bar Lounge"}
            </div>
            <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-cream leading-[1.08] tracking-tight">
              L&apos;art du <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange via-gold to-amber-300">Cocktail Privé</span>
            </h1>
            <p className="text-muted text-sm sm:text-base max-w-xl leading-relaxed font-normal">
              Bienvenue dans votre salon feutré. Explorez la cave, calculez instantanément vos cocktails réalisables et organisez des soirées d&apos;exception.
            </p>

            {/* Quick Category Badges */}
            <div className="pt-2 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-caps text-muted mr-1 font-semibold">En cave :</span>
              {categoryCounts.map(({ type, count, style }) => (
                <Link
                  key={type}
                  href="/stock"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${style.badgeBg} ${style.badgeText} border ${style.badgeBorder} hover:scale-105 transition-transform`}
                >
                  <span>{style.icon}</span>
                  <span>{style.label}</span>
                  <span className="opacity-75">({count})</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Right Hero Event / Quick Action */}
          <div className="lg:col-span-5 bg-ink/75 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <span className="text-xs font-semibold uppercase tracking-caps text-gold">Prochaine Soirée</span>
              <span className="text-[11px] text-muted font-mono bg-white/[0.05] px-2.5 py-0.5 rounded-full">
                {String(upcoming.length).padStart(2, "0")} au calendrier
              </span>
            </div>

            {nextEvent ? (
              <div className="space-y-3">
                <h3 className="font-display text-2xl font-bold text-cream">{nextEvent.name}</h3>
                <p className="text-orange text-xs font-medium capitalize flex items-center gap-2">
                  <span>📅</span>
                  {new Date(nextEvent.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <div className="pt-2">
                  <Link
                    href={`/soirees/${nextEvent.slug}`}
                    className="w-full flex items-center justify-center gap-2 text-xs uppercase tracking-widest px-5 py-3.5 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold hover:brightness-110 box-orange-glow transition-all duration-300"
                  >
                    <span>Ouvrir le Party Board</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-3">
                <p className="text-muted/70 text-sm italic">Aucune soirée planifiée pour l&apos;instant</p>
                <Link
                  href="/soirees"
                  className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-widest px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-cream border border-white/[0.1] transition-colors font-semibold"
                >
                  <span>🎉 Planifier une soirée</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Dashboard Stat Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-caps text-muted font-bold">Indicateurs du Bar</h2>
          <Link href="/stock" className="text-xs text-gold hover:underline font-semibold">
            Consulter le stock →
          </Link>
        </div>

        <div className={`grid gap-4 ${isVipOrAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
          <StatCard
            label="Bouteilles en stock"
            value={stockCount}
            href="/stock"
            icon="🥃"
            accent="border-orange/30 hover:border-orange/60"
            subLabel="Hors mixers"
          />
          {isVipOrAdmin && (
            <StatCard
              label="Réserve Privée VIP"
              value={vipCount}
              href="/stock?tab=vip"
              icon="🔒"
              accent="border-gold/40 hover:border-gold/70 bg-gradient-to-br from-brick-dark/60 to-ink-2"
              subLabel="Écrin secret"
            />
          )}
          <StatCard
            label="Cocktails prêts"
            value={makeableNow}
            href="/cocktails"
            icon="🍸"
            accent="border-emerald-500/30 hover:border-emerald-500/60"
            subLabel="Servibles ce soir"
          />
          <StatCard
            label="Soirées à venir"
            value={upcoming.length}
            href="/soirees"
            icon="🎉"
            accent="border-rose-500/30 hover:border-rose-500/60"
            subLabel="Événements"
          />
        </div>
      </div>

      {/* Low Stock Alert Section if any */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-brick-dark/60 via-ink-2 to-ink-2 p-6 border border-red-500/25 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange animate-ping" />
              <h3 className="text-xs uppercase tracking-caps text-orange font-extrabold">
                {lowStock.length} Alerte{lowStock.length > 1 ? "s" : ""} de Réapprovisionnement
              </h3>
            </div>
            <Link href="/stock" className="text-xs text-muted hover:text-cream">
              Voir tout le stock →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {lowStock.slice(0, 4).map((b) => (
              <div key={b.id} className="rounded-xl bg-ink/70 border border-white/[0.08] p-3 flex flex-col justify-between">
                <span className="text-sm font-semibold text-cream truncate">{b.name}</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] uppercase text-muted">{b.type}</span>
                  <span className="text-xs font-mono font-bold text-orange bg-orange/15 px-2 py-0.5 rounded border border-orange/30">
                    {b.quantity} restant{b.quantity > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function StatCard({
  label,
  value,
  href,
  icon,
  accent = "border-white/[0.08]",
  subLabel,
}: {
  label: string;
  value: number;
  href: string;
  icon: string;
  accent?: string;
  subLabel?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative rounded-2xl border ${accent} bg-ink-2/70 p-5 hover:bg-ink-2 transition-all duration-300 flex flex-col justify-between h-32 shadow-md`}
    >
      <div className="flex justify-between items-start">
        <span className="text-2xl">{icon}</span>
        <span className="text-orange opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs font-bold">→</span>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <p className="font-display text-3xl sm:text-4xl text-cream font-bold tracking-tight">{value}</p>
          {subLabel && <span className="text-[11px] text-muted">{subLabel}</span>}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted group-hover:text-cream transition-colors duration-300 mt-1 font-semibold">{label}</p>
      </div>
    </Link>
  );
}
