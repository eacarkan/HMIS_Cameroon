import { describe, expect, it } from "vitest";

import { fcfaAmount, fieldErrorsOf, requiredText, z } from "@/lib/validation";

describe("lib/validation", () => {
  it("requiredText rejects empty / whitespace and accepts text", () => {
    expect(requiredText("Le nom").safeParse("").success).toBe(false);
    expect(requiredText("Le nom").safeParse("   ").success).toBe(false);
    const ok = requiredText("Le nom").safeParse("BELLO");
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe("BELLO");
  });

  it("fcfaAmount requires a non-negative integer (mirrors lib/money)", () => {
    expect(fcfaAmount.safeParse(3000).success).toBe(true);
    expect(fcfaAmount.safeParse(0).success).toBe(true);
    expect(fcfaAmount.safeParse(-1).success).toBe(false);
    expect(fcfaAmount.safeParse(3000.5).success).toBe(false);
  });

  it("fieldErrorsOf maps a ZodError to { field: firstMessage }", () => {
    const schema = z.object({
      familyName: z.string().min(1, { message: "Le nom est obligatoire." }),
      sex: z.enum(["male", "female"], { message: "Le sexe est obligatoire." }),
    });
    const parsed = schema.safeParse({ familyName: "", sex: "x" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = fieldErrorsOf(parsed.error);
      expect(errors.familyName).toBe("Le nom est obligatoire.");
      expect(errors.sex).toBe("Le sexe est obligatoire.");
    }
  });
});
