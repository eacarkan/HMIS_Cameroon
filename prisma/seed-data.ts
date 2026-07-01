import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

import { getDemoSharedPassword } from "@/lib/demo-password";

/**
 * Deterministic fake demo base data (Step 3 — 07_Demo_Scenario, A-002/A-003).
 *
 * Establishes the KNOWN STARTING STATE: one active demo hospital (HRB-DEMO) plus
 * seven inactive regional hospitals (to populate the selector), five fictional
 * users/roles scoped to HRB-DEMO, and zeroed per-hospital numbering sequences for
 * 2026. No patient/encounter/invoice/consultation/payment — those are created live
 * during the demo (Steps 6-9). Fake data only — no real patient data.
 */

/** Year used for the demo numbering sequences (matches the 27/06/2026 scenario). */
export const SEQUENCE_YEAR = 2026;

// The shared demo password is env-controlled (Phase 6.1): every seeded user is hashed from
// `getDemoSharedPassword()` (HMIS_DEMO_SHARED_PASSWORD). No committed password literal.

/** The active demo hospital code (mirrors lib/constants DEMO_HOSPITAL). */
export const DEMO_HOSPITAL_ID = "hosp-hrb-demo";

/** Phase 3A — the second-site hospital (Ebolowa) prepared from the Bertoua reference template. */
export const SECOND_SITE_HOSPITAL_ID = "hosp-hre-ebo";

/** Phase 3A — the Bertoua reference configuration template code (a snapshot, not a global default). */
export const REFERENCE_TEMPLATE_CODE = "TPL-BERTOUA-REF";

type HospitalSeed = {
  id: string;
  code: string;
  name: string;
  city: string;
  region: string;
  isActive: boolean;
  isDemo: boolean;
};

// One active demo hospital + seven inactive (realistic Cameroonian regional
// hospitals — fake/inactive, shown only to populate the selector).
export const HOSPITALS: HospitalSeed[] = [
  {
    id: DEMO_HOSPITAL_ID,
    code: "HRB-DEMO",
    name: "Hôpital Régional de Bertoua — Démo",
    city: "Bertoua",
    region: "Est",
    isActive: true,
    isDemo: true,
  },
  {
    id: "hosp-hrn-nga",
    code: "HRN-NGA",
    name: "Hôpital Régional de Ngaoundéré",
    city: "Ngaoundéré",
    region: "Adamaoua",
    isActive: false,
    isDemo: false,
  },
  {
    id: "hosp-hrg-gar",
    code: "HRG-GAR",
    name: "Hôpital Régional de Garoua",
    city: "Garoua",
    region: "Nord",
    isActive: false,
    isDemo: false,
  },
  {
    id: "hosp-hrm-mar",
    code: "HRM-MAR",
    name: "Hôpital Régional de Maroua",
    city: "Maroua",
    region: "Extrême-Nord",
    isActive: false,
    isDemo: false,
  },
  {
    id: "hosp-hrb-bam",
    code: "HRB-BAM",
    name: "Hôpital Régional de Bamenda",
    city: "Bamenda",
    region: "Nord-Ouest",
    isActive: false,
    isDemo: false,
  },
  {
    id: "hosp-hrb-baf",
    code: "HRB-BAF",
    name: "Hôpital Régional de Bafoussam",
    city: "Bafoussam",
    region: "Ouest",
    isActive: false,
    isDemo: false,
  },
  {
    id: "hosp-hrb-bue",
    code: "HRB-BUE",
    name: "Hôpital Régional de Buéa",
    city: "Buéa",
    region: "Sud-Ouest",
    isActive: false,
    isDemo: false,
  },
  {
    id: "hosp-hre-ebo",
    code: "HRE-EBO",
    name: "Hôpital Régional d'Ebolowa",
    city: "Ebolowa",
    region: "Sud",
    isActive: false,
    isDemo: false,
  },
];

type RoleSeed = { id: string; code: string; name: string };

// Coarse roles (05 §4) — codes match server/authz Role union.
export const ROLES: RoleSeed[] = [
  { id: "role-administrateur", code: "administrateur", name: "Administrateur" },
  { id: "role-agent-accueil", code: "agent_accueil", name: "Agent d'accueil" },
  { id: "role-medecin", code: "medecin", name: "Médecin" },
  { id: "role-caissier", code: "caissier", name: "Caissier" },
  {
    id: "role-directeur",
    code: "directeur",
    name: "Directeur (lecture seule)",
  },
  // Phase 2D — pharmacy roles.
  { id: "role-pharmacien", code: "pharmacien", name: "Pharmacien" },
  { id: "role-pharmacien-chef", code: "pharmacien_chef", name: "Pharmacien responsable" },
  // Phase 2I — diagnostics roles (enter ≠ validate).
  { id: "role-technicien-diagnostic", code: "technicien_diagnostic", name: "Technicien de laboratoire / imagerie" },
  { id: "role-validateur-diagnostic", code: "validateur_diagnostic", name: "Validateur (biologiste / radiologue)" },
  // Phase 3B — central oversight role (aggregate-only, cross-hospital, read-only).
  { id: "role-superviseur-central", code: "superviseur_central", name: "Superviseur central (agrégats)" },
];

