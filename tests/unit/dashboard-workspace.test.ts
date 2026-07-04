import { describe, expect, it } from "vitest";

import { resolveWorkspaceProfile } from "@/lib/dashboard-workspace";

/** Phase 6.3 S4.2B — role → workspace profile (first screen = that role's work). */
describe("dashboard workspace profiles (Phase 6.3 S4.2B)", () => {
  it("maps each operational role to its workspace", () => {
    expect(resolveWorkspaceProfile(["administrateur"])).toBe("admin");
    expect(resolveWorkspaceProfile(["directeur"])).toBe("admin");
    expect(resolveWorkspaceProfile(["superviseur_central"])).toBe("admin");
    expect(resolveWorkspaceProfile(["medecin"])).toBe("clinical");
    expect(resolveWorkspaceProfile(["caissier"])).toBe("cashier");
    expect(resolveWorkspaceProfile(["pharmacien"])).toBe("pharmacy");
    expect(resolveWorkspaceProfile(["pharmacien_chef"])).toBe("pharmacy");
    expect(resolveWorkspaceProfile(["technicien_diagnostic"])).toBe("diagnostics");
    expect(resolveWorkspaceProfile(["validateur_diagnostic"])).toBe("diagnostics");
    expect(resolveWorkspaceProfile(["agent_accueil"])).toBe("operations");
  });

  it("multi-role users get the highest-priority profile; unknown roles fall back", () => {
    expect(resolveWorkspaceProfile(["pharmacien", "administrateur"])).toBe("admin");
    expect(resolveWorkspaceProfile(["technicien_diagnostic", "medecin"])).toBe("clinical");
    expect(resolveWorkspaceProfile([])).toBe("operations");
    expect(resolveWorkspaceProfile(["role_inconnu"])).toBe("operations");
  });
});
