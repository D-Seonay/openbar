import { test as base, expect, type Page } from "@playwright/test";

// Le projet authentifie par identifiant, pas par e-mail.
const IDENTIFIANT = process.env.AUDIT_USERNAME;
const MOT_DE_PASSE = process.env.AUDIT_PASSWORD;

export async function seConnecter(page: Page) {
  if (!IDENTIFIANT || !MOT_DE_PASSE) {
    throw new Error(
      "AUDIT_USERNAME et AUDIT_PASSWORD doivent pointer vers un compte de test. " +
        "Ne jamais utiliser un compte reel.",
    );
  }
  await page.goto("/login");
  // Ancré sur les attributs `name` plutôt que sur un label ou un placeholder :
  // le formulaire actuel n'a pas de label, et la Task 18 va le reskiner. Les
  // `name` ne peuvent pas changer sans casser l'action serveur qui les lit.
  await page.locator('input[name="username"]').fill(IDENTIFIANT);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await seConnecter(page);
    await use(page);
  },
});

export { expect };
