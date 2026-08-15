import { test as base } from "@playwright/test";
import { test, testAdmin } from "./fixtures";
import {
  PAGES,
  PAGES_PUBLIQUES,
  BILAN_PATH,
  ADMIN_PAGES,
  ADMIN_BAR_SOUS_PAGES,
  verifierDebordement,
  verifierTaillesTexte,
  verifierNavigationDesktop,
  resoudrePremiereSoiree,
  resoudrePremierBarAdmin,
} from "./audit-helpers";

/**
 * Audit desktop — 1440x900 (projet `audit-desktop`, voir playwright.config.ts).
 * Mêmes pages que `audit.spec.ts` (390px), mêmes fonctions de mesure
 * partagées depuis `./audit-helpers.ts` : une page qui diverge entre les
 * deux fichiers serait auditée sur une seule largeur sans que rien ne le
 * signale.
 *
 * Deux différences volontaires avec le mobile :
 *  - pas de vérification des cibles tactiles à 44px : la règle vient du
 *    pouce, pas de la souris, et n'a pas de sens ici. Omise explicitement
 *    plutôt que silencieusement laissée de côté.
 *  - une mesure propre au desktop : la barre d'onglets basse (TabBar) doit
 *    avoir disparu, remplacée par la navigation du bandeau (HeaderNav).
 *    Seulement sur les pages qui exigent une session — sur les pages
 *    publiques (login/signup), ni l'une ni l'autre ne doit s'afficher.
 */

for (const chemin of PAGES) {
  test.describe(chemin, () => {
    test("ne déborde pas horizontalement (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierDebordement(page);
    });

    test("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierTaillesTexte(page);
    });

    test("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierNavigationDesktop(page);
    });
  });
}

for (const chemin of PAGES_PUBLIQUES) {
  base.describe(chemin, () => {
    base("ne déborde pas horizontalement (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierDebordement(page);
    });

    base("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierTaillesTexte(page);
    });
  });
}

testAdmin.describe(BILAN_PATH, () => {
  testAdmin("ne déborde pas horizontalement (1440px)", async ({ page }) => {
    await page.goto(BILAN_PATH);
    await verifierDebordement(page);
  });

  testAdmin("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
    await page.goto(BILAN_PATH);
    await verifierTaillesTexte(page);
  });

  testAdmin("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
    await page.goto(BILAN_PATH);
    await verifierNavigationDesktop(page);
  });
});

test.describe("/soirees/[slug]", () => {
  test("ne déborde pas horizontalement (1440px)", async ({ page }) => {
    const chemin = await resoudrePremiereSoiree(page);
    await page.goto(chemin);
    await verifierDebordement(page);
  });

  test("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
    const chemin = await resoudrePremiereSoiree(page);
    await page.goto(chemin);
    await verifierTaillesTexte(page);
  });

  test("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
    const chemin = await resoudrePremiereSoiree(page);
    await page.goto(chemin);
    await verifierNavigationDesktop(page);
  });
});

for (const chemin of ADMIN_PAGES) {
  testAdmin.describe(chemin, () => {
    testAdmin("ne déborde pas horizontalement (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierDebordement(page);
    });

    testAdmin("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierTaillesTexte(page);
    });

    testAdmin("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
      await page.goto(chemin);
      await verifierNavigationDesktop(page);
    });
  });
}

for (const suffixe of ADMIN_BAR_SOUS_PAGES) {
  testAdmin.describe(`/admin/bars/[id]${suffixe}`, () => {
    testAdmin("ne déborde pas horizontalement (1440px)", async ({ page }) => {
      const base = await resoudrePremierBarAdmin(page);
      await page.goto(`${base}${suffixe}`);
      await verifierDebordement(page);
    });

    testAdmin("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
      const base = await resoudrePremierBarAdmin(page);
      await page.goto(`${base}${suffixe}`);
      await verifierTaillesTexte(page);
    });

    testAdmin("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
      const base = await resoudrePremierBarAdmin(page);
      await page.goto(`${base}${suffixe}`);
      await verifierNavigationDesktop(page);
    });
  });
}
