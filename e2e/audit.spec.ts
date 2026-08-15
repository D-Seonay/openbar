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
  verifierCiblesTactiles,
  verifierTaillesTexte,
  verifierRedirectionAnnuaire,
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

// /annuaire ne rend jamais de page (permanentRedirect immédiat vers
// /membres) : aucune mise en page à mesurer, donc pas les trois mesures
// habituelles. On vérifie à la place que la redirection elle-même fonctionne.
// `test` (audit-bot), pas `base` : /membres a sa propre garde de session, un
// visiteur anonyme y atterrirait sur /login après un second saut invisible
// depuis /annuaire — voir le commentaire sur ANNUAIRE_PATH dans audit-helpers.ts.
test.describe(ANNUAIRE_PATH, () => {
  test("redirige en permanence vers /membres", async ({ page }) => {
    await verifierRedirectionAnnuaire(page);
  });
});

// /creer redirige vers / si le compte possède déjà un bar : `testNoBar`
// (compte `audit-sansbar`, sans bar) est la seule fixture qui laisse
// apparaître le formulaire.
testNoBar.describe(CREER_PATH, () => {
  testNoBar("ne déborde pas horizontalement", async ({ page }) => {
    await page.goto(CREER_PATH);
    await verifierDebordement(page);
  });

  testNoBar("n'a aucune cible tactile sous 44px", async ({ page }) => {
    await page.goto(CREER_PATH);
    await verifierCiblesTactiles(page);
  });

  testNoBar("n'affiche aucun texte sous 13px", async ({ page }) => {
    await page.goto(CREER_PATH);
    await verifierTaillesTexte(page);
  });
});

// /changer-mot-de-passe n'a aucune garde propre au-delà d'une session : le
// compte de test générique suffit.
test.describe(CHANGER_MDP_PATH, () => {
  test("ne déborde pas horizontalement", async ({ page }) => {
    await page.goto(CHANGER_MDP_PATH);
    await verifierDebordement(page);
  });

  test("n'a aucune cible tactile sous 44px", async ({ page }) => {
    await page.goto(CHANGER_MDP_PATH);
    await verifierCiblesTactiles(page);
  });

  test("n'affiche aucun texte sous 13px", async ({ page }) => {
    await page.goto(CHANGER_MDP_PATH);
    await verifierTaillesTexte(page);
  });
});

// /rejoindre/[token] : le rendu de la carte « Rejoindre {barName} » n'existe
// que pour un visiteur SANS session (avec une session, la page rejoint le
// bar puis redirige vers /) — `base` plutôt que `test`. Le jeton vient de
// `AUDIT_INVITE_TOKEN` ; absent, chaque test se saute explicitement au lieu
// d'échouer ou de disparaître silencieusement de la liste.
base.describe("/rejoindre/[token]", () => {
  base("ne déborde pas horizontalement", async ({ page }) => {
    base.skip(!REJOINDRE_TOKEN, "AUDIT_INVITE_TOKEN absent : /rejoindre/[token] non audité.");
    await page.goto(cheminRejoindre());
    await verifierDebordement(page);
  });

  base("n'a aucune cible tactile sous 44px", async ({ page }) => {
    base.skip(!REJOINDRE_TOKEN, "AUDIT_INVITE_TOKEN absent : /rejoindre/[token] non audité.");
    await page.goto(cheminRejoindre());
    await verifierCiblesTactiles(page);
  });

  base("n'affiche aucun texte sous 13px", async ({ page }) => {
    base.skip(!REJOINDRE_TOKEN, "AUDIT_INVITE_TOKEN absent : /rejoindre/[token] non audité.");
    await page.goto(cheminRejoindre());
    await verifierTaillesTexte(page);
  });
});
