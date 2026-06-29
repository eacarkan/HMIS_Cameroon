import type {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

import { prisma } from "./prisma";

/** Billing data-access — hospital-scoped, integer FCFA (D-009, D-011, 09 §5). */

export type CreateInvoiceWithItemsData = {
  hospitalId: string;
  encounterId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  totalAmount: number;
  items: {
    label: string;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
  }[];
  createdById: string;
};

export function createInvoiceWithItems(data: CreateInvoiceWithItemsData) {
  return prisma.invoice.create({
    data: {
      hospitalId: data.hospitalId,
      encounterId: data.encounterId,
      invoiceNumber: data.invoiceNumber,
      status: data.status,
      totalAmount: data.totalAmount,
      createdById: data.createdById,
      items: {
        create: data.items.map((item) => ({
          hospitalId: data.hospitalId,
          label: item.label,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: { items: true },
  });
}

/** A single invoice within a hospital, with items, payments and the patient. Phase 2C also
 *  surfaces the cancellation requests (+ any refund voucher) so the invoice view can show state. */
export function findInvoiceById(hospitalId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: {
      items: true,
      payments: { orderBy: { paidAt: "asc" }, include: { cashier: true } },
      encounter: { include: { patient: true } },
      cancellationRequests: {
        orderBy: { createdAt: "desc" },
        include: { refundVoucher: true, requestedBy: true, decidedBy: true },
      },
    },
  });
}

export type CreatePaymentData = {
  hospitalId: string;
  invoiceId: string;
  receiptNumber: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  cashierId: string;
  createdById: string;
};

export function createPayment(data: CreatePaymentData) {
  return prisma.payment.create({ data });
}

export function updateInvoiceStatus(
  hospitalId: string,
  id: string,
  status: InvoiceStatus,
) {
  return prisma.invoice.updateMany({
    where: { id, hospitalId },
    data: { status },
  });
}

/** Set a payment's status (Phase 1A Batch 3 — voiding a receipt; never deletes history). */
export function updatePaymentStatus(
  hospitalId: string,
  id: string,
  status: PaymentStatus,
) {
  return prisma.payment.updateMany({ where: { id, hospitalId }, data: { status } });
}

/** Mark a payment's receipt as printed (idempotent timestamp). */
export function markReceiptPrinted(hospitalId: string, paymentId: string) {
  return prisma.payment.updateMany({
    where: { id: paymentId, hospitalId, printedAt: null },
    data: { printedAt: new Date() },
  });
}

export function findPaymentById(hospitalId: string, id: string) {
  return prisma.payment.findFirst({
    where: { id, hospitalId },
    include: {
      cashier: true,
      invoice: {
        include: {
          items: true,
          encounter: { include: { patient: true } },
        },
      },
    },
  });
}
