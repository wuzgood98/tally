import "server-only";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { periodDays, reportPeriod } from "@/lib/reports/period";
import { queryRows } from "@/lib/reports/rows";
import { getStockValueSeries } from "@/lib/reports/stock-value";
import type { Scope } from "@/lib/scope";

/**
 * The small charts on the overview: one value per day for the last `days`
 * days, oldest first and today last, so every series has `days` points.
 * Accra keeps GMT all year, so a UTC date is a trading day.
 */

const dayRow = z.object({ day: z.string(), value: z.coerce.number() });

/** Rows keyed by "2026-11-13", laid over every day of the period. */
const fillDays = (
  days: readonly string[],
  rows: readonly z.output<typeof dayRow>[]
): number[] => {
  const byDay = new Map(rows.map((row) => [row.day, row.value]));

  return days.map((day) => byDay.get(day) ?? 0);
};

const branchFilter = (column: SQL, scope: Scope): SQL =>
  scope.kind === "branch" ? sql`${column} = ${scope.branchId}` : sql`true`;

/** Sales total each day. */
export const getSalesTrend = async (
  scope: Scope,
  days: number,
  now = new Date()
): Promise<number[]> => {
  const period = reportPeriod(days, now);

  const rows = await queryRows(
    getDb(),
    dayRow,
    sql`
    select to_char(s.created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
      coalesce(sum(s.total), 0)::float8 as value
    from sale s
    where s.created_at >= ${period.from} and ${branchFilter(sql`s.branch_id`, scope)}
    group by 1
  `
  );

  return fillDays(periodDays(period), rows);
};

/** Goods received each day, as a count of deliveries. */
export const getDeliveriesTrend = async (
  scope: Scope,
  days: number,
  now = new Date()
): Promise<number[]> => {
  const period = reportPeriod(days, now);

  const rows = await queryRows(
    getDb(),
    dayRow,
    sql`
    select to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
      count(*)::int as value
    from goods_receipt r
    where r.created_at >= ${period.from} and ${branchFilter(sql`r.branch_id`, scope)}
    group by 1
  `
  );

  return fillDays(periodDays(period), rows);
};

/** Book value on the shelves at the end of each day, from the ledger. */
export const getStockValueTrend = async (
  branchIds: readonly string[],
  days: number,
  now = new Date()
): Promise<number[]> => {
  const series = await getStockValueSeries(
    getDb(),
    branchIds,
    reportPeriod(days, now)
  );

  return series.map((day) => day.onShelves);
};

/**
 * How many lines needed reordering at the end of each day: at or below their
 * reorder point, empty ones included. Each day's balance is today's balance
 * less everything that moved after that day ended. Reorder points are today's,
 * since their history isn't kept.
 */
export const getReorderTrend = async (
  scope: Scope,
  days: number,
  now = new Date()
): Promise<number[]> => {
  const period = reportPeriod(days, now);
  const dayList = periodDays(period);
  const [first] = dayList;
  const last = dayList.at(-1);

  if (first === undefined || last === undefined) {
    return [];
  }

  const rows = await queryRows(
    getDb(),
    dayRow,
    sql`
    with lines as (
      select l.product_id, l.branch_id, l.on_hand,
        coalesce(l.reorder_point, p.reorder_point) as reorder_point
      from stock_level l
      join product p on p.id = l.product_id
      where p.active and ${branchFilter(sql`l.branch_id`, scope)}
    ), moved as (
      select m.product_id, m.branch_id,
        (m.created_at at time zone 'UTC')::date as day,
        sum(m.quantity)::int as quantity
      from stock_movement m
      where m.created_at >= ${period.from} and ${branchFilter(sql`m.branch_id`, scope)}
      group by 1, 2, 3
    ), grid as (
      select generate_series(${first}::date, ${last}::date, interval '1 day')::date as day
    )
    select g.day::text as day,
      count(*) filter (
        where l.on_hand - coalesce((
          select sum(m.quantity) from moved m
          where m.product_id = l.product_id
            and m.branch_id = l.branch_id
            and m.day > g.day
        ), 0) <= l.reorder_point
      )::int as value
    from grid g
    cross join lines l
    group by 1
  `
  );

  return fillDays(dayList, rows);
};

export const branchIdsInScope = (
  scope: Scope,
  allBranchIds: readonly string[]
): string[] => (scope.kind === "branch" ? [scope.branchId] : [...allBranchIds]);
