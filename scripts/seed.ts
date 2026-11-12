/** Migrates, then fills an empty database with Akwaaba Mall's demo data. */

import { connectFromEnv } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";

const connection = connectFromEnv();

await connection.migrate();

const started = performance.now();
const summary = await seed(connection.db);

await connection.close();

console.info(
  `Seeded ${summary.products} products, ${summary.staff} staff and ${summary.movements} stock movements in ${Math.round(performance.now() - started)} ms.`
);
