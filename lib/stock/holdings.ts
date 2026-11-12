/**
 * What the company owns of a product: every branch's shelf stock plus anything
 * on a truck between branches. Goods in transit are in no branch's on_hand,
 * but they still count towards cost and value.
 */

import { eq, sql } from "drizzle-orm";

import type { Executor } from "@/lib/db/client";
import {
  product,
  stockLevel,
  stockTransfer,
  stockTransferLine,
} from "@/lib/db/schema";

export const companyUnitsHeld = async (
  executor: Executor,
  productId: number
): Promise<number> => {
  // One statement: inside a transaction, queries share a single connection.
  const [row] = await executor
    .select({
      units: sql<number>`(
        (select coalesce(sum(greatest(${stockLevel.onHand}, 0)), 0)
          from ${stockLevel}
          where ${stockLevel.productId} = ${product.id})
        + (select coalesce(sum(${stockTransferLine.quantitySent}), 0)
          from ${stockTransferLine}
          join ${stockTransfer} on ${stockTransfer.id} = ${stockTransferLine.transferId}
          where ${stockTransferLine.productId} = ${product.id}
            and ${stockTransfer.status} = 'in_transit')
      )::int`,
    })
    .from(product)
    .where(eq(product.id, productId));

  return row?.units ?? 0;
};
