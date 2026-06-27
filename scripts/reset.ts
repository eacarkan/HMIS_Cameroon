import "dotenv/config";

/**
 * Reset — PLACEHOLDER (build Step 3).
 *
 * Returns the demo data to its known starting state so every run reproduces the
 * same journey and the same numbers (07_Demo_Scenario §14). Implemented once the
 * schema + seed exist; it will truncate demo tables and re-run the seed. Touches
 * fake demo data only.
 */
async function reset() {
  console.log(
    "Reset placeholder — implemented at build Step 3 (re-seed to a known state). Nothing to reset yet.",
  );
}

void reset();
