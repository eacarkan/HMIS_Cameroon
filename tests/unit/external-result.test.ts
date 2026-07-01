import { describe, expect, it } from "vitest";

import { canReviewImport, parseImportCsv } from "@/lib/external-result";

/**
 * Phase 4C — pure external-result helpers. CSV parsing (header + rows, quoted fields, missing columns /
 * fields), and the review guard (only a NEEDS_REVIEW record may be reviewed). No I/O.
 */
describe("unit: Phase 4C external-result helpers", () => {
  it("parseImportCsv parses valid rows and reports missing required fields", () => {
    const csv = "externalRef,patientRef,orderRef,modality,testCode,resultText\nEXT-1,HRB-P-1,HRB-D-1,lab,NFS,Hb 12\nEXT-2,HRB-P-2,,radio,RX,RAS";
    const { rows, errors } = parseImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({ externalRef: "EXT-1", patientRef: "HRB-P-1", orderRef: "HRB-D-1", testCode: "NFS" });
    expect(rows[1].orderRef).toBeNull();
  });

  it("parseImportCsv rejects a file missing a required column", () => {
    const { rows, errors } = parseImportCsv("externalRef,patientRef,modality\nEXT-1,HRB-P-1,lab");
    expect(rows).toEqual([]);
    expect(errors.join(" ")).toMatch(/testCode|resultText/);
  });

  it("parseImportCsv skips a row missing a required field", () => {
    const csv = "externalRef,patientRef,orderRef,modality,testCode,resultText\nEXT-1,,HRB-D-1,lab,NFS,Hb 12";
    const { rows, errors } = parseImportCsv(csv);
    expect(rows.length).toBe(0);
    expect(errors.length).toBe(1);
  });

  it("canReviewImport allows only NEEDS_REVIEW", () => {
    expect(canReviewImport("NEEDS_REVIEW")).toBe(true);
    expect(canReviewImport("PROMOTED")).toBe(false);
    expect(canReviewImport("REJECTED")).toBe(false);
    expect(canReviewImport("DUPLICATE")).toBe(false);
  });
});
