import "dotenv/config";

import { writeFileSync } from "node:fs";

/**
 * Deterministic data fixture for the review screenshots (companion to
 * `scripts/capture-review-screenshots.mjs`). Resets the TEST database to the known
 * demo state and replays the golden path through the SERVICE layer, then emits the
 * real *internal route IDs* (per-row cuids) as JSON so the capture step visits valid
 * routes only.
 *
 * Why this exists: route IDs are cuids regenerated on every reseed — only the
 * human-readable numbers (HRB-DEMO-P-…) are deterministic. The previous capture read
 * IDs from one seed and a later reseed invalidated them, so the id-bearing detail
 * routes hit notFound() → Next 404. This script makes the seed and the id capture a
 * single, ordered step against the SAME test database the running server serves.
 *
 * Safety: runs ONLY against TEST_DATABASE_URL and refuses any DB whose name lacks
 * "test". Fake data only. Usage: `tsx scripts/seed-review-fixture.ts <ids-out.json>`.
 */
const HRB = "hosp-hrb-demo";

function resolveTestDatabase(): void {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    console.error(
      "seed-review-fixture requires TEST_DATABASE_URL (a dedicated test database).",
    );
    process.exit(1);
  }
  const dbName = (testUrl.split("/").pop() ?? "").split("?")[0];
  if (!/test/i.test(dbName)) {
    console.error(
      `Refusing: TEST_DATABASE_URL database "${dbName}" must contain "test".`,
    );
    process.exit(1);
  }
  process.env.DATABASE_URL = testUrl;
}

async function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: tsx scripts/seed-review-fixture.ts <ids-out.json>");
    process.exit(1);
  }
  resolveTestDatabase();

  const { clearOperationalData, seedBaseData } = await import(
    "@/prisma/seed-data"
  );
  const { prisma } = await import("@/server/db");
  const {
    authenticateCredentials,
    createInvoice,
    createPatientForActor,
    openEncounter,
    recordConsultation,
    recordPayment,
    recordReceiptPrint,
    selectHospital,
    addPatientContact,
    addPatientIdentifier,
    addObservation,
    addDiagnosis,
    flagDuplicateCandidate,
  } = await import("@/server/services");
  const { AuthorizationError } = await import("@/server/authz");

  async function login(email: string) {
    const actor = await authenticateCredentials(email, "demo1234");
    if (!actor) throw new Error(`login failed: ${email}`);
    const ctx = await selectHospital(actor, HRB);
    return { actor, ctx };
  }

  await clearOperationalData(prisma);
  await seedBaseData(prisma);

  // Patient 1 (BELLO) — full journey: encounter → consultation → invoice → paid receipt.
  const reception = await login("brigitte.mbarga@hrb-demo.cm");
  const patient1 = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: "+237 6 99 00 00 01",
    residence: "Bertoua — quartier Nkolbikon",
  });
  const encounter1 = await openEncounter(
    reception.actor,
    reception.ctx,
    patient1.id,
    {
      serviceLabel: "Médecine générale",
      reason: "Fièvre et céphalées depuis 48 heures",
    },
  );

  const clinician = await login("jeanpaul.etoa@hrb-demo.cm");
  const consultation1 = await recordConsultation(clinician.actor, clinician.ctx, encounter1.id, {
    reason: "Fièvre et céphalées depuis 48 heures",
    clinicalNote: "Patiente consciente, état général conservé.",
    vitals: "Température 38,2 °C · Tension 120/80 · Pouls 88/min · Poids 64 kg",
    provisionalDiagnosis: "Syndrome fébrile à explorer",
    recommendation:
      "Repos, hydratation ; bilan de base ; réévaluation si persistance.",
  });

  const cashier = await login("solange.abena@hrb-demo.cm");
  const invoice1 = await createInvoice(cashier.actor, cashier.ctx, encounter1.id, [
    { label: "Consultation médecine générale", unitAmount: 2000, quantity: 1 },
    { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
  ]);
  const payment1 = await recordPayment(cashier.actor, cashier.ctx, invoice1.id, {
    amount: invoice1.totalAmount,
    method: "cash",
  });
  await recordReceiptPrint(cashier.actor, cashier.ctx, payment1.id);

  // Server-side RBAC denial → writes an authz.denied audit entry (evidence for the
  // "Action refusée" audit screenshot). Reception cannot record a payment.
  try {
    await recordPayment(reception.actor, reception.ctx, invoice1.id, {
      amount: 1,
      method: "cash",
    });
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }

  const ids: Record<string, string> = {
    patient1: patient1.id,
    patient1Number: patient1.patientNumber,
    consultation1: consultation1.id,
    encounter1: encounter1.id,
    encounter1Number: encounter1.encounterNumber,
    invoice1: invoice1.id,
    invoice1Number: invoice1.invoiceNumber,
    payment1: payment1.id,
    payment1Number: payment1.receiptNumber,
  };

  // One-patient mode (stakeholder demo): the approved golden path uses ONE patient only,
  // so the dashboard reconciles to exactly 1 patient / 1 open encounter / 3 000 FCFA.
  // Two-patient mode (technical review) adds a fresh visit (Marie NDIAYE) with no
  // consultation/invoice so the empty consultation + invoice forms render cleanly.
  const onePatient =
    process.argv[3] === "one" || process.env.ONE_PATIENT === "true";
  if (!onePatient) {
    const patient2 = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "NDIAYE",
      givenName: "Marie",
      sex: "female",
      dateOfBirth: new Date("1986-11-02"),
      phone: "+237 6 99 00 00 02",
      residence: "Bertoua — quartier Madagascar",
    });
    const encounter2 = await openEncounter(
      reception.actor,
      reception.ctx,
      patient2.id,
      { serviceLabel: "Médecine générale", reason: "Douleurs abdominales" },
    );
    ids.patient2 = patient2.id;
    ids.patient2Number = patient2.patientNumber;
    ids.encounter2 = encounter2.id;
    ids.encounter2Number = encounter2.encounterNumber;

    // Gate 4 demo enrichment (fake): identity/contact, structured clinical data and a
    // duplicate-candidate hint — so the Gate 4 panels show content in screenshots.
    if (process.env.GATE4 === "true") {
      await addPatientContact(reception.actor, reception.ctx, patient1.id, {
        contactType: "phone",
        value: "+237 6 99 00 00 11",
        label: "Mobile",
      });
      await addPatientIdentifier(reception.actor, reception.ctx, patient1.id, {
        identifierType: "carte_hospitaliere",
        value: "HRB-2026-0001",
      });
      await addObservation(clinician.actor, clinician.ctx, consultation1.id, {
        type: "Température",
        value: "38,2",
        unit: "°C",
      });
      await addObservation(clinician.actor, clinician.ctx, consultation1.id, {
        type: "Tension",
        value: "120/80",
        unit: "mmHg",
      });
      await addDiagnosis(clinician.actor, clinician.ctx, consultation1.id, {
        label: "Syndrome fébrile",
        code: "R50.9",
        isPrimary: true,
      });
      await flagDuplicateCandidate(
        reception.actor,
        reception.ctx,
        patient1.id,
        patient2.id,
        "nom + date de naissance",
      );
    }
  }

  writeFileSync(out, JSON.stringify(ids, null, 2));
  console.log("review fixture seeded; ids ->", out);
  console.log(ids);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
