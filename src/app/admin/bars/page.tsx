import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllBars } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";

export default async function AdminBarsPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const bars = await listAllBars();

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Tous les bars
          </h1>
        </div>

        <div className="text-xs text-muted bg-ink-2 px-4 py-2 rounded-xl border border-white/[0.08]">
          Bars enregistrés : <span className="text-cream font-bold">{bars.length}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
        {bars.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">Aucun bar sur la plateforme.</div>
        ) : (
          bars.map((bar) => (
            <Link
              key={bar.id}
              href={`/admin/bars/${bar.id}`}
              className="p-4.5 flex items-center justify-between gap-4 hover:bg-ink-2 transition-colors"
            >
              <div>
                <p className="font-semibold text-sm text-cream">{bar.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  Par {bar.ownerUsername} · {bar.memberCount} membre{bar.memberCount > 1 ? "s" : ""}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                  bar.isPublic
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/[0.05] text-muted border border-white/[0.08]"
                }`}
              >
                {bar.isPublic ? "Public" : "Privé"}
              </span>
            </Link>
          ))
        )}
      </div>
    </PageTransition>
  );
}
