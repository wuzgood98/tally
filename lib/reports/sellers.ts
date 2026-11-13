/**
 * What sold and what didn't, by product, over a period: units and takings
 * net of returns (a return counts on the day it came back), gross margin,
 * and how many days the stock on hand would last at that rate.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { Executor } from "@/lib/db/client";
import type { ReportPeriod } from "@/lib/reports/period";
import { inList, queryRows } from "@/lib/reports/rows";

export interface SellerRow {
  readonly productId: number;
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly active: boolean;
  /** Units sold less units returned in the period. */
  readonly units: number;
  readonly returnedUnits: number;
  /** Takings net of refunds, VAT included, in pesewas. */
  readonly sales: number;
  /** What the units sold cost, net of returns, in pesewas. */
  readonly cost: number;
  readonly margin: number;
  /** Units on the shelves now (a line below zero counts as none). */
  readonly onHand: number;
  /** Those units at today's average cost, in pesewas: what's tied up. */
  readonly stockValue: number;
  /** Days the stock on hand lasts at this period's rate; null if nothing sold. */
  readonly daysOfCover: number | null;
}

const sellerRow = z.object({
  active: z.boolean(),
  category: z.string(),
  cost: z.coerce.number(),
  name: z.string(),
  on_hand: z.coerce.number(),
  product_id: z.coerce.number(),
  returned_cost: z.coerce.number(),
  returned_sales: z.coerce.number(),
  returned_units: z.coerce.number(),
  sales: z.coerce.number(),
  sku: z.string(),
  stock_value: z.coerce.number(),
  units: z.coerce.number(),
});

/**
 * Every product sold, returned or held in these branches, busiest first.
 * Lines with stock and no sales are included: they're the dead stock.
 */
export const getSellers = async (
  db: Executor,
  branchIds: readonly string[],
  period: ReportPeriod
): Promise<SellerRow[]> => {
  if (branchIds.length === 0) {
    return [];
  }

  const branches = inList(branchIds);

  const result = await queryRows(
    db,
    sellerRow,
    sql`
    with sold as (
      select l.product_id, sum(l.quantity) as units,
        sum(l.quantity::bigint * l.unit_price) as sales,
        sum(l.quantity::bigint * l.unit_cost) as cost
      from sale_line l
      join sale s on s.id = l.sale_id
      where s.branch_id in (${branches})
        and s.created_at >= ${period.from} and s.created_at < ${period.to}
      group by 1
    ), returned as (
      select rl.product_id, sum(rl.quantity) as units,
        sum(rl.quantity::bigint * sl.unit_price) as sales,
        sum(rl.quantity::bigint * sl.unit_cost) as cost
      from sale_return_line rl
      join sale_return r on r.id = rl.return_id
      join sale_line sl on sl.sale_id = r.sale_id and sl.product_id = rl.product_id
      where r.branch_id in (${branches})
        and r.created_at >= ${period.from} and r.created_at < ${period.to}
      group by 1
    ), held as (
      select product_id, sum(greatest(on_hand, 0)) as on_hand
      from stock_level
      where branch_id in (${branches})
      group by 1
    )
    select p.id as product_id, p.sku, p.name, p.active, c.name as category,
      coalesce(s.units, 0) as units, coalesce(s.sales, 0) as sales,
      coalesce(s.cost, 0) as cost,
      coalesce(r.units, 0) as returned_units,
      coalesce(r.sales, 0) as returned_sales,
      coalesce(r.cost, 0) as returned_cost,
      coalesce(h.on_hand, 0) as on_hand,
      coalesce(h.on_hand, 0)::bigint * p.average_cost as stock_value
    from product p
    join category c on c.id = p.category_id
    left join sold s on s.product_id = p.id
    left join returned r on r.product_id = p.id
    left join held h on h.product_id = p.id
    where s.product_id is not null
      or r.product_id is not null
      or coalesce(h.on_hand, 0) > 0
    order by coalesce(s.units, 0) - coalesce(r.units, 0) desc, p.name
  `
  );

  return result.map((row) => {
    const units = row.units - row.returned_units;
    const sales = row.sales - row.returned_sales;
    const cost = row.cost - row.returned_cost;

    return {
      active: row.active,
      category: row.category,
      cost,
      daysOfCover:
        units > 0 ? Math.round(row.on_hand / (units / period.days)) : null,
      margin: sales - cost,
      name: row.name,
      onHand: row.on_hand,
      productId: row.product_id,
      returnedUnits: row.returned_units,
      sales,
      sku: row.sku,
      stockValue: row.stock_value,
      units,
    };
  });
};

/** Stock that would last longer than this at the period's rate is slow. */
export const SLOW_COVER_DAYS = 90;

export interface SellerGroups {
  /** Sold something, most units first. */
  readonly fast: readonly SellerRow[];
  /** Sold, but the stock on hand lasts over `SLOW_COVER_DAYS`; longest first. */
  readonly slow: readonly SellerRow[];
  /** Holding stock, nothing sold (net); most money tied up first. */
  readonly unsold: readonly SellerRow[];
  readonly totals: {
    readonly units: number;
    readonly sales: number;
    readonly cost: number;
    readonly margin: number;
    readonly unsoldValue: number;
  };
}

/** Splits the report's rows into fast, slow and not selling, with totals. */
export const groupSellers = (rows: readonly SellerRow[]): SellerGroups => {
  const fast: SellerRow[] = [];
  const slow: SellerRow[] = [];
  const unsold: SellerRow[] = [];
  const totals = { cost: 0, margin: 0, sales: 0, units: 0, unsoldValue: 0 };

  for (const row of rows) {
    totals.units += row.units;
    totals.sales += row.sales;
    totals.cost += row.cost;
    totals.margin += row.margin;

    if (row.units > 0) {
      fast.push(row);
    }

    if (row.daysOfCover !== null && row.daysOfCover > SLOW_COVER_DAYS) {
      slow.push(row);
    }

    if (row.units <= 0 && row.onHand > 0) {
      unsold.push(row);
      totals.unsoldValue += row.stockValue;
    }
  }

  return {
    fast: fast.toSorted((a, b) => b.units - a.units || b.sales - a.sales),
    slow: slow.toSorted((a, b) => (b.daysOfCover ?? 0) - (a.daysOfCover ?? 0)),
    totals,
    unsold: unsold.toSorted((a, b) => b.stockValue - a.stockValue),
  };
};
