"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { generateHospitalAggregateSnapshot } from "@/server/services";

/**
 * Phase 3D — generate this hospital's aggregate snapshot (hospital-side action; reads the hospital's
 * own operational data in aggregate via the 2E report, gated by report.operational.read, and stores
 * only aggregate counts/totals). The central viewer never triggers this and never writes.
 */
export async function generateSnapshotAction(): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await generateHospitalAggregateSnapshot(actor, hospital);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath("/rapports");
  revalidatePath("/central");
}
