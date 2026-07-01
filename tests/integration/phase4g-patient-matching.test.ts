import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  createPatientForActor,
  generateMatchCandidatesForActor,
  getPatientMatchReview,
  recordMatchDecisionForActor,
  runMockMpiCheckForActor,
  startMatchReviewForActor,
} from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 4G — patient-matching (DB-backed). LOCAL + hospital-scoped, WARNING-ONLY candidates + a manual
 * review. The safety invariants under test: one ACTIVE candidate per canonical pair (A→B ≡ B→A), NO
 * cross-hospital pairing, RBAC (clinical + central supervisor denied), a recorded decision modifies
 * NEITHER patient record, and the mock MPI check makes NO network call. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";
const CENTRAL = "direction.regionale@hrb-demo.cm";

/** Two strongly-matching synthetic patients (same name + DOB) at HRB. */
async function twoDuplicates() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const a = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "MBALLA", givenName: "Jean", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: "699112233", residence: null,
  });
  const b = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "Mballa", givenName: "jean", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  return { reception, a, b };
}

describe("integration: Phase 4G patient-matching (local, warning-only)", () => {
  beforeEach(resetTestDb);

  it("generates a warning-only candidate for a local duplicate pair; a second run does NOT duplicate it; audited", async () => {
    const { a, b } = await twoDuplicates();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const res = await generateMatchCandidatesForActor(admin.actor, admin.ctx);
    expect(res.created).toBe(1);

    const cand = await prisma.patientMatchCandidate.findFirstOrThrow({ where: { hospitalId: HRB } });
    expect(cand.status).toBe("CANDIDATE"); // warning only — not an action, not a merge
    expect(cand.canonicalPairKey).toBe([a.id, b.id].sort().join("::"));
    expect(cand.score).toBeGreaterThanOrEqual(50);
    // A re-run finds the active pair and creates nothing new (one active candidate per canonical pair).
    const again = await generateMatchCandidatesForActor(admin.actor, admin.ctx);
    expect(again.created).toBe(0);
    expect(await prisma.patientMatchCandidate.count({ where: { hospitalId: HRB } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "patient_match.candidate_created" } })).toBe(1);
  });

  it("NEVER pairs across hospitals — a matching patient in another hospital is never a candidate", async () => {
    const { a } = await twoDuplicates();
    // A patient in ANOTHER hospital that would match — inserted directly (no cross-hospital service).
    const foreign = await prisma.patient.create({
      data: { hospitalId: OTHER, patientNumber: "HRN-NGA-P-2026-090909", familyName: "MBALLA", givenName: "Jean", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: "699112233" },
    });
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await generateMatchCandidatesForActor(admin.actor, admin.ctx);
    const all = await prisma.patientMatchCandidate.findMany({ where: { hospitalId: HRB } });
    for (const c of all) {
      expect(c.sourcePatientId).not.toBe(foreign.id);
      expect(c.candidatePatientId).not.toBe(foreign.id);
    }
    expect(all.every((c) => c.sourcePatientId !== a.id || c.candidatePatientId !== foreign.id)).toBe(true);
  });

  it("a RECORDED review decision modifies NEITHER patient record (judgment only)", async () => {
    const { a, b } = await twoDuplicates();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await generateMatchCandidatesForActor(admin.actor, admin.ctx);
    const cand = await prisma.patientMatchCandidate.findFirstOrThrow({ where: { hospitalId: HRB } });

    const beforeA = await prisma.patient.findUniqueOrThrow({ where: { id: a.id } });
    const beforeB = await prisma.patient.findUniqueOrThrow({ where: { id: b.id } });

    await startMatchReviewForActor(admin.actor, admin.ctx, cand.id);
    await recordMatchDecisionForActor(admin.actor, admin.ctx, cand.id, { decision: "MARKED_DUPLICATE", reason: "Même personne — vérifié au guichet." });

    // The candidate reflects the decision…
    const decided = await prisma.patientMatchCandidate.findUniqueOrThrow({ where: { id: cand.id } });
    expect(decided.status).toBe("MARKED_DUPLICATE");
    expect(decided.reviewReason).toMatch(/guichet/);
    // …but BOTH patient rows are byte-for-byte unchanged (no merge / overwrite / correction).
    expect(await prisma.patient.findUniqueOrThrow({ where: { id: a.id } })).toEqual(beforeA);
    expect(await prisma.patient.findUniqueOrThrow({ where: { id: b.id } })).toEqual(beforeB);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "patient_match.review_decision_recorded" } })).toBe(1);
  });

  it("a decision requires a reason; the mock MPI check makes NO network call", async () => {
    await twoDuplicates();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await generateMatchCandidatesForActor(admin.actor, admin.ctx);
    const cand = await prisma.patientMatchCandidate.findFirstOrThrow({ where: { hospitalId: HRB } });
    await startMatchReviewForActor(admin.actor, admin.ctx, cand.id);
    await expect(recordMatchDecisionForActor(admin.actor, admin.ctx, cand.id, { decision: "MARKED_DUPLICATE", reason: "  " })).rejects.toThrow(/motif|obligatoire/i);

    // Network-egress guard: the mock MPI check must never touch fetch.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((() => { throw new Error("NETWORK BLOCKED"); }) as unknown as typeof fetch);
    const result = await runMockMpiCheckForActor(admin.actor, admin.ctx, cand.id);
    expect(result.matched).toBe(false);
    expect(result.candidates).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "patient_match.mock_mpi_checked" } })).toBe(1);
  });

  it("RBAC: a clinical role and the central supervisor are denied patient-level match review", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getPatientMatchReview(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
    // The central supervisor (aggregate-only) must NEVER see patient-level candidates.
    const central = await actorFor(CENTRAL);
    await expect(getPatientMatchReview(central, { hospitalId: HRB, code: "HRB-DEMO", name: "HRB", region: "Est" })).rejects.toBeInstanceOf(AuthorizationError);
    // The generate action is likewise denied to a clinician.
    await expect(generateMatchCandidatesForActor(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
