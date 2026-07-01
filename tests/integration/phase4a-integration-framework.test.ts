import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  addCredentialReferenceForActor,
  configureConnectorForActor,
  createExternalSystemForActor,
  getIntegrationOverview,
  retryIntegrationJobForActor,
  runIntegrationJobForActor,
} from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 4A — integration framework (DB-backed). Mock/sandbox-first, no live calls. Proves: registry +
 * connector config are hospital-scoped + audited; INTEGRATION-admin RBAC is separate from clinical
 * roles + cross-hospital denied; mock jobs run idempotently; a PRODUCTION_DISABLED connector fails
 * SAFELY (no network); credential REFERENCES reject secrets; and a network-egress guard proves NO real
 * HTTP request is made. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

async function adminWithSystem() {
  const admin = await loginAndSelect(ACCOUNTS.admin);
  const system = await createExternalSystemForActor(admin.actor, admin.ctx, {
    code: "DHIS2_NATIONAL",
    name: "DHIS2 (national)",
    kind: "GENERIC",
  });
  return { admin, system };
}

describe("integration: Phase 4A integration framework", () => {
  beforeEach(resetTestDb);
  afterEach(() => vi.restoreAllMocks());

  it("an admin creates an external system + configures a mock connector (hospital-scoped, audited)", async () => {
    const { admin, system } = await adminWithSystem();
    expect(system.hospitalId).toBe(HRB);
    expect(system.status).toBe("NEEDS_CONFIGURATION");
    const connector = await configureConnectorForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      name: "mock-primary",
      environment: "MOCK",
    });
    expect(connector.environment).toBe("MOCK");
    expect(await prisma.externalSystem.count({ where: { hospitalId: HRB } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "integration.system_created" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "integration.connector_configured" } })).toBe(1);
  });

  it("a clinical role (doctor) is DENIED integration view AND management", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getIntegrationOverview(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      createExternalSystemForActor(doctor.actor, doctor.ctx, { code: "X", name: "x", kind: "g" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("the director can VIEW the registry but NOT manage it", async () => {
    await adminWithSystem();
    const director = await loginAndSelect(ACCOUNTS.director);
    const overview = await getIntegrationOverview(director.actor, director.ctx);
    expect(overview.systems.length).toBe(1);
    await expect(
      createExternalSystemForActor(director.actor, director.ctx, { code: "Y", name: "y", kind: "g" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cross-hospital integration management is denied (per-hospital RBAC)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createExternalSystemForActor(
        admin.actor,
        { ...admin.ctx, hospitalId: OTHER, code: "HRN-NGA", name: "Autre" },
        { code: "Z", name: "z", kind: "g" },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a mock job runs to SUCCEEDED, is IDEMPOTENT (a repeat does not create a second job), and is audited", async () => {
    const { admin, system } = await adminWithSystem();
    await configureConnectorForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      name: "mock-primary",
      environment: "MOCK",
    });
    const first = await runIntegrationJobForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      kind: "MOCK_RUN",
      ref: "run-1",
    });
    expect(first?.status).toBe("SUCCEEDED");
    // Same (system, kind, ref) → same idempotency key → no duplicate, no re-execution.
    const second = await runIntegrationJobForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      kind: "MOCK_RUN",
      ref: "run-1",
    });
    expect(second?.id).toBe(first?.id);
    expect(second?.attempts).toBe(1);
    expect(await prisma.integrationJob.count({ where: { hospitalId: HRB } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "integration.job_created" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "integration.job_succeeded" } })).toBe(1);
  });

  it("a PRODUCTION_DISABLED connector job FAILS SAFELY (no live call) and can be retried (bounded, audited)", async () => {
    const { admin, system } = await adminWithSystem();
    const connector = await configureConnectorForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      name: "prod-disabled",
      environment: "PRODUCTION_DISABLED",
    });
    const job = await runIntegrationJobForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      connectorId: connector.id,
      kind: "EXPORT",
      ref: "prod-1",
    });
    expect(job?.status).toBe("FAILED");
    expect(job?.attempts).toBe(1);
    expect(job?.lastError).toMatch(/désactiv/i);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "integration.job_failed" } })).toBe(1);

    // Retry → still fails (live disabled), attempts increments, retry audited.
    const retried = await retryIntegrationJobForActor(admin.actor, admin.ctx, job!.id);
    expect(retried?.status).toBe("FAILED");
    expect(retried?.attempts).toBe(2);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "integration.job_retried" } })).toBe(1);
  });

  it("a credential REFERENCE rejects an actual secret and stores only the reference (no-real-credential)", async () => {
    const { admin, system } = await adminWithSystem();
    await expect(
      addCredentialReferenceForActor(admin.actor, admin.ctx, {
        externalSystemId: system.id,
        name: "token",
        referenceKind: "ENV_VAR",
        referenceValue: "aB3xY7zQ9mN2kL5pR8tW1vC4",
      }),
    ).rejects.toThrow(/secret/i);
    const ref = await addCredentialReferenceForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      name: "token",
      referenceKind: "ENV_VAR",
      referenceValue: "DHIS2_API_TOKEN",
    });
    expect(ref.referenceValue).toBe("DHIS2_API_TOKEN"); // a NAME, never the secret
    expect(await prisma.integrationCredentialReference.count({ where: { hospitalId: HRB } })).toBe(1);
  });

  it("network-egress guard: running a mock job makes NO real network request", async () => {
    const { admin, system } = await adminWithSystem();
    await configureConnectorForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      name: "mock-primary",
      environment: "MOCK",
    });
    // Any accidental fetch would throw (and the job would then FAIL) — so success + 0 calls proves no egress.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((() => {
        throw new Error("NETWORK EGRESS BLOCKED IN TEST");
      }) as unknown as typeof fetch);
    const job = await runIntegrationJobForActor(admin.actor, admin.ctx, {
      externalSystemId: system.id,
      kind: "HEALTHCHECK",
      ref: "egress-1",
    });
    expect(job?.status).toBe("SUCCEEDED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a NON-member's integration view is denied; the central supervisor has no integration access", async () => {
    await adminWithSystem();
    const central = await actorFor("direction.regionale@hrb-demo.cm");
    // The central supervisor is a Bertoua member (for sign-in) but holds no integration capability there.
    const { selectHospital } = await import("@/server/services");
    const ctx = await selectHospital(central, HRB);
    await expect(getIntegrationOverview(central, ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
