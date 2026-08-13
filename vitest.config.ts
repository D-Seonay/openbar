import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node seul : ces tests sont des fonctions pures, pas du rendu.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
