import type { SequenceType } from "@prisma/client";

import { formatDocumentNumber, type DocumentKind } from "@/lib/numbering";
import { type HospitalContext, nextSequenceValue } from "@/server/db";

/**
 * Numbering service (05 §6). Generates the next per-hospital, per-year human-readable
 * number for a document kind (e.g. `HRB-DEMO-P-2026-000001`). The kinds match the
 * `SequenceType` enum values one-to-one.
 */
export async function generateNumber(
  ctx: HospitalContext,
  kind: DocumentKind,
  year: number,
): Promise<string> {
  const counter = await nextSequenceValue(
    ctx.hospitalId,
    kind as SequenceType,
    year,
  );
  return formatDocumentNumber({ hospitalCode: ctx.code, kind, year, counter });
}
