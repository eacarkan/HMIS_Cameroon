import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Architecture guardrail check (09 §4, §13). Lightweight static scan asserting the
 * one-way flow: the UI layer (app/, components/, features/) must NOT import Prisma or
 * the data-access layer directly — it goes through server/actions → server/services.
 * Complements the ESLint no-restricted-imports rule.
 */
const UI_ROOTS = ["app", "components", "features"];
const REQUIRED_LAYERS = [
  "server/actions",
  "server/authz",
  "server/services",
  "server/db",
];

const FORBIDDEN = [
  { re: /from\s+["']@prisma\/client["']/, what: "@prisma/client" },
  { re: /from\s+["']@prisma\/adapter-pg["']/, what: "@prisma/adapter-pg" },
  { re: /from\s+["']pg["']/, what: "pg" },
  {
    re: /from\s+["']@\/server\/db(\/[^"']*)?["']/,
    what: "@/server/db (data-access)",
  },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const violations: string[] = [];

for (const root of UI_ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    for (const { re, what } of FORBIDDEN) {
      if (re.test(src)) {
        violations.push(
          `${file} imports ${what} (UI must go through server/services)`,
        );
      }
    }
  }
}

const missingLayers = REQUIRED_LAYERS.filter((l) => {
  try {
    return !statSync(l).isDirectory();
  } catch {
    return true;
  }
});

let ok = true;
if (missingLayers.length) {
  ok = false;
  console.error("✗ missing architecture layers:", missingLayers.join(", "));
}
if (violations.length) {
  ok = false;
  console.error("✗ forbidden imports in the UI layer:");
  for (const v of violations) console.error("  - " + v);
}

if (ok) {
  console.log(
    "✓ architecture guardrail: UI → server/actions → server/services → server/db → Prisma (no direct DB access in app/, components/, features/).",
  );
  process.exit(0);
}
process.exit(1);
