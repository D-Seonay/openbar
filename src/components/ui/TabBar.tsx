"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Les quatre destinations, et la logique d'onglet actif : source unique
    partagée avec `HeaderNav`, qui affiche les mêmes destinations dans le
    bandeau à partir de 768px. Ne pas dupliquer cette liste ailleurs — deux
    listes qui divergent seraient un bug garanti. */
export const ONGLETS = [
  { href: "/soirees", libelle: "Soirée", icone: "◗" },
  { href: "/stock", libelle: "Cave", icone: "▤" },
  { href: "/cocktails", libelle: "Cocktails", icone: "◍" },
  { href: "/moi", libelle: "Moi", icone: "◔" },
] as const;

/** `startsWith` pour que /soirees/xyz garde l'onglet Soirée allumé. */
export function ongletActif(chemin: string, href: string): boolean {
  return chemin === href || chemin.startsWith(`${href}/`);
}

export default function TabBar() {
  const chemin = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      data-testid="tabbar"
      // md:hidden : à partir de 768px, ces mêmes destinations vivent dans le
      // bandeau (HeaderNav) — la barre basse n'a plus lieu d'être. En dessous
      // de 768px, cette classe n'a aucun effet : rien ne change.
      className="fixed bottom-0 inset-x-0 z-50 bg-paper border-t border-rule pb-safe-0 md:hidden"
    >
      <ul className="flex">
        {ONGLETS.map(({ href, libelle, icone }) => {
          const actif = ongletActif(chemin, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5
                  text-[13px] font-medium
                  focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-terracotta
                  ${actif ? "text-terracotta shadow-[inset_0_2px_0_var(--color-terracotta)]" : "text-ink-soft"}`}
              >
                <span aria-hidden className="text-[17px] leading-none">
                  {icone}
                </span>
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
