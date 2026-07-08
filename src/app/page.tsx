import Link from "next/link";
import { listBottles, listEvents } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";

export default async function HomePage() {
  const bottles = await listBottles();
  const events = await listEvents();

  const stockCount = bottles.filter((b) => b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const availability = evaluateRecipes(bottles);
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];

  return (
    <div className="-mx-6 -my-10 grid lg:grid-cols-2 min-h-[calc(100vh-8.5rem)]">
      {/* Left: moody spotlight panel */}
      <div className="relative overflow-hidden bg-ink-2 border-b lg:border-b-0 lg:border-r border-brick/40 flex items-end p-10 min-h-[320px]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 78%, rgba(150,57,42,0.55), rgba(20,9,10,0) 55%), radial-gradient(circle at 30% 20%, rgba(240,194,76,0.08), rgba(20,9,10,0) 40%)",
          }}
        />
        <div className="relative">
          <p className="text-xs uppercase tracking-caps text-gold-dim mb-3">Chez toi</p>
          <h2 className="font-display text-3xl text-cream leading-tight">
            Le QG
            <br />
            des soirées
          </h2>
          <p className="text-muted text-sm mt-4 max-w-xs">
            Tout le monde débarque chez toi, alors autant savoir ce qu&apos;il reste dans le bar avant que
            quelqu&apos;un ne pose la question.
          </p>
        </div>
      </div>

      {/* Right: brick content panel */}
      <div className="relative bg-brick px-10 py-12 flex flex-col">
        <div className="flex items-start justify-between">
          <p className="text-xs uppercase tracking-caps text-gold-dim">Tableau de bord</p>
          <p className="text-xs text-gold-dim">
            {String(upcoming.length).padStart(2, "0")} · soirée{upcoming.length > 1 ? "s" : ""} à venir
          </p>
        </div>

        <h1 className="font-display text-6xl sm:text-7xl text-gold leading-none mt-6">
          Bar de Noa
        </h1>

        <div className="grid grid-cols-2 gap-3 mt-10">
          <StatCard label="Bouteilles en stock" value={stockCount} href="/stock" />
          <StatCard label="Réserve VIP" value={vipCount} href="/stock" />
          <StatCard label="Cocktails prêts" value={makeableNow} href="/cocktails" />
          <StatCard label="Soirées à venir" value={upcoming.length} href="/soirees" />
        </div>

        <div className="mt-10 pt-8 border-t border-cream/15 grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Prochaine soirée</p>
            {nextEvent ? (
              <>
                <p className="font-display text-2xl text-cream">{nextEvent.name}</p>
                <p className="text-muted text-sm mt-1 capitalize">
                  {new Date(nextEvent.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </>
            ) : (
              <p className="text-muted text-sm">Rien de planifié.</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Action</p>
            {nextEvent ? (
              <Link
                href={`/soirees/${nextEvent.slug}`}
                className="inline-block text-sm px-4 py-2 rounded-full bg-gold text-ink font-medium hover:bg-cream transition-colors"
              >
                Voir la soirée →
              </Link>
            ) : (
              <Link
                href="/soirees"
                className="inline-block text-sm px-4 py-2 rounded-full bg-gold text-ink font-medium hover:bg-cream transition-colors"
              >
                Planifier une soirée →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-cream/15 bg-ink/20 p-4 hover:border-gold/60 hover:bg-ink/30 transition-colors"
    >
      <p className="font-display text-3xl text-cream">{value}</p>
      <p className="text-[11px] uppercase tracking-caps text-gold-dim mt-1">{label}</p>
    </Link>
  );
}
