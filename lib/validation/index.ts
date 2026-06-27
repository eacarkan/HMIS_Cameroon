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
