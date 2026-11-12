import Link from "next/link";

import { BestSellersPanel } from "@/components/sales/best-sellers-panel";
import { MovementTable } from "@/components/stock/movement-table";
import { OnTheWayPanel } from "@/components/stock/on-the-way-panel";
import { ReorderTable } from "@/components/stock/reorder-table";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatLongDate } from "@/lib/format";
import { formatCedis, formatCedisCompact } from "@/lib/money";
import { listMovements } from "@/lib/queries/movements";
import {
  getBranchHealth,
  getOverviewTotals,
  getReorderLines,
  getWeekReceipts,
} from "@/lib/queries/overview";
import { getBestSellers, getTodaySales } from "@/lib/queries/sales";
import { listTransfers } from "@/lib/queries/transfers";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

const REORDER_PREVIEW = 8;
const RECENT_MOVEMENTS = 8;
const ON_THE_WAY_PREVIEW = 5;
const BEST_SELLER_DAYS = 7;
const BEST_SELLERS = 6;

const SeeAll = ({
  href,
  children,
}: {
  readonly href: string;
  readonly children: string;
}) => (
  <Link className="text-brand text-sm font-medium hover:underline" href={href}>
    {children}
  </Link>
);

const OverviewPage = async () => {
  const viewer = await requireViewer();

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const allBranches = scope.kind === "all";
  const branchId = allBranches ? undefined : scope.branchId;

  const [
    totals,
    week,
    reorder,
    movements,
    health,
    incoming,
    salesToday,
    bestSellers,
  ] = await Promise.all([
    getOverviewTotals(scope),
    getWeekReceipts(scope),
    getReorderLines(scope, REORDER_PREVIEW),
    listMovements({ branchId }, RECENT_MOVEMENTS),
    allBranches ? getBranchHealth() : Promise.resolve([]),
    listTransfers(scope, { direction: "incoming", status: "in_transit" }, 1),
    getTodaySales(scope),
    getBestSellers(scope, BEST_SELLER_DAYS, BEST_SELLERS),
  ]);

  // Rendered on the server only, so there is no client clock to disagree with.
  const today = formatLongDate(new Date());
  const needReorder = totals.lowLines + totals.outLines;

  return (
    <>
      <PageHeader
        description={`${today} · ${scopeLabel(scope, branches)}`}
        title={`Akwaaba, ${viewer.name.split(" ")[0] ?? viewer.name}`}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          detail={`${formatCount(totals.units)} units · ${formatCedisCompact(totals.retailValue)} at shelf prices`}
          label="Stock value at cost"
          value={formatCedisCompact(totals.costValue)}
        />
        <Stat
          detail={`${formatCount(salesToday.count)} ${salesToday.count === 1 ? "sale" : "sales"}`}
          href="/sales"
          label="Sales today"
          value={formatCedisCompact(salesToday.total)}
        />
        <Stat
          detail={`${formatCount(totals.outLines)} of them out of stock`}
          href="/low-stock"
          label="Need reordering"
          tone={needReorder > 0 ? "warn" : undefined}
          value={formatCount(needReorder)}
        />
        <Stat
          detail={`${formatCedis(week.totalCost)} at cost`}
          href="/receipts"
          label="Deliveries, last 7 days"
          value={formatCount(week.count)}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Panel
          action={<SeeAll href="/low-stock">See all</SeeAll>}
          flush
          id="reorder"
          title="Running low"
        >
          {reorder.length === 0 ? (
            <p className="text-ink-2 p-4 text-sm">
              Nothing is at or below its reorder point.
            </p>
          ) : (
            <ReorderTable lines={reorder} showBranch={allBranches} />
          )}
        </Panel>

        {allBranches ? (
          <Panel flush id="branches" title="Branches">
            <Table>
              <caption className="sr-only">Stock health by branch</caption>
              <thead>
                <tr>
                  <Th>Branch</Th>
                  <Th numeric>Value</Th>
                  <Th numeric>Low</Th>
                  <Th numeric>Out</Th>
                </tr>
              </thead>
              <tbody>
                {health.map((row) => (
                  <tr key={row.id}>
                    <Td nowrap>
                      <span className="font-medium">{row.name}</span>
                      <span className="text-ink-3 block text-xs">
                        {row.kind === "warehouse" ? "Warehouse" : "Store"} ·{" "}
                        {formatCount(row.lines)} lines
                      </span>
                    </Td>
                    <Td numeric>{formatCedisCompact(row.costValue)}</Td>
                    <Td
                      numeric
                      tone={row.lowLines > 0 ? "warn" : "faint"}
                      weight={row.lowLines > 0 ? "medium" : "normal"}
                    >
                      {formatCount(row.lowLines)}
                    </Td>
                    <Td
                      numeric
                      tone={row.outLines > 0 ? "danger" : "faint"}
                      weight={row.outLines > 0 ? "medium" : "normal"}
                    >
                      {formatCount(row.outLines)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        ) : null}

        {/* Beside "Running low" for one branch; full width under the branch table. */}
        <BestSellersPanel
          className={allBranches ? "xl:col-span-2" : undefined}
          days={BEST_SELLER_DAYS}
          rows={bestSellers}
        />

        {incoming.total > 0 ? (
          <OnTheWayPanel
            className="xl:col-span-2"
            href={`/transfers${queryString({ direction: allBranches ? null : "incoming", status: "in_transit" })}`}
            rows={incoming.rows.slice(0, ON_THE_WAY_PREVIEW)}
            total={incoming.total}
          />
        ) : null}

        <Panel
          action={<SeeAll href="/movements">Full ledger</SeeAll>}
          className="xl:col-span-2"
          flush
          id="recent"
          title="Latest stock movements"
        >
          <MovementTable
            caption="Latest stock movements"
            rows={movements}
            showBranch={allBranches}
          />
        </Panel>
      </div>
    </>
  );
};

export default OverviewPage;
