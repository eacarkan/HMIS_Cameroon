import "dotenv/config";

import { forceGuardError, syntheticContact } from "@/lib/demo-seed-safety";
import { seedDemoFinance } from "./seed-demo-finance";

/**
 * Phase 6.3 · S1 — synthetic, date-relative demo seed (additive; sentinel-based idempotency).
 *
 * Builds a modest synthetic caseload for the flagship demo hospital (HRB-DEMO) through the
 * SERVICE layer (correct numbering / audit / financial integrity), then backdates the KPI date
 * fields across the last ~30 days plus today so the executive dashboard and charts are populated,
 * and upserts one aggregate snapshot per hospital so `/central` shows all 8 regional hospitals.
 *
 * Safety / rules:
 *  - 100% SYNTHETIC (fictional names, `@hrb-demo.cm` actors, `DEMO-CONTACT-…` placeholder
 *    contacts — never a real-looking phone number). No real patient data.
 *  - ADDITIVE only — never deletes or rewrites pre-existing rows.
 *  - SENTINEL-BASED (single-success) IDEMPOTENCY — a `Setting` sentinel (`demo.seed.phase63`) is
 *    written LAST, so after ONE completed successful run a re-run is a safe no-op. This is NOT
 *    strict row-level idempotency: a partial failure BEFORE the sentinel is written can leave
 *    partial data, so a re-run would then top it up rather than no-op. On a failed run, do not
 *    re-run blindly — inspect the sanitized before/after counts first (operator review).
 *  - Actor is built directly from the DB (no password) so it works on the demo/Neon database
 *    regardless of the local `HMIS_DEMO_SHARED_PASSWORD` value.
 *  - Snapshots are aggregate-only synthetic numbers (no patient-level data), consistent with the
 *    central view's privacy invariant.
 *
 * Usage:
 *   npm run db:seed:demo               # targets DATABASE_URL (the demo/Neon database) — run ONCE
 *   npm run db:seed:demo -- --test     # targets TEST_DATABASE_URL (must contain "test")
 *   npm run db:seed:demo -- --test --force   # TEST ONLY: bypass the sentinel to re-add data
 *   # `--force` WITHOUT `--test` is refused (see the guard below) so it can never touch Neon.
 */

const ARGV = process.argv.slice(2);
const USE_TEST = ARGV.includes("--test");
const FORCE = ARGV.includes("--force");

// Safety gate (Phase 6.3 S1A): `--force` is TEST-ONLY. Refuse it on the default target BEFORE any
// database work (no connection, no import of the client) so it can never duplicate data on Neon.
const guardError = forceGuardError(FORCE, USE_TEST);
if (guardError) {
  console.error(guardError);
  process.exit(1);
}

if (USE_TEST) {
  const testUrl = process.env.TEST_DATABASE_URL;
  const dbName = (testUrl?.split("/").pop() ?? "").split("?")[0];
  if (!testUrl || !/test/i.test(dbName)) {
    console.error(`--test requires TEST_DATABASE_URL whose db name contains "test" (got "${dbName}").`);
    process.exit(1);
  }
  process.env.DATABASE_URL = testUrl; // dotenv already loaded; override for this process only
}

const SENTINEL_KEY = "demo.seed.phase63";
const SENTINEL_VALUE = "v1";
const HRB = "hosp-hrb-demo";
const DAYS_BACK = 30;

// Synthetic, fictional Cameroonian-style identities (no real persons).
const FAMILY = ["NGUEMA", "ONANA", "MBALLA", "FOUDA", "ATANGANA", "BIYA", "ESSOMBA", "OWONA",
  "MANGA", "NKODO", "ABEGA", "MVONDO", "NDONGO", "TCHAMBA", "KAMGA", "DJOMO", "NANA", "TALLA",
  "MOUKOURI", "EYENGA"];
const GIVEN = ["Aïcha", "Bertrand", "Clarisse", "Didier", "Estelle", "Franck", "Ghislaine",
  "Hervé", "Ines", "Junior", "Karelle", "Landry", "Mireille", "Narcisse", "Odile", "Patrick",
  "Rachelle", "Serge", "Tania", "Ulrich"];
const RESIDENCES = ["Bertoua — Nkolbikon", "Bertoua — Madagascar", "Bertoua — Tigaza",
  "Bertoua — Mokolo 2", "Bertoua — Haoussa"];
