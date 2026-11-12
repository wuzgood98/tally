import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  branch,
  category,
  product,
  stockLevel,
  supplier,
} from "@/lib/db/schema";
import type { Unit } from "@/lib/db/schema";
import { effectiveReorderPoint } from "@/lib/queries/stock-status";
import type { Scope } from "@/lib/scope";

export const PAGE_SIZE = 50;

export type StatusFilter = "all" | "low" | "out" | "discontinued";

export interface ProductQuery {
  readonly search: string;
  readonly categoryId: number | null;
  readonly status: StatusFilter;
  readonly page: number;
}

export interface ProductListRow {
  readonly id: number;
  readonly sku: string;
  readonly barcode: string | null;
  readonly name: string;
  readonly categoryName: string;
  readonly unit: Unit;
  readonly sellPrice: number;
  readonly active: boolean;
  /** In scope: one branch's stock, or the total across branches. */
  readonly onHand: number;
  /** One branch: its threshold. All branches: null. */
  readonly reorderPoint: number | null;
  /** How many branches in scope are low or out. */
  readonly branchesLow: number;
  readonly branchesOut: number;
  readonly stocked: boolean;
}

/** Escapes % and _ so a search for "100%" means the text "100%". */
const likePattern = (text: string): string =>
  `%${text.replaceAll(/[\\%_]/gu, (match) => `\\${match}`)}%`;

const searchCondition = (search: string): SQL | undefined => {
  const text = search.trim();

  if (!text) {
    return undefined;
  }

  // A scanner types the whole barcode; staff often type the start of a SKU.
  return or(
    eq(product.barcode, text),
    ilike(product.sku, `${text.replaceAll(/[\\%_]/gu, "")}%`),
    ilike(product.name, likePattern(text))
  );
};

export const listProducts = async (
  scope: Scope,
  query: ProductQuery
): Promise<{ rows: ProductListRow[]; total: number }> => {
  // Per-product stock in scope, computed once and joined.
  const levels = getDb()
    .select({
      branchesLow:
        sql<number>`count(*) filter (where ${stockLevel.onHand} > 0 and ${stockLevel.onHand} <= ${effectiveReorderPoint})::int`.as(
          "level_branches_low"
        ),
      branchesOut:
        sql<number>`count(*) filter (where ${stockLevel.onHand} = 0)::int`.as(
          "level_branches_out"
        ),
      onHand: sql<number>`sum(${stockLevel.onHand})::int`.as("level_on_hand"),
      productId: stockLevel.productId,
      reorderPoint: sql<number>`max(${effectiveReorderPoint})::int`.as(
        "level_reorder_point"
      ),
    })
    .from(stockLevel)
    .innerJoin(product, eq(product.id, stockLevel.productId))
    .where(
      scope.kind === "branch"
        ? eq(stockLevel.branchId, scope.branchId)
        : undefined
    )
    .groupBy(stockLevel.productId)
    .as("levels");

  const statusCondition: Record<StatusFilter, SQL | undefined> = {
    all: eq(product.active, true),
    discontinued: eq(product.active, false),
    low: and(eq(product.active, true), sql`${levels.branchesLow} > 0`),
    out: and(eq(product.active, true), sql`${levels.branchesOut} > 0`),
  };

  const where = and(
    searchCondition(query.search),
    query.categoryId === null
      ? undefined
      : eq(product.categoryId, query.categoryId),
    statusCondition[query.status]
  );

  const [rows, [count]] = await Promise.all([
    getDb()
      .select({
        active: product.active,
        barcode: product.barcode,
        branchesLow: sql<number>`coalesce(${levels.branchesLow}, 0)`,
        branchesOut: sql<number>`coalesce(${levels.branchesOut}, 0)`,
        categoryName: category.name,
        id: product.id,
        name: product.name,
        onHand: sql<number>`coalesce(${levels.onHand}, 0)`,
        reorderPoint: sql<
          number | null
        >`${scope.kind === "branch" ? sql`coalesce(${levels.reorderPoint}, ${product.reorderPoint})` : sql`null`}`,
        sellPrice: product.sellPrice,
        sku: product.sku,
        stocked: sql<boolean>`${levels.productId} is not null`,
        unit: product.unit,
      })
      .from(product)
      .innerJoin(category, eq(category.id, product.categoryId))
      .leftJoin(levels, eq(levels.productId, product.id))
      .where(where)
      .orderBy(asc(product.name), asc(product.id))
      .limit(PAGE_SIZE)
      .offset((query.page - 1) * PAGE_SIZE),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(product)
      .leftJoin(levels, eq(levels.productId, product.id))
      .where(where),
  ]);

  return { rows, total: count?.count ?? 0 };
};

export const listCategories = async () =>
  await getDb()
    .select({
      department: category.department,
      id: category.id,
      name: category.name,
    })
    .from(category)
    .orderBy(asc(category.department), asc(category.name));

export const listSuppliers = async () =>
  await getDb()
    .select({ country: supplier.country, id: supplier.id, name: supplier.name })
    .from(supplier)
    .orderBy(asc(supplier.name));

export const getProduct = async (id: number) => {
  const [row] = await getDb()
    .select({
      active: product.active,
      averageCost: product.averageCost,
      barcode: product.barcode,
      categoryId: product.categoryId,
      categoryName: category.name,
      defaultSupplierId: product.defaultSupplierId,
      department: category.department,
      id: product.id,
      name: product.name,
      reorderPoint: product.reorderPoint,
      sellPrice: product.sellPrice,
      sku: product.sku,
      supplierName: supplier.name,
      unit: product.unit,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .leftJoin(supplier, eq(supplier.id, product.defaultSupplierId))
    .where(eq(product.id, id));

  return row ?? null;
};

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** Every branch, with this product's stock there (zero where never stocked). */
export const getProductLevels = async (productId: number) =>
  await getDb()
    .select({
      binLocation: stockLevel.binLocation,
      branchId: branch.id,
      branchKind: branch.kind,
      branchName: branch.name,
      onHand: sql<number>`coalesce(${stockLevel.onHand}, 0)`,
      reorderOverride: stockLevel.reorderPoint,
      stocked: sql<boolean>`${stockLevel.productId} is not null`,
    })
    .from(branch)
    .leftJoin(
      stockLevel,
      and(
        eq(stockLevel.branchId, branch.id),
        eq(stockLevel.productId, productId)
      )
    )
    .orderBy(asc(branch.kind), asc(branch.name));

/** Exact barcode or SKU, for scanners on the receiving and adjustment screens. */
export const findProductByCode = async (code: string) => {
  const text = code.trim();

  if (!text) {
    return null;
  }

  const [row] = await getDb()
    .select({
      active: product.active,
      averageCost: product.averageCost,
      barcode: product.barcode,
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
    })
    .from(product)
    .where(
      or(eq(product.barcode, text), sql`upper(${product.sku}) = upper(${text})`)
    )
    .limit(1);

  return row ?? null;
};
