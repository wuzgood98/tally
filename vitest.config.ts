import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", ".next/**", ".data/**"],
    include: ["**/*.test.ts"],
    // Each file migrates its own in-memory Postgres; give that a moment.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
