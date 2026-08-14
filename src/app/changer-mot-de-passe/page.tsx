import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ChangePasswordForm from "./ChangePasswordForm";
import { Card } from "@/components/ui";

export default async function ChangerMotDePassePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="max-w-sm mx-auto mt-6 sm:mt-16">
      <Card className="sm:p-6 space-y-4">
        <div className="text-center">
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
            Sécurité du compte
          </span>
          <h1 className="font-display text-[27px] text-ink mt-1">Changer de mot de passe</h1>
          <p className="text-[13px] text-ink-soft mt-2">
            Ton mot de passe a été généré par un administrateur. Choisis-en un nouveau
            pour continuer.
          </p>
        </div>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
