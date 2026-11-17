import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  FilterBar,
  ListFilters,
  ListResults,
  UrlSelect,
} from "@/components/lists/list-filters";
import { TransferStatusBadge } from "@/components/stock/transfer-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { labelledOptions } from "@/components/ui/select-options";
import { Table, Td, Th } from "@/components/ui/table";
import { transferStatusEnum } from "@/lib/db/schema";
import {
  countLabel,
  formatCount,
  formatDateTime,
  isoString,
} from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { operableBranchIds } from "@/lib/permissions";
import { listTransfers, TRANSFERS_PAGE_SIZE } from "@/lib/queries/transfers";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { enumFilter, intParam, queryString } from "@/lib/search-params";
import type { EnumFilter } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";
import { TRANSFER_STATUS_LABELS } from "@/lib/stock/transfer-status";
import { TRANSFER_DIRECTIONS } from "@/lib/transfer-direction";
import type { TransferDirection } from "@/lib/transfer-direction";

export const metadata: Metadata = { title: "Transfers" };

const STATUSES = ["all", ...transferStatusEnum.enumValues] as const;

const STATUS_FILTER: EnumFilter<(typeof STATUSES)[number]> = {
  defaultValue: "all",
  param: "status",
  values: STATUSES,
};

const STATUS_OPTIONS: Record<(typeof STATUSES)[number], string> = {
  all: "Any status",
  ...TRANSFER_STATUS_LABELS,
};

const DIRECTION_FILTER: EnumFilter<TransferDirection> = {
  defaultValue: "both",
  param: "direction",
  values: TRANSFER_DIRECTIONS,
};

const DIRECTION_LABELS: Record<TransferDirection, string> = {
  both: "In and out",
  incoming: "Incoming",
  outgoing: "Outgoing",
};

const TransfersPage = async ({ searchParams }: PageProps<"/transfers">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const page = intParam(params, "page", 1);
  const status = enumFilter(params, STATUS_FILTER);
  const direction = enumFilter(params, DIRECTION_FILTER);

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const oneBranch = scope.kind === "branch";

  const { rows, total } = await listTransfers(
    scope,
    { direction, status: status === "all" ? null : status },
    page
  );

  const canSendSomewhere =
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    ).length > 0;

  const filters = {
    direction: direction === "both" ? null : direction,
    status: status === "all" ? null : status,
  };

  return (
    <>
      <PageHeader
        actions={
          canSendSomewhere ? (
            <Link
              className={buttonVariants({ size: "md" })}
              href="/transfers/new"
            >
              <Truck aria-hidden="true" />
              New transfer
            </Link>
          ) : null
        }
        description={`Stock moving between branches, newest first · ${scopeLabel(scope, branches)}`}
        title="Transfers"
      />

      <ListFilters>
        <FilterBar>
          {oneBranch ? (
            <UrlSelect
              filter={DIRECTION_FILTER}
              label="Show"
              options={labelledOptions(TRANSFER_DIRECTIONS, DIRECTION_LABELS)}
              resets={["page"]}
              visibleLabel
            />
          ) : null}
          <UrlSelect
            className="w-auto"
            filter={STATUS_FILTER}
            label="Status"
            options={labelledOptions(STATUSES, STATUS_OPTIONS)}
            resets={["page"]}
            visibleLabel={!oneBranch}
          />
        </FilterBar>

        <ListResults announce={countLabel(total, "transfer")}>
          <Panel
            flush
            footer={
              <Pagination
                href={(target) =>
                  `/transfers${queryString({ ...filters, page: target > 1 ? target : null })}`
                }
                noun="transfers"
                page={page}
                pageSize={TRANSFERS_PAGE_SIZE}
                total={total}
              />
            }
          >
            {rows.length === 0 ? (
              <ListEmpty
                create={
                  canSendSomewhere
                    ? { href: "/transfers/new", label: "New transfer" }
                    : undefined
                }
                filtered={filters.status !== null || filters.direction !== null}
                firstPageHref={
                  page > 1 && total > 0
                    ? `/transfers${queryString(filters)}`
                    : undefined
                }
                listHref="/transfers"
                noMatchHint="Try another status or direction."
                tag="Transfers"
                title="No transfers yet"
              >
                Stock sent between branches shows here, newest first.
              </ListEmpty>
            ) : (
              <Table>
                <caption className="sr-only">Stock transfers</caption>
                <thead>
                  <tr>
                    <Th>Transfer</Th>
                    <Th>Sent</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Status</Th>
                    <Th numeric>Units</Th>
                    <Th numeric>Value</Th>
                    <Th>By</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="hover:bg-surface-2/60" key={row.id}>
                      <Td nowrap>
                        <Link
                          className="text-brand font-mono text-xs font-medium hover:underline"
                          href={`/transfers/${row.id}`}
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
                      <Td nowrap>{row.fromName}</Td>
                      <Td nowrap>{row.toName}</Td>
                      <Td nowrap>
                        <TransferStatusBadge
                          status={row.status}
                          unitsLost={row.unitsLost}
                        />
                      </Td>
                      <Td numeric>{formatCount(row.unitsSent)}</Td>
                      <Td numeric weight="medium">
                        {formatCedis(row.totalCost)}
                      </Td>
                      <Td tone="muted" nowrap>
                        {row.dispatchedBy ?? "—"}
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

export default TransfersPage;
