import type { Prisma, ServiceType } from "@prisma/client";

import {
  type ConfigurationTemplateContent,
  asTemplateContent,
  planTemplateApply,
} from "@/lib/configuration-template";
import type { HospitalConfigSummary } from "@/lib/configuration-completeness";
import { prisma } from "./prisma";

/**
 * Configuration-template data access (Phase 3A). Templates are SHARED, hospital-agnostic
 * blueprints (not hospital-scoped). Applying a template is a GUARDED, HOSPITAL-SCOPED
 * transaction: every config write carries the target `hospitalId` via a composite-unique
 * upsert (never update-by-id-only), and only config rows are touched — never patient or
 * transaction data. Consumers are `server/services` / seed / tests (never the UI).
 */

// ---- Template blueprints (shared; not hospital-scoped) ----

export function listConfigurationTemplates() {
  return prisma.configurationTemplate.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
}

export function findConfigurationTemplateById(id: string) {
  return prisma.configurationTemplate.findUnique({ where: { id } });
}

export function findConfigurationTemplateByCode(code: string) {
  return prisma.configurationTemplate.findUnique({ where: { code } });
}

export type CreateConfigurationTemplateData = {
  code: string;
  name: string;
  description?: string | null;
  version?: number;
  sourceHospitalId?: string | null;
  content: ConfigurationTemplateContent;
};

export function createConfigurationTemplate(data: CreateConfigurationTemplateData) {
  return prisma.configurationTemplate.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      version: data.version ?? 1,
      sourceHospitalId: data.sourceHospitalId ?? null,
      content: data.content as unknown as Prisma.InputJsonValue,
    },
  });
}

export type UpdateConfigurationTemplateData = {
  name?: string;
  description?: string | null;
  version?: number;
  content?: ConfigurationTemplateContent;
  isActive?: boolean;
};

export function updateConfigurationTemplate(id: string, data: UpdateConfigurationTemplateData) {
  return prisma.configurationTemplate.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      version: data.version,
      isActive: data.isActive,
      ...(data.content !== undefined
        ? { content: data.content as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export function listConfigurationTemplateApplications(hospitalId: string) {
  return prisma.configurationTemplateApplication.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
  });
}

// ---- Guarded, hospital-scoped template apply ----

export type ApplyTemplateResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  applicationId: string;
};

/**
 * Apply a template's structural config to ONE hospital instance, atomically. Departments are
 * upserted first (so a service can resolve its department within the same hospital), then
 * services, settings and document templates — each via a composite-unique upsert keyed by
 * `hospitalId`. Identity settings carried by a malformed template are skipped. A
 * ConfigurationTemplateApplication audit row records the counts. Returns the counts.
 */
export async function applyTemplateToHospital(params: {
  hospitalId: string;
  template: { id: string; code: string; version: number; content: unknown };
  appliedById: string;
}): Promise<ApplyTemplateResult> {
  const { hospitalId, template, appliedById } = params;
  const content = asTemplateContent(template.content);

  return prisma.$transaction(async (tx) => {
    // Existing keys for create-vs-update counting (scoped to this hospital). Read SEQUENTIALLY: inside an
    // interactive transaction every query runs on the ONE transaction connection, so issuing them in
    // parallel (Promise.all) gives no speed-up and trips pg's "client.query() while already executing a
    // query" deprecation warning. Sequential awaits are correct and warning-free (Phase 5D).
    const existingDepts = await tx.department.findMany({ where: { hospitalId }, select: { code: true } });
    const existingServices = await tx.serviceUnit.findMany({ where: { hospitalId }, select: { code: true } });
    const existingSettings = await tx.setting.findMany({ where: { hospitalId }, select: { key: true } });
    const existingDocs = await tx.documentTemplate.findMany({ where: { hospitalId }, select: { type: true, name: true } });
    const plan = planTemplateApply(content, {
      departmentCodes: existingDepts.map((d) => d.code),
      serviceCodes: existingServices.map((s) => s.code),
      settingKeys: existingSettings.map((s) => s.key),
      documentKeys: existingDocs.map((d) => `${d.type}::${d.name}`),
    });

    // Departments first → build a code→id map for service department resolution.
    const deptIdByCode = new Map<string, string>();
    for (const d of content.departments) {
      const row = await tx.department.upsert({
        where: { hospitalId_code: { hospitalId, code: d.code } },
        create: { hospitalId, code: d.code, name: d.name },
        update: { name: d.name },
      });
      deptIdByCode.set(d.code, row.id);
    }

    for (const s of content.services) {
      const departmentId = s.departmentCode ? (deptIdByCode.get(s.departmentCode) ?? null) : null;
      const data = {
        name: s.nameFr,
        nameFr: s.nameFr,
        nameEn: s.nameEn ?? null,
        type: s.type as ServiceType,
        displayOrder: s.displayOrder ?? 0,
        kind: s.kind ?? null,
        departmentId,
        acceptsQueue: s.acceptsQueue ?? false,
        acceptsConsultation: s.acceptsConsultation ?? false,
        supportsBilling: s.supportsBilling ?? false,
        supportsPharmacy: s.supportsPharmacy ?? false,
        supportsLab: s.supportsLab ?? false,
        supportsImaging: s.supportsImaging ?? false,
        isInpatientWard: s.isInpatientWard ?? false,
        isEmergency: s.isEmergency ?? false,
      };
      await tx.serviceUnit.upsert({
        where: { hospitalId_code: { hospitalId, code: s.code } },
        create: { hospitalId, code: s.code, ...data },
        update: data,
      });
    }

    for (const st of content.settings) {
      await tx.setting.upsert({
        where: { hospitalId_key: { hospitalId, key: st.key } },
        create: { hospitalId, key: st.key, value: st.value },
        update: { value: st.value },
      });
    }

    for (const doc of content.documentTemplates) {
      // On UPDATE, only refresh the generic header — never overwrite an existing instance's body,
      // which is per-hospital identity (the body is hospital-specific and must not be clobbered by
      // a shared template). On CREATE, seed the body from the template (the reference template
      // carries no identity body, so this is null there).
      await tx.documentTemplate.upsert({
        where: {
          hospitalId_type_name: { hospitalId, type: doc.type, name: doc.name },
        },
        create: {
          hospitalId,
          type: doc.type,
          name: doc.name,
          header: doc.header ?? null,
          body: doc.body ?? null,
        },
        update: { header: doc.header ?? null },
      });
    }

    // Settings the plan dropped (identity keys never apply to a shared instance).
    const plannedSettingCount = plan.items.filter((i) => i.category === "setting").length;
    const skippedCount = content.settings.length - plannedSettingCount;
    const application = await tx.configurationTemplateApplication.create({
      data: {
        hospitalId,
        templateId: template.id,
        templateCode: template.code,
        templateVersion: template.version,
        appliedById,
        createdCount: plan.created,
        updatedCount: plan.updated,
        skippedCount,
        summary: `Modèle ${template.code} v${template.version} appliqué : ${plan.created} créés, ${plan.updated} mis à jour`,
      },
    });

    return {
      createdCount: plan.created,
      updatedCount: plan.updated,
      skippedCount,
      applicationId: application.id,
    };
  });
}

