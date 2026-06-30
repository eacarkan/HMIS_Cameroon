/**
 * Draft autosave — pure, client-safe scope rules (Phase 2J).
 *
 * This is DRAFT PROTECTION for long free-text notes, NOT offline mode. The single most important rule:
 * autosave is allowed ONLY for long clinical notes — NEVER for payments, stock, dispensing, refunds, or
 * any other financial / irreversible action. The IndexedDB I/O lives in the client hook; this module
 * holds the allow-list, the storage-key derivation, and the sync-state vocabulary, all unit-tested.
 */

/** The ONLY form kinds permitted to autosave (long free-text notes). Extend deliberately. */
export const DRAFT_AUTOSAVE_ALLOWED_KINDS = ["consultation-note", "prescription-note"] as const;
export type DraftKind = (typeof DRAFT_AUTOSAVE_ALLOWED_KINDS)[number];

/**
 * Hard scope guard: returns true ONLY for an allow-listed long-note kind. Everything else (payments,
 * stock, adjustments, refunds, dispensing, irreversible actions, or any unknown kind) returns false —
 * so a caller can never autosave a financial/irreversible form even by mistake.
 */
export function isDraftAutosaveAllowed(kind: string): kind is DraftKind {
  return (DRAFT_AUTOSAVE_ALLOWED_KINDS as readonly string[]).includes(kind);
}

/** Deterministic IndexedDB key for a draft, scoped to the kind + the owning record (e.g. encounter). */
export function draftKey(params: { kind: DraftKind; scopeId: string }): string {
  return `hmis-draft:${params.kind}:${params.scopeId}`;
}

/** Local draft sync state — draft protection only (no server sync / offline queue). */
export type DraftSyncState = "idle" | "saving" | "saved" | "error";

/** A draft is worth persisting only when it has meaningful (non-whitespace) content. */
export function shouldPersistDraft(value: string): boolean {
  return value.trim().length > 0;
}
