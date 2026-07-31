import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ChangerMotDePassePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="max-w-sm mx-auto mt-6 sm:mt-16 bg-ink-2/40 border border-orange/10 p-6 sm:p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">
          Sécurité du compte
        </span>
        <h1 className="font-display text-3xl text-cream mt-1">Changer de mot de passe</h1>
        <p className="text-xs text-muted mt-2">
          Ton mot de passe a été généré par un administrateur. Choisis-en un nouveau
          pour continuer.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
