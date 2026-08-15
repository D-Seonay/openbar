import Link from "next/link";
import { signup } from "@/app/bar-actions";
import { Button, Card, Field, champClasses } from "@/components/ui";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; inviteToken?: string }>;
}) {
  const { error, inviteToken } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-6 sm:mt-16">
      <Card className="sm:p-6 space-y-4">
        <div className="text-center">
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">Nouveau compte</span>
          <h1 className="font-display text-[27px] text-ink mt-1">Rejoindre OpenBar</h1>
        </div>
        <form action={signup}>
          {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
          <Field label="Identifiant" htmlFor="signup-username">
            <input
              id="signup-username"
              name="username"
              type="text"
              placeholder="Identifiant"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              className={champClasses}
            />
          </Field>
          <Field label="Mot de passe" htmlFor="signup-password" aide="6 caractères min.">
            <input
              id="signup-password"
              name="password"
              type="password"
              placeholder="Mot de passe (6 caractères min.)"
              required
              minLength={6}
              autoComplete="new-password"
              className={champClasses}
            />
          </Field>
          <Field label="Confirmer le mot de passe" htmlFor="signup-confirm-password">
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type="password"
              placeholder="Confirmer le mot de passe"
              required
              minLength={6}
              autoComplete="new-password"
              className={champClasses}
            />
          </Field>
          {error && (
            <p className="text-[13px] text-terracotta text-center mb-4">
              Inscription impossible. Vérifie tes informations.
            </p>
          )}
          <Button type="submit" pleineLargeur>
            Créer mon compte
          </Button>
        </form>
        <p className="text-center text-[13px] text-ink-soft">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-terracotta hover:underline">
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  );
}
