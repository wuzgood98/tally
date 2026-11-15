import Link from "next/link";
import { redirect } from "next/navigation";

import { BestSellersPanel } from "@/components/sales/best-sellers-panel";
import { BranchBoard } from "@/components/stock/branch-board";
import { MovementTable } from "@/components/stock/movement-table";
import { OnTheWayPanel } from "@/components/stock/on-the-way-panel";
import { ReorderTable } from "@/components/stock/reorder-table";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Sparkline } from "@/components/ui/sparkline";
import { Stat, StatGroup } from "@/components/ui/stat";
import { boardBins, boardRows } from "@/lib/branch-board";
import { formatCount, formatLongDate } from "@/lib/format";
import { formatCedis, formatCedisCompact } from "@/lib/money";
import { canBrowseBackOffice, canViewReports } from "@/lib/permissions";
import { listMovements } from "@/lib/queries/movements";
import {
  getBranchHealth,
  getOverviewTotals,
  getReorderLines,
  getWeekReceipts,
} from "@/lib/queries/overview";
import { getBestSellers, getTodaySales } from "@/lib/queries/sales";
import { listTransfers } from "@/lib/queries/transfers";
import {
  branchIdsInScope,
  getDeliveriesTrend,
  getReorderTrend,
  getSalesTrend,
  getStockValueTrend,
} from "@/lib/queries/trends";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

const REORDER_PREVIEW = 8;

const RECENT_MOVEMENTS = 8;
const ON_THE_WAY_PREVIEW = 5;
const BEST_SELLER_DAYS = 7;
const BEST_SELLERS = 6;
const TREND_DAYS = 14;
const TREND_LABEL = `Last ${TREND_DAYS} days`;

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

  // A cashier's home is the till; the overview is back office.
  if (!canBrowseBackOffice(viewer)) {
    redirect("/till");
  }

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
    boardLines,
    incoming,
    salesToday,
    bestSellers,
    salesTrend,
    valueTrend,
    reorderTrend,
    deliveriesTrend,
  ] = await Promise.all([
    getOverviewTotals(scope),
    getWeekReceipts(scope),
    getReorderLines(scope, REORDER_PREVIEW),
    listMovements({ branchId }, RECENT_MOVEMENTS),
    allBranches ? getBranchHealth() : Promise.resolve([]),
    allBranches ? getReorderLines(scope) : Promise.resolve([]),
    listTransfers(scope, { direction: "incoming", status: "in_transit" }, 1),
    getTodaySales(scope),
    getBestSellers(scope, BEST_SELLER_DAYS, BEST_SELLERS),
    getSalesTrend(scope, TREND_DAYS),
    getStockValueTrend(
      branchIdsInScope(
        scope,
        branches.map((item) => item.id)
      ),
      TREND_DAYS
    ),
    getReorderTrend(scope, TREND_DAYS),
    getDeliveriesTrend(scope, TREND_DAYS),
  ]);

  // Rendered on the server only, so there is no client clock to disagree with.
  const today = formatLongDate(new Date());
  const reports = canViewReports(viewer);
  const needReorder = totals.lowLines + totals.outLines;
  const bins = boardBins(health, boardLines);

  return (
    <>
      <PageHeader
        description={`${today} · ${scopeLabel(scope, branches)}`}
        title={`Akwaaba, ${viewer.name.split(" ")[0] ?? viewer.name}`}
      />

      <StatGroup className="grid-cols-2 xl:grid-cols-4">
        <Stat
          detail={`${formatCount(totals.units)} units · ${formatCedisCompact(totals.retailValue)} at shelf prices`}
          href={reports ? "/reports/stock-value" : undefined}
          label="Stock value at cost"
          trend={<Sparkline values={valueTrend} />}
          trendLabel={TREND_LABEL}
          value={formatCedisCompact(totals.costValue)}
        />
        <Stat
          detail={
            salesToday.count === 0
              ? "No sales yet today"
              : `${formatCount(salesToday.count)} ${salesToday.count === 1 ? "sale" : "sales"}`
          }
          href="/sales"
          label="Sales today"
          trend={<Sparkline values={salesTrend} variant="bars" />}
          trendLabel={TREND_LABEL}
          value={formatCedisCompact(salesToday.total)}
        />
        <Stat
          detail={`${formatCount(totals.outLines)} of them out of stock`}
          href="/low-stock"
          label="Need reordering"
          tone={needReorder > 0 ? "warn" : undefined}
          trend={<Sparkline tone="warn" values={reorderTrend} />}
          trendLabel={TREND_LABEL}
          value={formatCount(needReorder)}
        />
        <Stat
          detail={`${formatCedis(week.totalCost)} at cost`}
          href="/receipts"
          label="Deliveries, last 7 days"
          trend={<Sparkline values={deliveriesTrend} variant="bars" />}
          trendLabel={TREND_LABEL}
          value={formatCount(week.count)}
        />
      </StatGroup>

      {allBranches ? (
        <BranchBoard bins={bins} className="mt-3.5" rows={boardRows(bins)} />
      ) : null}

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[3fr_2fr]">
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

        {/* Beside "Running low"; the branch board sits above both. */}
        <BestSellersPanel
          days={BEST_SELLER_DAYS}
          reportHref={
            reports ? `/reports/sellers?days=${BEST_SELLER_DAYS}` : undefined
          }
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
