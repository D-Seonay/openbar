import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllBars, listUsers } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import { Badge } from "@/components/ui";

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-rule">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-caps text-terracotta mb-2">
            <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-[27px] text-ink mt-1">
            Tableau de bord
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="px-4 py-3 rounded-xl bg-paper-sunk border border-rule">
          <span className="text-ink-soft block text-[13px] uppercase font-semibold">Bars</span>
          <span className="text-ink font-bold text-xl">{bars.length}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-paper-sunk border border-rule">
          <span className="text-ink-soft block text-[13px] uppercase font-semibold">Bars publics</span>
          <span className="text-ink font-bold text-xl">{publicBarsCount}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-paper-sunk border border-rule">
          <span className="text-ink-soft block text-[13px] uppercase font-semibold">Bars privés</span>
          <span className="text-ink font-bold text-xl">{privateBarsCount}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-paper-sunk border border-rule">
          <span className="text-ink-soft block text-[13px] uppercase font-semibold">Comptes</span>
          <span className="text-ink font-bold text-xl">{users.length}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-paper-sunk border border-rule">
          <span className="text-ink-soft block text-[13px] uppercase font-semibold">VIP / Admin</span>
          <span className="text-ink font-bold text-xl">
            {vipUsersCount} <span className="text-ink-soft text-[15px] font-normal">/</span> {adminUsersCount}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/comptes"
          className="p-5 rounded-2xl bg-paper-sunk border border-rule hover:border-terracotta transition-colors"
        >
          <p className="font-display font-bold text-[17px] text-ink">Comptes & Privilèges VIP</p>
          <p className="text-[13px] text-ink-soft mt-1">Gérer les comptes, rôles et statuts VIP.</p>
        </Link>
        <Link
          href="/admin/bars"
          className="p-5 rounded-2xl bg-paper-sunk border border-rule hover:border-terracotta transition-colors"
        >
          <p className="font-display font-bold text-[17px] text-ink">Tous les bars</p>
          <p className="text-[13px] text-ink-soft mt-1">Voir et gérer le contenu de chaque bar.</p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* min-w-0 : un grid item n'a pas de min-width auto à 0 comme un flex
            item — sans lui, un nom long dans un `truncate` imbriqué élargit
            toute la colonne (voir la même remarque sur /soirees). */}
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold uppercase tracking-caps text-ink-soft mb-3">
            Derniers bars créés
          </h2>
          <div className="rounded-2xl bg-paper-sunk border border-rule overflow-hidden divide-y divide-rule">
            {recentBars.length === 0 ? (
              <div className="py-8 text-center text-[15px] text-ink-soft">Aucun bar pour l&apos;instant.</div>
            ) : (
              recentBars.map((bar) => (
                <Link
                  key={bar.id}
                  href={`/admin/bars/${bar.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-paper transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] text-ink truncate">{bar.name}</p>
                    <p className="text-[13px] text-ink-soft mt-0.5">Par {bar.ownerUsername}</p>
                  </div>
                  <span className="text-[13px] text-ink-soft whitespace-nowrap">
                    {new Date(bar.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="text-[13px] font-bold uppercase tracking-caps text-ink-soft mb-3">
            Derniers comptes créés
          </h2>
          <div className="rounded-2xl bg-paper-sunk border border-rule overflow-hidden divide-y divide-rule">
            {recentUsers.length === 0 ? (
              <div className="py-8 text-center text-[15px] text-ink-soft">Aucun compte pour l&apos;instant.</div>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <p className="font-semibold text-[15px] text-ink truncate">{user.username}</p>
                    {user.role === "ADMIN" && <Badge ton="complet">Admin</Badge>}
                    {user.vip && <Badge ton="alerte">VIP</Badge>}
                  </div>
                  <span className="text-[13px] text-ink-soft whitespace-nowrap">
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
