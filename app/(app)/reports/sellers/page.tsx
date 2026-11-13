import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportToolbar } from "@/components/reports/report-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { Table, Td, Th } from "@/components/ui/table";
import type { CellTone } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatCount } from "@/lib/format";
import { formatCedis, formatCedisCompact } from "@/lib/money";
import { loadReportContext } from "@/lib/reports/context";
import {
  getSellers,
  groupSellers,
  SLOW_COVER_DAYS,
} from "@/lib/reports/sellers";
import type { SellerRow } from "@/lib/reports/sellers";
import { param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Fast and slow sellers" };

/** Rows shown per table; the CSV has every line. */
const SHOWN = 15;

/** Beyond this, the exact number of days stops meaning anything. */
const YEAR_DAYS = 365;

/** Cover this short means it's time to reorder. */
const SHORT_COVER_DAYS = 7;

const marginShare = (row: { margin: number; sales: number }): string =>
  row.sales > 0 ? `${Math.round((row.margin / row.sales) * 100)}%` : "—";

const coverTone = (row: SellerRow): CellTone => {
  if (row.onHand === 0) {
    return "danger";
  }

  return row.daysOfCover !== null && row.daysOfCover < SHORT_COVER_DAYS
    ? "warn"
    : "ink";
};

const coverText = (row: SellerRow): string => {
  if (row.onHand === 0) {
    return "Out";
  }

  if (row.daysOfCover === null) {
    return "—";
  }

  return row.daysOfCover > YEAR_DAYS
    ? "1 yr+"
    : `${formatCount(row.daysOfCover)} d`;
};

const ProductCell = ({ row }: { readonly row: SellerRow }) => (
  <Td className="min-w-56">
    <Link
      className="font-medium hover:underline"
      href={`/products/${row.productId}`}
    >
      {row.name}
    </Link>
    <span className="text-ink-3 block text-xs">
      <span className="font-mono">{row.sku}</span> · {row.category}
      {row.active ? null : " · Discontinued"}
    </span>
  </Td>
);

const More = ({ total }: { readonly total: number }) =>
  total > SHOWN ? (
    <p className="text-ink-2 px-4 py-3 text-xs">
      Showing {SHOWN} of {formatCount(total)}. The CSV has them all.
    </p>
  ) : null;

/** Fast or slow sellers: what sold, what it made, and how long stock lasts. */
const SoldTable = ({
  caption,
  rows,
}: {
  readonly caption: string;
  readonly rows: readonly SellerRow[];
}) => (
  <>
    <Table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th numeric>Sold</Th>
          <Th numeric>Returned</Th>
          <Th numeric>Takings</Th>
          <Th numeric>Margin</Th>
          <Th numeric>On hand</Th>
          <Th numeric>Lasts</Th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, SHOWN).map((row) => (
          <tr key={row.productId}>
            <ProductCell row={row} />
            <Td numeric weight="medium">
              {formatCount(row.units)}
            </Td>
            <Td numeric tone={row.returnedUnits > 0 ? "muted" : "faint"}>
              {row.returnedUnits > 0 ? formatCount(row.returnedUnits) : "—"}
            </Td>
            <Td numeric>{formatCedis(row.sales)}</Td>
            <Td numeric>
              {formatCedis(row.margin)}
              <span className="text-ink-3 block text-xs">
                {marginShare(row)}
              </span>
            </Td>
            <Td numeric>{formatCount(row.onHand)}</Td>
            <Td numeric tone={coverTone(row)}>
              {coverText(row)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
    <More total={rows.length} />
  </>
);

/** Held but not sold: what's tied up in each line. */
const UnsoldTable = ({ rows }: { readonly rows: readonly SellerRow[] }) => (
  <>
    <Table>
      <caption className="sr-only">
        Products in stock that didn&apos;t sell
      </caption>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th numeric>On hand</Th>
          <Th numeric>At cost</Th>
          <Th numeric>Returned</Th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, SHOWN).map((row) => (
          <tr key={row.productId}>
            <ProductCell row={row} />
            <Td numeric>{formatCount(row.onHand)}</Td>
            <Td numeric weight="medium">
              {formatCedis(row.stockValue)}
            </Td>
            <Td numeric tone={row.returnedUnits > 0 ? "muted" : "faint"}>
              {row.returnedUnits > 0 ? formatCount(row.returnedUnits) : "—"}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
    <More total={rows.length} />
  </>
);

const Empty = ({ children }: { readonly children: string }) => (
  <p className="text-ink-2 p-6 text-center text-sm">{children}</p>
);

const SellersPage = async ({ searchParams }: PageProps<"/reports/sellers">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);
  const context = await loadReportContext(viewer, param(params, "days"));

  if (context === null) {
    notFound();
  }

  const { fast, slow, totals, unsold } = groupSellers(
    await getSellers(getDb(), context.branchIds, context.period)
  );

  const days = `${context.range} days`;

  return (
    <>
      <PageHeader
        description={`What sold, what made money, and what's sitting on the shelf. Returns are netted off on the day they came back. · ${context.label}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/reports">
            Reports
          </Link>
        }
        title="Fast and slow sellers"
      />
      <ReportToolbar
        csvHref={`/reports/sellers/csv?days=${context.range}`}
        path="/reports/sellers"
        range={context.range}
      />

      <div className="grid grid-cols-1 gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            detail={`Net of returns, last ${days}`}
            label="Units sold"
            value={formatCount(totals.units)}
          />
          <Stat
            detail="Net of refunds, VAT included"
            label="Takings"
            value={formatCedisCompact(totals.sales)}
          />
          <Stat
            detail={`${marginShare(totals)} of takings, after ${formatCedisCompact(totals.cost)} cost`}
            label="Gross margin"
            value={formatCedisCompact(totals.margin)}
          />
          <Stat
            detail={`${formatCount(unsold.length)} lines in stock sold nothing`}
            label="Not selling, at cost"
            tone={unsold.length > 0 ? "warn" : undefined}
            value={formatCedisCompact(totals.unsoldValue)}
          />
        </div>

        <Panel flush id="fast" title="Fast sellers">
          {fast.length === 0 ? (
            <Empty>Nothing sold in this period.</Empty>
          ) : (
            <SoldTable caption="Fast sellers, most units first" rows={fast} />
          )}
        </Panel>

        <Panel
          action={
            <span className="text-ink-2 text-xs">
              Stock lasts over {SLOW_COVER_DAYS} days at this rate
            </span>
          }
          flush
          id="slow"
          title="Slow sellers"
        >
          {slow.length === 0 ? (
            <Empty>
              {`Everything that sold would clear within ${SLOW_COVER_DAYS} days.`}
            </Empty>
          ) : (
            <SoldTable
              caption="Slow sellers, longest cover first"
              rows={slow}
            />
          )}
        </Panel>

        <Panel
          action={
            <span className="text-ink-2 text-xs">Most money tied up first</span>
          }
          flush
          id="unsold"
          title={`Not sold in ${days}`}
        >
          {unsold.length === 0 ? (
            <Empty>Every line in stock sold at least once.</Empty>
          ) : (
            <UnsoldTable rows={unsold} />
          )}
        </Panel>

        <p className="text-ink-2 text-xs">
          Margin is takings (VAT included) less cost at the average cost when
          sold. &ldquo;Lasts&rdquo; is the stock on hand now divided by this
          period&apos;s daily rate.
        </p>
      </div>
    </>
  );
};

export default SellersPage;
