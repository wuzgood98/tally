import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RequestStatusBadge } from "@/components/stock/request-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { labelledOptions } from "@/components/ui/select-options";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { canRequestStock } from "@/lib/permissions";
import { listStockRequests, REQUESTS_PAGE_SIZE } from "@/lib/queries/requests";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { enumParam, intParam, queryString } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";
import {
  STOCK_REQUEST_STATUS_LABELS,
  STOCK_REQUEST_STATUSES,
} from "@/lib/stock/request-status";

export const metadata: Metadata = { title: "Stock requests" };

const STATUSES = ["all", ...STOCK_REQUEST_STATUSES] as const;

const STATUS_OPTIONS: Record<(typeof STATUSES)[number], string> = {
  all: "Any status",
  ...STOCK_REQUEST_STATUS_LABELS,
};

const RequestsPage = async ({ searchParams }: PageProps<"/requests">) => {
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

      <form
        action="/requests"
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

      <Panel flush>
        {rows.length === 0 ? (
          <p className="text-ink-2 p-8 text-center text-sm">
            No requests match.
          </p>
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
        <div className="border-line border-t">
          <Pagination
            href={(target) =>
              `/requests${queryString({ page: target > 1 ? target : null, status: status === "all" ? null : status })}`
            }
            noun="requests"
            page={page}
            pageSize={REQUESTS_PAGE_SIZE}
            total={total}
          />
        </div>
      </Panel>
    </>
  );
};

export default RequestsPage;
