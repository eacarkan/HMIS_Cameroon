import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftNoteField } from "@/components/drafts/draft-note-field";
import { renderWithIntl } from "../helpers/render";

/**
 * Phase 2J — the draft-note field renders as a plain form field (same name/id) so it submits exactly
 * like before, and is safe with no IndexedDB (jsdom): it must not crash and must not auto-fill a draft.
 */
describe("Phase 2J — DraftNoteField", () => {
  it("renders the labelled textarea with the given name/id (drop-in form field)", () => {
    renderWithIntl(
      <DraftNoteField kind="consultation-note" scopeId="enc-1" id="clinicalNote" name="clinicalNote" label="Note clinique" />,
    );
    const field = screen.getByLabelText("Note clinique") as HTMLTextAreaElement;
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.getAttribute("name")).toBe("clinicalNote");
    expect(field.value).toBe(""); // never auto-fills a recovered draft
  });

  it("shows no recovery prompt when there is no draft (no IndexedDB in jsdom)", () => {
    renderWithIntl(
      <DraftNoteField kind="consultation-note" scopeId="enc-2" id="n" name="n" label="Note" />,
    );
    expect(screen.queryByRole("button", { name: "Restaurer" })).not.toBeInTheDocument();
  });
});
