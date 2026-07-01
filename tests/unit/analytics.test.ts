import { describe, expect, it } from "vitest";

import {
  type OperationalReportAggregate,
  analyticsRowsToCsv,
  assertAggregateReportRows,
  buildAnalyticsRows,
  resolveTopN,
  validateReportDefinitionInput,
} from "@/lib/analytics";

/**
 * Phase 4F — pure analytics helpers. Report-definition validation, the report-kind → aggregate-rows
 * transform, the aggregate-only guard (rejects a leaked patient identifier), and CSV serialisation. No I/O.
 */
const REPORT: OperationalReportAggregate = {
  consultationCount: 12,
  diagnosisCount: 9,
  revenueTotal: 45000,
  revenueByMethod: [
    { method: "cash", amount: 30000 },
    { method: "mobile_money", amount: 15000 },
  ],
  ageGender: [{ band: "15-24", M: 2, F: 3, U: 0, total: 5 }],
  diagnoses: [
    { code: "B50", label: "Paludisme à P. falciparum", count: 4 },
    { code: "J06", label: "Infection respiratoire", count: 2 },
  ],
};

describe("unit: Phase 4F analytics helpers", () => {
  it("validateReportDefinitionInput requires UPPER code + name + known kind + a 1..50 topN", () => {
    expect(validateReportDefinitionInput({ code: "MENSUEL", name: "Mensuel", kind: "OPERATIONAL_SUMMARY" }).ok).toBe(true);
    expect(validateReportDefinitionInput({ code: "lower", name: "x", kind: "OPERATIONAL_SUMMARY" }).ok).toBe(false);
    expect(validateReportDefinitionInput({ code: "X", name: "", kind: "OPERATIONAL_SUMMARY" }).ok).toBe(false);
    expect(validateReportDefinitionInput({ code: "X", name: "x", kind: "NOPE" }).ok).toBe(false);
    expect(validateReportDefinitionInput({ code: "X", name: "x", kind: "TOP_DIAGNOSES", topN: 99 }).ok).toBe(false);
  });

  it("resolveTopN clamps to 1..50 with a default of 10", () => {
    expect(resolveTopN(null)).toBe(10);
    expect(resolveTopN(3)).toBe(3);
    expect(resolveTopN(0)).toBe(1);
    expect(resolveTopN(1000)).toBe(50);
  });

  it("buildAnalyticsRows produces aggregate rows per kind (no patient field)", () => {
    const revenue = buildAnalyticsRows("REVENUE_BY_METHOD", REPORT);
    expect(revenue).toContainEqual({ section: "revenue", label: "total", value: 45000 });
    expect(revenue).toContainEqual({ section: "revenue", dimension: "cash", value: 30000 });

    const diags = buildAnalyticsRows("TOP_DIAGNOSES", REPORT, { topN: 1 });
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ section: "diagnosis", dimension: "B50", value: 4 });

    const ag = buildAnalyticsRows("AGE_GENDER", REPORT);
    expect(ag).toContainEqual({ section: "age_gender", dimension: "15-24", subDimension: "F", value: 3 });

    const summary = buildAnalyticsRows("OPERATIONAL_SUMMARY", REPORT);
    expect(summary).toContainEqual({ section: "summary", label: "consultations", value: 12 });
    // Every row carries only whitelisted aggregate keys.
    expect(assertAggregateReportRows(summary as unknown as Record<string, unknown>[]).ok).toBe(true);
  });

  it("assertAggregateReportRows REJECTS a row carrying a patient identifier or a non-numeric value", () => {
    expect(assertAggregateReportRows([{ section: "x", value: 1 }]).ok).toBe(true);
    expect(assertAggregateReportRows([{ section: "x", patientNumber: "P-1", value: 1 }] as unknown as Record<string, unknown>[]).ok).toBe(false);
    expect(assertAggregateReportRows([{ section: "x", value: "oops" }] as unknown as Record<string, unknown>[]).ok).toBe(false);
  });

  it("analyticsRowsToCsv emits the strict aggregate header + escapes commas", () => {
    const csv = analyticsRowsToCsv([{ section: "diagnosis", dimension: "B50", label: "Paludisme, grave", value: 4 }]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("section,dimension,subDimension,label,value");
    expect(row).toBe('diagnosis,B50,,"Paludisme, grave",4');
  });
});
