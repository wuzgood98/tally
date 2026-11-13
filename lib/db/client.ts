/**
 * Database connections. With DATABASE_URL (or Vercel's POSTGRES_URL) set,
 * Tally talks to a real Postgres server. Without it, it runs PGlite (Postgres compiled to WebAssembly) in
 * this process, stored in `.data/pglite`, so `pnpm dev` works with nothing
 * installed. Both run the same migrations, so the schema is identical.
 *
 * No "@/" imports: the migrate and seed scripts load this file directly.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import type { PoolConfig } from "pg";

import * as schema from "./schema.ts";
import { databaseUrl } from "./url.ts";

export type Schema = typeof schema;

export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Anything queries can run on: the database or an open transaction. */
export type Executor = Db | Tx;

export interface Connection {
  readonly db: Db;
  readonly kind: "pglite" | "postgres";
  /** Applies any pending migrations. */
  readonly migrate: () => Promise<void>;
  readonly close: () => Promise<void>;
}

const MIGRATIONS = path.join(process.cwd(), "drizzle");
const CASING = "snake_case";

/** In-process Postgres. Pass no directory for a throwaway in-memory database. */
export const connectPglite = (dataDir?: string): Connection => {
  if (dataDir !== undefined) {
    mkdirSync(dataDir, { recursive: true });
  }

  const client = new PGlite(dataDir);
  const db = drizzlePglite({ casing: CASING, client, schema });

  return {
    close: async () => {
      await client.close();
    },
    db,
    kind: "pglite",
    migrate: async () => {
      await migratePglite(db, { migrationsFolder: MIGRATIONS });
    },
  };
};

/**
 * Verified TLS for hosts that sign with their own certificate authority,
 * such as Supabase: the server's certificate must chain to `caCert` (PEM)
 * and match the host name. A literal backslash-n stands for a line break,
 * for settings screens that only take one line. The URL's own sslmode is
 * dropped, because node-postgres would let it override these options.
 */
const withCaCert = (connectionString: string, caCert: string): PoolConfig => {
  const url = new URL(connectionString);

  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");

  return {
    connectionString: url.toString(),
    ssl: {
      ca: caCert.replaceAll(String.raw`\n`, "\n"),
      rejectUnauthorized: true,
    },
  };
};

export const connectPostgres = (
  connectionString: string,
  caCert?: string
): Connection => {
  const target =
    caCert === undefined || caCert.trim() === ""
      ? { connectionString }
      : withCaCert(connectionString, caCert);

  const pool = new Pool({ ...target, max: 10 });
  const db = drizzleNodePg({ casing: CASING, client: pool, schema });

  return {
    close: async () => {
      await pool.end();
    },
    db,
    kind: "postgres",
    migrate: async () => {
      await migrateNodePg(db, { migrationsFolder: MIGRATIONS });
    },
  };
};

export const PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");

/** The connection the app and scripts use, chosen by `databaseUrl`. */
export const connectFromEnv = (): Connection => {
  const url = databaseUrl(process.env);

  return url === null
    ? connectPglite(PGLITE_DIR)
    : connectPostgres(url, process.env.DATABASE_CA_CERT);
};
