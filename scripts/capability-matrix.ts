import { writeFileSync } from "node:fs";

import { ROLE_CAPABILITIES } from "../lib/rbac/index";

/**
 * Phase 5G — regenerate the capability↔role matrix reference (`docs/security/CAPABILITY_ROLE_MATRIX.md`)
 * from the single source of truth (`lib/rbac`). Run: `npm run docs:capability-matrix`. App-level only;
 * no external audit. Documents which role holds which capability so over-grant is visible at a glance.
 */
const RC = ROLE_CAPABILITIES as Record<string, readonly string[]>;
const roles = Object.keys(RC).sort();
const allCaps = [...new Set(roles.flatMap((r) => [...RC[r]]))].sort();

/** The ONLY cross-hospital capability (Phase 3B rule). */
const CROSS_HOSPITAL = "central.aggregate.view";
/** Privileged manage/admin capabilities that clinical/reception roles must NEVER hold. */
const PRIVILEGED = [
  "admin.manage", "user.manage", "config.manage", "config.template.manage", "config.instance.manage",
  "integration.system.manage", "integration.job.retry", "dhis2.mapping.manage", "dhis2.export.run",
  "external_result.import", "external_payment.reconcile", "payer.manage", "claim.manage",
  "analytics.report.manage", "patient_match.review", "patient_match.configure",
].filter((c) => allCaps.includes(c));
const CLINICAL_OR_RECEPTION = ["medecin", "agent_accueil", "technicien_diagnostic", "validateur_diagnostic", "pharmacien", "pharmacien_chef"];

const lines: string[] = [];
lines.push("# Capability ↔ Role matrix (Phase 5G — app-level access review)");
lines.push("");
lines.push("**Synthetic prototype · not Gate 7 · app-level review only (not an external cybersecurity audit).**");
lines.push("");
lines.push(`Generated from \`lib/rbac\` (${roles.length} roles, ${allCaps.length} capabilities). Regenerate with \`npm run docs:capability-matrix\`. Server-side RBAC (\`requireCapability\` / \`canAtHospital\`) is authoritative; UI hiding is not security.`);
lines.push("");
lines.push("## Security invariants (verified — see `tests/unit/rbac-matrix-5g.test.ts`)");
lines.push(`- **Single cross-hospital capability.** \`${CROSS_HOSPITAL}\` is the ONLY capability held across hospitals, and ONLY by \`${roles.filter((r) => RC[r].includes(CROSS_HOSPITAL)).join(", ")}\`. Central oversight is aggregate-only / snapshot-fed (Phase 3D).`);
lines.push(`- **No clinical/reception over-grant.** None of {${CLINICAL_OR_RECEPTION.join(", ")}} holds any privileged manage/admin capability.`);
lines.push("- **No live external calls / no real credentials by default.** Integration + MPI live flags default OFF; adapters are mock-only; credential references only.");
lines.push("");
lines.push("## Privileged capabilities → holders");
lines.push("");
lines.push("| Capability | Held by |");
lines.push("|---|---|");
for (const cap of PRIVILEGED) {
  lines.push(`| \`${cap}\` | ${roles.filter((r) => RC[r].includes(cap)).join(", ") || "—"} |`);
}
lines.push("");
lines.push("## Per-role capabilities");
lines.push("");
for (const r of roles) {
  lines.push(`### \`${r}\` (${RC[r].length})`);
  lines.push(`${[...RC[r]].sort().map((c) => `\`${c}\``).join(" · ")}`);
  lines.push("");
}

writeFileSync("docs/security/CAPABILITY_ROLE_MATRIX.md", lines.join("\n") + "\n");
console.log(`✓ wrote docs/security/CAPABILITY_ROLE_MATRIX.md (${roles.length} roles, ${allCaps.length} capabilities)`);
