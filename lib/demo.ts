import "server-only";
import { databaseKind } from "@/lib/db";

/**
 * Demo mode lists the sample accounts on the sign-in page. On by default for
 * the local PGlite database; a real deployment turns it on only on purpose.
 */
export const isDemo = (): boolean =>
  process.env.TALLY_DEMO === "true" ||
  (databaseKind() === "pglite" && process.env.TALLY_DEMO !== "false");