type UserSeed = {
  id: string;
  displayName: string;
  email: string;
  roleCode: string;
};

// Five fictional users, all scoped to HRB-DEMO (07_Demo_Scenario §4).
export const USERS: UserSeed[] = [
  {
    id: "user-awa-njoya",
    displayName: "Awa NJOYA",
    email: "awa.njoya@hrb-demo.cm",
    roleCode: "administrateur",
  },
  {
    id: "user-brigitte-mbarga",
    displayName: "Brigitte MBARGA",
    email: "brigitte.mbarga@hrb-demo.cm",
    roleCode: "agent_accueil",
  },
  {
    id: "user-jean-paul-etoa",
    displayName: "Dr Jean-Paul ETOA",
    email: "jeanpaul.etoa@hrb-demo.cm",
    roleCode: "medecin",
  },
  {
    id: "user-solange-abena",
    displayName: "Solange ABENA",
    email: "solange.abena@hrb-demo.cm",
    roleCode: "caissier",
  },
  {
    id: "user-emmanuel-tchoua",
    displayName: "Dr Emmanuel TCHOUA",
    email: "emmanuel.tchoua@hrb-demo.cm",
    roleCode: "directeur",
  },
  // Phase 2D — pharmacy demo users (dual validation: pharmacien requests, pharmacien_chef approves).
  {
    id: "user-georges-mballa",
    displayName: "Georges MBALLA",
    email: "georges.mballa@hrb-demo.cm",
    roleCode: "pharmacien",
  },
  {
    id: "user-claire-fotso",
    displayName: "Claire FOTSO",
    email: "claire.fotso@hrb-demo.cm",
    roleCode: "pharmacien_chef",
  },
  // Phase 2I — diagnostics demo users (the technician enters results; the validator validates them).
  {
    id: "user-paul-ngono",
    displayName: "Paul NGONO",
    email: "paul.ngono@hrb-demo.cm",
    roleCode: "technicien_diagnostic",
  },
  {
    id: "user-marie-eyenga",
    displayName: "Dr Marie EYENGA",
    email: "marie.eyenga@hrb-demo.cm",
    roleCode: "validateur_diagnostic",
  },
  // Phase 3B — central supervisor demo user (aggregate-only oversight; no hospital operational caps).
  // Synthetic; uses the fake demo domain. Membership at HRB-DEMO is only so the account can sign in.
  {
    id: "user-direction-regionale",
    displayName: "Direction Régionale",
    email: "direction.regionale@hrb-demo.cm",
    roleCode: "superviseur_central",
  },
];

const SEQUENCE_TYPES = ["patient", "encounter", "invoice", "receipt"] as const;

/**
 * Idempotently upsert the base demo data. Safe to run repeatedly; existing sequence
 * counters are NOT reset here (use clearOperationalData for that).
 */
export async function seedBaseData(prisma: PrismaClient): Promise<void> {
  for (const h of HOSPITALS) {
    await prisma.hospital.upsert({ where: { id: h.id }, create: h, update: h });
  }

  for (const r of ROLES) {
    await prisma.role.upsert({ where: { id: r.id }, create: r, update: r });
  }

  const passwordHash = bcrypt.hashSync(getDemoSharedPassword(), 10);
  const roleByCode = new Map(ROLES.map((r) => [r.code, r]));

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        passwordHash,
      },
      // Restore the demo password + active status on reseed so tests that change a
      // password (Phase 1A Batch 4) stay isolated. Also clear the Phase 5.1 (F-02) lockout state so a
      // reseed returns every demo account to a clean, unlocked baseline. Fake demo password only.
      update: {
        displayName: u.displayName,
        email: u.email,
        passwordHash,
        status: "active",
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
        lastSuccessfulLoginAt: null,
      },
    });

    const role = roleByCode.get(u.roleCode);
    if (!role) throw new Error(`Unknown role code in seed: ${u.roleCode}`);

    await prisma.userRole.upsert({
      where: {
        userId_roleId_hospitalId: {
          userId: u.id,
          roleId: role.id,
          hospitalId: DEMO_HOSPITAL_ID,
        },
      },
      create: { userId: u.id, roleId: role.id, hospitalId: DEMO_HOSPITAL_ID },
      update: {},
    });
  }

  // Zeroed numbering sequences for the demo hospital (counters advance live later).
  for (const type of SEQUENCE_TYPES) {
    await prisma.sequence.upsert({
      where: {
        hospitalId_type_year: {
          hospitalId: DEMO_HOSPITAL_ID,
          type,
          year: SEQUENCE_YEAR,
        },
      },
      create: {
        hospitalId: DEMO_HOSPITAL_ID,
        type,
        year: SEQUENCE_YEAR,
        current: 0,
      },
      update: {},
    });
  }

  await seedConfigAndTariffs(prisma);
  await seedDiagnosisCodes(prisma);
  await seedMedications(prisma);
  await seedStock(prisma);
  await seedDiagnosticCatalogue(prisma);
  await seedSecondSiteAndReferenceTemplate(prisma);
}

