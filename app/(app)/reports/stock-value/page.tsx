import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportToolbar } from "@/components/reports/report-toolbar";
import { TimeChart } from "@/components/reports/time-chart";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { Table, Td, Th } from "@/components/ui/table";
import type { CellTone } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatDay } from "@/lib/format";
import { formatCedis, formatCedisCompact } from "@/lib/money";
import { loadReportContext } from "@/lib/reports/context";
import type { ReportContext } from "@/lib/reports/context";
import { getStockValueSeries } from "@/lib/reports/stock-value";
import type { StockValueDay } from "@/lib/reports/stock-value";
import { param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Stock value over time" };

/** "+GH₵1,200.00" / "−GH₵80.00" / "GH₵0.00", with a true minus sign. */
const signedCedis = (pesewas: number): string => {
  if (pesewas === 0) {
    return formatCedis(0);
  }

  return `${pesewas > 0 ? "+" : "−"}${formatCedis(Math.abs(pesewas))}`;
};

const changeTone = (pesewas: number): CellTone => {
  if (pesewas === 0) {
    return "muted";
  }

  return pesewas > 0 ? "good" : "danger";
};

/** Each branch now and at the start of the period, then transit and total. */
const BranchTable = ({
  context,
  first,
  last,
}: {
  readonly context: ReportContext;
  readonly first: StockValueDay;
  readonly last: StockValueDay;
}) => {
  const rows = [
    ...context.branches.map((item) => ({
      before: first.byBranch[item.id] ?? 0,
      key: item.id,
      name: item.name,
      now: last.byBranch[item.id] ?? 0,
    })),
    {
      before: first.inTransit,
      key: "transit",
      name: "Goods in transit",
      now: last.inTransit,
    },
  ];

  return (
    <Table>
      <caption className="sr-only">Stock value by branch</caption>
      <thead>
        <tr>
          <Th>Branch</Th>
          <Th numeric>{formatDay(first.day)}</Th>
          <Th numeric>Now</Th>
          <Th numeric>Change</Th>
          <Th numeric>Share</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <Td nowrap tone={row.key === "transit" ? "muted" : undefined}>
              {row.name}
            </Td>
            <Td numeric tone="muted">
              {formatCedis(row.before)}
            </Td>
            <Td numeric weight="medium">
              {formatCedis(row.now)}
            </Td>
            <Td numeric tone={changeTone(row.now - row.before)}>
              {signedCedis(row.now - row.before)}
            </Td>
            <Td numeric tone="muted">
              {last.total > 0
                ? `${Math.round((row.now / last.total) * 100)}%`
                : "—"}
            </Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <Td weight="semibold">Total</Td>
          <Td numeric tone="muted">
            {formatCedis(first.total)}
          </Td>
          <Td numeric weight="semibold">
            {formatCedis(last.total)}
          </Td>
          <Td numeric tone={changeTone(last.total - first.total)}>
            {signedCedis(last.total - first.total)}
          </Td>
          <Td numeric tone="muted">
            100%
          </Td>
        </tr>
      </tfoot>
    </Table>
  );
};

/** Newest day first, with the day's change. */
const DayTable = ({
  series,
}: {
  readonly series: readonly StockValueDay[];
}) => (
  <Table>
    <caption className="sr-only">Stock value at the end of each day</caption>
    <thead>
      <tr>
        <Th>Day</Th>
        <Th numeric>On the shelves</Th>
        <Th numeric>In transit</Th>
        <Th numeric>Total</Th>
        <Th numeric>Change</Th>
      </tr>
    </thead>
    <tbody>
      {series.toReversed().map((day, index, newestFirst) => {
        const before = newestFirst[index + 1];
        const change = before === undefined ? null : day.total - before.total;

        return (
          <tr key={day.day}>
            <Td nowrap>
              <time dateTime={day.day}>{formatDay(day.day)}</time>
            </Td>
            <Td numeric>{formatCedis(day.onShelves)}</Td>
            <Td numeric tone="muted">
              {day.inTransit > 0 ? formatCedis(day.inTransit) : "—"}
            </Td>
            <Td numeric weight="medium">
              {formatCedis(day.total)}
            </Td>
            <Td numeric tone={change === null ? "faint" : changeTone(change)}>
              {change === null ? "—" : signedCedis(change)}
            </Td>
          </tr>
        );
      })}
    </tbody>
  </Table>
);

const StockValuePage = async ({
  searchParams,
}: PageProps<"/reports/stock-value">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);
  const context = await loadReportContext(viewer, param(params, "days"));

  if (context === null) {
    notFound();
  }

  const series = await getStockValueSeries(
    getDb(),
    context.branchIds,
    context.period
  );

  const [first] = series;
  const last = series.at(-1);

  return (
    <>
      <PageHeader
        description={`What the stock is worth at cost at the end of each day, from the ledger. · ${context.label}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/reports">
            Reports
          </Link>
        }
        title="Stock value over time"
      />
      <ReportToolbar
        csvHref={`/reports/stock-value/csv?days=${context.range}`}
        path="/reports/stock-value"
        range={context.range}
      />

      {first === undefined || last === undefined ? (
        <p className="text-ink-2 text-sm">No branches to report on.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              detail={`${formatCedis(last.onShelves)} on the shelves`}
              label="Stock value now"
              value={formatCedisCompact(last.total)}
            />
            <Stat
              detail={`Since ${formatDay(first.day)}, from ${formatCedisCompact(first.total)}`}
              label={`Change, ${context.range} days`}
              value={signedCedis(last.total - first.total)}
            />
            <Stat
              detail="Sent, not yet counted in; at cost when sent"
              label="Goods in transit"
              value={formatCedisCompact(last.inTransit)}
            />
          </div>

          <Panel id="value-chart" title="Stock value, end of each day">
            <div className="pt-8">
              <TimeChart
                mark="line"
                points={series.map((day) => ({
                  label: formatDay(day.day),
                  value: day.total,
                }))}
                title={`Stock value at cost, ${context.label}, last ${context.range} days`}
              />
            </div>
          </Panel>

          <Panel id="transit-chart" title="Goods in transit, end of each day">
            <div className="pt-8">
              <TimeChart
                height={96}
                mark="columns"
                points={series.map((day) => ({
                  label: formatDay(day.day),
                  value: day.inTransit,
                }))}
                title={`Goods in transit at cost, ${context.label}, last ${context.range} days`}
              />
            </div>
          </Panel>

          {context.company ? (
            <Panel flush id="by-branch" title="By branch">
              <BranchTable context={context} first={first} last={last} />
            </Panel>
          ) : null}

          <Panel flush id="by-day" title="Day by day">
            <DayTable series={series} />
          </Panel>
        </div>
      )}
    </>
  );
};

export default StockValuePage;
