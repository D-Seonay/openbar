import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

/**
 * Les pages refondues, et les mesures qui les vérifient — partagées entre
 * `audit.spec.ts` (390px, iPhone 14) et `audit.desktop.spec.ts` (1440x900).
 * Une page absente d'ici n'est auditée dans aucun des deux : deux listes qui
 * divergent entre mobile et desktop seraient aussi trompeuses qu'une liste
 * de navigation dupliquée.
 */
export const PAGES = [
  "/",
  "/soirees",
  "/stock",
  "/cocktails",
  "/moi",
  "/profil",
  "/membres",
  "/comptes",
  "/journal",
  "/decouvrir",
];

// /login et /signup s'affichent sans session : elles ne passent pas par la
// fixture connectée (celle-ci se connecte via `/login` elle-même, s'y
// auditer par-dessus serait circulaire). Chaque état est vérifié — vierge et
// en erreur — car un audit qui ne regarde que l'état vierge d'un formulaire
// rate systématiquement le débordement introduit par le message d'erreur.
export const PAGES_PUBLIQUES = ["/login", "/signup", "/login?error=1", "/signup?error=1"];

// Le bilan est réservé au propriétaire du bar et à l'ADMIN global (garde
// posée dans la page elle-même, pas dans `src/proxy.ts`) ; on audite via le
// compte ADMIN. Le chemin est celui d'une soirée passée provisionnée pour cet
// audit, afin que le bilan ait un sens à remplir.
export const BILAN_PATH = "/soirees/soiree-passee-a-bilanter-9b3aa64d/bilan";

// Section administration : réservée au rôle ADMIN global, donc auditée avec
// le compte `testAdmin` plutôt que le compte de test générique.
export const ADMIN_PAGES = ["/admin", "/admin/bars"];

export const ADMIN_BAR_SOUS_PAGES = ["", "/cocktails", "/soirees", "/stock"];

// Les mesures de la spec, factorisées pour être appliquées identiquement à
// toutes les pages ci-dessus, sur les deux largeurs auditées.
export async function verifierDebordement(page: Page) {
  await page.waitForLoadState("networkidle");

  const debordement = await page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });

  // Un pixel de tolérance : les sous-pixels d'arrondi ne sont pas un bug.
  expect(
    debordement.scroll - debordement.client,
    `débordement de ${debordement.scroll - debordement.client}px`,
  ).toBeLessThanOrEqual(1);
}

// N'a de sens qu'au tactile : sur desktop l'interaction se fait à la souris,
// dont la précision n'a pas besoin d'une cible de 44px. Seul `audit.spec.ts`
// (mobile) appelle cette fonction.
export async function verifierCiblesTactiles(page: Page) {
  await page.waitForLoadState("networkidle");

  const trop_petits = await page.evaluate(() => {
    const selecteur = "a[href], button, input, select, textarea, [role=button]";
    const fautifs: Array<{ balise: string; texte: string; h: number; w: number }> = [];

    for (const el of document.querySelectorAll(selecteur)) {
      const r = el.getBoundingClientRect();
      // Les éléments masqués n'ont pas de cible à mesurer.
      if (r.width === 0 || r.height === 0) continue;
      // Un lien à l'intérieur d'un paragraphe n'est pas un contrôle : sa
      // hauteur est celle de la ligne de texte, la règle ne s'y applique pas.
      if (el.tagName === "A" && el.closest("p")) continue;
      if (r.height < 44 || r.width < 44) {
        fautifs.push({
          balise: el.tagName,
          texte: (el.textContent ?? "").trim().slice(0, 40),
          h: Math.round(r.height),
          w: Math.round(r.width),
        });
      }
    }
    return fautifs;
  });

  expect(trop_petits, JSON.stringify(trop_petits, null, 2)).toEqual([]);
}

export async function verifierTaillesTexte(page: Page) {
  await page.waitForLoadState("networkidle");

  const trop_petits = await page.evaluate(() => {
    const fautifs: Array<{ texte: string; taille: string }> = [];
    const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let noeud: Node | null;
    while ((noeud = parcours.nextNode())) {
      const texte = (noeud.textContent ?? "").trim();
      if (!texte) continue;
      const parent = noeud.parentElement;
      if (!parent) continue;
      const taille = parseFloat(getComputedStyle(parent).fontSize);
      if (taille < 13) fautifs.push({ texte: texte.slice(0, 40), taille: `${taille}px` });
    }
    return fautifs;
  });

  expect(trop_petits, JSON.stringify(trop_petits, null, 2)).toEqual([]);
}

// Mesure propre au desktop (768px+) : la barre d'onglets basse (TabBar,
// `data-testid="tabbar"`) doit avoir disparu au profit de la navigation du
// bandeau (HeaderNav, `data-testid="header-nav"`). N'a de sens que sur une
// page où une session est ouverte — sur une page publique (login/signup) ni
// l'une ni l'autre ne doit s'afficher, un visiteur anonyme n'a pas de
// destinations protégées à voir.
export async function verifierNavigationDesktop(page: Page) {
  await page.waitForLoadState("networkidle");

  const etat = await page.evaluate(() => {
    const visible = (el: Element | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return {
      tabbar: visible(document.querySelector('[data-testid="tabbar"]')),
      headerNav: visible(document.querySelector('[data-testid="header-nav"]')),
    };
  });

  expect(etat.tabbar, "la barre d'onglets basse ne doit pas être visible en desktop").toBe(false);
  expect(etat.headerNav, "la navigation du bandeau doit être visible en desktop").toBe(true);
}

// /soirees/[slug] n'a pas de slug fixe à auditer : on résout la première
// soirée listée par /soirees pour le compte de test (compte USER, propriétaire
// de « Bar Audit »), plutôt que d'en coder un en dur qui romprait au moindre
// reseed. Le sélecteur exclut volontairement les liens à un segment
// supplémentaire (.../bilan, .../calendar) rendus ailleurs sur la même page.
export async function resoudrePremiereSoiree(page: Page): Promise<string> {
  await page.goto("/soirees");
  await page.waitForLoadState("networkidle");
  const chemin = await page.evaluate(() => {
    const liens = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const lien = liens.find((a) => /^\/soirees\/[^/]+$/.test(new URL(a.href).pathname));
    return lien ? new URL(lien.href).pathname : null;
  });
  if (!chemin) {
    throw new Error("Aucune soirée trouvée pour auditer /soirees/[slug].");
  }
  return chemin;
}

// /admin/bars/[id] et ses sous-pages : même logique de résolution dynamique
// que /soirees/[slug], depuis le premier bar listé par /admin/bars.
export async function resoudrePremierBarAdmin(page: Page): Promise<string> {
  await page.goto("/admin/bars");
  await page.waitForLoadState("networkidle");
  const chemin = await page.evaluate(() => {
    const lien = document.querySelector<HTMLAnchorElement>('a[href^="/admin/bars/"]');
    return lien ? new URL(lien.href).pathname : null;
  });
  if (!chemin) {
    throw new Error("Aucun bar trouvé pour auditer /admin/bars/[id].");
  }
  return chemin;
}
