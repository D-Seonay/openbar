import { test as base } from "@playwright/test";
import { test, testAdmin } from "./fixtures";
import {
  PAGES,
  PAGES_PUBLIQUES,
  BILAN_PATH,
  ADMIN_PAGES,
  ADMIN_BAR_SOUS_PAGES,
  verifierDebordement,
  verifierCiblesTactiles,
  verifierTaillesTexte,
  resoudrePremiereSoiree,
  resoudrePremierBarAdmin,
} from "./audit-helpers";

/**
 * Audit mobile — 390px (iPhone 14, voir playwright.config.ts). Les pages et
 * les mesures viennent de `./audit-helpers.ts`, partagé avec
 * `audit.desktop.spec.ts` (1440x900) : une page absente des listes de ce
 * fichier n'est pas auditée, donc pas terminée — sur aucune des deux
 * largeurs.
 */

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

test.describe("/soirees/[slug]", () => {
  test("ne déborde pas horizontalement", async ({ page }) => {
    const chemin = await resoudrePremiereSoiree(page);
    await page.goto(chemin);
    await verifierDebordement(page);
  });

  test("n'a aucune cible tactile sous 44px", async ({ page }) => {
    const chemin = await resoudrePremiereSoiree(page);
    await page.goto(chemin);
    await verifierCiblesTactiles(page);
  });

  test("n'affiche aucun texte sous 13px", async ({ page }) => {
    const chemin = await resoudrePremiereSoiree(page);
    await page.goto(chemin);
    await verifierTaillesTexte(page);
  });
});

for (const chemin of ADMIN_PAGES) {
  testAdmin.describe(chemin, () => {
    testAdmin("ne déborde pas horizontalement", async ({ page }) => {
      await page.goto(chemin);
      await verifierDebordement(page);
    });

    testAdmin("n'a aucune cible tactile sous 44px", async ({ page }) => {
      await page.goto(chemin);
      await verifierCiblesTactiles(page);
    });

    testAdmin("n'affiche aucun texte sous 13px", async ({ page }) => {
      await page.goto(chemin);
      await verifierTaillesTexte(page);
    });
  });
}

for (const suffixe of ADMIN_BAR_SOUS_PAGES) {
  testAdmin.describe(`/admin/bars/[id]${suffixe}`, () => {
    testAdmin("ne déborde pas horizontalement", async ({ page }) => {
      const base = await resoudrePremierBarAdmin(page);
      await page.goto(`${base}${suffixe}`);
      await verifierDebordement(page);
    });

    testAdmin("n'a aucune cible tactile sous 44px", async ({ page }) => {
      const base = await resoudrePremierBarAdmin(page);
      await page.goto(`${base}${suffixe}`);
      await verifierCiblesTactiles(page);
    });

    testAdmin("n'affiche aucun texte sous 13px", async ({ page }) => {
      const base = await resoudrePremierBarAdmin(page);
      await page.goto(`${base}${suffixe}`);
      await verifierTaillesTexte(page);
    });
  });
}
