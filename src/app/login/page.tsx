import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Espace réservé</span>
        <h1 className="font-display text-3xl text-cream mt-1">OpenBar</h1>
      </div>
      <form action={login} className="space-y-3">
        <input
          name="username"
          type="text"
          placeholder="Identifiant"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe d'administration"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        {error && <p className="text-xs text-red-400 text-center">Mot de passe incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
