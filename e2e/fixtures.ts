import { test as base, expect, type Page } from "@playwright/test";

// Paramétrable : chaque fixture lui passe ses propres identifiants plutôt que
// de dupliquer la mécanique de connexion pour chaque compte de test.
export async function seConnecter(
  page: Page,
  identifiant: string | undefined,
  motDePasse: string | undefined,
) {
  if (!identifiant || !motDePasse) {
    throw new Error(
      "Un identifiant et un mot de passe de compte de test sont requis. " +
        "Ne jamais utiliser un compte reel.",
    );
  }
  await page.goto("/login");
  // Ancré sur les attributs `name` plutôt que sur un label ou un placeholder :
  // le formulaire actuel n'a pas de label, et la Task 18 va le reskiner. Les
  // `name` ne peuvent pas changer sans casser l'action serveur qui les lit.
  await page.locator('input[name="username"]').fill(identifiant);
  await page.locator('input[name="password"]').fill(motDePasse);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

// Le projet authentifie par identifiant, pas par e-mail.
const IDENTIFIANT = process.env.AUDIT_USERNAME;
const MOT_DE_PASSE = process.env.AUDIT_PASSWORD;

// Compte ADMIN, distinct du compte de test générique : le bilan de soirée
// est réservé au propriétaire du bar et à l'ADMIN global (garde posée dans
// la page elle-même), donc hors de portée du compte `test` ci-dessous s'il
// n'est pas propriétaire du bar audité.
const IDENTIFIANT_ADMIN = process.env.AUDIT_ADMIN_USERNAME;
const MOT_DE_PASSE_ADMIN = process.env.AUDIT_ADMIN_PASSWORD;

export const test = base.extend({
  page: async ({ page }, use) => {
    await seConnecter(page, IDENTIFIANT, MOT_DE_PASSE);
    await use(page);
  },
});

export const testAdmin = base.extend({
  page: async ({ page }, use) => {
    await seConnecter(page, IDENTIFIANT_ADMIN, MOT_DE_PASSE_ADMIN);
    await use(page);
  },
});

export { expect };