const METHODS = ["cash", "mobile_money", "card", "bank_transfer"] as const;
const REASONS = ["Fièvre depuis 48 heures", "Céphalées et fatigue", "Toux persistante",
  "Douleurs abdominales", "Contrôle de routine", "Suivi de grossesse", "Paludisme suspecté",
  "Hypertension — suivi"];

// Canonical ICD-10 entries for the central snapshots (no free text / no patient identifiers).
const CANON_DX = [
  { code: "B54", label: "Paludisme, sans précision" },
  { code: "J06.9", label: "Infection aiguë des voies respiratoires supérieures" },
  { code: "A09", label: "Diarrhée et gastro-entérite d'origine présumée infectieuse" },
  { code: "I10", label: "Hypertension essentielle (primitive)" },
  { code: "O26.9", label: "Affection liée à la grossesse, sans précision" },
];

// The 8 regional hospitals (id + code + region) — for the central snapshots.
const HOSPITALS = [
  { id: "hosp-hrb-demo", code: "HRB-DEMO", weight: 100 },
  { id: "hosp-hre-ebo", code: "HRE-EBO", weight: 62 },
  { id: "hosp-hrb-baf", code: "HRB-BAF", weight: 74 },
  { id: "hosp-hrb-bam", code: "HRB-BAM", weight: 58 },
  { id: "hosp-hrb-bue", code: "HRB-BUE", weight: 49 },
  { id: "hosp-hrg-gar", code: "HRG-GAR", weight: 66 },
  { id: "hosp-hrm-mar", code: "HRM-MAR", weight: 71 },
  { id: "hosp-hrn-nga", code: "HRN-NGA", weight: 53 },
];

