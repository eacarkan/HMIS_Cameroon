import "dotenv/config";

import { prisma } from "@/server/db";
import { SEQUENCE_YEAR, seedBaseData } from "@/prisma/seed-data";

/**
 * Seed the deterministic fake demo base data (Step 3 — 07_Demo_Scenario).
 * Idempotent: safe to run repeatedly. Fake data only (A-001/D-008).
 */
async function seed() {
  await seedBaseData(prisma);

  const [hospitals, activeHospitals, roles, users, userRoles, sequences] =
    await Promise.all([
      prisma.hospital.count(),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.role.count(),
      prisma.user.count(),
      prisma.userRole.count(),
      prisma.sequence.count(),
    ]);

  console.log("✓ Seed complete (fake demo data only):");
  console.log(
    `  hospitals=${hospitals} (active: ${activeHospitals} — HRB-DEMO) · roles=${roles} · users=${users} · userRoles=${userRoles} · sequences=${sequences} @ ${SEQUENCE_YEAR}`,
  );
  console.log(
    "  Demo login password (all users): set via HMIS_DEMO_SHARED_PASSWORD (not printed).",
  );
}

seed()
  .catch((error) => {
    console.error("✗ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
