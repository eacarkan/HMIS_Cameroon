import { existsSync } from "node:fs";

import { RELEASE_CANDIDATE, RELEASE_LABEL } from "../lib/constants";

/**
 * Phase 5F — release-candidate guardrail. Verifies the RC marker is a SYNTHETIC candidate (no production
 * / Gate-7 claim) and that the release docs + the QA evidence folders the index points to actually
 * exist (so the evidence index cannot drift from reality). App-level / doc check; no deployment.
 */
const problems: string[] = [];

// 1. The version marker must be a synthetic RC, never a production / Gate-7 claim.
if (!/^v\d+\.\d+\.\d+-rc\.\d+$/.test(RELEASE_CANDIDATE)) {
  problems.push(`RELEASE_CANDIDATE "${RELEASE_CANDIDATE}" is not a release-candidate version (vX.Y.Z-rc.N)`);
}
// Phase 6.3 S3 (mentor-approved wording): the label must state the review environment +
// synthetic data + the Gate-7 boundary, and must never use the word "production".
if (
  !/environnement de revue/i.test(RELEASE_LABEL) ||
  !/synth[ée]tiques/i.test(RELEASE_LABEL) ||
  !/hors Gate 7/i.test(RELEASE_LABEL)
) {
  problems.push(
    `RELEASE_LABEL must state review-environment + synthetic + outside-Gate-7: "${RELEASE_LABEL}"`,
  );
}
if (/\bproduction\b/i.test(RELEASE_LABEL)) {
  problems.push("RELEASE_LABEL must not use the word production");
}

// 2. The release docs must ship.
for (const f of [
  "docs/release/RELEASE_NOTES.md",
  "docs/release/RELEASE_CANDIDATE_CHECKLIST.md",
  "docs/release/QA_EVIDENCE_INDEX.md",
  "docs/release/KNOWN_ISSUES.md",
]) {
  if (!existsSync(f)) problems.push(`missing release doc: ${f}`);
}

// 3. The QA evidence folders the index references must exist (index ↔ reality).
for (const dir of [
  "docs/qa-command-output/phase4/FINAL",
  "docs/qa-command-output/phase4/4G",
  "docs/qa-command-output/phase5/5A",
  "docs/qa-command-output/phase5/5G",
  "docs/qa-command-output/phase5/5B",
  "docs/qa-command-output/phase5/5C",
  "docs/qa-command-output/phase5/5D",
  "docs/qa-command-output/phase5/5E",
]) {
  if (!existsSync(dir)) problems.push(`QA evidence folder referenced by the index is missing: ${dir}`);
}

if (problems.length) {
  console.error("✗ release-candidate check found issues:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`✓ release check: ${RELEASE_CANDIDATE} (synthetic RC); release docs + QA evidence folders present.`);
process.exit(0);
