import "dotenv/config";

/**
 * Seed — PLACEHOLDER (build Step 3).
 *
 * The deterministic, fully fake demo dataset is implemented here once the Prisma
 * schema lands: one hospital (HRB-DEMO), five fictional users/roles, and the
 * reconciling 3 000 FCFA patient journey from 07_Demo_Scenario — with fixed
 * identifiers (e.g. HRB-DEMO-P-2026-000001) so the receipt, dashboard and audit
 * log always agree. Fake data only — no real patient data (A-001/D-008).
 */
async function seed() {
  console.log(
    "Seed placeholder — demo dataset is implemented at build Step 3 (07_Demo_Scenario). Nothing to seed yet.",
  );
}

void seed();
