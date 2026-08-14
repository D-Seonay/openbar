import Link from "next/link";
import { login } from "./actions";
import { Button, Card, Field, champClasses } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-6 sm:mt-16">
      <Card className="sm:p-6 space-y-4">
        <div className="text-center">
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">Connexion</span>
          <h1 className="font-display text-[27px] text-ink mt-1">OpenBar</h1>
        </div>
        <form action={login}>
          {/* "/soirees" et non "/" : la racine ne fait plus que trancher entre
              l'accueil public et ce même renvoi, ce détour ajouterait un aller-retour
              serveur inutile à chaque connexion. */}
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/soirees"} />
          {/* No autoFocus: on phones it pops the keyboard over the form before
              the user has seen it. autoComplete/autoCapitalize let mobile
              password managers fill this in. */}
          <Field label="Identifiant" htmlFor="login-username">
            <input
              id="login-username"
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
          <Field label="Mot de passe" htmlFor="login-password">
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="Mot de passe"
              required
              autoComplete="current-password"
              className={champClasses}
            />
          </Field>
          {/* Checked by default: staying signed in is what almost everyone wants
              here, and unticking is the deliberate "this is not my device" case. */}
          <label
            htmlFor="login-remember"
            className="flex items-center justify-center gap-2.5 text-[13px] text-ink-soft cursor-pointer select-none mb-4"
          >
            <input
              id="login-remember"
              type="checkbox"
              name="rememberMe"
              defaultChecked
              className="tap-target shrink-0 rounded border-rule bg-paper-sunk accent-terracotta cursor-pointer"
            />
            <span>Rester connecté sur cet appareil</span>
          </label>
          {error && <p className="text-[13px] text-terracotta text-center mb-4">Mot de passe incorrect.</p>}
          <Button type="submit" pleineLargeur>
            Se connecter
          </Button>
        </form>
        <p className="text-center text-[13px] text-ink-soft">
          Pas de compte ?{" "}
          <Link href="/signup" className="text-terracotta hover:underline">
            Créer un compte
          </Link>
        </p>
        <p className="text-center text-[13px] text-ink-soft">
          <Link href="/decouvrir" className="text-terracotta hover:underline">
            Voir les bars sans compte
          </Link>
        </p>
      </Card>
    </div>
  );
}