// ---- Hospital configuration summary (for completeness; hospital-scoped counts only) ----

/** Gather the hospital-scoped configuration summary used by the completeness calculator. */
export async function gatherHospitalConfigSummary(
  hospitalId: string,
): Promise<HospitalConfigSummary> {
  const [
    hospital,
    departmentCount,
    activeServiceCount,
    outpatientConsultCount,
    wardCount,
    cashierServiceCount,
    pharmacyServiceCount,
    labServiceCount,
    imagingServiceCount,
    diagnosticCatalogueCount,
    tariffCount,
    medicationCount,
    stockBatchCount,
    documentTemplateCount,
    sequenceCount,
    settings,
    userRoles,
  ] = await Promise.all([
    prisma.hospital.findUnique({ where: { id: hospitalId } }),
    prisma.department.count({ where: { hospitalId, deletedAt: null } }),
    prisma.serviceUnit.count({ where: { hospitalId, deletedAt: null, isActive: true } }),
    prisma.serviceUnit.count({
      where: { hospitalId, deletedAt: null, isActive: true, type: "OUTPATIENT", acceptsConsultation: true },
    }),
    prisma.serviceUnit.count({
      where: { hospitalId, deletedAt: null, isActive: true, type: "INPATIENT_WARD", isInpatientWard: true },
    }),
    prisma.serviceUnit.count({ where: { hospitalId, deletedAt: null, isActive: true, type: "CASHIER" } }),
    prisma.serviceUnit.count({ where: { hospitalId, deletedAt: null, isActive: true, type: "PHARMACY" } }),
    prisma.serviceUnit.count({ where: { hospitalId, deletedAt: null, isActive: true, type: "LABORATORY" } }),
    prisma.serviceUnit.count({ where: { hospitalId, deletedAt: null, isActive: true, type: "IMAGING" } }),
    prisma.diagnosticCatalogueItem.count({ where: { hospitalId } }),
    prisma.tariff.count({ where: { hospitalId, deletedAt: null } }),
    prisma.medication.count({ where: { hospitalId, deletedAt: null } }),
    prisma.medicationStockBatch.count({ where: { hospitalId } }),
    prisma.documentTemplate.count({ where: { hospitalId, deletedAt: null } }),
    prisma.sequence.count({ where: { hospitalId } }),
    prisma.setting.findMany({ where: { hospitalId, deletedAt: null }, select: { key: true } }),
    prisma.userRole.findMany({
      where: { hospitalId },
      select: { userId: true, roleId: true, role: { select: { code: true } } },
    }),
  ]);

  const userIds = new Set(userRoles.map((ur) => ur.userId));
  const roleIds = new Set(userRoles.map((ur) => ur.roleId));
  const adminUserIds = new Set(
    userRoles.filter((ur) => ur.role.code === "administrateur").map((ur) => ur.userId),
  );

  return {
    identity: {
      hasName: Boolean(hospital?.name),
      hasCity: Boolean(hospital?.city),
      hasRegion: Boolean(hospital?.region),
      hasCode: Boolean(hospital?.code),
    },
    departmentCount,
    activeServiceCount,
    outpatientConsultCount,
    wardCount,
    cashierServiceCount,
    pharmacyServiceCount,
    labServiceCount,
    imagingServiceCount,
    diagnosticCatalogueCount,
    tariffCount,
    medicationCount,
    stockBatchCount,
    documentTemplateCount,
    sequenceCount,
    userCount: userIds.size,
    adminUserCount: adminUserIds.size,
    roleCount: roleIds.size,
    settingKeys: settings.map((s) => s.key),
  };
}
