import { describe, expect, it } from "vitest";

import { userFacingMessage } from "@/lib/errors";

/**
 * Phase 5E — user-facing error sanitisation. Clean French validation messages (what our services throw)
 * pass through; technical / leaky messages (Prisma internals, SQL, stack frames, file paths, connection
 * errors, secrets) collapse to a safe generic fallback so nothing sensitive reaches the UI.
 */
const GENERIC = "Une erreur inattendue s'est produite. Veuillez réessayer.";

describe("unit: Phase 5E user-facing error sanitisation", () => {
  it("passes through clean French validation messages (our thrown errors)", () => {
    for (const m of [
      "Le montant réclamé doit être un entier positif (FCFA).",
      "Un payeur avec ce code existe déjà dans cet hôpital.",
      "Service de consultation externe invalide.",
      "Un motif/commentaire est obligatoire pour enregistrer une décision.",
    ]) {
      expect(userFacingMessage(new Error(m))).toBe(m);
    }
  });

  it("collapses technical / leaky messages to a safe generic fallback", () => {
    for (const leaky of [
      "Invalid `prisma.patient.create()` invocation in /Users/erdem/app/db.ts",
      "\n    at Client.query (/node_modules/pg/lib/client.js:715:7)",
      'duplicate key value violates unique constraint (P2002)',
      "SELECT * FROM \"Patient\" WHERE id = $1",
      "connect ECONNREFUSED 127.0.0.1:5432",
      "AUTH_SECRET token missing password",
    ]) {
      expect(userFacingMessage(new Error(leaky))).toBe(GENERIC);
    }
  });

  it("collapses empty / over-long messages and non-Error throwables", () => {
    expect(userFacingMessage(new Error(""))).toBe(GENERIC);
    expect(userFacingMessage(new Error("x".repeat(400)))).toBe(GENERIC);
    expect(userFacingMessage("a raw string")).toBe(GENERIC);
    expect(userFacingMessage(undefined)).toBe(GENERIC);
    expect(userFacingMessage({ code: "P2002" })).toBe(GENERIC);
  });

  it("honours a custom fallback", () => {
    expect(userFacingMessage(new Error("SELECT leak"), "Échec.")).toBe("Échec.");
  });
});
