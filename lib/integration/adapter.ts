/**
 * Phase 4A — integration adapter interface + mock connector (pure, server-agnostic, client-safe).
 *
 * THE INTEGRATION RULE: every external system is reached through an adapter, never inline, and the
 * DEFAULT adapter is a MOCK that performs NO network request. Live external calls are disabled by
 * default and gated behind an explicit feature flag that is OFF unless deliberately enabled later —
 * and even then this module ships NO production adapter, so a "PRODUCTION_DISABLED" connector can
 * never reach a real endpoint. No `@/server/*` or Prisma imports (keeps it unit-testable + pure).
 */

/** A connector's environment. There is deliberately NO enabled "production" value. */
export type ConnectorEnvironment = "MOCK" | "SANDBOX" | "PRODUCTION_DISABLED";

export type IntegrationRunInput = {
  /** What the job does, e.g. "EXPORT" | "IMPORT" | "HEALTHCHECK" | "MOCK_RUN" (free-form per batch). */
  jobKind: string;
  /** Optional non-secret payload (aggregate / config data). Never patient-identifying. */
  payload?: unknown;
};

export type IntegrationRunResult = {
  ok: boolean;
  /** Human-readable French detail recorded on the job/event. */
  detail: string;
  /** Optional structured output (simulated). */
  output?: Record<string, unknown>;
};

/** Every connector implements this. The mock is the only concrete adapter shipped in Phase 4. */
export interface IntegrationConnectorAdapter {
  readonly environment: ConnectorEnvironment;
  /** True for mock/sandbox adapters (the only kind that exists). Used by the UI "MOCK" marker. */
  readonly isMock: boolean;
  /** Run the job. The mock performs purely in-memory work and NEVER touches the network. */
  run(input: IntegrationRunInput): Promise<IntegrationRunResult>;
}

/**
 * The default connector: a fully in-memory simulation. It makes NO `fetch`/HTTP/socket call of any
 * kind — the network-egress guard test asserts exactly this. Marked clearly as mock so nothing can
 * mistake a simulated result for a real integration.
 */
export class MockIntegrationConnector implements IntegrationConnectorAdapter {
  readonly environment: ConnectorEnvironment;
  readonly isMock = true;

  constructor(environment: ConnectorEnvironment = "MOCK") {
    this.environment = environment;
  }

  async run(input: IntegrationRunInput): Promise<IntegrationRunResult> {
    // Purely synchronous, in-memory simulation — no network, no side effects outside the caller's tx.
    return {
      ok: true,
      detail: `Connecteur FICTIF (${this.environment}) — exécution simulée de « ${input.jobKind} » (aucun appel réseau réel).`,
      output: { simulated: true, jobKind: input.jobKind, hasPayload: input.payload != null },
    };
  }
}

/** Thrown when a connector that could reach a real endpoint is asked to run while live mode is off. */
export class IntegrationLiveDisabledError extends Error {
  constructor(public readonly environment: ConnectorEnvironment) {
    super(
      `Intégration en direct désactivée — un connecteur « ${environment} » ne peut pas être exécuté ` +
        `(mode fictif/sandbox uniquement, aucun appel externe réel).`,
    );
    this.name = "IntegrationLiveDisabledError";
  }
}

/** The env flag that would (in a FUTURE patch) enable live integrations. Default: OFF. */
export const INTEGRATION_LIVE_FLAG = "HMIS_INTEGRATION_LIVE_ENABLED";

/**
 * Whether live external integration is enabled. Fails closed: only the exact string "true" enables
 * it; anything else (including unset) keeps live calls OFF. Pure — env is injectable for tests.
 */
export function isLiveIntegrationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[INTEGRATION_LIVE_FLAG] === "true";
}

/**
 * Resolve the adapter for a connector environment. MOCK/SANDBOX → the in-memory mock. PRODUCTION_DISABLED
 * → ALWAYS refuses: when live mode is off it throws `IntegrationLiveDisabledError`; even when a future
 * flag turns live mode on, no production adapter is implemented here, so it still throws. The net effect
 * is that NO live network call can originate from this framework in Phase 4.
 */
export function resolveConnectorAdapter(
  environment: ConnectorEnvironment,
  opts: { liveEnabled?: boolean } = {},
): IntegrationConnectorAdapter {
  if (environment === "MOCK" || environment === "SANDBOX") {
    return new MockIntegrationConnector(environment);
  }
  // PRODUCTION_DISABLED — the placeholder slot for a future real connector.
  if (!opts.liveEnabled) {
    throw new IntegrationLiveDisabledError(environment);
  }
  throw new Error(
    "Aucun connecteur de production n'est implémenté en Phase 4 (intégrations fictives/sandbox uniquement).",
  );
}
