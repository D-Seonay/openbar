import Link from "next/link";
import { listBottles, listEvents } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";

export default async function HomePage() {
  const bottles = await listBottles();
  const events = await listEvents();

  const stockCount = bottles.filter((b) => b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const availability = evaluateRecipes(bottles);
  const lowStock = bottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => a.quantity - b.quantity);
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];

  return (
    <div className="-mx-6 -my-10 grid lg:grid-cols-2 min-h-[calc(100vh-8.5rem)]">
      {/* Left: moody spotlight panel */}
      <div className="relative overflow-hidden bg-ink-2 border-b lg:border-b-0 lg:border-r border-orange/15 flex items-end p-12 min-h-[360px]">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at 50% 80%, rgba(255,99,43,0.3) 0%, rgba(107,31,21,0.15) 45%, rgba(15,7,8,0) 80%), radial-gradient(circle at 10% 10%, rgba(245,190,79,0.06) 0%, rgba(15,7,8,0) 50%)",
          }}
        />
        <div className="relative z-10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-orange mb-3 block">Atmosphère Privée</span>
          <h2 className="font-display text-4xl sm:text-5xl text-cream leading-tight font-light">
            Le Salon <br />
            <span className="text-orange">de Noa</span>
          </h2>
          <p className="text-muted text-sm mt-4 max-w-sm leading-relaxed">
            Votre espace personnel de mixologie. Gérez votre stock d&apos;exception, découvrez les recettes réalisables et planifiez vos plus belles soirées.
          </p>
        </div>
      </div>

      {/* Right: content panel with refined background */}
      <div className="relative bg-ink px-10 py-12 flex flex-col justify-between border-t lg:border-t-0 border-orange/10">
        <div className="absolute inset-0 bg-radial-[circle_at_top_right] from-brick-dark/15 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 space-y-8">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Tableau de Bord</span>
            <span className="text-xs text-muted/80 bg-ink-2 px-2.5 py-1 rounded-full border border-orange/15">
              {String(upcoming.length).padStart(2, "0")} · soirée{upcoming.length > 1 ? "s" : ""} à venir
            </span>
          </div>

          <div>
            <h1 className="font-display text-5xl sm:text-6xl text-cream leading-none tracking-wide">
              Le Bar <span className="text-orange">de Noa</span>
            </h1>
            <p className="text-muted text-xs mt-2">Cocktails sur mesure · Gestion des réserves</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <StatCard label="Bouteilles en stock" value={stockCount} href="/stock" icon="🥃" />
            <StatCard label="Réserve VIP" value={vipCount} href="/stock" icon="🔒" />
            <StatCard label="Cocktails prêts" value={makeableNow} href="/cocktails" icon="🍹" />
            <StatCard label="Soirées à venir" value={upcoming.length} href="/soirees" icon="🎉" />
          </div>

          <div className="mt-8 pt-8 border-t border-orange/10 grid sm:grid-cols-2 gap-8 items-center bg-ink-2/30 p-6 rounded-xl border border-orange/5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-2 font-medium">Prochaine soirée</p>
              {nextEvent ? (
                <>
                  <p className="font-display text-2xl text-cream">{nextEvent.name}</p>
                  <p className="text-orange text-xs mt-1 capitalize font-medium">
                    {new Date(nextEvent.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </>
              ) : (
                <p className="text-muted/60 text-sm italic">Aucun événement planifié</p>
              )}
            </div>
            <div className="sm:text-right">
              {nextEvent ? (
                <Link
                  href={`/soirees/${nextEvent.slug}`}
                  className="inline-block text-xs uppercase tracking-widest px-5 py-3 rounded-full bg-orange text-white font-medium hover:bg-orange-hover box-orange-glow transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  Rejoindre →
                </Link>
              ) : (
                <Link
                  href="/soirees"
                  className="inline-block text-xs uppercase tracking-widest px-5 py-3 rounded-full bg-orange text-white font-medium hover:bg-orange-hover box-orange-glow transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  Planifier →
                </Link>
              )}
            </div>
          </div>

          {lowStock.length > 0 && (
            <div className="mt-6 pt-6 border-t border-orange/10 bg-brick-dark/10 p-5 rounded-lg border border-red-500/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-orange animate-ping" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange font-bold">
                  {lowStock.length} Alerte{lowStock.length > 1 ? "s" : ""} Réapprovisionnement
                </p>
              </div>
              <ul className="text-xs space-y-2">
                {lowStock.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex justify-between items-center text-muted">
                    <span className="text-cream font-medium">{b.name}</span>
                    <span className="text-orange font-mono bg-orange-dark/20 px-2 py-0.5 rounded border border-orange-dark/30">
                      {b.quantity} restant{b.quantity > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {lowStock.length > 4 && (
                <p className="text-[10px] text-muted/50 mt-2 text-right">Et {lowStock.length - 4} autres bouteilles...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, icon }: { label: string; value: number; href: string; icon: string }) {
  return (
    <Link
      href={href}
      className="group relative rounded-xl border border-orange/10 bg-ink-2/40 p-5 hover:border-orange/40 hover:bg-ink-2 transition-all duration-300 box-orange-glow-hover flex flex-col justify-between h-28"
    >
      <div className="flex justify-between items-start">
        <span className="text-2xl">{icon}</span>
        <span className="text-orange opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs">→</span>
      </div>
      <div>
        <p className="font-mono text-3xl text-cream font-semibold tracking-tight">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted group-hover:text-cream transition-colors duration-300 mt-1">{label}</p>
      </div>
    </Link>
  );
}