/**
 * Phase 3A — multi-hospital configuration foundation seed (synthetic). Prepares Ebolowa as a
 * SECOND SITE (admin membership + numbering + minimal identity setting, but NO departments/services/
 * tariffs yet — so its completeness starts low), and snapshots Bertoua's live configuration into the
 * shared reference TEMPLATE `TPL-BERTOUA-REF`. Applying that template to Ebolowa later (a guarded,
 * scoped operation) raises Ebolowa's completeness without any code change. Idempotent.
 *
 * The reference template carries STRUCTURE only (departments, services + flags, hospital-agnostic
 * settings, document headers) — never hospital identity (name/city stays per-instance) and never any
 * patient/transaction data.
 */
async function seedSecondSiteAndReferenceTemplate(prisma: PrismaClient): Promise<void> {
  // 1) The existing Hospital Admin (Awa NJOYA) also administers the Ebolowa second site, so she can
  //    configure it. Other demo users remain single-site (Bertoua), preserving cross-hospital denial.
  const adminRole = ROLES.find((r) => r.code === "administrateur");
  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_hospitalId: {
          userId: "user-awa-njoya",
          roleId: adminRole.id,
          hospitalId: SECOND_SITE_HOSPITAL_ID,
        },
      },
      create: { userId: "user-awa-njoya", roleId: adminRole.id, hospitalId: SECOND_SITE_HOSPITAL_ID },
      update: {},
    });
  }

  // 2) Ebolowa baseline infrastructure: numbering sequences + a default language. Departments/services/
  //    tariffs/medications are intentionally absent until the template is applied.
  for (const type of SEQUENCE_TYPES) {
    await prisma.sequence.upsert({
      where: { hospitalId_type_year: { hospitalId: SECOND_SITE_HOSPITAL_ID, type, year: SEQUENCE_YEAR } },
      create: { hospitalId: SECOND_SITE_HOSPITAL_ID, type, year: SEQUENCE_YEAR, current: 0 },
      update: {},
    });
  }
  await prisma.setting.upsert({
    where: { hospitalId_key: { hospitalId: SECOND_SITE_HOSPITAL_ID, key: "locale.default" } },
    create: { hospitalId: SECOND_SITE_HOSPITAL_ID, key: "locale.default", value: "fr" },
    update: {},
  });

  // 3) Snapshot Bertoua's live config into the shared reference template (structure only).
  const [departments, services, settingsRows, documentTemplates] = await Promise.all([
    prisma.department.findMany({ where: { hospitalId: DEMO_HOSPITAL_ID, deletedAt: null }, orderBy: { code: "asc" } }),
    prisma.serviceUnit.findMany({ where: { hospitalId: DEMO_HOSPITAL_ID, deletedAt: null }, orderBy: { displayOrder: "asc" } }),
    prisma.setting.findMany({ where: { hospitalId: DEMO_HOSPITAL_ID, deletedAt: null }, orderBy: { key: "asc" } }),
    prisma.documentTemplate.findMany({ where: { hospitalId: DEMO_HOSPITAL_ID, deletedAt: null }, orderBy: { type: "asc" } }),
  ]);
  const deptCodeById = new Map(departments.map((d) => [d.id, d.code]));
  const content = {
    departments: departments.map((d) => ({ code: d.code, name: d.name })),
    services: services.map((s) => ({
      code: s.code,
      nameFr: s.nameFr ?? s.name,
      nameEn: s.nameEn ?? null,
      type: s.type,
      displayOrder: s.displayOrder,
      departmentCode: s.departmentId ? (deptCodeById.get(s.departmentId) ?? null) : null,
      kind: s.kind ?? null,
      acceptsQueue: s.acceptsQueue,
      acceptsConsultation: s.acceptsConsultation,
      supportsBilling: s.supportsBilling,
      supportsPharmacy: s.supportsPharmacy,
      supportsLab: s.supportsLab,
      supportsImaging: s.supportsImaging,
      isInpatientWard: s.isInpatientWard,
      isEmergency: s.isEmergency,
    })),
    // Identity settings never travel in a shared template; none exist here, but filter defensively.
    settings: settingsRows
      .filter((s) => !s.key.startsWith("hospital.") && !s.key.startsWith("identity."))
      .map((s) => ({ key: s.key, value: s.value })),
    // Carry only the GENERIC document structure (type, name, national header) — NOT the body,
    // which holds hospital identity (e.g. "Hôpital Régional de Bertoua — Démo"). Templating the
    // body would leak Bertoua's identity into every hospital the template is applied to; the body
    // stays per-instance (each hospital sets its own).
    documentTemplates: documentTemplates.map((d) => ({
      type: d.type,
      name: d.name,
      header: d.header ?? null,
      body: null,
    })),
  };

  const existing = await prisma.configurationTemplate.findUnique({ where: { code: REFERENCE_TEMPLATE_CODE } });
  if (existing) {
    await prisma.configurationTemplate.update({
      where: { code: REFERENCE_TEMPLATE_CODE },
      data: {
        name: "Modèle de référence — Bertoua",
        description: "Configuration de référence (structure) capturée depuis l'Hôpital Régional de Bertoua. Identité par hôpital ; aucune donnée patient.",
        sourceHospitalId: DEMO_HOSPITAL_ID,
        content,
      },
    });
  } else {
    await prisma.configurationTemplate.create({
      data: {
        code: REFERENCE_TEMPLATE_CODE,
        name: "Modèle de référence — Bertoua",
        description: "Configuration de référence (structure) capturée depuis l'Hôpital Régional de Bertoua. Identité par hôpital ; aucune donnée patient.",
        version: 1,
        sourceHospitalId: DEMO_HOSPITAL_ID,
        content,
      },
    });
  }
}

