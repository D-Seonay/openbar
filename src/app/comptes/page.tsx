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
      <div>
        <span className="text-xs uppercase tracking-caps text-orange font-semibold">Administration</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-cream mt-1 tracking-tight">Comptes</h1>
        <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
          Crée un compte pour chaque proche, gère son rôle et son accès à la réserve VIP.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1">
          <CreateUserForm />
        </div>
        <div className="md:col-span-2 space-y-3">
          {users.length === 0 ? (
            <p className="text-muted text-xs italic">Aucun compte pour l&apos;instant.</p>
          ) : (
            users.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </div>
      </div>
    </PageTransition>
  );
}
