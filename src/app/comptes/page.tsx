import { redirect } from "next/navigation";
import { listUsers } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CreateUserForm from "./CreateUserForm";
import UserRow from "./UserRow";

export default async function ComptesPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const users = await listUsers();

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Comptes & Privilèges VIP
          </h1>
        </div>

        <div className="text-xs text-muted bg-ink-2 px-4 py-2 rounded-xl border border-white/[0.08]">
          Comptes enregistrés : <span className="text-cream font-bold">{users.length}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
          <CreateUserForm />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              Aucun compte enregistré pour l&apos;instant.
            </div>
          ) : (
            users.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </div>
      </div>
    </PageTransition>
  );
}
