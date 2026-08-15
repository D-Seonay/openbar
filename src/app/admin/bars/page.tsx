import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllBars } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import { Badge } from "@/components/ui";

export default async function AdminBarsPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const bars = await listAllBars();

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-rule">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-caps text-terracotta mb-2">
            <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-[27px] text-ink mt-1">
            Tous les bars
          </h1>
        </div>

        <div className="text-[13px] text-ink-soft bg-paper-sunk px-4 py-2 rounded-xl border border-rule">
          Bars enregistrés : <span className="text-ink font-bold">{bars.length}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-paper-sunk border border-rule overflow-hidden divide-y divide-rule">
        {bars.length === 0 ? (
          <div className="py-12 text-center text-[15px] text-ink-soft">Aucun bar sur la plateforme.</div>
        ) : (
          bars.map((bar) => (
            <Link
              key={bar.id}
              href={`/admin/bars/${bar.id}`}
              className="p-4 sm:p-4.5 flex items-center justify-between gap-3 hover:bg-paper transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[15px] text-ink truncate">{bar.name}</p>
                <p className="text-[13px] text-ink-soft mt-0.5">
                  Par {bar.ownerUsername} · {bar.memberCount} membre{bar.memberCount > 1 ? "s" : ""}
                </p>
              </div>
              <span className="shrink-0">
                <Badge ton={bar.isPublic ? "complet" : "neutre"}>{bar.isPublic ? "Public" : "Privé"}</Badge>
              </span>
            </Link>
          ))
        )}
      </div>
    </PageTransition>
  );
}