/** Phase 2I — seed a small SYNTHETIC lab/radiology catalogue for HRB-DEMO (idempotent upsert). */
async function seedDiagnosticCatalogue(prisma: PrismaClient): Promise<void> {
  const items: {
    code: string;
    nameFr: string;
    nameEn: string;
    modality: "lab" | "radiology";
    price: number;
  }[] = [
    { code: "LAB-NFS", nameFr: "Numération formule sanguine (NFS)", nameEn: "Complete blood count", modality: "lab", price: 3500 },
    { code: "LAB-GE", nameFr: "Goutte épaisse (paludisme)", nameEn: "Thick smear (malaria)", modality: "lab", price: 1500 },
    { code: "LAB-GLY", nameFr: "Glycémie à jeun", nameEn: "Fasting blood glucose", modality: "lab", price: 2000 },
    { code: "LAB-CREAT", nameFr: "Créatininémie", nameEn: "Serum creatinine", modality: "lab", price: 2500 },
    { code: "RAD-THORAX", nameFr: "Radiographie du thorax", nameEn: "Chest X-ray", modality: "radiology", price: 8000 },
    { code: "RAD-ECHO-ABDO", nameFr: "Échographie abdominale", nameEn: "Abdominal ultrasound", modality: "radiology", price: 12000 },
  ];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await prisma.diagnosticCatalogueItem.upsert({
      where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: it.code } },
      create: { hospitalId: DEMO_HOSPITAL_ID, ...it, displayOrder: i + 1 },
      update: { nameFr: it.nameFr, nameEn: it.nameEn, modality: it.modality, price: it.price },
    });
  }
}

/**
 * Phase 2D-3 — seed a small SYNTHETIC stock ledger for HRB-DEMO (idempotent: skips if any batch
 * already exists). Fixed future expiry dates; integer quantities. Paracétamol has two lots so FEFO
 * (2D-6) has an earliest-expiry choice. Fictional only.
 */
async function seedStock(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.medicationStockBatch.count({ where: { hospitalId: DEMO_HOSPITAL_ID } });
  if (existing > 0) return;
  const batches = [
    { code: "MED-PARA-500", batchNumber: "LOT-PARA-B", expiry: "2026-12-31", qty: 200 },
    { code: "MED-PARA-500", batchNumber: "LOT-PARA-A", expiry: "2027-06-30", qty: 500 },
    { code: "MED-AMOX-500", batchNumber: "LOT-AMOX-A", expiry: "2027-03-31", qty: 300 },
    { code: "MED-ACT-2024", batchNumber: "LOT-ACT-A", expiry: "2026-09-30", qty: 150 },
  ];
  for (const b of batches) {
    const med = await prisma.medication.findFirst({
      where: { hospitalId: DEMO_HOSPITAL_ID, code: b.code },
    });
    if (!med) continue;
    await prisma.medicationStockBatch.create({
      data: {
        hospitalId: DEMO_HOSPITAL_ID,
        medicationId: med.id,
        batchNumber: b.batchNumber,
        expiryDate: new Date(b.expiry),
        quantityReceived: b.qty,
        quantityOnHand: b.qty,
        quantityReserved: 0,
      },
    });
  }
}