function dayDate(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function frMonthLabel(d: Date): string {
  const m = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre"][d.getMonth()];
  return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
}

async function main() {
  const { prisma } = await import("@/server/db");
  const { findUserByEmailWithRoles } = await import("@/server/db");
  const {
    createPatientForActor, openEncounter, recordConsultation, createInvoice, recordPayment,
    recordReceiptPrint, selectHospital, receiveStockBatch, requestDiagnostic,
  } = await import("@/server/services");
  type Actor = Awaited<ReturnType<typeof import("@/server/services").authenticateCredentials>>;

  const target = USE_TEST ? "TEST_DATABASE_URL" : "DATABASE_URL (demo/Neon)";
  console.log(`▶ demo seed target: ${target}`);

  // Idempotency guard. The sentinel is stored under HRB (avoids the null-compound-unique gotcha).
  const existing = await prisma.setting.findUnique({
    where: { hospitalId_key: { hospitalId: HRB, key: SENTINEL_KEY } },
  }).catch(() => null);
  if (existing && !FORCE) {
    console.log(`✓ demo data already seeded (sentinel ${SENTINEL_KEY}=${existing.value}); no-op. To re-add on the TEST DB only, use: npm run db:seed:demo -- --test --force`);
    await prisma.$disconnect();
    return;
  }

  // Build password-free actors straight from the DB (mirrors auth-service's actor shape).
  async function actorFor(email: string): Promise<NonNullable<Actor>> {
    const user = await findUserByEmailWithRoles(email);
    if (!user || user.status !== "active") throw new Error(`seed actor unavailable: ${email}`);
    const rolesByHospital: Record<string, string[]> = {};
    for (const ur of user.userRoles) {
      (rolesByHospital[ur.hospitalId] ??= []).push(ur.role.code);
    }
    const primary = user.userRoles[0];
    return {
      id: user.id, displayName: user.displayName, email: user.email,
      roles: [...new Set(user.userRoles.map((ur) => ur.role.code))],
      rolesByHospital,
      hospitalIds: [...new Set(user.userRoles.map((ur) => ur.hospitalId))],
      hospitalId: primary?.hospitalId ?? null,
      hospitalCode: primary?.hospital.code ?? null,
      hospitalName: primary?.hospital.name ?? null,
    };
  }

  const reception = await actorFor("brigitte.mbarga@hrb-demo.cm");
  const doctor = await actorFor("jeanpaul.etoa@hrb-demo.cm");
  const cashier = await actorFor("solange.abena@hrb-demo.cm");
  const pharmacist = await actorFor("georges.mballa@hrb-demo.cm");
  const admin = await actorFor("awa.njoya@hrb-demo.cm");

  const ctxR = await selectHospital(reception, HRB);
  const ctxD = await selectHospital(doctor, HRB);
  const ctxC = await selectHospital(cashier, HRB);
  const ctxP = await selectHospital(pharmacist, HRB);

  // Valid outpatient consultation service labels (openEncounter validates against these).
  const services = await prisma.serviceUnit.findMany({
    where: { hospitalId: HRB, type: "OUTPATIENT", acceptsConsultation: true, isActive: true },
    select: { name: true },
  });
  const SERVICE_LABELS = services.length ? services.map((s) => s.name) : ["Médecine générale"];

  const before = {
    patients: await prisma.patient.count({ where: { hospitalId: HRB } }),
    encounters: await prisma.encounter.count({ where: { hospitalId: HRB } }),
    invoices: await prisma.invoice.count({ where: { hospitalId: HRB } }),
    payments: await prisma.payment.count({ where: { hospitalId: HRB } }),
    snapshots: await prisma.hospitalAggregateSnapshot.count(),
  };

  let g = 0; // global journey index (drives deterministic variation)
  const counts = { patients: 0, encounters: 0, open: 0, closed: 0, consultations: 0, invoices: 0, payments: 0, diagnostics: 0 };

  // Diagnostic catalogue items (ids by modality) for a few pending requests.
  const dxItems = await prisma.diagnosticCatalogueItem.findMany({
    where: { hospitalId: HRB, isActive: true }, select: { id: true },
  });

  // Pharmacy: a few additive stock batches (synthetic), incl. one expiring within ~90 days.
  // Done BEFORE the journeys so the recent-activity feed surfaces the (newer) clinical/billing
  // actions rather than repeated stock receipts.
  const meds = await prisma.medication.findMany({ where: { hospitalId: HRB, isActive: true }, select: { id: true, code: true } });
  const stockPlan: Record<string, { qty: number; expDays: number }> = {
    "MED-PARA-500": { qty: 600, expDays: 400 },
    "MED-AMOX-500": { qty: 250, expDays: 70 }, // expiring soon
    "MED-ACT-2024": { qty: 180, expDays: 500 },
    "MED-IBU-400": { qty: 320, expDays: 300 },
  };
  let stockBatches = 0;
  for (const m of meds) {
    const plan = stockPlan[m.code];
    if (!plan) continue;
    const exp = new Date(); exp.setDate(exp.getDate() + plan.expDays);
    try {
      await receiveStockBatch(pharmacist, ctxP, {
        medicationId: m.id, batchNumber: `LOT-${m.code}-D63`,
        expiryDate: exp.toISOString().slice(0, 10), quantity: plan.qty,
      });
      stockBatches++;
    } catch { /* skip if a same batch already exists */ }
  }

  for (let d = DAYS_BACK; d >= 0; d--) {
    const n = d === 0 ? 8 : 2 + ((d * 3 + 1) % 4); // today busier; past days 2–5
    for (let j = 0; j < n; j++, g++) {
      const when = dayDate(d, 8 + (j % 8), (g * 7) % 60);
      const family = FAMILY[g % FAMILY.length];
      const given = GIVEN[(g * 3) % GIVEN.length];
      const sex = (g % 2 === 0 ? "female" : "male") as "female" | "male";
      const dob = new Date(1960 + (g % 50), (g * 5) % 12, 1 + (g % 27));

      const patient = await createPatientForActor(reception, ctxR, {
        familyName: family, givenName: given, sex,
        dateOfBirth: dob,
        // Clearly-synthetic placeholder — never a real-looking phone number (Phase 6.3 S1A).
        phone: syntheticContact(g),
        residence: RESIDENCES[g % RESIDENCES.length],
      });
      await prisma.patient.update({ where: { id: patient.id }, data: { createdAt: when } });
      counts.patients++;

      const encounter = await openEncounter(reception, ctxR, patient.id, {
        serviceLabel: SERVICE_LABELS[g % SERVICE_LABELS.length],
        reason: REASONS[g % REASONS.length],
      });
      counts.encounters++;

      const hasConsult = g % 10 < 7;
      const hasInvoice = g % 10 < 6;
      const leaveOpen = g % 5 === 0; // ~20% stay open

      if (hasConsult) {
        const c = await recordConsultation(doctor, ctxD, encounter.id, {
          reason: REASONS[g % REASONS.length],
          clinicalNote: "État général conservé ; examen clinique sans particularité notable.",
          vitals: `Température ${(36 + (g % 3)).toString()},${(g % 9)} °C · TA 12${g % 3}/8${g % 2} · Pouls ${70 + (g % 20)}/min`,
          provisionalDiagnosis: CANON_DX[g % CANON_DX.length].label,
          recommendation: "Traitement symptomatique ; réévaluation si persistance.",
        });
        await prisma.consultation.update({ where: { id: c.id }, data: { createdAt: when } });
        counts.consultations++;
      }

      if (hasInvoice) {
        const lines = [
          { label: "Consultation médecine générale", unitAmount: 2000, quantity: 1 },
          { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
        ];
        if (g % 3 === 0) lines.push({ label: "Acte de soins", unitAmount: 1500 + 500 * (g % 4), quantity: 1 });
        const invoice = await createInvoice(cashier, ctxC, encounter.id, lines);
        await prisma.invoice.update({ where: { id: invoice.id }, data: { createdAt: when } });
        counts.invoices++;

        const payment = await recordPayment(cashier, ctxC, invoice.id, {
          amount: invoice.totalAmount, method: METHODS[g % METHODS.length],
        });
        await prisma.payment.update({ where: { id: payment.id }, data: { paidAt: when, createdAt: when } });
        counts.payments++;
        if (g % 2 === 0) await recordReceiptPrint(cashier, ctxC, payment.id);
      }

      // Backdate the visit; close a completed journey, otherwise leave it open.
      if (hasConsult && !leaveOpen) {
        await prisma.encounter.update({
          where: { id: encounter.id },
          data: { openedAt: when, status: "closed", closedAt: when },
        });
        counts.closed++;
      } else {
        await prisma.encounter.update({ where: { id: encounter.id }, data: { openedAt: when } });
        counts.open++;
      }

      // A few pending diagnostic requests for the diagnostics card.
      if (dxItems.length && g % 6 === 0) {
        try {
          const item = dxItems[g % dxItems.length];
          const order = await requestDiagnostic(doctor, ctxD, { encounterId: encounter.id, catalogueItemId: item.id });
          await prisma.diagnosticOrder.update({ where: { id: order.id }, data: { createdAt: when } }).catch(() => {});
          counts.diagnostics++;
        } catch { /* skip if the role lacks the cap or the item is ineligible */ }
      }
    }
  }

  // Central snapshots: one aggregate-only synthetic snapshot per hospital for the current period.
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodLabel = frMonthLabel(now);
  let snapshots = 0;
  for (const h of HOSPITALS) {
    const w = h.weight;
    const revenue = 1000 * (350 + w * 12);
    const indicators = {
      period, periodLabel,
      consultationCount: 40 + Math.round(w * 1.8),
      patientCount: 60 + Math.round(w * 2.4),
      queueTicketCount: 20 + Math.round(w * 0.9),
      admissionCount: 5 + Math.round(w * 0.25),
      diagnosticOrderCount: 12 + Math.round(w * 0.7),
      revenueTotalFcfa: revenue,
      revenueByMethod: [
        { method: "cash", amount: Math.round(revenue * 0.55) },
        { method: "mobile_money", amount: Math.round(revenue * 0.3) },
        { method: "card", amount: Math.round(revenue * 0.1) },
        { method: "bank_transfer", amount: Math.round(revenue * 0.05) },
      ],
      topDiagnoses: CANON_DX.slice(0, 3).map((dx, i) => ({ code: dx.code, label: dx.label, count: 18 - i * 4 + (w % 5) })),
      emergencyDebtOutstandingFcfa: 1000 * (w % 40),
      pharmacy: { medicationsTracked: 6, lowStock: (w % 3) + 1, expiringLots: (w % 2) + 1 },
    };
    await prisma.hospitalAggregateSnapshot.upsert({
      where: { hospitalId_period: { hospitalId: h.id, period } },
      create: { hospitalId: h.id, period, indicators, generatedById: admin.id },
      update: { indicators, generatedById: admin.id },
    });
    snapshots++;
  }

  // Phase 6.6 — synthetic ARREARS across the receivables-aging buckets (0–30 / 31–60 / 61–90 / 90+):
  // a few backdated invoices left unpaid or partially paid through the CONTROLLED billing path
  // (createInvoice → recordPayment). This seeds outstanding receivables for the later aging view without
  // ever touching an existing paid invoice. Partial payments stay strictly below the invoice total.
  const arrearsPlan = [
    { daysAgo: 12, pay: 0 },    // bucket 0–30, unpaid (issued)
    { daysAgo: 40, pay: 0.5 },  // bucket 31–60, partially paid
    { daysAgo: 47, pay: 0 },    // bucket 31–60, unpaid
    { daysAgo: 75, pay: 0.4 },  // bucket 61–90, partially paid
    { daysAgo: 118, pay: 0 },   // bucket 90+, unpaid
    { daysAgo: 133, pay: 0.3 }, // bucket 90+, partially paid
  ];
  let arrears = 0;
  for (let a = 0; a < arrearsPlan.length; a++, g++) {
    const plan = arrearsPlan[a];
    const when = dayDate(plan.daysAgo, 10, (a * 11) % 60);
    const patient = await createPatientForActor(reception, ctxR, {
      familyName: FAMILY[(g + 5) % FAMILY.length], givenName: GIVEN[(g + 7) % GIVEN.length],
      sex: (a % 2 === 0 ? "male" : "female") as "male" | "female",
      dateOfBirth: new Date(1955 + (g % 55), (g * 7) % 12, 1 + (g % 26)),
      phone: syntheticContact(g), residence: RESIDENCES[g % RESIDENCES.length],
    });
    await prisma.patient.update({ where: { id: patient.id }, data: { createdAt: when } });
    const encounter = await openEncounter(reception, ctxR, patient.id, {
      serviceLabel: SERVICE_LABELS[g % SERVICE_LABELS.length], reason: REASONS[g % REASONS.length],
    });
    const invoice = await createInvoice(cashier, ctxC, encounter.id, [
      { label: "Consultation médecine générale", unitAmount: 2000, quantity: 1 },
      { label: "Acte de soins", unitAmount: 3000 + 500 * (a % 4), quantity: 1 },
    ]);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { createdAt: when } });
    if (plan.pay > 0) {
      const amount = Math.min(
        invoice.totalAmount - 500,
        Math.max(500, Math.round((invoice.totalAmount * plan.pay) / 500) * 500),
      );
      const payment = await recordPayment(cashier, ctxC, invoice.id, { amount, method: "cash" });
      await prisma.payment.update({ where: { id: payment.id }, data: { paidAt: when, createdAt: when } });
    }
    await prisma.encounter.update({ where: { id: encounter.id }, data: { openedAt: when } });
    arrears++;
  }

  // Phase 6.6 — synthetic FINANCE overlay (MoMo snapshots + deposit slips + bank statement + one match).
  // Pure metadata over the recorded payments above — never an Invoice/Payment money mutation.
  const finance = await seedDemoFinance(prisma, { hospitalId: HRB, hospitalCode: ctxC.code, force: FORCE });

  // Sentinel written LAST (single-success idempotency): after a completed run a re-run no-ops;
  // a partial failure before this point leaves partial data → operator review, not a blind re-run.
  await prisma.setting.upsert({
    where: { hospitalId_key: { hospitalId: HRB, key: SENTINEL_KEY } },
    create: { hospitalId: HRB, key: SENTINEL_KEY, value: SENTINEL_VALUE },
    update: { value: SENTINEL_VALUE, deletedAt: null },
  });

  const after = {
    patients: await prisma.patient.count({ where: { hospitalId: HRB } }),
    encounters: await prisma.encounter.count({ where: { hospitalId: HRB } }),
    invoices: await prisma.invoice.count({ where: { hospitalId: HRB } }),
    payments: await prisma.payment.count({ where: { hospitalId: HRB } }),
    snapshots: await prisma.hospitalAggregateSnapshot.count(),
  };

  console.log("✓ demo seed complete (synthetic, additive). Created (HRB-DEMO):");
  console.log(`  journeys: patients=${counts.patients} encounters=${counts.encounters} (open=${counts.open} closed=${counts.closed})`);
  console.log(`  consultations=${counts.consultations} invoices=${counts.invoices} payments=${counts.payments} diagnostics=${counts.diagnostics} stockBatches=${stockBatches} snapshots=${snapshots}`);
  console.log(`  arrears (backdated outstanding invoices across aging buckets)=${arrears}`);
  console.log(`  finance overlay: momoBackfilled=${finance.momoBackfilled} depositSlips=${finance.slips} slipPayments=${finance.slipPayments} bankLines=${finance.bankLines} matches=${finance.matches}${finance.skipped ? " (skipped — already seeded)" : ""}`);
  console.log("  HRB-DEMO row counts before → after:");
  console.log(`    patients   ${before.patients} → ${after.patients}`);
  console.log(`    encounters ${before.encounters} → ${after.encounters}`);
  console.log(`    invoices   ${before.invoices} → ${after.invoices}`);
  console.log(`    payments   ${before.payments} → ${after.payments}`);
  console.log(`    snapshots  ${before.snapshots} → ${after.snapshots} (all hospitals)`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("✗ demo seed failed:", error);
  process.exitCode = 1;
});
