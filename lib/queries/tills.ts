import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { branch, sale, till } from "@/lib/db/schema";

export const listTills = async () =>
  await getDb()
    .select({
      branchName: branch.name,
      createdAt: till.createdAt,
      id: till.id,
      keyPrefix: till.keyPrefix,
      lastUsedAt: till.lastUsedAt,
      name: till.name,
      revokedAt: till.revokedAt,
      // Unique alias: subquery columns are emitted without a table prefix.
      sales:
        sql<number>`(select count(*)::int from ${sale} where ${sale.tillId} = ${till.id})`.as(
          "till_sales"
        ),
    })
    .from(till)
    .innerJoin(branch, eq(branch.id, till.branchId))
    .orderBy(
      sql`${till.revokedAt} is not null`,
      asc(branch.name),
      desc(till.createdAt)
    );
