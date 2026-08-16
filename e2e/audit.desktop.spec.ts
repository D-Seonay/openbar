import { test as base } from "@playwright/test";
import { test, testAdmin, testNoBar } from "./fixtures";
import {
  PAGES,
  PAGES_PUBLIQUES,
  BILAN_PATH,
  ADMIN_PAGES,
  ADMIN_BAR_SOUS_PAGES,
  ANNUAIRE_PATH,
  CREER_PATH,
  CHANGER_MDP_PATH,
  REJOINDRE_TOKEN,
  cheminRejoindre,
  verifierDebordement,
  verifierTaillesTexte,
  verifierNavigationDesktop,
  verifierRedirectionAnnuaire,
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

// /annuaire ne rend jamais de page : voir le commentaire équivalent dans
// audit.spec.ts. Une seule mesure, indépendante de la largeur — on l'audite
// ici aussi car le projet `audit-desktop` a son propre contexte navigateur
// (Desktop Chrome vs iPhone 14), pas par redondance avec le mobile.
// `test` (audit-bot), pas `base` : voir ANNUAIRE_PATH dans audit-helpers.ts.
test.describe(ANNUAIRE_PATH, () => {
  test("redirige en permanence vers /membres", async ({ page }) => {
    await verifierRedirectionAnnuaire(page);
  });
});

// /creer : `testNoBar` uniquement, voir le commentaire dans audit.spec.ts.
testNoBar.describe(CREER_PATH, () => {
  testNoBar("ne déborde pas horizontalement (1440px)", async ({ page }) => {
    await page.goto(CREER_PATH);
    await verifierDebordement(page);
  });

  testNoBar("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
    await page.goto(CREER_PATH);
    await verifierTaillesTexte(page);
  });

  testNoBar("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
    await page.goto(CREER_PATH);
    await verifierNavigationDesktop(page);
  });
});

// /changer-mot-de-passe : accessible à n'importe quelle session, le compte de
// test générique suffit.
test.describe(CHANGER_MDP_PATH, () => {
  test("ne déborde pas horizontalement (1440px)", async ({ page }) => {
    await page.goto(CHANGER_MDP_PATH);
    await verifierDebordement(page);
  });

  test("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
    await page.goto(CHANGER_MDP_PATH);
    await verifierTaillesTexte(page);
  });

  test("bandeau visible, barre basse absente (1440px)", async ({ page }) => {
    await page.goto(CHANGER_MDP_PATH);
    await verifierNavigationDesktop(page);
  });
});

// /rejoindre/[token] : visiteur SANS session (`base`), voir le commentaire
// dans audit.spec.ts. Pas de vérification de navigation : comme pour
// PAGES_PUBLIQUES, un visiteur anonyme n'a ni bandeau ni barre basse à voir.
// Sauté explicitement si AUDIT_INVITE_TOKEN est absent.
base.describe("/rejoindre/[token]", () => {
  base("ne déborde pas horizontalement (1440px)", async ({ page }) => {
    base.skip(!REJOINDRE_TOKEN, "AUDIT_INVITE_TOKEN absent : /rejoindre/[token] non audité.");
    await page.goto(cheminRejoindre());
    await verifierDebordement(page);
  });

  base("n'affiche aucun texte sous 13px (1440px)", async ({ page }) => {
    base.skip(!REJOINDRE_TOKEN, "AUDIT_INVITE_TOKEN absent : /rejoindre/[token] non audité.");
    await page.goto(cheminRejoindre());
    await verifierTaillesTexte(page);
  });
});
