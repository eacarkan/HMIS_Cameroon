import { beforeEach, describe, expect, it } from "vitest";

import { todayIsoDate } from "@/lib/dates";
import { AuthorizationError } from "@/server/authz";
import { type HospitalContext, prisma } from "@/server/db";
import {
  type AuthenticatedActor,
  createPatientForActor,
  openEncounter,
  getTariffLineSource,
  createInvoice,
  recordPayment,
  getCashierDailyReport,
  exportCashierDailyReportCsv,
  listUsers,
  createUserForActor,
  setUserActive,
  assignRoleForActor,
  removeRoleForActor,
  LAST_ADMIN_ERROR,
  SELF_DEACTIVATE_ERROR,
  SELF_ADMIN_REMOVAL_ERROR,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

/** Build one paid 3 000 FCFA invoice (today) so the cashier report has data. */
async function makePaidInvoice() {
  const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(rec, rctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: null,
    residence: null,
  });
  const enc = await openEncounter(rec, rctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "t",
  });
  const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
  const l1 = await getTariffLineSource(cai, cctx, "consultation_generale"); // 2 000
  const l2 = await getTariffLineSource(cai, cctx, "ouverture_dossier"); // 1 000
  const invoice = await createInvoice(cai, cctx, enc.id, [l1, l2]);
  await recordPayment(cai, cctx, invoice.id, { amount: 3000, method: "cash" });
  return { cai, cctx };
}

