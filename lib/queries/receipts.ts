import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  branch,
  goodsReceipt,
  product,
  purchaseOrder,
  stockMovement,
  supplier,
  user,
} from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";

export const RECEIPTS_PAGE_SIZE = 30;

export const listReceipts = async (scope: Scope, page: number) => {
  const where =
    scope.kind === "branch"
      ? eq(goodsReceipt.branchId, scope.branchId)
      : undefined;

  const [rows, [count]] = await Promise.all([
    getDb()
      .select({
        branchName: branch.name,
        createdAt: goodsReceipt.createdAt,
        id: goodsReceipt.id,
        lines: sql<number>`(select count(*)::int from ${stockMovement} where ${stockMovement.receiptId} = ${goodsReceipt.id})`,
        number: goodsReceipt.number,
        purchaseOrderNumber: purchaseOrder.number,
        receivedBy: user.name,
        supplierName: supplier.name,
        supplierReference: goodsReceipt.supplierReference,
        totalCost: goodsReceipt.totalCost,
      })
      .from(goodsReceipt)
      .innerJoin(branch, eq(branch.id, goodsReceipt.branchId))
      .innerJoin(supplier, eq(supplier.id, goodsReceipt.supplierId))
      .leftJoin(user, eq(user.id, goodsReceipt.receivedById))
      .leftJoin(
        purchaseOrder,
        eq(purchaseOrder.id, goodsReceipt.purchaseOrderId)
      )
      .where(where)
      .orderBy(desc(goodsReceipt.createdAt), desc(goodsReceipt.id))
      .limit(RECEIPTS_PAGE_SIZE)
      .offset((page - 1) * RECEIPTS_PAGE_SIZE),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(goodsReceipt)
      .where(where),
  ]);

  return { rows, total: count?.count ?? 0 };
};

export const getReceipt = async (id: number) => {
  const [header] = await getDb()
    .select({
      branchId: goodsReceipt.branchId,
      branchName: branch.name,
      createdAt: goodsReceipt.createdAt,
      id: goodsReceipt.id,
      note: goodsReceipt.note,
      number: goodsReceipt.number,
      purchaseOrderId: goodsReceipt.purchaseOrderId,
      purchaseOrderNumber: purchaseOrder.number,
      receivedBy: user.name,
      supplierCountry: supplier.country,
      supplierName: supplier.name,
      supplierReference: goodsReceipt.supplierReference,
      totalCost: goodsReceipt.totalCost,
    })
    .from(goodsReceipt)
    .innerJoin(branch, eq(branch.id, goodsReceipt.branchId))
    .innerJoin(supplier, eq(supplier.id, goodsReceipt.supplierId))
    .leftJoin(user, eq(user.id, goodsReceipt.receivedById))
    .leftJoin(purchaseOrder, eq(purchaseOrder.id, goodsReceipt.purchaseOrderId))
    .where(eq(goodsReceipt.id, id));

  if (header === undefined) {
    return null;
  }

  const lines = await getDb()
    .select({
      balanceAfter: stockMovement.balanceAfter,
      name: product.name,
      productId: product.id,
      quantity: stockMovement.quantity,
      sku: product.sku,
      unit: product.unit,
      unitCost: stockMovement.unitCost,
    })
    .from(stockMovement)
    .innerJoin(product, eq(product.id, stockMovement.productId))
    .where(eq(stockMovement.receiptId, id))
    .orderBy(asc(product.name));

  return { ...header, lines };
};
