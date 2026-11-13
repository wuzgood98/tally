/**
 * Stock value over time, straight from the ledger. Every movement carries the
 * cost it moved at, so a branch's book value at any moment is the running sum
 * of quantity × cost up to then.
 *
 * Goods in transit belong to no shelf: they're valued at their cost at
 * dispatch, and count towards the branch they're on their way to.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { Executor } from "@/lib/db/client";
import { periodDays } from "@/lib/reports/period";
import type { ReportPeriod } from "@/lib/reports/period";
import { inList, queryRows } from "@/lib/reports/rows";

export interface StockValueDay {
  /** "2026-11-13", valued at the end of that day (or now, for today). */
  readonly day: string;
  /** Book value on the shelves, by branch, in pesewas. */
  readonly byBranch: Readonly<Record<string, number>>;
  readonly onShelves: number;
  /** Sent to these branches and not yet counted in, in pesewas. */
  readonly inTransit: number;
  readonly total: number;
}

const shelfRow = z.object({
  branch_id: z.string(),
  day: z.string(),
  value: z.coerce.number(),
});

const transitRow = z.object({ day: z.string(), value: z.coerce.number() });

/** The day ends at the next midnight (UTC is Accra's local time). */
const DAY_END = sql.raw(`(d.day + 1)::timestamp at time zone 'UTC'`);

export const getStockValueSeries = async (
  db: Executor,
  branchIds: readonly string[],
  period: ReportPeriod
): Promise<StockValueDay[]> => {
  const days = periodDays(period);
  const [first] = days;
  const last = days.at(-1);

  if (branchIds.length === 0 || first === undefined || last === undefined) {
    return [];
  }

  const branches = inList(branchIds);

  // Daily changes, opened with everything before the period, then summed
  // forward over a grid so days without movements still get a value.
  const shelvesQuery = queryRows(
    db,
    shelfRow,
    sql`
    with changes as (
      select m.branch_id,
        (m.created_at at time zone 'UTC')::date as day,
        sum(m.quantity::bigint * m.unit_cost) as change
      from stock_movement m
      where m.branch_id in (${branches}) and m.created_at < ${period.to}
      group by 1, 2
    ), opening as (
      select branch_id, sum(change) as value
      from changes where day < ${first}::date
      group by 1
    ), grid as (
      select b.id as branch_id, d::date as day
      from branch b
      cross join generate_series(${first}::date, ${last}::date, interval '1 day') d
      where b.id in (${branches})
    )
    select g.branch_id, g.day::text as day,
      (coalesce(o.value, 0) + sum(coalesce(c.change, 0))
        over (partition by g.branch_id order by g.day))::float8 as value
    from grid g
    left join changes c on c.branch_id = g.branch_id and c.day = g.day
    left join opening o on o.branch_id = g.branch_id
    order by 2, 1
  `
  );

  const transitQuery = queryRows(
    db,
    transitRow,
    sql`
    select d.day::text as day,
      coalesce(sum(l.quantity_sent::bigint * l.unit_cost), 0)::float8 as value
    from (
      select generate_series(${first}::date, ${last}::date, interval '1 day')::date as day
    ) d
    left join stock_transfer t
      on t.to_branch_id in (${branches})
      and t.created_at < ${DAY_END}
      and coalesce(t.received_at, t.cancelled_at, 'infinity') >= ${DAY_END}
    left join stock_transfer_line l on l.transfer_id = t.id
    group by 1
    order by 1
  `
  );

  const [shelves, transit] = await Promise.all([shelvesQuery, transitQuery]);

  const byDay = Map.groupBy(shelves, (row) => row.day);

  const inTransit = new Map(transit.map((row) => [row.day, row.value]));

  return days.map((day) => {
    const rows = byDay.get(day) ?? [];

    const byBranch = Object.fromEntries(
      rows.map((row) => [row.branch_id, row.value])
    );

    let onShelves = 0;

    for (const row of rows) {
      onShelves += row.value;
    }

    const transitValue = inTransit.get(day) ?? 0;

    return {
      byBranch,
      day,
      inTransit: transitValue,
      onShelves,
      total: onShelves + transitValue,
    };
  });
};
