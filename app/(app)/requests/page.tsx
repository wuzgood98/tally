import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  FilterSummary,
  ListFilters,
  ListResults,
  UrlTabs,
} from "@/components/lists/list-filters";
import { tabOptions } from "@/components/lists/tab-options";
import { RequestStatusBadge } from "@/components/stock/request-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import type { StockRequestStatus } from "@/lib/db/schema";
import {
  countLabel,
  formatCount,
  formatDateTime,
  isoString,
} from "@/lib/format";
import { canRequestStock } from "@/lib/permissions";
import { listStockRequests, REQUESTS_PAGE_SIZE } from "@/lib/queries/requests";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import {
  clearParams,
  enumFilter,
  intParam,
  queryString,
} from "@/lib/search-params";
import type { EnumFilter } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";
import {
  STOCK_REQUEST_STATUS_LABELS,
  STOCK_REQUEST_STATUSES,
} from "@/lib/stock/request-status";

export const metadata: Metadata = { title: "Stock requests" };

const STATUSES = ["all", ...STOCK_REQUEST_STATUSES] as const;

const STATUS_FILTER: EnumFilter<(typeof STATUSES)[number]> = {
  defaultValue: "all",
  param: "status",
  values: STATUSES,
};

/** What "Clear filters" clears. */
const CLEAR = clearParams([STATUS_FILTER], ["page"]);

const STATUS_OPTIONS: Record<(typeof STATUSES)[number], string> = {
  all: "All",
  ...STOCK_REQUEST_STATUS_LABELS,
};

/** How the summary sentence names a status: "1 waiting request". */
const STATUS_TERMS: Record<StockRequestStatus, string> = {
  cancelled: "cancelled",
  fulfilled: "sent",
  requested: "waiting",
};

const RequestsPage = async ({ searchParams }: PageProps<"/requests">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const page = intParam(params, "page", 1);
  const status = enumFilter(params, STATUS_FILTER);

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const { rows, total } = await listStockRequests(
    scope,
    status === "all" ? null : status,
    page
  );

  const canRequest = branches.some(
    (item) => item.kind === "store" && canRequestStock(viewer, item.id)
  );

  return (
    <>
      <PageHeader
        actions={
          canRequest ? (
            <Link
              className={buttonVariants({ size: "md" })}
              href="/requests/new"
            >
              <Inbox aria-hidden="true" />
              Request stock
            </Link>
          ) : null
        }
        description={`Stores asking the warehouse for stock, newest first. · ${scopeLabel(scope, branches)}`}
        title="Stock requests"
      />

      <ListFilters>
        <UrlTabs
          filter={STATUS_FILTER}
          label="Status"
          options={tabOptions(
            STATUS_FILTER,
            STATUS_OPTIONS,
            (value) => `/requests${queryString({ status: value })}`
          )}
          resets={["page"]}
        />

        <ListResults announce={countLabel(total, "request")}>
          {rows.length === 0 ? null : (
            <FilterSummary
              adjective={status === "all" ? null : STATUS_TERMS[status]}
              clear={status === "all" ? undefined : CLEAR}
              count={total}
              noun="request"
            />
          )}
          <Panel
            flush
            footer={
              <Pagination
                href={(target) =>
                  `/requests${queryString({ page: target > 1 ? target : null, status: status === "all" ? null : status })}`
                }
                noun="requests"
                page={page}
                pageSize={REQUESTS_PAGE_SIZE}
                total={total}
              />
            }
          >
            {rows.length === 0 ? (
              <ListEmpty
                create={
                  canRequest
                    ? { href: "/requests/new", label: "Request stock" }
                    : undefined
                }
                filtered={status !== "all"}
                firstPageHref={
                  page > 1 && total > 0
                    ? `/requests${queryString({ status: status === "all" ? null : status })}`
                    : undefined
                }
                listHref="/requests"
                noMatchHint="No request here has that status. Try another."
                tag="Requests"
                title="No requests yet"
              >
                Stores asking the warehouse for stock show here, newest first.
              </ListEmpty>
            ) : (
              <Table>
                <caption className="sr-only">Stock requests</caption>
                <thead>
                  <tr>
                    <Th>Request</Th>
                    <Th>Store</Th>
                    <Th>Status</Th>
                    <Th numeric>Units</Th>
                    <Th>Asked by</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="hover:bg-surface-2/60" key={row.id}>
                      <Td nowrap>
                        <Link
                          className="text-brand font-mono text-xs font-medium hover:underline"
                          href={`/requests/${row.id}`}
                        >
                          {row.number}
                        </Link>
                        <time
                          className="text-ink-3 tabular block text-xs"
                          dateTime={isoString(row.createdAt)}
                        >
                          {formatDateTime(row.createdAt)}
                        </time>
                      </Td>
                      <Td nowrap>{row.storeName}</Td>
                      <Td nowrap>
                        <RequestStatusBadge status={row.status} />
                      </Td>
                      <Td numeric>{formatCount(row.units)}</Td>
                      <Td nowrap tone="muted">
                        {row.requestedBy ?? "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </ListResults>
      </ListFilters>
    </>
  );
};

export default RequestsPage;
