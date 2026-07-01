import { RELEASE_CANDIDATE } from "@/lib/constants";
import { APP_VERSION, DATA_MODE, REAL_DATA_ENABLED } from "@/lib/data-mode";
import { DEPLOYMENT_ENVIRONMENT } from "@/lib/deployment-mode";

/**
 * Public health/status route (Phase 6D). NO auth, NO database query, NO patient data,
 * NO secrets — a safe non-sensitive signal for Vercel/Neon monitoring and stakeholder
 * verification: the app is up, which environment it is, and its synthetic-only / live-
 * integrations-off posture. Reads only pure libs + the fail-closed env flags.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "santegrid",
    environment: DEPLOYMENT_ENVIRONMENT,
    dataMode: DATA_MODE,
    syntheticDataOnly: !REAL_DATA_ENABLED,
    liveIntegrations: process.env.HMIS_INTEGRATION_LIVE_ENABLED === "true",
    mpiLive: process.env.HMIS_MPI_LIVE_ENABLED === "true",
    appVersion: APP_VERSION,
    releaseCandidate: RELEASE_CANDIDATE,
    timestamp: new Date().toISOString(),
  });
}
