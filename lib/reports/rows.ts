import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import type { Executor } from "@/lib/db/client";

/**
 * Runs a raw query and checks its rows. Sums come back as strings from
 * node-postgres (bigint, numeric) and as numbers from PGlite, so number
 * columns should use `z.coerce.number()`.
 */
export const queryRows = async <S extends z.ZodType>(
  db: Executor,
  schema: S,
  query: SQL
): Promise<z.output<S>[]> =>
  z.object({ rows: z.array(schema) }).parse(await db.execute(query)).rows;

/** Bound parameters for `in (…)`; callers return early when there are none. */
export const inList = (values: readonly string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  );