/**
 * Phase 2D-1 — seed a small SYNTHETIC medication catalogue for HRB-DEMO (idempotent upsert).
 * No quantities/prices (stock = 2D-3). Fictional / illustrative only.
 */
async function seedMedications(prisma: PrismaClient): Promise<void> {
  const meds = [
    { code: "MED-PARA-500", nameFr: "Paracétamol", nameEn: "Paracetamol", form: "Comprimé", unit: "comprimé", strength: "500 mg" },
    { code: "MED-AMOX-500", nameFr: "Amoxicilline", nameEn: "Amoxicillin", form: "Gélule", unit: "gélule", strength: "500 mg" },
    { code: "MED-METRO-250", nameFr: "Métronidazole", nameEn: "Metronidazole", form: "Comprimé", unit: "comprimé", strength: "250 mg" },
    { code: "MED-ACT-2024", nameFr: "Artéméther-Luméfantrine (ACT)", nameEn: "Artemether-Lumefantrine (ACT)", form: "Comprimé", unit: "comprimé", strength: "20/120 mg" },
    { code: "MED-IBU-400", nameFr: "Ibuprofène", nameEn: "Ibuprofen", form: "Comprimé", unit: "comprimé", strength: "400 mg" },
    { code: "MED-SRO", nameFr: "Sels de réhydratation orale (SRO)", nameEn: "Oral rehydration salts (ORS)", form: "Suspension", unit: "sachet", strength: null },
  ];
  for (let i = 0; i < meds.length; i++) {
    const m = meds[i];
    await prisma.medication.upsert({
      where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: m.code } },
      create: { hospitalId: DEMO_HOSPITAL_ID, ...m, displayOrder: i + 1 },
      update: { nameFr: m.nameFr, nameEn: m.nameEn, form: m.form, unit: m.unit, strength: m.strength },
    });
  }
}

/**
 * Phase 2B — seed the ICD-10 diagnosis-code reference SUBSET (GLOBAL; synthetic UAT only).
 * Importing the full ICD-10 catalogue is a documented extension path — NOT done here.
 */
async function seedDiagnosisCodes(prisma: PrismaClient): Promise<void> {
  const codes = [
    { code: "A09", fr: "Diarrhée et gastro-entérite présumées infectieuses", en: "Diarrhoea and gastroenteritis of presumed infectious origin", cat: "Infectieux" },
    { code: "B50", fr: "Paludisme à Plasmodium falciparum", en: "Plasmodium falciparum malaria", cat: "Infectieux" },
    { code: "J06", fr: "Infections aiguës des voies respiratoires supérieures", en: "Acute upper respiratory infections", cat: "Respiratoire" },
    { code: "J18", fr: "Pneumonie, micro-organisme non précisé", en: "Pneumonia, unspecified organism", cat: "Respiratoire" },
    { code: "K29", fr: "Gastrite et duodénite", en: "Gastritis and duodenitis", cat: "Digestif" },
    { code: "I10", fr: "Hypertension essentielle (primitive)", en: "Essential (primary) hypertension", cat: "Cardiovasculaire" },
    { code: "E11", fr: "Diabète sucré de type 2", en: "Type 2 diabetes mellitus", cat: "Endocrinien" },
    { code: "N39", fr: "Autres affections de l'appareil urinaire", en: "Other disorders of urinary system", cat: "Génito-urinaire" },
    { code: "O80", fr: "Accouchement unique et spontané", en: "Single spontaneous delivery", cat: "Obstétrique" },
    { code: "Z00", fr: "Examen général, sans plainte", en: "General examination without complaint", cat: "Général" },
    { code: "T14", fr: "Traumatisme d'une région non précisée du corps", en: "Injury of unspecified body region", cat: "Traumatologie" },
    { code: "R50", fr: "Fièvre d'origine inconnue", en: "Fever of unknown origin", cat: "Symptômes" },
  ];
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    await prisma.diagnosisCode.upsert({
      where: { code: c.code },
      create: { code: c.code, labelFr: c.fr, labelEn: c.en, category: c.cat, displayOrder: i + 1 },
      update: { labelFr: c.fr, labelEn: c.en, category: c.cat, displayOrder: i + 1 },
    });
  }
}

/**
 * Phase 1 (Gate 2) fake, deterministic configuration + tariff base data for HRB-DEMO:
 * a few departments/service units, minimal settings, a receipt document template, and a
 * price list with the demo tariffs (mirrors lib/constants TARIFFS). Idempotent upserts.
 * Fake data only — added at Gate 2 to support the new schema; the golden path is unchanged.
 */
