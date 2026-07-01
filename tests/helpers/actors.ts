import { getDemoSharedPassword } from "@/lib/demo-password";
import { authenticateCredentials, selectHospital } from "@/server/services";

/** Active demo hospital id (seeded). */
export const HRB = "hosp-hrb-demo";

/** Demo account emails by role (07 §4). */
export const ACCOUNTS = {
  admin: "awa.njoya@hrb-demo.cm",
  reception: "brigitte.mbarga@hrb-demo.cm",
  doctor: "jeanpaul.etoa@hrb-demo.cm",
  cashier: "solange.abena@hrb-demo.cm",
  director: "emmanuel.tchoua@hrb-demo.cm",
  // Phase 2D — pharmacy roles (dual validation: pharmacist requests, pharmacist-in-charge approves).
  pharmacist: "georges.mballa@hrb-demo.cm",
  pharmacistChief: "claire.fotso@hrb-demo.cm",
  // Phase 2I — diagnostics roles (enter ≠ validate).
  labTech: "paul.ngono@hrb-demo.cm",
  labValidator: "marie.eyenga@hrb-demo.cm",
} as const;

/** Authenticate a demo user (asserts success). */
export async function actorFor(email: string) {
  const actor = await authenticateCredentials(email, getDemoSharedPassword());
  if (!actor) throw new Error(`auth failed for ${email}`);
  return actor;
}

/** Authenticate + select HRB-DEMO, returning the actor and hospital context. */
export async function loginAndSelect(email: string) {
  const actor = await actorFor(email);
  const ctx = await selectHospital(actor, HRB);
  return { actor, ctx };
}
