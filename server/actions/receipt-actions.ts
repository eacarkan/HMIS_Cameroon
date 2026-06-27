"use server";

import { requireActorAndHospital } from "@/server/auth";
import { recordReceiptPrint } from "@/server/services";

/**
 * Log a receipt print (06 §13). Best-effort: printing happens client-side; this only
 * marks the receipt printed and writes the `receipt.print` audit entry.
 */
export async function printReceiptAction(paymentId: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await recordReceiptPrint(actor, hospital, paymentId);
  } catch {
    // Swallow — the on-screen receipt + client print remain available.
  }
}
