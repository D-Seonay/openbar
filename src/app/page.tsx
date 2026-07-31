import Link from "next/link";
import { redirect } from "next/navigation";
import { listBottles, listEvents, evaluateCocktails, listMyBars, listBarsDirectory } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";
import BarDirectory from "./BarDirectory";
import GuestLanding from "./GuestLanding";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <GuestLanding />;

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  
  if (!activeBar) {
    const directory = await listBarsDirectory();
    return (
      <PageTransition className="space-y-8">
        <div className="py-12 text-center border-b border-orange/15">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Bienvenue sur OpenBar</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-cream tracking-tight mb-4 mt-2">
            L&apos;Art du Cocktail Privé
          </h1>
          <p className="text-muted max-w-lg mx-auto mb-8">
            Vous n&apos;avez pas encore de bar. Vous pouvez en créer un ou rejoindre un bar existant pour accéder aux fonctionnalités.
          </p>
          <Link
            href="/creer"
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold text-sm uppercase tracking-wider box-orange-glow transition-all hover:brightness-110"
          >
            Créer mon premier bar
          </Link>
        </div>
        <BarDirectory entries={directory} />
      </PageTransition>
    );
  }

  const [bottles, availability, directory, events, eventsByBar] = await Promise.all([
    listBottles(activeBar.id),
    evaluateCocktails(activeBar.id),
    listBarsDirectory(),
    listEvents(activeBar.id),
    Promise.all(
      bars.map(async (bar) => {
        const barEvents = await listEvents(bar.id);
        return barEvents.map((event) => ({ ...event, barName: bar.name }));
      }),
    ),
  ]);

  const isVipOrAdmin = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const accessibleBottles = isVipOrAdmin ? bottles : bottles.filter((b) => !b.vip);

  const stockCount = accessibleBottles.filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const totalLiters = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const lowStock = accessibleBottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => (a.quantity - a.lowStockThreshold!) - (b.quantity - b.lowStockThreshold!));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.date >= today && !e.isClosed)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];

  const upcomingAcrossBars = eventsByBar
    .flat()
    .filter((e) => e.date >= today && !e.isClosed)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextEventAcrossAll = upcomingAcrossBars[0];

  return (
    <PageTransition className="space-y-8">
      {/* Warm Lounge Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Salon de Mixologie & Bar Lounge</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-cream tracking-tight">
            L&apos;Art du Cocktail Privé
          </h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3">
          <Link
            href="/stock"
            className="tap-target flex items-center justify-center text-center px-3 sm:px-4 py-2.5 rounded-xl bg-ink-2 hover:bg-ink-2/80 border border-white/[0.08] text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-cream hover:border-orange/50 transition-all"
          >
            Consulter la Cave →
          </Link>
          <Link
            href="/cocktails"
            className="tap-target flex items-center justify-center text-center px-3 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold text-[11px] sm:text-xs uppercase tracking-wider box-orange-glow transition-all hover:brightness-110"
          >
            Carte des Cocktails →
          </Link>
        </div>
      </div>

      {/* Primary Lounge Indicators Grid */}
      <div className={`grid gap-4 ${isVipOrAdmin ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        <LoungeMetricCard
          sub="RAYON SPIRITUEUX"
          title="Cave du Bar"
          value={stockCount}
          unit="bouteilles"
          detail={`Volume en réserve : ${formatLiters(totalLiters)}`}
          href="/stock"
          accent="border-orange/30 hover:border-orange/60"
        />

        {isVipOrAdmin && (
          <LoungeMetricCard
            sub="SECTION CONFIDENTIELLE"
            title="Réserve Privée VIP"
            value={vipCount}
            unit="références"
            detail="Écrin secret réservé aux initiés"
            href="/stock"
            accent="border-gold/40 hover:border-gold/70 bg-gradient-to-br from-brick-dark/60 to-ink-2"
          />
        )}

        <LoungeMetricCard
          sub="CARTE INSTANTANÉE"
          title="Cocktails Prêts"
          value={makeableNow}
          unit="recettes"
          detail="Servibles ce soir avec la cave"
          href="/cocktails"
          accent="border-emerald-500/30 hover:border-emerald-500/60"
        />

        <LoungeMetricCard
          sub="ÉVÉNEMENTS À VENIR"
          title="Soirées au Bar"
          value={upcoming.length}
          unit="soirées"
          detail={nextEvent ? `Prochainement : ${nextEvent.name}` : "Aucune soirée au calendrier"}
          href="/soirees"
          accent="border-rose-500/30 hover:border-rose-500/60"
        />
      </div>

      {/* Architectural Split Section: Prochain Événement + Diagnostic Cave */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Next Party Board Lounge Card */}
        <div className="lg:col-span-5 rounded-2xl bg-ink-2/80 border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <span className="text-xs uppercase tracking-caps text-gold font-bold">
                Prochain Party Board
              </span>
              <span className="text-[11px] text-muted bg-white/[0.05] px-2.5 py-0.5 rounded-full">
                Événement
              </span>
            </div>

            {nextEventAcrossAll ? (
              <div className="space-y-3">
                <h3 className="font-display text-2xl font-bold text-cream">{nextEventAcrossAll.name}</h3>
                <p className="text-orange text-xs font-semibold capitalize">
                  {new Date(nextEventAcrossAll.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {" · "}
                  {nextEventAcrossAll.barName}
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Le Party Board interactif permet aux invités d&apos;annoncer leurs apports et de promener leurs verres dans le salon.
                </p>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted/70 italic">Aucune soirée planifiée pour le moment</p>
              </div>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-white/[0.08]">
            {nextEventAcrossAll ? (
              <Link
                href={`/soirees/${nextEventAcrossAll.slug}`}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold text-xs uppercase tracking-wider box-orange-glow transition-all hover:brightness-110"
              >
                <span>Ouvrir le Party Board</span>
                <span>→</span>
              </Link>
            ) : (
              <Link
                href="/soirees"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-orange hover:underline font-semibold"
              >
                <span>+ Planifier une soirée</span>
              </Link>
            )}
          </div>
        </div>

        {/* Low Stock Alerts Warm Lounge Card */}
        <div className="lg:col-span-7 rounded-2xl bg-ink-2/80 border border-white/[0.08] p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
            <span className="text-xs uppercase tracking-caps text-orange font-bold">
              Surveillance du Stock & Alertes
            </span>
            <span
              className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                lowStock.length > 0
                  ? "bg-orange/15 text-orange border border-orange/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {lowStock.length > 0 ? `${lowStock.length} à réapprovisionner` : "Stock idéal"}
            </span>
          </div>

          {lowStock.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-cream">Votre cave est parfaitement approvisionnée</p>
              <p className="text-xs text-muted">Aucune bouteille sous son seuil d&apos;alerte n&apos;a été détectée.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {lowStock.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-ink/70 border border-white/[0.06] hover:border-orange/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-muted px-2 py-0.5 rounded bg-white/[0.05] shrink-0">
                      {b.type}
                    </span>
                    <span className="font-semibold text-sm text-cream truncate">{b.name}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span className="text-xs font-mono font-bold text-orange">
                      {b.quantity} restant{b.quantity > 1 ? "s" : ""}
                    </span>
                    <Link
                      href="/stock"
                      className="text-xs text-gold hover:underline font-semibold"
                    >
                      Ajuster →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BarDirectory entries={directory} />
    </PageTransition>
  );
}

function LoungeMetricCard({
  sub,
  title,
  value,
  unit,
  detail,
  href,
  accent = "border-white/[0.08]",
}: {
  sub: string;
  title: string;
  value: number;
  unit: string;
  detail: string;
  href: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative rounded-2xl border ${accent} bg-ink-2/80 p-5 hover:bg-ink-2 transition-all duration-300 flex flex-col justify-between shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-caps text-muted font-semibold">{sub}</span>
        <span className="text-orange opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-bold">
          →
        </span>
      </div>
      <div className="my-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold text-cream">{value}</span>
          <span className="text-xs text-muted">{unit}</span>
        </div>
        <p className="font-display text-base font-bold text-cream mt-1">{title}</p>
      </div>
      <p className="text-xs text-muted/80 truncate">{detail}</p>
    </Link>
  );
}