async function seedConfigAndTariffs(prisma: PrismaClient): Promise<void> {
  const departments = [
    { code: "ACCUEIL", name: "Accueil" },
    { code: "MED-GEN", name: "Médecine générale" },
    { code: "CAISSE", name: "Caisse" },
  ];
  const deptIdByCode = new Map<string, string>();
  for (const d of departments) {
    const row = await prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: d.code } },
      create: { hospitalId: DEMO_HOSPITAL_ID, code: d.code, name: d.name },
      update: { name: d.name },
    });
    deptIdByCode.set(d.code, row.id);
  }

  const serviceUnits = [
    { code: "SU-CONSULT-1", name: "Salle de consultation 1", dept: "MED-GEN", kind: "consultation", order: 90 },
    { code: "SU-CAISSE-1", name: "Caisse 1", dept: "CAISSE", kind: "caisse", order: 91 },
  ];
  for (const s of serviceUnits) {
    await prisma.serviceUnit.upsert({
      where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: s.code } },
      create: {
        hospitalId: DEMO_HOSPITAL_ID,
        code: s.code,
        name: s.name,
        nameFr: s.name,
        kind: s.kind,
        displayOrder: s.order,
        departmentId: deptIdByCode.get(s.dept) ?? null,
      },
      update: {
        name: s.name,
        nameFr: s.name,
        kind: s.kind,
        displayOrder: s.order,
        departmentId: deptIdByCode.get(s.dept) ?? null,
      },
    });
  }

  // Phase 2A — Bertoua standard service catalogue (synthetic; ward-level only). Typed +
  // bilingual + eligibility flags. Idempotent upsert by (hospital, code).
  const catalogue = [
    { code: "SRV-MED-GEN", nameFr: "Médecine générale", nameEn: "General Medicine", type: "OUTPATIENT", order: 1, dept: "MED-GEN", acceptsQueue: true, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-PEDIATRIE", nameFr: "Pédiatrie", nameEn: "Pediatrics", type: "OUTPATIENT", order: 2, dept: "", acceptsQueue: true, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-GYNECO", nameFr: "Gynéco-obstétrique", nameEn: "Obstetrics & Gynecology", type: "OUTPATIENT", order: 3, dept: "", acceptsQueue: true, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-CHIRURGIE", nameFr: "Chirurgie", nameEn: "Surgery", type: "OUTPATIENT", order: 4, dept: "", acceptsQueue: true, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-DENTAIRE", nameFr: "Dentaire", nameEn: "Dental", type: "OUTPATIENT", order: 5, dept: "", acceptsQueue: true, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-MED-INTERNE", nameFr: "Médecine interne (hospitalisation)", nameEn: "Internal Medicine (ward)", type: "INPATIENT_WARD", order: 6, dept: "", acceptsQueue: false, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: true, isEmergency: false },
    { code: "SRV-MATERNITE", nameFr: "Maternité", nameEn: "Maternity", type: "INPATIENT_WARD", order: 7, dept: "", acceptsQueue: false, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: true, isEmergency: false },
    { code: "SRV-CHIR-HOSP", nameFr: "Chirurgie (hospitalisation)", nameEn: "Surgery (ward)", type: "INPATIENT_WARD", order: 8, dept: "", acceptsQueue: false, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: true, isEmergency: false },
    { code: "SRV-PEDIA-HOSP", nameFr: "Pédiatrie (hospitalisation)", nameEn: "Pediatrics (ward)", type: "INPATIENT_WARD", order: 9, dept: "", acceptsQueue: false, acceptsConsultation: true, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: true, isEmergency: false },
    { code: "SRV-ACCUEIL", nameFr: "Accueil", nameEn: "Reception", type: "SUPPORT", order: 10, dept: "ACCUEIL", acceptsQueue: true, acceptsConsultation: false, supportsBilling: false, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-CAISSE", nameFr: "Caisse", nameEn: "Cashier", type: "CASHIER", order: 11, dept: "CAISSE", acceptsQueue: true, acceptsConsultation: false, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-PHARMACIE", nameFr: "Pharmacie", nameEn: "Pharmacy", type: "PHARMACY", order: 12, dept: "", acceptsQueue: true, acceptsConsultation: false, supportsBilling: true, supportsPharmacy: true, supportsLab: false, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-LABO", nameFr: "Laboratoire", nameEn: "Laboratory", type: "LABORATORY", order: 13, dept: "", acceptsQueue: true, acceptsConsultation: false, supportsBilling: true, supportsPharmacy: false, supportsLab: true, supportsImaging: false, isInpatientWard: false, isEmergency: false },
    { code: "SRV-IMAGERIE", nameFr: "Imagerie médicale", nameEn: "Medical Imaging", type: "IMAGING", order: 14, dept: "", acceptsQueue: true, acceptsConsultation: false, supportsBilling: true, supportsPharmacy: false, supportsLab: false, supportsImaging: true, isInpatientWard: false, isEmergency: false },
  ] as const;
  for (const s of catalogue) {
    const data = {
      name: s.nameFr,
      nameFr: s.nameFr,
      nameEn: s.nameEn,
      type: s.type,
      displayOrder: s.order,
      departmentId: s.dept ? (deptIdByCode.get(s.dept) ?? null) : null,
      acceptsQueue: s.acceptsQueue,
      acceptsConsultation: s.acceptsConsultation,
      supportsBilling: s.supportsBilling,
      supportsPharmacy: s.supportsPharmacy,
      supportsLab: s.supportsLab,
      supportsImaging: s.supportsImaging,
      isInpatientWard: s.isInpatientWard,
      isEmergency: s.isEmergency,
    };
    await prisma.serviceUnit.upsert({
      where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: s.code } },
      create: { hospitalId: DEMO_HOSPITAL_ID, code: s.code, ...data },
      update: data,
    });
  }

  const settings = [
    { key: "locale.default", value: "fr" },
    {
      key: "receipt.footer_note",
      value: "Document généré par le système — veuillez conserver ce reçu.",
    },
    // Phase 3A — operational-policy settings that back the configuration-completeness categories
    // (synthetic; hospital-agnostic structure, so they also travel in the reference template).
    { key: "payment.modes", value: "especes,mobile_money" },
    { key: "cashier.shift.rules", value: "one_open_per_cashier;close_required_daily" },
    { key: "reporting.calendar", value: "monthly" },
    { key: "dhis2.export", value: "manual_csv" },
    { key: "backup.schedule", value: "daily_local" },
    { key: "local_server.status", value: "configured" },
  ];
  for (const st of settings) {
    await prisma.setting.upsert({
      where: { hospitalId_key: { hospitalId: DEMO_HOSPITAL_ID, key: st.key } },
      create: { hospitalId: DEMO_HOSPITAL_ID, key: st.key, value: st.value },
      update: { value: st.value },
    });
  }

  await prisma.documentTemplate.upsert({
    where: {
      hospitalId_type_name: {
        hospitalId: DEMO_HOSPITAL_ID,
        type: "receipt",
        name: "Reçu standard",
      },
    },
    create: {
      hospitalId: DEMO_HOSPITAL_ID,
      type: "receipt",
      name: "Reçu standard",
      header: "République du Cameroun · Ministère de la Santé Publique",
      body: "Hôpital Régional de Bertoua — Démo",
    },
    update: {},
  });

  const priceList = await prisma.priceList.upsert({
    where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: "PL-2026" } },
    create: { hospitalId: DEMO_HOSPITAL_ID, code: "PL-2026", name: "Tarifs 2026 — Démo" },
    update: { name: "Tarifs 2026 — Démo" },
  });

  // Integer FCFA only — mirrors the fake demo tariffs in lib/constants.
  const tariffs = [
    { code: "consultation_generale", label: "Consultation médecine générale", amount: 2000 },
    { code: "ouverture_dossier", label: "Frais d'ouverture de dossier", amount: 1000 },
    { code: "consultation_specialisee", label: "Consultation spécialisée", amount: 5000 },
    { code: "pansement", label: "Pansement", amount: 1500 },
    { code: "injection", label: "Injection", amount: 1000 },
    // Phase 2G — daily ward fees. The tariff `code` MATCHES the INPATIENT_WARD service code, so
    // `assignWard` resolves + snapshots the fee from the ward's active tariff. Integer FCFA.
    { code: "SRV-MED-INTERNE", label: "Hospitalisation — médecine interne (journée)", amount: 10000 },
    { code: "SRV-MATERNITE", label: "Hospitalisation — maternité (journée)", amount: 12000 },
    { code: "SRV-CHIR-HOSP", label: "Hospitalisation — chirurgie (journée)", amount: 15000 },
    { code: "SRV-PEDIA-HOSP", label: "Hospitalisation — pédiatrie (journée)", amount: 9000 },
  ];
  for (const t of tariffs) {
    await prisma.tariff.upsert({
      where: { hospitalId_code: { hospitalId: DEMO_HOSPITAL_ID, code: t.code } },
      create: {
        hospitalId: DEMO_HOSPITAL_ID,
        priceListId: priceList.id,
        code: t.code,
        label: t.label,
        amount: t.amount,
      },
      update: { label: t.label, amount: t.amount, priceListId: priceList.id },
    });
  }
}

