import {
  countActiveCandidates,
  createMatchCandidate,
  findActiveCandidateByPair,
  findMatchCandidateById,
  listMatchCandidates,
  listPatientsForMatching,
  transitionMatchCandidate,
  type HospitalContext,
} from "@/server/db";
import {
  type MatchablePatient,
  type PatientMatchStatusCode,
  canTransitionMatchStatus,
  canonicalPairKey,
  decisionRequiresReason,
  isSelfPair,
  scoreCandidate,
  shouldSurfaceCandidate,
} from "@/lib/patient-match";
import { normalizeName, normalizePhone } from "@/lib/patient-matching";
import { isMpiLiveEnabled, resolveMpiAdapter } from "@/lib/integration/mpi-adapter";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Phase 4G — patient-matching service. LOCAL, hospital-scoped, WARNING-ONLY duplicate-candidate
 * detection + a manual review queue. Canonicalizes each pair (A→B ≡ B→A), rejects self-pairs, and
 * enforces one ACTIVE candidate per (hospital, canonical pair). A recorded review decision captures the
 * reviewer's JUDGMENT ONLY — it never merges, overwrites, corrects, or modifies either patient record.
 * The MPI adapter is mock-only (no network). Audit payloads carry IDs + decision/reason only — never
 * nominative patient detail. Central oversight is unaffected (stays aggregate-only).
 */

/** UTC calendar day for a DOB (DATE column). */
function dayKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export async function getPatientMatchReview(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "patient_match.review");
  const candidates = await listMatchCandidates(ctx.hospitalId);
  return {
    candidates,
    activeCount: await countActiveCandidates(ctx.hospitalId),
    // The MPI is mock-only and disabled by default; surfaced so the UI can show the "no live call" notice.
    mpiLiveEnabled: isMpiLiveEnabled(),
  };
}

/**
 * Generate conservative LOCAL duplicate candidates. Uses blocking on the strong exact-match keys
 * (name / DOB / phone / guardian phone) — complete for the threshold (no above-threshold pair can miss a
 * block) while avoiding a full O(n²) scan. Canonicalizes + dedupes pairs, skips self-pairs and pairs that
 * already have an active candidate, and creates one candidate per new above-threshold pair. Audited.
 */
export async function generateMatchCandidatesForActor(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "patient_match.review", { type: "PatientMatchCandidate" });
  const patients = (await listPatientsForMatching(ctx.hospitalId)) as MatchablePatient[];
  const byId = new Map(patients.map((p) => [p.id, p]));

  // Build blocks keyed by exact signals; only intra-block pairs can reach the threshold.
  const blocks = new Map<string, string[]>();
  const addToBlock = (key: string, id: string) => {
    if (!key) return;
    const arr = blocks.get(key);
    if (arr) arr.push(id);
    else blocks.set(key, [id]);
  };
  for (const p of patients) {
    const fam = normalizeName(p.familyName);
    const giv = normalizeName(p.givenName);
    if (fam && giv) addToBlock(`n:${fam}|${giv}`, p.id);
    const day = dayKey(p.dateOfBirth);
    if (day) addToBlock(`d:${day}`, p.id);
    const phone = normalizePhone(p.phone);
    if (phone) addToBlock(`p:${phone}`, p.id);
    const guardian = normalizePhone(p.guardianPhone);
    if (guardian) addToBlock(`g:${guardian}`, p.id);
  }

  const seenPairs = new Set<string>();
  let created = 0;
  for (const ids of blocks.values()) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = byId.get(ids[i])!;
        const b = byId.get(ids[j])!;
        if (isSelfPair(a.id, b.id)) continue; // defensive — never within a block
        const key = canonicalPairKey(a.id, b.id);
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        const { score, signals } = scoreCandidate(a, b);
        if (!shouldSurfaceCandidate(score)) continue;
        if (await findActiveCandidateByPair(ctx.hospitalId, key)) continue; // one active candidate per pair
        try {
          const candidate = await createMatchCandidate({
            hospitalId: ctx.hospitalId, sourcePatientId: a.id, candidatePatientId: b.id, canonicalPairKey: key,
            score, signals, createdById: actor.id,
          });
          created++;
          await recordAudit({
            hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.patientMatchCandidateCreated,
            entityType: "PatientMatchCandidate", entityId: candidate.id,
            summary: `Candidat de rapprochement créé (score ${score}) — signaux : ${signals.map((s) => s.type).join(", ")}`,
            metadata: { sourcePatientId: a.id, candidatePatientId: b.id, score },
          });
        } catch {
          // A concurrent generation may have created the same active pair (partial-unique race) — skip.
        }
      }
    }
  }
  return { scanned: patients.length, created };
}

