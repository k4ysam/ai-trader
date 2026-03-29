import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.claude/**",
    ],
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      exclude: ["lib/constants.ts"],
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
