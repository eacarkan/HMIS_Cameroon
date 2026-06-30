import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turn off rules that conflict with Prettier (formatting is Prettier's job).
  eslintConfigPrettier,

  // Architecture guardrail (09 §4, §13 / D-012): the UI layer (pages, components,
  // features) must NEVER import Prisma or the data-access layer directly — it goes
  // through `server/actions` → `server/services`. Enforced, not just documented.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "features/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@prisma/adapter-pg", "pg"],
              message:
                "Do not call Prisma from the UI. Use a server action → service (09 §4).",
            },
            {
              group: ["@/server/db", "@/server/db/*"],
              message:
                "The UI must not touch data-access directly. Go through server/services (09 §4).",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next. Also ignore generated test artifacts —
  // Playwright writes minified vendor bundles into playwright-report/ (and traces into
  // test-results/) when a run retains traces; both are gitignored build output, not source.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
