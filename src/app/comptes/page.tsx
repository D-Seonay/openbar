import { redirect } from "next/navigation";
import { listUsers } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CreateUserForm from "./CreateUserForm";
import UserRow from "./UserRow";
import PaginationLinks from "@/components/PaginationLinks";
import { paginate } from "@/lib/pagination";
import { Card } from "@/components/ui";

export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const users = await listUsers();
  const { page } = await searchParams;
  const accounts = paginate(users, page);

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-rule">
        <div>
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
            Espace Administrateur
          </span>
          <h1 className="font-display text-[27px] text-ink mt-1">
            Comptes & Privilèges VIP
          </h1>
        </div>

        <div className="text-[13px] text-ink-soft bg-paper-sunk px-4 py-2 rounded-xl border border-rule">
          Comptes enregistrés : <span className="text-ink font-bold">{users.length}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4">
          <CreateUserForm />
        </div>

        <div className="lg:col-span-8 space-y-3">
          {users.length === 0 ? (
            <Card className="py-12 text-center text-[15px] text-ink-soft">
              Aucun compte enregistré pour l&apos;instant.
            </Card>
          ) : (
            accounts.items.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </div>

        <div className="lg:col-span-8 lg:col-start-5">
          <PaginationLinks
            currentPage={accounts.currentPage}
            totalPages={accounts.totalPages}
            basePath="/comptes"
          />
        </div>
      </div>
    </PageTransition>
  );
}
