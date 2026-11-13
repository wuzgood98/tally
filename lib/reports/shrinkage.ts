/**
 * Stock lost, by branch and cause, at the cost it was written off at: every
 * adjustment (losses, and the counts and finds that net against them),
 * damaged customer returns, and units that went missing in transit.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { Executor } from "@/lib/db/client";
import type { AdjustmentReason } from "@/lib/db/schema";
import type { ReportPeriod } from "@/lib/reports/period";
import { inList, queryRows } from "@/lib/reports/rows";

/** An adjustment reason, or a damaged customer return written off. */
export type ShrinkageCause = AdjustmentReason | "returned_damaged";

export interface ShrinkageLine {
  readonly branchId: string;
  readonly cause: ShrinkageCause;
  /** Signed, as on the ledger: losses are negative, finds positive. */
  readonly units: number;
  /** Signed, in pesewas. */
  readonly value: number;
}

export interface TransitLoss {
  readonly fromBranchId: string;
  readonly toBranchId: string;
  /** Transfers that arrived short. */
  readonly transfers: number;
  /** Units missing on arrival (positive). */
  readonly units: number;
  /** Their cost at dispatch, in pesewas (positive). */
  readonly value: number;
}

export interface ShrinkageReport {
  readonly lines: readonly ShrinkageLine[];
  readonly transit: readonly TransitLoss[];
  /** Cost of goods sold by branch, net of returns: the base for a shrinkage rate. */
  readonly salesCost: Readonly<Record<string, number>>;
}

const CAUSES = [
  "damaged",
  "expired",
  "theft",
  "count_correction",
  "found",
  "internal_use",
  "returned_damaged",
] as const satisfies readonly ShrinkageCause[];

const lineRow = z.object({
  branch_id: z.string(),
  cause: z.enum(CAUSES),
  units: z.coerce.number(),
  value: z.coerce.number(),
});

const transitRow = z.object({
  from_branch_id: z.string(),
  to_branch_id: z.string(),
  transfers: z.coerce.number(),
  units: z.coerce.number(),
  value: z.coerce.number(),
});

const salesCostRow = z.object({
  branch_id: z.string(),
  value: z.coerce.number(),
});

export const getShrinkage = async (
  db: Executor,
  branchIds: readonly string[],
  period: ReportPeriod
): Promise<ShrinkageReport> => {
  if (branchIds.length === 0) {
    return { lines: [], salesCost: {}, transit: [] };
  }

  const branches = inList(branchIds);

  const linesQuery = queryRows(
    db,
    lineRow,
    sql`
    select m.branch_id,
      case when m.sale_return_id is not null then 'returned_damaged'
        else m.adjustment_reason::text end as cause,
      sum(m.quantity) as units,
      sum(m.quantity::bigint * m.unit_cost)::float8 as value
    from stock_movement m
    where m.kind = 'adjustment'
      and m.branch_id in (${branches})
      and m.created_at >= ${period.from} and m.created_at < ${period.to}
    group by 1, 2
    order by 1, 2
  `
  );

  // Counted short where it arrived; listed if either end is in the report.
  const transitQuery = queryRows(
    db,
    transitRow,
    sql`
    select t.from_branch_id, t.to_branch_id,
      count(distinct t.id) as transfers,
      sum(l.quantity_sent - l.quantity_received) as units,
      sum((l.quantity_sent - l.quantity_received)::bigint * l.unit_cost)::float8 as value
    from stock_transfer t
    join stock_transfer_line l on l.transfer_id = t.id
    where t.status = 'received'
      and l.quantity_received < l.quantity_sent
      and (t.from_branch_id in (${branches}) or t.to_branch_id in (${branches}))
      and t.received_at >= ${period.from} and t.received_at < ${period.to}
    group by 1, 2
    order by 5 desc
  `
  );

  const salesCostQuery = queryRows(
    db,
    salesCostRow,
    sql`
    select branch_id, sum(value)::float8 as value
    from (
      select s.branch_id, l.quantity::bigint * l.unit_cost as value
      from sale_line l join sale s on s.id = l.sale_id
      where s.branch_id in (${branches})
        and s.created_at >= ${period.from} and s.created_at < ${period.to}
      union all
      select r.branch_id, -(rl.quantity::bigint * sl.unit_cost)
      from sale_return_line rl
      join sale_return r on r.id = rl.return_id
      join sale_line sl on sl.sale_id = r.sale_id and sl.product_id = rl.product_id
      where r.branch_id in (${branches})
        and r.created_at >= ${period.from} and r.created_at < ${period.to}
    ) costs
    group by 1
  `
  );

  const [lines, transit, salesCost] = await Promise.all([
    linesQuery,
    transitQuery,
    salesCostQuery,
  ]);

  return {
    lines: lines.map((row) => ({
      branchId: row.branch_id,
      cause: row.cause,
      units: row.units,
      value: row.value,
    })),
    salesCost: Object.fromEntries(
      salesCost.map((row) => [row.branch_id, row.value])
    ),
    transit: transit.map((row) => ({
      fromBranchId: row.from_branch_id,
      toBranchId: row.to_branch_id,
      transfers: row.transfers,
      units: row.units,
      value: row.value,
    })),
  };
};
