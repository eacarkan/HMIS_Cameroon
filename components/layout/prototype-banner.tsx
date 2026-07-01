import { TriangleAlert } from "lucide-react";

import { PROTOTYPE_LABEL } from "@/lib/constants";

/**
 * Persistent prototype label (01, 06 §5, R-001). A slim, calm notice band shown at
 * the very top of every screen so the demo can never be mistaken for production.
 * The exact same wording appears on printed documents (from Step 10).
 */
export function PrototypeBanner() {
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900"
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      <span>{PROTOTYPE_LABEL}</span>
    </div>
  );
}
