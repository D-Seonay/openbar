import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

// Paramétrable : chaque fixture lui passe ses propres identifiants plutôt que
// de dupliquer la mécanique de connexion pour chaque compte de test.
// N'est plus appelée par les fixtures `test`/`testAdmin` ci-dessous (qui
// rejouent un état de session déjà enregistré) : seul `e2e/auth.setup.ts`
// s'en sert encore, une fois par compte, pour produire cet état.
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

// Fichiers d'état de session, écrits une fois par `e2e/auth.setup.ts` (projet
// `setup`, dont le projet de test dépend) et rejoués ici par chaque test au
// lieu de se reconnecter. `/e2e/.auth/` est ignoré par git : ces fichiers
// contiennent des jetons de session, pas des identifiants en dur.
export const AUTH_DIR = path.join(__dirname, ".auth");
export const USER_AUTH_FILE = path.join(AUTH_DIR, "audit-bot.json");
export const ADMIN_AUTH_FILE = path.join(AUTH_DIR, "audit-admin.json");

// `storageState` est le fixture d'options standard de Playwright (celui que
// `test.use({ storageState: ... })` renseigne d'habitude) : le surcharger ici
// donne à chaque test une page déjà connectée, sans toucher au fixture
// `page` ni à l'interface que consomme audit.spec.ts.
export const test = base.extend({
  storageState: async ({}, use) => {
    await use(USER_AUTH_FILE);
  },
});

export const testAdmin = base.extend({
  storageState: async ({}, use) => {
    await use(ADMIN_AUTH_FILE);
  },
});

export { expect };
