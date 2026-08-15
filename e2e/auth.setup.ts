import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { seConnecter, USER_AUTH_FILE, ADMIN_AUTH_FILE, NOBAR_AUTH_FILE, AUTH_DIR } from "./fixtures";

// Connexion unique par compte, une seule fois pour toute la suite : audit.spec.ts
// (66 tests, un seul worker) rejoue ensuite ces états via les fixtures `test`
// et `testAdmin` de fixtures.ts au lieu de repasser par /login à chaque test.
// C'est ce qui supprime la contention qui faisait expirer le dernier
// `page.goto("/login")` d'une série sous charge (voir playwright.config.ts).
const IDENTIFIANT = process.env.AUDIT_USERNAME;
const MOT_DE_PASSE = process.env.AUDIT_PASSWORD;

// Compte ADMIN, distinct du compte de test générique : le bilan de soirée et
// les pages /admin sont réservés au propriétaire du bar et à l'ADMIN global.
const IDENTIFIANT_ADMIN = process.env.AUDIT_ADMIN_USERNAME;
const MOT_DE_PASSE_ADMIN = process.env.AUDIT_ADMIN_PASSWORD;

// Compte SANS BAR, distinct des deux précédents : /creer redirige vers / dès
// que le compte possède déjà un bar (creer/page.tsx), ce qui est le cas des
// deux comptes ci-dessus. Provisionné pour cet audit sans aucun bar.
const IDENTIFIANT_NOBAR = process.env.AUDIT_NOBAR_USERNAME;
const MOT_DE_PASSE_NOBAR = process.env.AUDIT_NOBAR_PASSWORD;

mkdirSync(AUTH_DIR, { recursive: true });

setup("authentification – compte de test (audit-bot)", async ({ page }) => {
  await seConnecter(page, IDENTIFIANT, MOT_DE_PASSE);
  await page.context().storageState({ path: USER_AUTH_FILE });
});

setup("authentification – compte ADMIN (audit-admin)", async ({ page }) => {
  await seConnecter(page, IDENTIFIANT_ADMIN, MOT_DE_PASSE_ADMIN);
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

setup("authentification – compte sans bar (audit-sansbar)", async ({ page }) => {
  await seConnecter(page, IDENTIFIANT_NOBAR, MOT_DE_PASSE_NOBAR);
  await page.context().storageState({ path: NOBAR_AUTH_FILE });
});
