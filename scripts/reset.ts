import "dotenv/config";

import { prisma } from "@/server/db";
import { clearOperationalData, seedBaseData } from "@/prisma/seed-data";

/**
 * Reset the demo to its known starting state (07_Demo_Scenario §14): clear all
 * operational records, reset numbering counters to zero, and re-seed the base data
 * (hospitals, roles, users). Reproducible — every run starts the same. Fake data only.
 */
async function reset() {
  await clearOperationalData(prisma);
  await seedBaseData(prisma);

  const [patients, encounters, invoices, payments] = await Promise.all([
    prisma.patient.count(),
    prisma.encounter.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
  ]);

  console.log("✓ Reset complete — known starting state restored:");
  console.log(
    `  operational records cleared (patients=${patients}, encounters=${encounters}, invoices=${invoices}, payments=${payments}); counters at 0; base demo data re-seeded.`,
  );
}

reset()
  .catch((error) => {
    console.error("✗ Reset failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
