import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ListEmpty } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { labelledOptions } from "@/components/ui/select-options";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDate, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { canDraftPurchaseOrder } from "@/lib/permissions";
import {
  listPurchaseOrders,
  PURCHASE_ORDERS_PAGE_SIZE,
} from "@/lib/queries/purchase-orders";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { enumParam, intParam, queryString } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUSES,
} from "@/lib/stock/purchase-order-status";

export const metadata: Metadata = { title: "Purchase orders" };

const STATUSES = ["all", ...PURCHASE_ORDER_STATUSES] as const;

const STATUS_OPTIONS: Record<(typeof STATUSES)[number], string> = {
  all: "Any status",
  ...PURCHASE_ORDER_STATUS_LABELS,
};

const PurchaseOrdersPage = async ({
  searchParams,
}: PageProps<"/purchase-orders">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const page = intParam(params, "page", 1);
  const status = enumParam(params, "status", STATUSES, "all");

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const { rows, total } = await listPurchaseOrders(
    scope,
    status === "all" ? null : status,
    page
  );

  const canDraft = branches.some((item) =>
    canDraftPurchaseOrder(viewer, item.id)
  );

  return (
    <>
      <PageHeader
        actions={
          canDraft ? (
            <Link
              className={buttonVariants({ size: "md" })}
              href="/purchase-orders/new"
            >
              <FilePlus2 aria-hidden="true" />
              New order
            </Link>
          ) : null
        }
        description={`Orders to suppliers, newest first. Managers draft them; head office approves and sends them. · ${scopeLabel(scope, branches)}`}
        title="Purchase orders"
      />

      <form
        action="/purchase-orders"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <Field layout="inline">
          <FieldLabel tone="quiet">Show</FieldLabel>
          <Select
            className="w-auto"
            defaultValue={status}
            name="status"
            options={labelledOptions(STATUSES, STATUS_OPTIONS)}
          />
        </Field>
        <button
          className={buttonVariants({ size: "md", variant: "outline" })}
          type="submit"
        >
          Apply
        </button>
      </form>

      <Panel
        flush
        footer={
          <Pagination
            href={(target) =>
              `/purchase-orders${queryString({ page: target > 1 ? target : null, status: status === "all" ? null : status })}`
            }
            noun="orders"
            page={page}
            pageSize={PURCHASE_ORDERS_PAGE_SIZE}
            total={total}
          />
        }
      >
        {rows.length === 0 ? (
          <ListEmpty
            create={
              canDraft
                ? { href: "/purchase-orders/new", label: "New order" }
                : undefined
            }
            filtered={status !== "all"}
            firstPageHref={
              page > 1 && total > 0
                ? `/purchase-orders${queryString({ status: status === "all" ? null : status })}`
                : undefined
            }
            listHref="/purchase-orders"
            noMatchHint="No order here has that status. Try another."
            tag="Orders"
            title="No purchase orders yet"
          >
            Orders to suppliers show here, newest first.
          </ListEmpty>
        ) : (
          <Table>
            <caption className="sr-only">Purchase orders</caption>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Supplier</Th>
                {scope.kind === "all" ? <Th>Deliver to</Th> : null}
                <Th>Status</Th>
                <Th>Expected</Th>
                <Th numeric>Received</Th>
                <Th numeric>Value</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="hover:bg-surface-2/60" key={row.id}>
                  <Td nowrap>
                    <Link
                      className="text-brand font-mono text-xs font-medium hover:underline"
                      href={`/purchase-orders/${row.id}`}
                    >
                      {row.number}
                    </Link>
                    <time
                      className="text-ink-3 tabular block text-xs"
                      dateTime={isoString(row.createdAt)}
                    >
                      {formatDate(row.createdAt)}
                    </time>
                  </Td>
                  <Td className="min-w-44">{row.supplierName}</Td>
                  {scope.kind === "all" ? (
                    <Td nowrap>{row.branchName}</Td>
                  ) : null}
                  <Td nowrap>
                    <PurchaseOrderStatusBadge status={row.status} />
                  </Td>
                  <Td nowrap tone="muted">
                    {row.expectedAt === null ? (
                      "—"
                    ) : (
                      <time
                        className="tabular"
                        dateTime={isoString(row.expectedAt)}
                      >
                        {formatDate(row.expectedAt)}
                      </time>
                    )}
                  </Td>
                  <Td numeric tone="muted">
                    {formatCount(row.received)} / {formatCount(row.ordered)}
                  </Td>
                  <Td numeric weight="medium">
                    {formatCedis(row.totalCost)}
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

export default PurchaseOrdersPage;
