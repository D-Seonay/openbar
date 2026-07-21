// src/app/GuestLanding.tsx
import Link from "next/link";

export default function GuestLanding() {
  return (
    <div className="space-y-8">
      <div className="text-center py-16 space-y-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Salon de Mixologie & Bar Lounge</span>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-cream tracking-tight max-w-3xl mx-auto">
          Gérez votre bar,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">
            entre passionnés
          </span>
        </h1>
        <p className="text-muted max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Cave, cocktails, soirées et invitations : OpenBar centralise la gestion de votre bar privé
          et vous permet de découvrir ceux des autres.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold text-xs uppercase tracking-wider box-orange-glow transition-all hover:brightness-110"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-ink-2 hover:bg-ink-2/80 border border-white/[0.08] text-xs font-semibold uppercase tracking-wider text-cream hover:border-orange/50 transition-all"
          >
            Créer un compte
          </Link>
        </div>
      </div>

      <Link
        href="/decouvrir"
        className="block rounded-2xl bg-ink-2/80 border border-white/[0.08] p-6 shadow-xl hover:border-orange/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-caps text-gold font-bold">Annuaire public</span>
            <p className="font-display text-xl font-bold text-cream mt-1">Découvrir les bars</p>
            <p className="text-xs text-muted mt-1">Parcourez les bars ouverts au public, sans compte.</p>
          </div>
          <span className="text-orange text-lg font-bold">→</span>
        </div>
      </Link>
    </div>
  );
}
