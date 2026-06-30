import "dotenv/config";

import { clearOperationalData, seedBaseData } from "@/prisma/seed-data";
import { formatFcfa } from "@/lib/money";
import { AuthorizationError } from "@/server/authz";

/**
 * Golden-path smoke test (09 §11, 02). Resets to the known demo state and replays the
 * full journey through the SERVICE layer (login → hospital → patient → encounter →
 * consultation → invoice → payment → receipt → dashboard → audit), asserting the
 * acceptance-critical outcomes: deterministic numbering, 3 000 FCFA reconciliation,
 * the audit chain, hospital scoping and a server-side RBAC block. Fake data only.
 *
 * DB target safety:
 *  - `npm run smoke` / `npm run smoke:test` (DEFAULT): runs against TEST_DATABASE_URL and
 *    REFUSES any database whose name does not contain "test".
 *  - `npm run smoke:dev` (SMOKE_DEV=true): runs against the development DATABASE_URL —
 *    manual/dev-only, fake data only, NEVER with real data.
 * The target is resolved BEFORE Prisma is imported (dynamic imports in main()).
 */
const HRB = "hosp-hrb-demo";
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Resolve which database the smoke test runs against, safely (test DB by default). */
function resolveDatabaseTarget(): void {
  if (process.env.SMOKE_DEV === "true") {
    if (!process.env.DATABASE_URL) {
      console.error(
        "smoke:dev requires DATABASE_URL (the development database).",
      );
      process.exit(1);
    }
    console.warn(
      "⚠ smoke:dev — running against the DEVELOPMENT database. Manual/dev-only; " +
        "fake data only; never use with real data.",
    );
    return;
  }

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    console.error(
      "smoke:test requires TEST_DATABASE_URL (a dedicated test database). See " +
        ".env.example. Use `npm run smoke:dev` to target the development DB.",
    );
    process.exit(1);
  }

  const dbName = (testUrl.split("/").pop() ?? "").split("?")[0];
  if (!/test/i.test(dbName)) {
    console.error(
      `Refusing: TEST_DATABASE_URL database "${dbName}" does not look like a test ` +
        `database (its name must contain "test").`,
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = testUrl;
}

async function main() {
  resolveDatabaseTarget();

  // Imported AFTER the DB target is set so Prisma connects to the right database.
  const { prisma } = await import("@/server/db");
  const {
    authenticateCredentials,
    createInvoice,
    createPatientForActor,
    getDashboardSummary,
    getInvoice,
    invoiceBalance,
    listAuditEntries,
    openEncounter,
    recordConsultation,
    recordPayment,
    recordReceiptPrint,
    resolveHospitalContext,
    selectHospital,
  } = await import("@/server/services");

  async function login(email: string) {
    const actor = await authenticateCredentials(email, "demo1234");
    if (!actor) throw new Error(`login failed: ${email}`);
    const ctx = await selectHospital(actor, HRB);
    return { actor, ctx };
  }

  await clearOperationalData(prisma);
  await seedBaseData(prisma);

  // Known starting state
  const hospital = await prisma.hospital.findUnique({
    where: { code: "HRB-DEMO" },
  });
  check("HRB-DEMO hospital exists and is active", hospital?.isActive === true);
  // Phase 2D +2 pharmacy, Phase 2I +2 diagnostics demo users (9 total).
  check("nine demo users seeded", (await prisma.user.count()) === 9);

  // Reception: patient + encounter
  const reception = await login("brigitte.mbarga@hrb-demo.cm");
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: "+237 6 99 00 00 01",
    residence: "Bertoua — quartier Nkolbikon",
  });
  check(
    "patient number",
    patient.patientNumber === "HRB-DEMO-P-2026-000001",
    patient.patientNumber,
  );

  const encounter = await openEncounter(
    reception.actor,
    reception.ctx,
    patient.id,
    {
      serviceLabel: "Médecine générale",
      reason: "Fièvre et céphalées depuis 48 heures",
    },
  );
  check(
    "encounter number",
    encounter.encounterNumber === "HRB-DEMO-V-2026-000001",
    encounter.encounterNumber,
  );

  // Hospital scoping: reception has no access to another hospital
  const leak = await resolveHospitalContext(reception.actor, "hosp-hrn-nga");
  check("hospital scoping (cross-hospital denied)", leak === null);

  // Clinician: consultation
  const clinician = await login("jeanpaul.etoa@hrb-demo.cm");
  await recordConsultation(clinician.actor, clinician.ctx, encounter.id, {
    reason: "Fièvre et céphalées depuis 48 heures",
    clinicalNote: "Patiente consciente, état général conservé.",
    vitals: "Température 38,2 °C · Tension 120/80 · Pouls 88/min · Poids 64 kg",
    provisionalDiagnosis: "Syndrome fébrile à explorer",
    recommendation:
      "Repos, hydratation ; bilan de base ; réévaluation si persistance.",
  });
  check("consultation recorded (clinician)", true);

  // Cashier: invoice + payment + receipt
  const cashier = await login("solange.abena@hrb-demo.cm");
  const invoice = await createInvoice(
    cashier.actor,
    cashier.ctx,
    encounter.id,
    [
      {
        label: "Consultation médecine générale",
        unitAmount: 2000,
        quantity: 1,
      },
      { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
    ],
  );
  check(
    "invoice number",
    invoice.invoiceNumber === "HRB-DEMO-F-2026-000001",
    invoice.invoiceNumber,
  );
  check(
    "invoice total",
    invoice.totalAmount === 3000,
    formatFcfa(invoice.totalAmount),
  );

  const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
    amount: invoice.totalAmount,
    method: "cash",
  });
  check(
    "receipt number",
    payment.receiptNumber === "HRB-DEMO-R-2026-000001",
    payment.receiptNumber,
  );
  await recordReceiptPrint(cashier.actor, cashier.ctx, payment.id);

  const full = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
  const sumItems = full!.items.reduce((s, i) => s + i.lineTotal, 0);
  const { paid, remaining } = invoiceBalance(full!);
  check(
    "reconciliation (total = items = payment = 3 000, paid)",
    full!.totalAmount === 3000 &&
      sumItems === 3000 &&
      paid === 3000 &&
      remaining === 0 &&
      full!.status === "paid",
  );

  // RBAC: reception blocked from recording a payment, server-side
  let blocked = false;
  try {
    await recordPayment(reception.actor, reception.ctx, invoice.id, {
      amount: 1,
      method: "cash",
    });
  } catch (e) {
    blocked = e instanceof AuthorizationError;
  }
  check("RBAC block (reception cannot encaisser)", blocked);

  // Dashboard reflects the actions
  const director = await login("emmanuel.tchoua@hrb-demo.cm");
  const dash = await getDashboardSummary(director.actor, director.ctx);
  check(
    "dashboard KPIs (1 / 1 / 3 000 FCFA)",
    dash.patientsToday === 1 &&
      dash.openEncounters === 1 &&
      dash.collectionsToday === 3000,
    `${dash.patientsToday} / ${dash.openEncounters} / ${formatFcfa(dash.collectionsToday)}`,
  );

  // Audit chain present
  const audit = await listAuditEntries(director.actor, director.ctx, {});
  const actions = audit.map((a) => a.action);
  const required = [
    "patient.create",
    "encounter.create",
    "consultation.create",
    "invoice.create",
    "payment.record",
    "receipt.print",
    "authz.denied",
  ];
  check(
    "audit chain present (who/what/when)",
    required.every((a) => actions.includes(a)),
    `${audit.length} entries`,
  );

  console.log(
    failures === 0
      ? "\n✓ GOLDEN PATH PASSED — all acceptance-critical outcomes verified."
      : `\n✗ GOLDEN PATH FAILED — ${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
