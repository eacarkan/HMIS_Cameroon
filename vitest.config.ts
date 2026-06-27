import { defineConfig } from "vitest/config";

/**
 * Vitest configuration (Step 14). Three projects:
 *  - unit        : pure logic in `lib/` (node, no DB)
 *  - component   : React Testing Library on client/presentational components (jsdom)
 *  - integration : service + data-access against the TEST database (node, serial)
 *
 * `@/` path aliases resolve via Vite's native tsconfig-paths support. Integration tests
 * require TEST_DATABASE_URL (a dedicated test DB) — see tests/setup/db.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/component/**/*.test.tsx"],
          setupFiles: ["tests/setup/rtl.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/db.ts"],
          fileParallelism: false,
          hookTimeout: 30000,
          testTimeout: 30000,
        },
      },
    ],
  },
});
