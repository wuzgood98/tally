import "server-only";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import {
  branch,
  product,
  stockTransfer,
  stockTransferLine,
  user,
} from "@/lib/db/schema";
import type { TransferStatus } from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";
import type { TransferDirection } from "@/lib/transfer-direction";

export const TRANSFERS_PAGE_SIZE = 30;

export interface TransferFilters {
  readonly status: TransferStatus | null;
  /** Only meaningful when looking at one branch. */
  readonly direction: TransferDirection;
}

const fromBranch = alias(branch, "from_branch");
const toBranch = alias(branch, "to_branch");
const dispatcher = alias(user, "dispatcher");
const receiver = alias(user, "receiver");
const canceller = alias(user, "canceller");

const scopeCondition = (
  scope: Scope,
  direction: TransferDirection
): SQL | undefined => {
  if (scope.kind === "all") {
    return undefined;
  }

  if (direction === "incoming") {
    return eq(stockTransfer.toBranchId, scope.branchId);
  }

  if (direction === "outgoing") {
    return eq(stockTransfer.fromBranchId, scope.branchId);
  }

  return or(
    eq(stockTransfer.toBranchId, scope.branchId),
    eq(stockTransfer.fromBranchId, scope.branchId)
  );
};

export const listTransfers = async (
  scope: Scope,
  filters: TransferFilters,
  page: number
) => {
  const where = and(
    scopeCondition(scope, filters.direction),
    filters.status === null
      ? undefined
      : eq(stockTransfer.status, filters.status)
  );

  const [rows, [count]] = await Promise.all([
    getDb()
      .select({
        createdAt: stockTransfer.createdAt,
        dispatchedBy: dispatcher.name,
        fromBranchId: stockTransfer.fromBranchId,
        fromName: fromBranch.name,
        id: stockTransfer.id,
        // Unique aliases: subquery columns are emitted without a table prefix.
        lineCount:
          sql<number>`(select count(*)::int from ${stockTransferLine} where ${stockTransferLine.transferId} = ${stockTransfer.id})`.as(
            "transfer_line_count"
          ),
        number: stockTransfer.number,
        status: stockTransfer.status,
        toBranchId: stockTransfer.toBranchId,
        toName: toBranch.name,
        totalCost: stockTransfer.totalCost,
        unitsLost:
          sql<number>`(select coalesce(sum(${stockTransferLine.quantitySent} - ${stockTransferLine.quantityReceived}), 0)::int from ${stockTransferLine} where ${stockTransferLine.transferId} = ${stockTransfer.id} and ${stockTransferLine.quantityReceived} is not null)`.as(
            "transfer_units_lost"
          ),
        unitsSent:
          sql<number>`(select coalesce(sum(${stockTransferLine.quantitySent}), 0)::int from ${stockTransferLine} where ${stockTransferLine.transferId} = ${stockTransfer.id})`.as(
            "transfer_units_sent"
          ),
      })
      .from(stockTransfer)
      .innerJoin(fromBranch, eq(fromBranch.id, stockTransfer.fromBranchId))
      .innerJoin(toBranch, eq(toBranch.id, stockTransfer.toBranchId))
      .leftJoin(dispatcher, eq(dispatcher.id, stockTransfer.dispatchedById))
      .where(where)
      .orderBy(desc(stockTransfer.createdAt), desc(stockTransfer.id))
      .limit(TRANSFERS_PAGE_SIZE)
      .offset((page - 1) * TRANSFERS_PAGE_SIZE),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(stockTransfer)
      .where(where),
  ]);

  return { rows, total: count?.count ?? 0 };
};

export type TransferListRow = Awaited<
  ReturnType<typeof listTransfers>
>["rows"][number];

export const getTransfer = async (id: number) => {
  const [header] = await getDb()
    .select({
      cancelledAt: stockTransfer.cancelledAt,
      cancelledBy: canceller.name,
      createdAt: stockTransfer.createdAt,
      dispatchedBy: dispatcher.name,
      fromBranchId: stockTransfer.fromBranchId,
      fromName: fromBranch.name,
      id: stockTransfer.id,
      note: stockTransfer.note,
      number: stockTransfer.number,
      receiveNote: stockTransfer.receiveNote,
      receivedAt: stockTransfer.receivedAt,
      receivedBy: receiver.name,
      status: stockTransfer.status,
      toBranchId: stockTransfer.toBranchId,
      toName: toBranch.name,
      totalCost: stockTransfer.totalCost,
    })
    .from(stockTransfer)
    .innerJoin(fromBranch, eq(fromBranch.id, stockTransfer.fromBranchId))
    .innerJoin(toBranch, eq(toBranch.id, stockTransfer.toBranchId))
    .leftJoin(dispatcher, eq(dispatcher.id, stockTransfer.dispatchedById))
    .leftJoin(receiver, eq(receiver.id, stockTransfer.receivedById))
    .leftJoin(canceller, eq(canceller.id, stockTransfer.cancelledById))
    .where(eq(stockTransfer.id, id));

  if (header === undefined) {
    return null;
  }

  const lines = await getDb()
    .select({
      name: product.name,
      productId: product.id,
      quantityReceived: stockTransferLine.quantityReceived,
      quantitySent: stockTransferLine.quantitySent,
      sku: product.sku,
      unit: product.unit,
      unitCost: stockTransferLine.unitCost,
    })
    .from(stockTransferLine)
    .innerJoin(product, eq(product.id, stockTransferLine.productId))
    .where(eq(stockTransferLine.transferId, id))
    .orderBy(asc(product.name));

  return { ...header, lines };
};

export type TransferDetail = NonNullable<
  Awaited<ReturnType<typeof getTransfer>>
>;

/** Transfers on the road towards the scope's branch, or anywhere for all branches. */
export const countIncomingInTransit = async (scope: Scope): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(stockTransfer)
    .where(
      and(
        eq(stockTransfer.status, "in_transit"),
        scopeCondition(scope, "incoming")
      )
    );

  return row?.count ?? 0;
};

/** Units of a product in transit, by receiving branch id. */
export const getProductInTransit = async (
  productId: number
): Promise<Map<string, number>> => {
  const rows = await getDb()
    .select({
      branchId: stockTransfer.toBranchId,
      units: sql<number>`sum(${stockTransferLine.quantitySent})::int`,
    })
    .from(stockTransferLine)
    .innerJoin(
      stockTransfer,
      eq(stockTransfer.id, stockTransferLine.transferId)
    )
    .where(
      and(
        eq(stockTransferLine.productId, productId),
        eq(stockTransfer.status, "in_transit")
      )
    )
    .groupBy(stockTransfer.toBranchId);

  return new Map(rows.map((row) => [row.branchId, row.units]));
};
