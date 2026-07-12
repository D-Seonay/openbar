import Link from "next/link";
import { listBottles, listEvents, evaluateCocktails } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

export default async function HomePage() {
  const [bottles, events, availability, session] = await Promise.all([
    listBottles(),
    listEvents(),
    evaluateCocktails(),
    getSession(),
  ]);

  const isVipOrAdmin = Boolean(session?.vip || session?.role === "ADMIN");
  const accessibleBottles = isVipOrAdmin ? bottles : bottles.filter((b) => !b.vip);

  const stockCount = accessibleBottles.filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const totalLiters = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const lowStock = accessibleBottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => (a.quantity - a.lowStockThreshold!) - (b.quantity - b.lowStockThreshold!));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];

  return (
    <PageTransition className="space-y-8">
      {/* OS Telemetry & Studio Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>SYSTEM_TELEMETRY // MIXOLOGY WORKBENCH</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            Tableau de Bord Architectural
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/stock"
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-mono text-xs font-semibold text-zinc-300 transition-colors"
          >
            [01] CAVE & STOCK →
          </Link>
          <Link
            href="/cocktails"
            className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-bold transition-colors"
          >
            [02] CARTE MIXOLOGIE →
          </Link>
        </div>
      </div>

      {/* Primary Technical Modules Grid */}
      <div className={`grid gap-4 ${isVipOrAdmin ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        <StudioMetricCard
          code="INV-01"
          title="CAVE DU BAR"
          value={stockCount}
          unit="RÉFÉRENCES"
          detail={`Volume total : ${formatLiters(totalLiters)}`}
          href="/stock"
        />

        {isVipOrAdmin && (
          <StudioMetricCard
            code="VLT-VIP"
            title="RÉSERVE PRIVÉE"
            value={vipCount}
            unit="RÉF. VIP"
            detail="Section confidentielle"
            href="/stock"
            highlight
          />
        )}

        <StudioMetricCard
          code="MIX-02"
          title="COCKTAILS SERVIABLES"
          value={makeableNow}
          unit="RECETTES"
          detail="Prêts avec le stock actuel"
          href="/cocktails"
        />

        <StudioMetricCard
          code="EVT-03"
          title="SOIRÉES AU CALENDRIER"
          value={upcoming.length}
          unit="ÉVÉNEMENTS"
          detail={nextEvent ? `Prochain : ${nextEvent.name}` : "Aucune soirée programmée"}
          href="/soirees"
        />
      </div>

      {/* Split Architectural Section: Prochain Événement + Diagnostic Cave */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Next Event Terminal Panel */}
        <div className="lg:col-span-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                // PROCHAIN PARTY BOARD
              </span>
              <span className="font-mono text-[10px] text-zinc-500">SYS_EVENT</span>
            </div>

            {nextEvent ? (
              <div className="space-y-3">
                <h3 className="font-display text-xl font-bold text-zinc-100">{nextEvent.name}</h3>
                <p className="font-mono text-xs text-amber-400">
                  {new Date(nextEvent.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Le Party Board interactif permet aux invités d&apos;annoncer leurs apports et de consulter la carte en direct.
                </p>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-xs font-mono text-zinc-500">// AUCUNE SOIRÉE ACTIVE</p>
              </div>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-zinc-800/80">
            {nextEvent ? (
              <Link
                href={`/soirees/${nextEvent.slug}`}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 text-zinc-100 font-mono text-xs font-semibold transition-colors"
              >
                <span>ACCÉDER AU PARTY BOARD</span>
                <span>→</span>
              </Link>
            ) : (
              <Link
                href="/soirees"
                className="inline-flex items-center gap-2 font-mono text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <span>+ PLANIFIER UNE SOIRÉE</span>
              </Link>
            )}
          </div>
        </div>

        {/* System Diagnostics: Low Stock Alerts */}
        <div className="lg:col-span-7 rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-6">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                // DIAGNOSTIC DE STOCK
              </span>
            </div>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                lowStock.length > 0
                  ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}
            >
              {lowStock.length > 0 ? `${lowStock.length} ALERTE(S)` : "STOCK OPTIMAL"}
            </span>
          </div>

          {lowStock.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-mono text-xs text-emerald-400">STATUS: TOUS LES SEUILS SONT RESPECTÉS</p>
              <p className="text-xs text-zinc-500">Aucune référence ne nécessite un réapprovisionnement immédiat.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {lowStock.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase text-zinc-500 px-2 py-0.5 rounded bg-zinc-900">
                      {b.type}
                    </span>
                    <span className="font-semibold text-sm text-zinc-100">{b.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {b.quantity} btl
                    </span>
                    <Link
                      href="/stock"
                      className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 underline"
                    >
                      Ajuster
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function StudioMetricCard({
  code,
  title,
  value,
  unit,
  detail,
  href,
  highlight = false,
}: {
  code: string;
  title: string;
  value: number;
  unit: string;
  detail: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-xl border p-5 flex flex-col justify-between transition-all duration-200 ${
        highlight
          ? "bg-zinc-900/90 border-amber-500/30 hover:border-amber-400/60"
          : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <span>[{code}]</span>
        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
      </div>
      <div className="my-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-extrabold text-zinc-100">{value}</span>
          <span className="font-mono text-[11px] text-zinc-400">{unit}</span>
        </div>
        <p className="font-display text-xs font-bold text-zinc-300 uppercase tracking-wide mt-1">
          {title}
        </p>
      </div>
      <p className="font-mono text-[11px] text-zinc-500 truncate">{detail}</p>
    </Link>
  );
}
