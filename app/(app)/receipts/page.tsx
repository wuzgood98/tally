import { PackagePlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { operableBranchIds } from "@/lib/permissions";
import { listReceipts, RECEIPTS_PAGE_SIZE } from "@/lib/queries/receipts";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { intParam, queryString } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";

export const metadata: Metadata = { title: "Goods received" };

const ReceiptsPage = async ({ searchParams }: PageProps<"/receipts">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const page = intParam(params, "page", 1);

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const { rows, total } = await listReceipts(scope, page);

  const canReceiveSomewhere =
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    ).length > 0;

  return (
    <>
      <PageHeader
        actions={
          canReceiveSomewhere ? (
            <Link
              className={buttonVariants({ size: "md" })}
              href="/receipts/new"
            >
              <PackagePlus aria-hidden="true" />
              Receive goods
            </Link>
          ) : null
        }
        description={`Deliveries from suppliers, newest first · ${scopeLabel(scope, branches)}`}
        title="Goods received"
      />
      <Panel
        flush
        footer={
          <Pagination
            href={(target) =>
              `/receipts${queryString({ page: target > 1 ? target : null })}`
            }
            noun="receipts"
            page={page}
            pageSize={RECEIPTS_PAGE_SIZE}
            total={total}
          />
        }
      >
        {rows.length === 0 ? (
          <ListEmpty
            create={
              canReceiveSomewhere
                ? { href: "/receipts/new", label: "Receive goods" }
                : undefined
            }
            firstPageHref={page > 1 && total > 0 ? "/receipts" : undefined}
            listHref="/receipts"
            tag="Receipts"
            title="No deliveries yet"
          >
            Goods received from suppliers show here, newest first.
          </ListEmpty>
        ) : (
          <Table>
            <caption className="sr-only">Goods received notes</caption>
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th>Received</Th>
                {scope.kind === "all" ? <Th>Branch</Th> : null}
                <Th>Supplier</Th>
                <Th numeric>Lines</Th>
                <Th numeric>Cost</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="hover:bg-surface-2/60" key={row.id}>
                  <Td nowrap>
                    <Link
                      className="text-brand font-mono text-xs font-medium hover:underline"
                      href={`/receipts/${row.id}`}
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
                  <Td className="min-w-48">
                    {row.supplierName}
                    {row.supplierReference !== null &&
                    row.supplierReference !== undefined ? (
                      <span className="text-ink-3 block font-mono text-xs">
                        {row.supplierReference}
                      </span>
                    ) : null}
                    {row.purchaseOrderNumber === null ? null : (
                      <span className="text-ink-3 block font-mono text-xs">
                        {row.purchaseOrderNumber}
                      </span>
                    )}
                  </Td>
                  <Td numeric>{formatCount(row.lines)}</Td>
                  <Td numeric weight="medium">
                    {formatCedis(row.totalCost)}
                  </Td>
                  <Td tone="muted" nowrap>
                    {row.receivedBy ?? "—"}
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

export default ReceiptsPage;
