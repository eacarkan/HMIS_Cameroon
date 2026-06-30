import type { QueueStatus } from "@prisma/client";

import {
  createQueueTicket,
  findPatientByNumber,
  findQueueTicketById,
  findServiceUnitById,
  listQueueForService,
  setQueueTicketUrgent,
  updateQueueTicketStatus,
  type HospitalContext,
} from "@/server/db";
import { canTransitionQueue, formatTicketNumber, type QueueStatusValue } from "@/lib/queue";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Queue service (Phase 2F). A simple per-service digital queue: reception/triage adds a registered
 * patient to a service's queue for today (sequential per-service-per-day number), service staff advance
 * the status (waiting → in_service → completed, or cancelled), and a triage override may flag a ticket
 * urgent so it jumps the line. Hospital-scoped; every transition + override is audited.
 */

function todayUtcDate(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getQueueForService(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  serviceUnitId: string,
  opts: { now?: Date } = {},
) {
  await requireCapability(actor, ctx, "queue.read");
  return listQueueForService(ctx.hospitalId, serviceUnitId, todayUtcDate(opts.now ?? new Date()));
}

export async function addToQueue(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { serviceUnitId: string; patientNumber: string; isUrgent?: boolean },
  opts: { now?: Date } = {},
) {
  await requireCapability(actor, ctx, "queue.manage", { type: "QueueTicket" });
  const isUrgent = input.isUrgent ?? false;
  if (isUrgent) await requireCapability(actor, ctx, "queue.urgent");

  const service = await findServiceUnitById(ctx.hospitalId, input.serviceUnitId);
  if (!service || !service.isActive) throw new Error("Service introuvable ou inactif dans cet hôpital.");
  const patient = await findPatientByNumber(ctx.hospitalId, input.patientNumber.trim());
  if (!patient) throw new Error("Patient introuvable dans cet hôpital.");

  const ticket = await createQueueTicket({
    hospitalId: ctx.hospitalId,
    serviceUnitId: service.id,
    patientId: patient.id,
    queueDate: todayUtcDate(opts.now ?? new Date()),
    isUrgent,
    createdById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.queueTicketCreated,
    entityType: "QueueTicket",
    entityId: ticket.id,
    summary:
      `File ${service.nameFr} — n° ${formatTicketNumber(ticket.ticketNumber)} pour ` +
      `${patient.familyName} ${patient.givenName}${isUrgent ? " (URGENT)" : ""}`,
  });
  return ticket;
}

export async function advanceQueueTicket(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  toStatus: QueueStatusValue,
) {
  await requireCapability(actor, ctx, "queue.manage", { type: "QueueTicket", id });
  const ticket = await findQueueTicketById(ctx.hospitalId, id);
  if (!ticket) throw new Error("Ticket de file introuvable dans cet hôpital.");
  if (!canTransitionQueue(ticket.status, toStatus)) {
    throw new Error("Transition de file non autorisée.");
  }
  const stamps =
    toStatus === "in_service"
      ? { calledAt: new Date() }
      : toStatus === "completed"
        ? { completedAt: new Date() }
        : toStatus === "cancelled"
          ? { cancelledAt: new Date() }
          : {};
  await updateQueueTicketStatus(ctx.hospitalId, id, toStatus as QueueStatus, stamps);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.queueStatusChanged,
    entityType: "QueueTicket",
    entityId: id,
    summary: `File — ticket n° ${formatTicketNumber(ticket.ticketNumber)} : ${ticket.status} → ${toStatus}`,
  });
  return findQueueTicketById(ctx.hospitalId, id);
}

export async function setQueueUrgent(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  isUrgent: boolean,
) {
  await requireCapability(actor, ctx, "queue.urgent", { type: "QueueTicket", id });
  const ticket = await findQueueTicketById(ctx.hospitalId, id);
  if (!ticket) throw new Error("Ticket de file introuvable dans cet hôpital.");
  if (ticket.status !== "waiting" && ticket.status !== "in_service") {
    throw new Error("Seul un ticket actif peut changer de priorité.");
  }
  await setQueueTicketUrgent(ctx.hospitalId, id, isUrgent);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.queueMarkedUrgent,
    entityType: "QueueTicket",
    entityId: id,
    summary:
      `File — ticket n° ${formatTicketNumber(ticket.ticketNumber)} ` +
      (isUrgent ? "marqué URGENT" : "priorité urgente retirée"),
  });
  return findQueueTicketById(ctx.hospitalId, id);
}
