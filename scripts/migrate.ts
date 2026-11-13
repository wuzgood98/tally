/** Applies pending migrations to DATABASE_URL (or POSTGRES_URL), or to the local PGlite database. */

import { connectFromEnv } from "@/lib/db/client";

const connection = connectFromEnv();

await connection.migrate();

await connection.close();

console.info(`Migrated the ${connection.kind} database.`);
