/**
 * Phase 4G — future MPI (Master Patient Index) adapter interface + mock connector (PURE, no I/O).
 *
 * THE MPI RULE: there is NO live national MPI in Phase 4G. Every MPI lookup goes through this adapter,
 * and the ONLY concrete adapter is a MOCK that performs NO network request and returns NO national
 * identifier. A live lookup is disabled by default behind a flag that is OFF; even were it flipped on,
 * no production MPI adapter is implemented, so `PRODUCTION_DISABLED` can never reach a real endpoint.
 * No `@/server/*` or Prisma imports (keeps it pure + unit-testable). Reuses the 4A connector shape.
 */

import type { ConnectorEnvironment } from "./adapter";

/** A local, non-nominative lookup key (IDs/among-hospital signals only — never a national identifier). */
export type MpiLookupQuery = {
  hospitalId: string;
  localPatientId: string;
};

/** The mock always returns an empty, non-authoritative result — it never asserts a legal identity. */
export type MpiLookupResult = {
  /** Always false for the mock — no external index was consulted. */
  matched: boolean;
  /** Mock candidates (always empty). Deliberately carries NO national identifier. */
  candidates: never[];
  source: ConnectorEnvironment;
  detail: string;
};

export interface MpiAdapter {
  readonly environment: ConnectorEnvironment;
  readonly isMock: boolean;
  /** Look up an external MPI. The mock performs purely in-memory work and NEVER touches the network. */
  lookup(query: MpiLookupQuery): Promise<MpiLookupResult>;
}

/** The default MPI adapter: an in-memory stub that makes NO network call and returns no match. */
export class MockMpiConnector implements MpiAdapter {
  readonly environment: ConnectorEnvironment;
  readonly isMock = true;

  constructor(environment: ConnectorEnvironment = "MOCK") {
    this.environment = environment;
  }

  // The mock ignores the query — it consults nothing. (Interface param intentionally unused.)
  async lookup(): Promise<MpiLookupResult> {
    return {
      matched: false,
      candidates: [],
      source: this.environment,
      detail: "MPI FICTIF — aucune consultation d'index national réel, aucun identifiant national retourné (aucun appel réseau).",
    };
  }
}

/** Thrown if a production MPI connector is asked to run while live mode is off (it always is here). */
export class MpiLiveDisabledError extends Error {
  constructor(public readonly environment: ConnectorEnvironment) {
    super(`MPI en direct désactivé — un connecteur « ${environment} » ne peut pas être exécuté (MPI fictif uniquement, aucun appel externe réel).`);
    this.name = "MpiLiveDisabledError";
  }
}

/** The env flag that would (in a FUTURE patch) enable a live MPI. Default: OFF (fails closed). */
export const MPI_LIVE_FLAG = "HMIS_MPI_LIVE_ENABLED";

export function isMpiLiveEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[MPI_LIVE_FLAG] === "true";
}

/** Resolve the MPI adapter. MOCK/SANDBOX → the in-memory mock; PRODUCTION_DISABLED → ALWAYS refuses. */
export function resolveMpiAdapter(
  environment: ConnectorEnvironment = "MOCK",
  opts: { liveEnabled?: boolean } = {},
): MpiAdapter {
  if (environment === "MOCK" || environment === "SANDBOX") {
    return new MockMpiConnector(environment);
  }
  if (!opts.liveEnabled) {
    throw new MpiLiveDisabledError(environment);
  }
  throw new Error("Aucun connecteur MPI de production n'est implémenté en Phase 4G (MPI fictif uniquement).");
}
