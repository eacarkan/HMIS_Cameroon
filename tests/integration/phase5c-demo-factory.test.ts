import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { seedBilledEncounter, seedDuplicateMatch, seedEmergencyDebt, seedInsuranceClaim } from "../helpers/scenarios";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 5C — synthetic-data factory + UAT scenario coverage (DB-backed). Proves the repeatable demo
 * builders cover the key edge cases (billing, emergency debt, insurance claim, duplicate matching), are
 * deterministic after a reset, and are 100% synthetic (no real data). No schema change.
 */
const HRB = "hosp-hrb-demo";

describe("integration: Phase 5C demo-scenario factory", () => {
  beforeEach(resetTestDb);

  it("builds every edge-case scenario with the expected synthetic artifacts", async () => {
    const billed = await seedBilledEncounter();
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: billed.invoice.id } })).status).toBe("paid");

    const emergency = await seedEmergencyDebt();
    expect(emergency.debt.status).toBe("outstanding");
    expect((await prisma.encounter.findUniqueOrThrow({ where: { id: emergency.encounter.id } })).isEmergency).toBe(true);

    const insurance = await seedInsuranceClaim();
    expect(insurance.claim.status).toBe("DRAFT");
    expect(insurance.claim.invoiceId).toBe(insurance.invoice.id); // billing-linked

    const dup = await seedDuplicateMatch();
    expect(dup.created).toBeGreaterThanOrEqual(1);
    expect((await prisma.patientMatchCandidate.findFirstOrThrow({ where: { hospitalId: HRB } })).status).toBe("CANDIDATE");
  });

  it("is deterministic after a reset and 100% synthetic (no real data)", async () => {
    // First run.
    const first = await seedBilledEncounter("REPRO");
    const firstNumber = first.patient.patientNumber;
    const firstPatients = await prisma.patient.count({ where: { hospitalId: HRB } });

    // Reset + identical run → identical deterministic patient number + count.
    await resetTestDb();
    const second = await seedBilledEncounter("REPRO");
    expect(second.patient.patientNumber).toBe(firstNumber); // counters reset → deterministic
    expect(await prisma.patient.count({ where: { hospitalId: HRB } })).toBe(firstPatients);

    // Every seeded patient is synthetic (the factory tags names DEMO_*); no real nominative data.
    const names = (await prisma.patient.findMany({ where: { hospitalId: HRB }, select: { familyName: true } })).map((p) => p.familyName);
    expect(names.every((n) => n.startsWith("DEMO_"))).toBe(true);
  });
});
