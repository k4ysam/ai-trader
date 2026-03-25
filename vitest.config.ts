import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Component tests use jsdom; lib/api tests use node.
    // Per-file environment overrides via @vitest-environment docblock.
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      exclude: ["lib/agents.ts", "lib/rate-limit.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80 },
    },
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
