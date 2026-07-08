import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16">
      <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Accès privé</p>
      <h1 className="font-display text-3xl text-gold mb-6">Le Bar de Noa</h1>
      <form action={login} className="space-y-3">
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          required
          autoFocus
          className="w-full bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
        />
        {error && <p className="text-xs text-red-400">Mot de passe incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-gold text-ink font-medium rounded-lg py-2 hover:bg-cream transition-colors"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
