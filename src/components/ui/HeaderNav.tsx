"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ONGLETS, ongletActif } from "./TabBar";

/** Les quatre destinations de TabBar, réutilisées telles quelles (voir
    TabBar.tsx) mais rendues dans le bandeau plutôt qu'en barre basse. Ne
    s'affiche qu'à partir de 768px — en dessous, TabBar reste seule
    responsable de la navigation. */
export default function HeaderNav() {
  const chemin = usePathname();

  return (
    <nav aria-label="Navigation principale du bandeau" data-testid="header-nav" className="hidden md:flex items-center gap-1">
      {ONGLETS.map(({ href, libelle }) => {
        const actif = ongletActif(chemin, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={`min-h-[44px] flex items-center px-2.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta
              ${actif ? "text-terracotta bg-terracotta/10" : "text-ink-soft hover:text-ink hover:bg-paper-sunk"}`}
          >
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
