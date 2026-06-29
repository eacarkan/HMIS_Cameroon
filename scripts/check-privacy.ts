import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Privacy / fake-data check (01, R-008). Lightweight scan of committed source for
 * obvious secrets and non-fake data, plus assertions that the prototype is clearly a
 * fake-data demo (prototype label present; demo accounts use the fake @hrb-demo.cm
 * domain). Not a full secret-scanner — a sane guardrail.
 */
const SCAN_ROOTS = [
  "app",
  "components",
  "features",
  "server",
  "lib",
  "prisma",
  "scripts",
  "messages",
];

const SECRET_PATTERNS = [
  { re: /AKIA[0-9A-Z]{16}/, what: "AWS access key id" },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, what: "private key" },
  { re: /sk_live_[0-9a-zA-Z]{10,}/, what: "Stripe live secret key" },
  { re: /xox[baprs]-[0-9A-Za-z-]{10,}/, what: "Slack token" },
  { re: /ghp_[0-9A-Za-z]{30,}/, what: "GitHub token" },
  {
    re: /postgres(?:ql)?:\/\/[^\s"']*amazonaws\.com/i,
    what: "managed/production DB URL",
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
    else if (/\.(ts|tsx|json|css|md)$/.test(entry)) out.push(full);
  }
  return out;
}

const problems: string[] = [];

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    for (const { re, what } of SECRET_PATTERNS) {
      if (re.test(src)) problems.push(`${file}: possible ${what}`);
    }
  }
}

// .env must be gitignored (never committed).
try {
  execSync("git check-ignore .env", { stdio: "ignore" });
} catch {
  problems.push(".env is NOT gitignored — secrets could be committed");
}

// Prototype label must exist and be referenced where it matters.
const constants = readFileSync("lib/constants/index.ts", "utf8");
if (!/non destiné à la production/.test(constants)) {
  problems.push("prototype label (PROTOTYPE_LABEL) missing from lib/constants");
}
for (const f of [
  "components/layout/prototype-banner.tsx",
  "components/print/receipt-document.tsx",
]) {
  if (!/PROTOTYPE_LABEL/.test(readFileSync(f, "utf8"))) {
    problems.push(`${f} does not render the prototype label`);
  }
}

// Demo accounts must use the fake hospital domain.
const seed = readFileSync("prisma/seed-data.ts", "utf8");
const emails = [...seed.matchAll(/email:\s*"([^"]+)"/g)].map((m) => m[1]);
const nonFake = emails.filter((e) => !e.endsWith("@hrb-demo.cm"));
if (nonFake.length) {
  problems.push(`seed users use non-demo emails: ${nonFake.join(", ")}`);
}

// Phase 1A Batch 6: the real patient-data path must stay disabled (fail closed; Gate 7 only).
const dataMode = readFileSync("lib/data-mode.ts", "utf8");
if (!/REAL_DATA_ENABLED\s*=\s*false/.test(dataMode)) {
  problems.push("lib/data-mode.ts: REAL_DATA_ENABLED must be false (real-data path stays disabled)");
}
if (!/DÉMO \/ PILOTE — données fictives/.test(dataMode)) {
  problems.push("lib/data-mode.ts: visible fake-data marker (DATA_MODE_LABEL) missing");
}

if (problems.length) {
  console.error("✗ privacy/fake-data check found issues:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(
  `✓ privacy/fake-data check: no secrets found; .env gitignored; prototype label present (app + receipt); ${emails.length} demo accounts all @hrb-demo.cm (fake).`,
);
process.exit(0);
