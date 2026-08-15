import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Un seul worker : les tests partagent une base de données.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? "http://localhost:3000",
    // 390px est la largeur de l'iPhone 14/15. La spec conçoit à cette taille.
    ...devices["iPhone 14"],
  },
  projects: [
    {
      // Se connecte une fois par compte et écrit l'état de session dans
      // `e2e/.auth/` (voir e2e/fixtures.ts et e2e/auth.setup.ts). Les tests
      // du projet `audit` rejouent cet état au lieu de repasser par
      // `page.goto("/login")` à chacun des 66 tests : c'était cette
      // connexion répétée, sous 66 tests séquentiels sur un seul worker, qui
      // faisait expirer le dernier `goto` d'une série sous charge — pas un
      // défaut applicatif (Postgres restait à 13/100 connexions, le serveur
      // répondait en 46 ms juste après l'échec, et le test passait 3/3 en
      // isolement). Une seule connexion par compte supprime la cause plutôt
      // que d'en compenser les symptômes par des délais ou des reprises.
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "audit",
      testMatch: /audit\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
});
