import type { SequenceType } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Numbering data-access (05 §6). Transaction-safe: the atomic `increment` is a single
 * `UPDATE ... SET current = current + 1 RETURNING current`, so concurrent callers never
 * get duplicate numbers. The 2026 rows are seeded; a missing row is created on demand.
 */
export async function nextSequenceValue(
  hospitalId: string,
  type: SequenceType,
  year: number,
): Promise<number> {
  try {
    const seq = await prisma.sequence.update({
      where: { hospitalId_type_year: { hospitalId, type, year } },
      data: { current: { increment: 1 } },
    });
    return seq.current;
  } catch {
    const seq = await prisma.sequence.create({
      data: { hospitalId, type, year, current: 1 },
    });
    return seq.current;
  }
}
