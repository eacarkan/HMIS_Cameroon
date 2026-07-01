import { beforeEach, describe, expect, it } from "vitest";

import { searchPatients } from "@/server/db";
import {
  createPatientForActor,
  resolveHospitalContext,
  selectHospital,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect, actorFor } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

describe("integration: hospital scoping (09 §5)", () => {
  beforeEach(resetTestDb);

  it("an actor can only select a hospital they are assigned to", async () => {
    const actor = await actorFor(ACCOUNTS.reception);
    const ctx = await selectHospital(actor, "hosp-hrb-demo");
    expect(ctx.code).toBe("HRB-DEMO");

    expect(await resolveHospitalContext(actor, "hosp-hrn-nga")).toBeNull();
    await expect(selectHospital(actor, "hosp-hrn-nga")).rejects.toThrow();
  });

  it("data-access filters by hospital — no cross-hospital leakage", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await createPatientForActor(actor, ctx, {
      familyName: "BELLO",
      givenName: "Aïssatou",
      sex: "female",
      dateOfBirth: new Date("1990-03-14"),
      phone: null,
      residence: null,
    });

    // Same query against a different hospital must return nothing.
    expect(await searchPatients("hosp-hrb-demo", "BELLO")).toHaveLength(1);
    expect(await searchPatients("hosp-hrn-nga", "BELLO")).toHaveLength(0);
  });
});
