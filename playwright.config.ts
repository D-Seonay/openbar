import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Un seul worker : les tests partagent une base et une session.
  workers: 1,
  // Chaque test se reconnecte via la fixture, et la suite est séquentielle :
  // sous charge, une de ces navigations dépasse les 30 s par défaut. Le seul
  // échec observé était un `page.goto("/login")` expiré, jamais une assertion.
  // On relève donc le plafond plutôt que de compter sur une reprise.
  timeout: 60_000,
  // Filet de sécurité résiduel. Une régression réelle échoue aux deux essais :
  // une reprise ne peut pas transformer un débordement en absence de débordement.
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? "http://localhost:3000",
    navigationTimeout: 45_000,
    // 390px est la largeur de l'iPhone 14/15. La spec conçoit à cette taille.
    ...devices["iPhone 14"],
  },
});
