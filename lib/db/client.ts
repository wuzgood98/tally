/**
 * Database connections. With DATABASE_URL set, Tally talks to a real Postgres
 * server. Without it, it runs PGlite (Postgres compiled to WebAssembly) in
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

import * as schema from "./schema.ts";

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

export const connectPostgres = (connectionString: string): Connection => {
  const pool = new Pool({ connectionString, max: 10 });
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

/** The connection the app and scripts use, chosen by DATABASE_URL. */
export const connectFromEnv = (): Connection => {
  const url = process.env.DATABASE_URL;

  return url !== undefined && url !== ""
    ? connectPostgres(url)
    : connectPglite(PGLITE_DIR);
};
