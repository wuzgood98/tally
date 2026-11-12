import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import {
  branch,
  goodsReceipt,
  product,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
  user,
} from "@/lib/db/schema";
import type { PurchaseOrderStatus } from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";

export const PURCHASE_ORDERS_PAGE_SIZE = 30;

const creator = alias(user, "po_creator");
const approver = alias(user, "po_approver");
const closer = alias(user, "po_closer");

export const listPurchaseOrders = async (
  scope: Scope,
  status: PurchaseOrderStatus | null,
  page: number
) => {
  const where = and(
    scope.kind === "branch"
      ? eq(purchaseOrder.branchId, scope.branchId)
      : undefined,
    status === null ? undefined : eq(purchaseOrder.status, status)
  );

  const [rows, [count]] = await Promise.all([
    getDb()
      .select({
        branchName: branch.name,
        createdAt: purchaseOrder.createdAt,
        expectedAt: purchaseOrder.expectedAt,
        id: purchaseOrder.id,
        number: purchaseOrder.number,
        // Unique aliases: subquery columns are emitted without a table prefix.
        // The query joins other tables, so the outer column keeps its prefix.
        ordered:
          sql<number>`(select coalesce(sum(${purchaseOrderLine.quantity}), 0)::int from ${purchaseOrderLine} where ${purchaseOrderLine.purchaseOrderId} = ${purchaseOrder.id})`.as(
            "po_units_ordered"
          ),
        received:
          sql<number>`(select coalesce(sum(${purchaseOrderLine.quantityReceived}), 0)::int from ${purchaseOrderLine} where ${purchaseOrderLine.purchaseOrderId} = ${purchaseOrder.id})`.as(
            "po_units_received"
          ),
        status: purchaseOrder.status,
        supplierName: supplier.name,
        totalCost: purchaseOrder.totalCost,
      })
      .from(purchaseOrder)
      .innerJoin(branch, eq(branch.id, purchaseOrder.branchId))
      .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
      .where(where)
      .orderBy(desc(purchaseOrder.createdAt), desc(purchaseOrder.id))
      .limit(PURCHASE_ORDERS_PAGE_SIZE)
      .offset((page - 1) * PURCHASE_ORDERS_PAGE_SIZE),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(purchaseOrder)
      .where(where),
  ]);

  return { rows, total: count?.count ?? 0 };
};

/** Drafts waiting for head office: the badge on the nav. */
export const countDraftPurchaseOrders = async (): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.status, "draft"));

  return row?.count ?? 0;
};

export const getPurchaseOrder = async (id: number) => {
  const [header] = await getDb()
    .select({
      approvedAt: purchaseOrder.approvedAt,
      approvedBy: approver.name,
      branchAddress: branch.address,
      branchCity: branch.city,
      branchId: purchaseOrder.branchId,
      branchName: branch.name,
      closedAt: purchaseOrder.closedAt,
      closedBy: closer.name,
      closeNote: purchaseOrder.closeNote,
      createdAt: purchaseOrder.createdAt,
      createdBy: creator.name,
      expectedAt: purchaseOrder.expectedAt,
      id: purchaseOrder.id,
      note: purchaseOrder.note,
      number: purchaseOrder.number,
      status: purchaseOrder.status,
      supplierContact: supplier.contactName,
      supplierCountry: supplier.country,
      supplierEmail: supplier.email,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      totalCost: purchaseOrder.totalCost,
    })
    .from(purchaseOrder)
    .innerJoin(branch, eq(branch.id, purchaseOrder.branchId))
    .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .leftJoin(creator, eq(creator.id, purchaseOrder.createdById))
    .leftJoin(approver, eq(approver.id, purchaseOrder.approvedById))
    .leftJoin(closer, eq(closer.id, purchaseOrder.closedById))
    .where(eq(purchaseOrder.id, id));

  if (header === undefined) {
    return null;
  }

  const [lines, receipts] = await Promise.all([
    getDb()
      .select({
        barcode: product.barcode,
        name: product.name,
        productId: product.id,
        quantity: purchaseOrderLine.quantity,
        quantityReceived: purchaseOrderLine.quantityReceived,
        sku: product.sku,
        unit: product.unit,
        unitCost: purchaseOrderLine.unitCost,
      })
      .from(purchaseOrderLine)
      .innerJoin(product, eq(product.id, purchaseOrderLine.productId))
      .where(eq(purchaseOrderLine.purchaseOrderId, id))
      .orderBy(asc(product.name)),
    getDb()
      .select({
        createdAt: goodsReceipt.createdAt,
        id: goodsReceipt.id,
        number: goodsReceipt.number,
        totalCost: goodsReceipt.totalCost,
      })
      .from(goodsReceipt)
      .where(eq(goodsReceipt.purchaseOrderId, id))
      .orderBy(asc(goodsReceipt.id)),
  ]);

  return { ...header, lines, receipts };
};

export type PurchaseOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getPurchaseOrder>>
>;

/** Units of one product still due on approved purchase orders, by branch id. */
export const getProductOnOrder = async (
  productId: number
): Promise<Map<string, number>> => {
  const rows = await getDb()
    .select({
      branchId: purchaseOrder.branchId,
      units: sql<number>`sum(${purchaseOrderLine.quantity} - ${purchaseOrderLine.quantityReceived})::int`,
    })
    .from(purchaseOrderLine)
    .innerJoin(
      purchaseOrder,
      eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId)
    )
    .where(
      and(
        eq(purchaseOrderLine.productId, productId),
        inArray(purchaseOrder.status, ["approved", "partly_received"])
      )
    )
    .groupBy(purchaseOrder.branchId);

  return new Map(rows.map((row) => [row.branchId, row.units]));
};
