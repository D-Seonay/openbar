import type { Page } from "@playwright/test";
import { test as base } from "@playwright/test";
import { test, testAdmin, expect } from "./fixtures";

/**
 * Les pages refondues. On en ajoute une à chaque tâche de la phase D —
 * une page absente de cette liste n'est pas auditée, donc pas terminée.
 */
const PAGES = [
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

// Les trois mesures de la spec, factorisées pour être appliquées identiquement
// à la boucle PAGES (compte de test générique) et au bilan (compte ADMIN).
async function verifierDebordement(page: Page) {
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

async function verifierCiblesTactiles(page: Page) {
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

async function verifierTaillesTexte(page: Page) {
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

for (const chemin of PAGES) {
  test.describe(chemin, () => {
    test("ne déborde pas horizontalement", async ({ page }) => {
      await page.goto(chemin);
      await verifierDebordement(page);
    });

    test("n'a aucune cible tactile sous 44px", async ({ page }) => {
      await page.goto(chemin);
      await verifierCiblesTactiles(page);
    });

    test("n'affiche aucun texte sous 13px", async ({ page }) => {
      await page.goto(chemin);
      await verifierTaillesTexte(page);
    });
  });
}

// /login et /signup s'affichent sans session : elles ne passent pas par la
// fixture connectée (celle-ci se connecte via `/login` elle-même, s'y
// auditer par-dessus serait circulaire). Chaque état est vérifié — vierge et
// en erreur — car un audit qui ne regarde que l'état vierge d'un formulaire
// rate systématiquement le débordement introduit par le message d'erreur.
const PAGES_PUBLIQUES = ["/login", "/signup", "/login?error=1", "/signup?error=1"];

for (const chemin of PAGES_PUBLIQUES) {
  base.describe(chemin, () => {
    base("ne déborde pas horizontalement", async ({ page }) => {
      await page.goto(chemin);
      await verifierDebordement(page);
    });

    base("n'a aucune cible tactile sous 44px", async ({ page }) => {
      await page.goto(chemin);
      await verifierCiblesTactiles(page);
    });

    base("n'affiche aucun texte sous 13px", async ({ page }) => {
      await page.goto(chemin);
      await verifierTaillesTexte(page);
    });
  });
}

// Le bilan est réservé au rôle ADMIN par `src/proxy.ts` : le compte de test
// générique (rôle USER) n'y a jamais accès, d'où la fixture `testAdmin`
// dédiée. Le chemin est celui d'une soirée passée provisionnée pour cet
// audit, afin que le bilan ait un sens à remplir.
const BILAN_PATH = "/soirees/soiree-passee-a-bilanter-9b3aa64d/bilan";

testAdmin.describe(BILAN_PATH, () => {
  testAdmin("ne déborde pas horizontalement", async ({ page }) => {
    await page.goto(BILAN_PATH);
    await verifierDebordement(page);
  });

  testAdmin("n'a aucune cible tactile sous 44px", async ({ page }) => {
    await page.goto(BILAN_PATH);
    await verifierCiblesTactiles(page);
  });

  testAdmin("n'affiche aucun texte sous 13px", async ({ page }) => {
    await page.goto(BILAN_PATH);
    await verifierTaillesTexte(page);
  });
});
