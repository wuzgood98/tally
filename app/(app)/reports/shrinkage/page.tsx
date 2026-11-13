import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportToolbar } from "@/components/reports/report-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat, StatGroup } from "@/components/ui/stat";
import { Table, Td, Th } from "@/components/ui/table";
import type { CellTone } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatCount } from "@/lib/format";
import { formatCedis, formatCedisCompact } from "@/lib/money";
import { loadReportContext } from "@/lib/reports/context";
import type { ReportContext } from "@/lib/reports/context";
import {
  getShrinkage,
  LOSS_COLUMNS,
  LOSS_LABELS,
  shrinkageByBranch,
} from "@/lib/reports/shrinkage";
import type {
  BranchShrinkage,
  LossColumn,
  TransitLoss,
} from "@/lib/reports/shrinkage";
import { listBranches } from "@/lib/scope";
import { param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Shrinkage" };

/** "1.4%" (a gain "−0.3%"), or a dash where nothing sold to compare against. */
const formatRate = (rate: number | null): string => {
  if (rate === null) {
    return "—";
  }

  const percent = `${Math.abs(rate * 100).toFixed(1)}%`;

  return rate < 0 ? `−${percent}` : percent;
};

/** A loss as money; a gain (stock found) with a minus sign. */
const lossText = (pesewas: number): string => {
  if (pesewas === 0) {
    return "—";
  }

  return pesewas > 0
    ? formatCedis(pesewas)
    : `−${formatCedis(Math.abs(pesewas))}`;
};

const lossTone = (pesewas: number): CellTone => {
  if (pesewas === 0) {
    return "faint";
  }

  return pesewas > 0 ? "ink" : "good";
};

const LossCell = ({
  row,
  column,
}: {
  readonly row: BranchShrinkage;
  readonly column: LossColumn;
}) => {
  const value = row.lost[column];
  const units = row.units[column];

  return (
    <Td numeric tone={lossTone(value)}>
      {lossText(value)}
      {units === 0 ? null : (
        <span className="text-ink-3 block text-xs">
          {formatCount(Math.abs(units))} {units > 0 ? "lost" : "found"}
        </span>
      )}
    </Td>
  );
};

const BranchRow = ({
  row,
  name,
  total = false,
}: {
  readonly row: BranchShrinkage;
  readonly name: string;
  readonly total?: boolean;
}) => (
  <tr>
    <Td nowrap weight={total ? "semibold" : "medium"}>
      {name}
    </Td>
    {LOSS_COLUMNS.map((column) => (
      <LossCell column={column} key={column} row={row} />
    ))}
    <Td numeric weight="semibold">
      {lossText(row.net)}
    </Td>
    <Td numeric tone="muted">
      {formatRate(row.rate)}
    </Td>
  </tr>
);

const BranchTable = ({
  context,
  rows,
  total,
}: {
  readonly context: ReportContext;
  readonly rows: readonly BranchShrinkage[];
  readonly total: BranchShrinkage;
}) => {
  const names = new Map(context.branches.map((item) => [item.id, item.name]));

  return (
    <Table>
      <caption className="sr-only">
        Stock lost at cost by branch and cause
      </caption>
      <thead>
        <tr>
          <Th>Branch</Th>
          {LOSS_COLUMNS.map((column) => (
            <Th key={column} numeric>
              {LOSS_LABELS[column]}
            </Th>
          ))}
          <Th numeric>Net lost</Th>
          <Th numeric>Of sales at cost</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <BranchRow
            key={row.branchId}
            name={names.get(row.branchId ?? "") ?? row.branchId ?? ""}
            row={row}
          />
        ))}
      </tbody>
      {context.company ? (
        <tfoot>
          <BranchRow name="All branches" row={total} total />
        </tfoot>
      ) : null}
    </Table>
  );
};

