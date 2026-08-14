import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Un seul worker : les tests partagent une base et une session.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? "http://localhost:3000",
    // 390px est la largeur de l'iPhone 14/15. La spec conçoit à cette taille.
    ...devices["iPhone 14"],
  },
});
