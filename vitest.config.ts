import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: keeps the dev/build pipeline untouched by the
// test runner's config (no proxy/plugins needed for tests, which hit real ephemeral ports
// or mock lib/api directly instead of going through the Vite dev proxy).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,mts,js,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      // Scoped to the modules that actually have unit tests (server logic + pure client
      // helpers + the dashboard store) rather than the whole src/ tree - untested React
      // components would otherwise dilute the percentage without reflecting real gaps.
      include: ["server/app.mjs", "src/lib/utils.ts", "src/store/dashboard.ts"],
    },
  },
});