/**
 * Clear all operational data and reset numbering counters to zero, returning the demo
 * to its known starting state (07_Demo_Scenario §14). Reference/base data (hospitals,
 * roles, users) is preserved. Deletes in FK-safe order. Touches fake demo data only.
 */
export async function clearOperationalData(
  prisma: PrismaClient,
): Promise<void> {
  // FK-safe order (children before parents). Phase 1 (Gate 2) patient/consultation
  // child tables are cleared before patients/consultations. Config/tariff base data is
  // NOT cleared here — it is re-upserted idempotently by seedBaseData.
  // Phase 2D — clear dispense records + reservations, then prescriptions + stock, before
  // encounters/patients/medications (FK order: dispense items → dispense → reservations →
  // prescription items → prescription → stock batches).
  await prisma.dispenseRecordItem.deleteMany();
  await prisma.dispenseRecord.deleteMany();
  await prisma.stockReservation.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.medicationStockBatch.deleteMany();
  // Phase 2C — clear cancellation/refund/shift records before invoices/payments/users.
  await prisma.cashierShiftCorrection.deleteMany();
  await prisma.cashierShift.deleteMany();
  await prisma.refundVoucher.deleteMany();
  await prisma.invoiceCancellationRequest.deleteMany();
  // Phase 2I — clear diagnostic orders BEFORE encounters/patients (order → encounter/patient FKs).
  await prisma.diagnosticOrder.deleteMany();
  // Phase 2G — clear admissions + daily charges BEFORE invoices/encounters (admission → invoice +
  // encounter FKs; daily charges cascade with the admission but are cleared explicitly first).
  await prisma.admissionDailyCharge.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.queueTicket.deleteMany();
  await prisma.emergencyDebt.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.patientDuplicateCandidate.deleteMany();
  // Phase 4G — clear patient-match candidates before patients (FK RESTRICT to Patient).
  await prisma.patientMatchCandidate.deleteMany();
  await prisma.patientIdentifier.deleteMany();
  await prisma.patientContact.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.patient.deleteMany();
  // Config / tariff master-data is reset too so each run starts from the seeded base
  // (seedBaseData re-creates it idempotently). Tariff is cleared after InvoiceItem (FK);
  // ServiceUnit before Department, Tariff before PriceList.
  await prisma.tariff.deleteMany();
  await prisma.priceList.deleteMany();
  // Phase 2D-1 — medication catalogue (re-upserted by seedBaseData). No FK children yet.
  await prisma.medication.deleteMany();
  // Phase 2I — diagnostic catalogue (master data, re-upserted by seedBaseData; after its orders).
  await prisma.diagnosticCatalogueItem.deleteMany();
  await prisma.serviceUnit.deleteMany();
  await prisma.department.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.documentTemplate.deleteMany();
  // Phase 3A — clear guarded template-apply records (the reference templates themselves persist and
  // are re-upserted idempotently by seedBaseData). Config-only; no patient/transaction data.
  await prisma.configurationTemplateApplication.deleteMany();
  // Phase 3C — clear per-hospital site-readiness items (status tracking; re-created on demand).
  await prisma.siteReadinessItem.deleteMany();
  // Phase 3D — clear aggregate snapshots (regenerated on demand from operational data).
  await prisma.hospitalAggregateSnapshot.deleteMany();
  // Phase 3E — clear UAT executions/scenarios + Gate 7 items (FK-safe: executions before scenarios).
  await prisma.uatExecution.deleteMany();
  await prisma.uatScenario.deleteMany();
  await prisma.gate7ReadinessItem.deleteMany();
  await prisma.reportExport.deleteMany();
  // Phase 4A — clear the integration framework (children before parents; FK-safe).
  await prisma.integrationJobEvent.deleteMany();
  await prisma.integrationJob.deleteMany();
  await prisma.externalSystemConfig.deleteMany();
  await prisma.integrationCredentialReference.deleteMany();
  await prisma.integrationConnector.deleteMany();
  await prisma.externalSystem.deleteMany();
  // Phase 4B — clear DHIS2 mapping sets (children before parents).
  await prisma.dhis2Mapping.deleteMany();
  await prisma.dhis2MappingSet.deleteMany();
  // Phase 4C — clear external-result staging imports.
  await prisma.externalResultImport.deleteMany();
  // Phase 4D — clear external payment transactions + providers (children before parents).
  await prisma.externalPaymentTransaction.deleteMany();
  await prisma.externalPaymentProvider.deleteMany();
  // Phase 4E — clear insurance records (children before parents).
  await prisma.claimDraft.deleteMany();
  await prisma.preAuthorizationRequest.deleteMany();
  await prisma.patientCoverage.deleteMany();
  await prisma.coverageProfile.deleteMany();
  await prisma.payer.deleteMany();
  // Phase 4F — clear analytics report definitions / runs / exports (children before parents).
  await prisma.reportRunExport.deleteMany();
  await prisma.reportRun.deleteMany();
  await prisma.reportDefinition.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sequence.updateMany({ data: { current: 0 } });
}
