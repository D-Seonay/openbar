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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>ADMIN_CORE // GESTION SYSTÈME DES COMPTES</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            Comptes & Privilèges
          </h1>
        </div>

        <div className="font-mono text-xs text-zinc-400 bg-zinc-900 px-3.5 py-2 rounded-lg border border-zinc-800">
          TOTAL COMPTES: <span className="text-zinc-100 font-bold">{users.length}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-6">
          <CreateUserForm />
        </div>

        <div className="lg:col-span-8 rounded-xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden divide-y divide-zinc-800/60">
          {users.length === 0 ? (
            <div className="py-12 text-center font-mono text-xs text-zinc-500">
              // AUCUN COMPTE ENREGISTRÉ
            </div>
          ) : (
            users.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </div>
      </div>
    </PageTransition>
  );
}
