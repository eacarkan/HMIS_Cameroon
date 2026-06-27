import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

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

/** Shared demo password for every seeded user (verification logic lands at Step 4). */
export const DEMO_PASSWORD = "demo1234";

/** The active demo hospital code (mirrors lib/constants DEMO_HOSPITAL). */
export const DEMO_HOSPITAL_ID = "hosp-hrb-demo";

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

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
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
      update: { displayName: u.displayName, email: u.email },
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
}

/**
 * Clear all operational data and reset numbering counters to zero, returning the demo
 * to its known starting state (07_Demo_Scenario §14). Reference/base data (hospitals,
 * roles, users) is preserved. Deletes in FK-safe order. Touches fake demo data only.
 */
export async function clearOperationalData(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sequence.updateMany({ data: { current: 0 } });
}
