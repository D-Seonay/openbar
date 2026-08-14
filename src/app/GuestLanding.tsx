// src/app/GuestLanding.tsx
import Link from "next/link";
import { Card, lienBoutonClasses } from "@/components/ui";

export default function GuestLanding() {
  return (
    <div className="space-y-8">
      <div className="text-center py-16 space-y-6">
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          Salon de Mixologie & Bar Lounge
        </span>
        <h1 className="font-display text-[27px] sm:text-4xl text-ink max-w-3xl mx-auto">
          Gérez votre bar, entre passionnés
        </h1>
        <p className="text-ink-soft max-w-xl mx-auto text-[15px] leading-relaxed">
          Cave, cocktails, soirées et invitations : OpenBar centralise la gestion de votre bar privé
          et vous permet de découvrir ceux des autres.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/login" className={lienBoutonClasses("principal")}>
            Se connecter
          </Link>
          <Link href="/signup" className={lienBoutonClasses("discret")}>
            Créer un compte
          </Link>
        </div>
      </div>

      <Link href="/decouvrir" className="block">
        <Card className="hover:border-terracotta/40 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
                Annuaire public
              </span>
              <p className="font-display text-[17px] text-ink mt-1">Découvrir les bars</p>
              <p className="text-[13px] text-ink-soft mt-1">Parcourez les bars ouverts au public, sans compte.</p>
            </div>
            <span className="text-terracotta text-[15px] font-bold">→</span>
          </div>
        </Card>
      </Link>
    </div>
  );
}