export async function startMatchReviewForActor(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "patient_match.review", { type: "PatientMatchCandidate", id });
  const candidate = await findMatchCandidateById(ctx.hospitalId, id);
  if (!candidate) throw new Error("Candidat introuvable dans cet hôpital.");
  if (!canTransitionMatchStatus(candidate.status, "UNDER_REVIEW")) throw new Error(`Transition invalide (${candidate.status} → UNDER_REVIEW).`);
  const count = await transitionMatchCandidate(ctx.hospitalId, id, { from: candidate.status, to: "UNDER_REVIEW", reviewedById: actor.id });
  if (count === 0) throw new Error("Le statut du candidat a changé — réessayez.");
  await recordAudit({
    hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.patientMatchReviewStarted,
    entityType: "PatientMatchCandidate", entityId: id, summary: "Revue de candidat démarrée",
  });
  return findMatchCandidateById(ctx.hospitalId, id);
}

/**
 * Record a review decision. Requires a reason/comment. Guarded transition; captures the reviewer's
 * JUDGMENT ONLY — it writes the match record and NEVER modifies either patient row.
 */
export async function recordMatchDecisionForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: { decision: PatientMatchStatusCode; reason: string },
) {
  await requireCapability(actor, ctx, "patient_match.review", { type: "PatientMatchCandidate", id });
  if (decisionRequiresReason(input.decision) && !input.reason?.trim()) {
    throw new Error("Un motif/commentaire est obligatoire pour enregistrer une décision.");
  }
  const candidate = await findMatchCandidateById(ctx.hospitalId, id);
  if (!candidate) throw new Error("Candidat introuvable dans cet hôpital.");
  if (!canTransitionMatchStatus(candidate.status, input.decision)) {
    throw new Error(`Transition de candidat invalide (${candidate.status} → ${input.decision}).`);
  }
  const count = await transitionMatchCandidate(ctx.hospitalId, id, {
    from: candidate.status, to: input.decision, reviewedById: actor.id, reviewReason: input.reason.trim(), reviewedAt: new Date(),
  });
  if (count === 0) throw new Error("Le statut du candidat a changé — réessayez.");
  const action = input.decision === "DISMISSED" ? AUDIT_ACTIONS.patientMatchDismissed : AUDIT_ACTIONS.patientMatchDecisionRecorded;
  await recordAudit({
    hospitalId: ctx.hospitalId, actorId: actor.id, action, entityType: "PatientMatchCandidate", entityId: id,
    summary: `Décision de revue : ${input.decision} — ${input.reason.trim()} (jugement uniquement ; aucun dossier patient modifié)`,
  });
  return findMatchCandidateById(ctx.hospitalId, id);
}

/**
 * Run a MOCK MPI check for a candidate. The mock adapter makes NO network call and returns no match /
 * no national identifier. Never merges. Audited.
 */
export async function runMockMpiCheckForActor(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "patient_match.review", { type: "PatientMatchCandidate", id });
  const candidate = await findMatchCandidateById(ctx.hospitalId, id);
  if (!candidate) throw new Error("Candidat introuvable dans cet hôpital.");
  const adapter = resolveMpiAdapter("MOCK", { liveEnabled: isMpiLiveEnabled() });
  const result = await adapter.lookup({ hospitalId: ctx.hospitalId, localPatientId: candidate.sourcePatientId });
  await recordAudit({
    hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.patientMatchMockMpiChecked,
    entityType: "PatientMatchCandidate", entityId: id, summary: `Vérification MPI fictive (${result.source}) — ${result.matched ? "correspondance" : "aucune correspondance"} (aucun appel réseau)`,
  });
  return result;
}
