import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  addToQueue,
  advanceQueueTicket,
  createPatientForActor,
  getQueueForService,
  setQueueUrgent,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function activeServiceId() {
  const s = await prisma.serviceUnit.findFirst({ where: { hospitalId: HRB, isActive: true } });
  return s!.id;
}

async function makePatient(family: string) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const p = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: family,
    givenName: "Test",
    sex: "male",
    dateOfBirth: new Date("1990-01-01"),
    phone: null,
    residence: null,
  });
  return p.patientNumber;
}

describe("integration: Phase 2F — digital queue", () => {
  beforeEach(resetTestDb);

  it("assigns sequential per-service-per-day numbers and audits the add", async () => {
    const serviceUnitId = await activeServiceId();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const t1 = await addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: await makePatient("QA") });
    const t2 = await addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: await makePatient("QB") });
    expect(t1.ticketNumber).toBe(1);
    expect(t2.ticketNumber).toBe(2);
    const audit = await prisma.auditLog.findFirst({ where: { action: "queue.ticket_created", entityId: t1.id } });
    expect(audit).not.toBeNull();
  });

  it("never duplicates a number under concurrent adds (unique-constraint backstop)", async () => {
    const serviceUnitId = await activeServiceId();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const pa = await makePatient("CA");
    const pb = await makePatient("CB");
    const [a, b] = await Promise.all([
      addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: pa }),
      addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: pb }),
    ]);
    expect(new Set([a.ticketNumber, b.ticketNumber]).size).toBe(2); // distinct
    expect([a.ticketNumber, b.ticketNumber].sort()).toEqual([1, 2]);
  });

  it("enforces the queue state machine (waiting → in_service → completed; invalid rejected)", async () => {
    const serviceUnitId = await activeServiceId();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const t = await addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: await makePatient("SM") });

    await expect(advanceQueueTicket(reception.actor, reception.ctx, t.id, "completed")).rejects.toThrow(
      /non autorisée/,
    );
    const called = await advanceQueueTicket(reception.actor, reception.ctx, t.id, "in_service");
    expect(called!.status).toBe("in_service");
    expect(called!.calledAt).not.toBeNull();
    const done = await advanceQueueTicket(reception.actor, reception.ctx, t.id, "completed");
    expect(done!.status).toBe("completed");
  });

  it("urgent override needs queue.urgent and re-orders the board first", async () => {
    const serviceUnitId = await activeServiceId();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const t1 = await addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: await makePatient("U1") });
    const t2 = await addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: await makePatient("U2") });

    // A pharmacist may manage the queue but NOT flag urgent.
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await expect(
      addToQueue(pharm.actor, pharm.ctx, { serviceUnitId, patientNumber: await makePatient("U3"), isUrgent: true }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    // Reception flags ticket #2 urgent → it sorts before #1 on the board.
    await setQueueUrgent(reception.actor, reception.ctx, t2.id, true);
    const board = await getQueueForService(reception.actor, reception.ctx, serviceUnitId);
    expect(board[0].id).toBe(t2.id);
    expect(board[0].isUrgent).toBe(true);
    expect(board.map((b) => b.ticketNumber)).toContain(t1.ticketNumber);
  });

  it("RBAC: the cashier (read-only) cannot add to the queue", async () => {
    const serviceUnitId = await activeServiceId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(
      addToQueue(cashier.actor, cashier.ctx, { serviceUnitId, patientNumber: await makePatient("RB") }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("scoping: a patient number from another hospital is not found", async () => {
    const serviceUnitId = await activeServiceId();
    // A patient that exists only in another hospital.
    await prisma.patient.create({
      data: { hospitalId: "hosp-hrn-nga", patientNumber: "HRN-X-1", familyName: "Z", givenName: "Z", sex: "male", dateOfBirth: new Date("1990-01-01") },
    });
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      addToQueue(reception.actor, reception.ctx, { serviceUnitId, patientNumber: "HRN-X-1" }),
    ).rejects.toThrow(/Patient introuvable/);
  });
});
