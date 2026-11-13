/**
 * Deletes every table and reseeds. On a real Postgres server this needs
 * `--yes`, because it destroys data; the local PGlite folder is just removed.
 * Stop the dev server first: PGlite allows one process at a time.
 */

import { rm } from "node:fs/promises";

import { sql } from "drizzle-orm";

import { connectFromEnv, PGLITE_DIR } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";
import { databaseUrl } from "@/lib/db/url";

if (databaseUrl(process.env) === null) {
  await rm(PGLITE_DIR, { force: true, recursive: true });
} else {
  if (!process.argv.includes("--yes")) {
    console.error(
      "This drops every table in the Postgres database. Run again with --yes to confirm."
    );
    process.exit(1);
  }

  const connection = connectFromEnv();
  await connection.db.execute(sql`drop schema if exists drizzle cascade`);
  await connection.db.execute(sql`drop schema public cascade`);
  await connection.db.execute(sql`create schema public`);
  await connection.close();
}

const connection = connectFromEnv();

await connection.migrate();

const summary = await seed(connection.db);

await connection.close();

console.info(
  `Reset and seeded ${summary.products} products and ${summary.movements} movements.`
);
