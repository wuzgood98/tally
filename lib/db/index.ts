import "server-only";
import { connectFromEnv } from "@/lib/db/client";
import type { Connection, Db } from "@/lib/db/client";
import { isSeeded, seed } from "@/lib/db/seed";
import { databaseUrl } from "@/lib/db/url";

/**
 * One connection per server process, opened on the first query rather than
 * on import: `next build` imports every page in several workers at once, and
 * none of them should touch the database (PGlite allows one process per folder).
 *
 * Kept on globalThis so hot reload in development doesn't open a new pool,
 * or a second PGlite on the same folder, on every edit.
 */
// SAFETY: these optional slots are only ever written below, with these types.
const globalForDb = globalThis as typeof globalThis & {
  tallyConnection?: Connection;
  tallyReady?: Promise<void>;
};

const getConnection = (): Connection => {
  globalForDb.tallyConnection ??= connectFromEnv();

  return globalForDb.tallyConnection;
};

/** The database, connected on first use. */
export const getDb = (): Db => getConnection().db;

export const databaseKind = (): Connection["kind"] =>
  databaseUrl(process.env) === null ? "pglite" : "postgres";

/**
 * The local PGlite database prepares itself: it migrates, and seeds the demo
 * data the first time. A real Postgres server is migrated explicitly with
 * `pnpm db:migrate`, never behind your back.
 */
const prepare = async (): Promise<void> => {
  const connection = getConnection();

  if (connection.kind !== "pglite") {
    return;
  }

  await connection.migrate();

  if (!(await isSeeded(connection.db))) {
    await seed(connection.db);
  }
};

/** Await before the first query of a request. Cheap after the first call. */
export const databaseReady = async (): Promise<void> => {
  globalForDb.tallyReady ??= prepare();
  await globalForDb.tallyReady;
};
