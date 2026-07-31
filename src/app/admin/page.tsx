import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllBars, listUsers } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";

export default async function AdminDashboardPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const [bars, users] = await Promise.all([listAllBars(), listUsers()]);

  const publicBarsCount = bars.filter((b) => b.isPublic).length;
  const privateBarsCount = bars.length - publicBarsCount;
  const vipUsersCount = users.filter((u) => u.vip).length;
  const adminUsersCount = users.filter((u) => u.role === "ADMIN").length;

  const recentBars = [...bars]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const recentUsers = [...users]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Tableau de bord
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Bars</span>
          <span className="text-cream font-bold text-xl">{bars.length}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Bars publics</span>
          <span className="text-cream font-bold text-xl">{publicBarsCount}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Bars privés</span>
          <span className="text-cream font-bold text-xl">{privateBarsCount}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Comptes</span>
          <span className="text-cream font-bold text-xl">{users.length}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">VIP / Admin</span>
          <span className="text-cream font-bold text-xl">
            {vipUsersCount} <span className="text-muted text-sm font-normal">/</span> {adminUsersCount}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/comptes"
          className="p-5 rounded-2xl bg-ink-2/60 border border-white/[0.08] hover:bg-ink-2 transition-colors shadow-xl"
        >
          <p className="font-display font-bold text-lg text-cream">Comptes & Privilèges VIP</p>
          <p className="text-xs text-muted mt-1">Gérer les comptes, rôles et statuts VIP.</p>
        </Link>
        <Link
          href="/admin/bars"
          className="p-5 rounded-2xl bg-ink-2/60 border border-white/[0.08] hover:bg-ink-2 transition-colors shadow-xl"
        >
          <p className="font-display font-bold text-lg text-cream">Tous les bars</p>
          <p className="text-xs text-muted mt-1">Voir et gérer le contenu de chaque bar.</p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-caps text-gold-dim mb-3">
            Derniers bars créés
          </h2>
          <div className="rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
            {recentBars.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">Aucun bar pour l&apos;instant.</div>
            ) : (
              recentBars.map((bar) => (
                <Link
                  key={bar.id}
                  href={`/admin/bars/${bar.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-ink-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-cream truncate">{bar.name}</p>
                    <p className="text-xs text-muted mt-0.5">Par {bar.ownerUsername}</p>
                  </div>
                  <span className="text-[10px] text-muted whitespace-nowrap">
                    {new Date(bar.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-caps text-gold-dim mb-3">
            Derniers comptes créés
          </h2>
          <div className="rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
            {recentUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">Aucun compte pour l&apos;instant.</div>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <p className="font-semibold text-sm text-cream truncate">{user.username}</p>
                    {user.role === "ADMIN" && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink">
                        Admin
                      </span>
                    )}
                    {user.vip && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange/20 text-orange border border-orange/30">
                        VIP
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
