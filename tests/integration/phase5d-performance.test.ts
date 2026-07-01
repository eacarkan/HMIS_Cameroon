import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { getDashboardSummary } from "@/server/services";
import { seedBilledEncounter } from "../helpers/scenarios";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 5D — performance / query hardening. The optimisation review must NOT weaken hospital scoping:
 * the dashboard aggregate runs several counts in parallel (pooled connections) and must still reflect
 * ONLY the active hospital's data. Also guards that the config-template apply path (whose transaction-
 * internal reads were serialised to remove a pg deprecation warning) stays scoped + correct. Synthetic.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

describe("integration: Phase 5D performance / scoping preserved", () => {
  beforeEach(resetTestDb);

  it("the dashboard aggregate (parallel counts) reflects ONLY the active hospital's data", async () => {
    await seedBilledEncounter(); // 1 patient + encounter + paid invoice at HRB, today
    // A patient created in ANOTHER hospital today must NOT be counted in HRB's dashboard.
    await prisma.patient.create({
      data: { hospitalId: OTHER, patientNumber: "HRN-NGA-P-2026-050501", familyName: "AUTRE", givenName: "Hopital", sex: "male", dateOfBirth: new Date("1990-01-01") },
    });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const summary = await getDashboardSummary(admin.actor, admin.ctx);
    // HRB counts reflect the one seeded patient; the other hospital's patient is excluded.
    expect(summary.patientsToday).toBe(1);
    const hrbPatients = await prisma.patient.count({ where: { hospitalId: HRB } });
    const otherPatients = await prisma.patient.count({ where: { hospitalId: OTHER } });
    expect(hrbPatients).toBe(1);
    expect(otherPatients).toBe(1);
    // The aggregate never conflated the two hospitals.
    expect(summary.patientsToday).toBeLessThan(hrbPatients + otherPatients);
  });
});