describe("integration: Gate 5B cashier daily report + export", () => {
  beforeEach(resetTestDb);

  it("totals match payment data and the report is hospital-scoped", async () => {
    const { cai, cctx } = await makePaidInvoice();
    // A payment in ANOTHER hospital must NOT appear in the HRB report (no leakage).
    const otherPatient = await prisma.patient.create({
      data: { hospitalId: OTHER, patientNumber: "OTHER-P-1", familyName: "X", givenName: "Y", sex: "male", dateOfBirth: new Date("1990-01-01") },
    });
    const otherEnc = await prisma.encounter.create({
      data: { hospitalId: OTHER, patientId: otherPatient.id, encounterNumber: "OTHER-V-1", serviceLabel: "x", reason: "x" },
    });
    const otherInv = await prisma.invoice.create({
      data: { hospitalId: OTHER, encounterId: otherEnc.id, invoiceNumber: "OTHER-F-1", status: "paid", totalAmount: 9999 },
    });
    await prisma.payment.create({
      data: { hospitalId: OTHER, invoiceId: otherInv.id, receiptNumber: "OTHER-R-1", amount: 9999, method: "cash", status: "recorded" },
    });

    const report = await getCashierDailyReport(cai, cctx, todayIsoDate());
    expect(report.count).toBe(1);
    expect(report.total).toBe(3000); // not 3000 + 9999
    expect(report.rows[0].amount).toBe(3000);
    expect(Number.isInteger(report.total)).toBe(true);
  });

  it("CSV export matches the report data and is audited", async () => {
    const { cai, cctx } = await makePaidInvoice();
    const { csv, report } = await exportCashierDailyReportCsv(cai, cctx, todayIsoDate());
    expect(csv).toContain("HRB-DEMO-R-2026-000001");
    expect(csv).toContain("3000"); // integer FCFA in CSV
    expect(csv).not.toContain("OTHER-R-1");
    // header + one data row + total row
    expect(csv.split("\n").filter(Boolean).length).toBe(report.rows.length + 2);
    expect(await prisma.auditLog.count({ where: { action: "cashier.daily_report.generate" } })).toBeGreaterThanOrEqual(1);
  });

  it("admin and director may READ the report; reception/doctor are denied", async () => {
    await makePaidInvoice();
    const { actor: adm, ctx: actx } = await loginAndSelect(ACCOUNTS.admin);
    expect((await getCashierDailyReport(adm, actx, todayIsoDate())).total).toBe(3000);
    const { actor: dir, ctx: dctx } = await loginAndSelect(ACCOUNTS.director);
    expect((await getCashierDailyReport(dir, dctx, todayIsoDate())).total).toBe(3000);

    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    await expect(getCashierDailyReport(rec, rctx, todayIsoDate())).rejects.toBeInstanceOf(AuthorizationError);
    await expect(exportCashierDailyReportCsv(rec, rctx, todayIsoDate())).rejects.toBeInstanceOf(AuthorizationError);
    const { actor: doc, ctx: docx } = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getCashierDailyReport(doc, docx, todayIsoDate())).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("integration: Gate 5B user / account lifecycle", () => {
  beforeEach(resetTestDb);

  async function deleteUserByEmail(email: string) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  it("admin can list users; non-admin roles are denied", async () => {
    const { actor: adm, ctx } = await loginAndSelect(ACCOUNTS.admin);
    expect((await listUsers(adm, ctx)).length).toBeGreaterThanOrEqual(5);

    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    await expect(listUsers(rec, rctx)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      createUserForActor(rec, rctx, { displayName: "X", email: "x@hrb-demo.cm", password: "Demo1234", roleCode: "agent_accueil" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(setUserActive(rec, rctx, "user-awa-njoya", false)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(assignRoleForActor(rec, rctx, "user-awa-njoya", "caissier")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("admin creates/deactivates a user and assigns/removes roles — all audited, hospital-scoped", async () => {
    const email = "test.user@hrb-demo.cm";
    await deleteUserByEmail(email);
    const { actor: adm, ctx } = await loginAndSelect(ACCOUNTS.admin);

    const created = await createUserForActor(adm, ctx, {
      displayName: "Test User",
      email,
      password: "Demo1234",
      roleCode: "agent_accueil",
    });
    // The new user is assigned ONLY to the active hospital (no cross-hospital leakage).
    const roles = await prisma.userRole.findMany({ where: { userId: created.id } });
    expect(roles).toHaveLength(1);
    expect(roles[0].hospitalId).toBe(HRB);
    expect(await prisma.userRole.count({ where: { userId: created.id, hospitalId: OTHER } })).toBe(0);

    await assignRoleForActor(adm, ctx, created.id, "caissier");
    expect(await prisma.userRole.count({ where: { userId: created.id, hospitalId: HRB } })).toBe(2);
    await removeRoleForActor(adm, ctx, created.id, "caissier");
    expect(await prisma.userRole.count({ where: { userId: created.id, hospitalId: HRB } })).toBe(1);

    const deactivated = await setUserActive(adm, ctx, created.id, false);
    expect(deactivated.status).toBe("disabled");

    for (const action of ["user.create", "user.deactivate", "role.assign", "role.remove"]) {
      expect(await prisma.auditLog.count({ where: { action } })).toBeGreaterThanOrEqual(1);
    }
    await deleteUserByEmail(email);
  });

  it("refuses to assign a role to a user who does NOT belong to the active hospital (Phase 1A QA fix 4)", async () => {
    const email = "outsider.qa@hrb-demo.cm";
    await deleteUserByEmail(email);
    const { actor: adm, ctx } = await loginAndSelect(ACCOUNTS.admin); // active hospital = HRB

    // A user that belongs ONLY to another hospital — never assigned in HRB.
    const outsider = await prisma.user.create({
      data: { id: "user-outsider-qa", displayName: "Outsider", email, passwordHash: "x" },
    });
    const caissier = await prisma.role.findUniqueOrThrow({ where: { code: "caissier" } });
    await prisma.userRole.create({ data: { userId: outsider.id, roleId: caissier.id, hospitalId: OTHER } });

    // The hospital-membership guard must block pulling that global user into HRB via assignment.
    await expect(assignRoleForActor(adm, ctx, outsider.id, "caissier")).rejects.toThrow(
      "Utilisateur introuvable dans cet hôpital.",
    );
    // No HRB assignment was created (and the OTHER-hospital one is untouched).
    expect(await prisma.userRole.count({ where: { userId: outsider.id, hospitalId: HRB } })).toBe(0);
    expect(await prisma.userRole.count({ where: { userId: outsider.id, hospitalId: OTHER } })).toBe(1);

    await deleteUserByEmail(email);
  });
});

describe("integration: Gate 5B admin-lockout safeguards", () => {
  beforeEach(resetTestDb);

  const ADMIN_ID = "user-awa-njoya"; // sole seeded administrator in HRB

  async function deleteUserByEmail(email: string) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  /** Create an ADDITIONAL active administrator in HRB (idempotent across runs). */
  async function createSecondAdmin(adm: AuthenticatedActor, ctx: HospitalContext, email: string) {
    await deleteUserByEmail(email);
    return createUserForActor(adm, ctx, {
      displayName: "Second Admin",
      email,
      password: "DemoTemp123",
      roleCode: "administrateur",
    });
  }

  it("blocks an actor from deactivating their OWN account", async () => {
    const { actor: adm, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(setUserActive(adm, ctx, adm.id, false)).rejects.toThrow(SELF_DEACTIVATE_ERROR);
    // Account untouched.
    expect((await prisma.user.findUnique({ where: { id: ADMIN_ID } }))?.status).toBe("active");
  });

  it("blocks an actor from removing their OWN administrator access", async () => {
    const { actor: adm, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      removeRoleForActor(adm, ctx, adm.id, "administrateur"),
    ).rejects.toThrow(SELF_ADMIN_REMOVAL_ERROR);
    // Admin role still held.
    expect(
      await prisma.userRole.count({
        where: { userId: ADMIN_ID, hospitalId: ctx.hospitalId, role: { code: "administrateur" } },
      }),
    ).toBe(1);
  });

  it("blocks deactivating the LAST active administrator (non-self path)", async () => {
    const { ctx } = await loginAndSelect(ACCOUNTS.admin);
    // A crafted actor that holds user.manage but is NOT a DB administrator, so the seeded
    // admin is genuinely the last active one. Proves the guard is server-side, not self-only.
    const other: AuthenticatedActor = {
      id: "user-non-db-admin",
      displayName: "Autre admin",
      email: "autre.admin@hrb-demo.cm",
      roles: ["administrateur"],
      rolesByHospital: { [ctx.hospitalId]: ["administrateur"] },
      hospitalIds: [ctx.hospitalId],
      hospitalId: ctx.hospitalId,
      hospitalCode: ctx.code,
      hospitalName: ctx.name,
    };
    await expect(setUserActive(other, ctx, ADMIN_ID, false)).rejects.toThrow(LAST_ADMIN_ERROR);
    expect((await prisma.user.findUnique({ where: { id: ADMIN_ID } }))?.status).toBe("active");
  });

  it("blocks removing the LAST administrator role (non-self path)", async () => {
    const { ctx } = await loginAndSelect(ACCOUNTS.admin);
    const other: AuthenticatedActor = {
      id: "user-non-db-admin",
      displayName: "Autre admin",
      email: "autre.admin@hrb-demo.cm",
      roles: ["administrateur"],
      rolesByHospital: { [ctx.hospitalId]: ["administrateur"] },
      hospitalIds: [ctx.hospitalId],
      hospitalId: ctx.hospitalId,
      hospitalCode: ctx.code,
      hospitalName: ctx.name,
    };
    await expect(
      removeRoleForActor(other, ctx, ADMIN_ID, "administrateur"),
    ).rejects.toThrow(LAST_ADMIN_ERROR);
    expect(
      await prisma.userRole.count({
        where: { hospitalId: ctx.hospitalId, role: { code: "administrateur" } },
      }),
    ).toBe(1);
  });

  it("allows deactivating / role-changing a NON-last admin while another active admin remains", async () => {
    const { actor: adm, ctx } = await loginAndSelect(ACCOUNTS.admin);

    // Case 1 — remove the admin role from a second admin (2 → 1 assignment): allowed.
    const emailA = "second.admin.role@hrb-demo.cm";
    const adminA = await createSecondAdmin(adm, ctx, emailA);
    await removeRoleForActor(adm, ctx, adminA.id, "administrateur");
    expect(
      await prisma.userRole.count({
        where: { userId: adminA.id, hospitalId: ctx.hospitalId, role: { code: "administrateur" } },
      }),
    ).toBe(0);
    // The seeded admin still holds the role — the hospital keeps an administrator.
    expect(
      await prisma.userRole.count({
        where: { hospitalId: ctx.hospitalId, role: { code: "administrateur" } },
      }),
    ).toBe(1);

    // Case 2 — deactivate a second active admin while the seeded admin remains: allowed.
    const emailB = "second.admin.deact@hrb-demo.cm";
    const adminB = await createSecondAdmin(adm, ctx, emailB);
    const deactivated = await setUserActive(adm, ctx, adminB.id, false);
    expect(deactivated.status).toBe("disabled");
    expect((await prisma.user.findUnique({ where: { id: ADMIN_ID } }))?.status).toBe("active");

    await deleteUserByEmail(emailA);
    await deleteUserByEmail(emailB);
  });
});
