/**
 * Validation — zod helpers (ADR-0 stack, 09 §4).
 *
 * Input validation (zod) happens at the TRANSPORT boundary (`server/actions`),
 * before a service runs. Authorization and hospital scoping happen later, in the
 * service layer. This module collects shared schema primitives so forms and actions
 * validate identically.
 *
 * FOUNDATIONS (Steps 1-2): only generic primitives — no domain schemas yet.
 */
import { z } from "zod";

export { z };

/** A trimmed, non-empty French text field. */
export const requiredText = (label = "Ce champ") =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} est obligatoire.` });

/** An integer FCFA amount (≥ 0). Mirrors lib/money's integer rule (D-009). */
export const fcfaAmount = z
  .number()
  .int({ message: "Le montant doit être un entier (FCFA)." })
  .nonnegative({ message: "Le montant ne peut pas être négatif." });

/** Flatten a ZodError to `{ field: firstMessage }` for inline form display. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  const fieldErrors = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages[0]) out[key] = messages[0];
  }
  return out;
}
