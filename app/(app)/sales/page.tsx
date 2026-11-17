import { ScanBarcode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyLabel } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { sellableBranchIds } from "@/lib/permissions";
import { getTodaySales, listSales, SALES_PAGE_SIZE } from "@/lib/queries/sales";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { intParam, queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";
import { PAYMENT_LABELS } from "@/lib/stock/payment";

export const metadata: Metadata = { title: "Sales" };

const SalesPage = async ({ searchParams }: PageProps<"/sales">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);
  const page = intParam(params, "page", 1);

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const [{ rows, total }, today] = await Promise.all([
    listSales(scope, page),
    getTodaySales(scope),
  ]);

  const canUseTill =
    sellableBranchIds(
      viewer,
      branches.flatMap((item) => (item.kind === "store" ? [item.id] : []))
    ).length > 0;

  return (
    <>
      <PageHeader
        actions={
          canUseTill ? (
            <Link className={buttonVariants({ size: "md" })} href="/till">
              <ScanBarcode aria-hidden="true" />
              Open till
            </Link>
          ) : null
        }
        description={`Today: ${formatCount(today.count)} ${today.count === 1 ? "sale" : "sales"}, ${formatCedis(today.total)} · ${scopeLabel(scope, branches)}`}
        title="Sales"
      />
      <Panel
        flush
        footer={
          <Pagination
            href={(target) =>
              `/sales${queryString({ page: target > 1 ? target : null })}`
            }
            noun="sales"
            page={page}
            pageSize={SALES_PAGE_SIZE}
            total={total}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyLabel
            action={
              canUseTill ? { href: "/till", label: "Open till" } : undefined
            }
            tag="Sales"
            title="No sales yet"
          >
            Sales rung up at the till or sent by a POS show here, newest first.
          </EmptyLabel>
        ) : (
          <Table>
            <caption className="sr-only">Sales, newest first</caption>
            <thead>
              <tr>
                <Th>Sale</Th>
                <Th>When</Th>
                {scope.kind === "all" ? <Th>Branch</Th> : null}
                <Th>Paid by</Th>
                <Th numeric>Items</Th>
                <Th numeric>Total</Th>
                <Th>Cashier</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="hover:bg-surface-2/60" key={row.id}>
                  <Td nowrap>
                    <Link
                      className="text-brand font-mono text-xs font-medium hover:underline"
                      href={`/sales/${row.id}`}
                    >
                      {row.number}
                    </Link>
                  </Td>
                  <Td tone="muted" nowrap>
                    <time
                      className="tabular"
                      dateTime={isoString(row.createdAt)}
                    >
                      {formatDateTime(row.createdAt)}
                    </time>
                  </Td>
                  {scope.kind === "all" ? (
                    <Td nowrap>{row.branchName}</Td>
                  ) : null}
                  <Td nowrap>{PAYMENT_LABELS[row.paymentMethod]}</Td>
                  <Td numeric>{formatCount(row.units)}</Td>
                  <Td numeric weight="medium">
                    {formatCedis(row.total)}
                  </Td>
                  <Td tone="muted" nowrap>
                    {row.cashier ?? "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
};

export default SalesPage;