const RouteTable = ({
  routes,
  names,
}: {
  readonly routes: readonly TransitLoss[];
  readonly names: ReadonlyMap<string, string>;
}) => (
  <Table>
    <caption className="sr-only">Units lost in transit by route</caption>
    <thead>
      <tr>
        <Th>From</Th>
        <Th>To</Th>
        <Th numeric>Transfers short</Th>
        <Th numeric>Units</Th>
        <Th numeric>Lost at cost</Th>
      </tr>
    </thead>
    <tbody>
      {routes.map((route) => (
        <tr key={`${route.fromBranchId}-${route.toBranchId}`}>
          <Td nowrap>{names.get(route.fromBranchId) ?? route.fromBranchId}</Td>
          <Td nowrap>{names.get(route.toBranchId) ?? route.toBranchId}</Td>
          <Td numeric>{formatCount(route.transfers)}</Td>
          <Td numeric>{formatCount(route.units)}</Td>
          <Td numeric weight="medium">
            {formatCedis(route.value)}
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
);

/** The column that lost the most, for the headline. */
const biggestCause = (total: BranchShrinkage) => {
  let biggest: LossColumn = LOSS_COLUMNS[0];

  for (const column of LOSS_COLUMNS) {
    if (total.lost[column] > total.lost[biggest]) {
      biggest = column;
    }
  }

  return { column: biggest, value: total.lost[biggest] };
};

const ShrinkagePage = async ({
  searchParams,
}: PageProps<"/reports/shrinkage">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);
  const context = await loadReportContext(viewer, param(params, "days"));

  if (context === null) {
    notFound();
  }

  // Routes can start or end outside the report (the warehouse, for a
  // manager), so their names come from every branch.
  const [report, allBranches] = await Promise.all([
    getShrinkage(getDb(), context.branchIds, context.period),
    listBranches(),
  ]);

  const { rows, total } = shrinkageByBranch(report, context.branchIds);
  const biggest = biggestCause(total);
  const names = new Map(allBranches.map((item) => [item.id, item.name]));

  return (
    <>
      <PageHeader
        description={`Stock that left without being sold, at cost: write-offs, damaged returns, what counts turned up short, and what went missing on the road. · ${context.label}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/reports">
            Reports
          </Link>
        }
        title="Shrinkage"
      />
      <ReportToolbar
        csvHref={`/reports/shrinkage/csv?days=${context.range}`}
        path="/reports/shrinkage"
        range={context.range}
      />

      <div className="grid grid-cols-1 gap-6">
        <StatGroup className="sm:grid-cols-3">
          <Stat
            detail={`Last ${context.range} days, finds netted off`}
            label="Net stock lost, at cost"
            tone={total.net > 0 ? "warn" : undefined}
            value={formatCedisCompact(Math.max(total.net, 0))}
          />
          <Stat
            detail={`Against ${formatCedisCompact(total.salesCost)} of goods sold, at cost`}
            label="Shrinkage rate"
            value={formatRate(total.rate)}
          />
          <Stat
            detail={
              biggest.value > 0
                ? `${formatCedis(biggest.value)} of the losses`
                : "Nothing lost in this period"
            }
            label="Biggest cause"
            value={biggest.value > 0 ? LOSS_LABELS[biggest.column] : "—"}
          />
        </StatGroup>

        <Panel flush id="by-branch" title="By branch and cause">
          <BranchTable context={context} rows={rows} total={total} />
        </Panel>

        <Panel flush id="routes" title="Lost in transit, by route">
          {report.transit.length === 0 ? (
            <p className="text-ink-2 p-6 text-center text-sm">
              Every transfer arrived in full.
            </p>
          ) : (
            <RouteTable names={names} routes={report.transit} />
          )}
        </Panel>

        <p className="text-ink-2 text-xs">
          Each loss is valued at the cost it left the ledger at. &ldquo;Counts
          and finds&rdquo; nets stock counts against stock found: a minus sign
          means more turned up than was lost. A transit loss counts against the
          branch that counted the transfer short. The rate compares the net loss
          with what sold, at cost; the warehouse sells nothing, so it has none.
        </p>
      </div>
    </>
  );
};

export default ShrinkagePage;
