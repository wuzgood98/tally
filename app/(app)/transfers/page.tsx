import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TransferStatusBadge } from "@/components/stock/transfer-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { labelledOptions } from "@/components/ui/select-options";
import { Table, Td, Th } from "@/components/ui/table";
import { transferStatusEnum } from "@/lib/db/schema";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { operableBranchIds } from "@/lib/permissions";
import { listTransfers, TRANSFERS_PAGE_SIZE } from "@/lib/queries/transfers";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { enumParam, intParam, queryString } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";
import { TRANSFER_STATUS_LABELS } from "@/lib/stock/transfer-status";
import { TRANSFER_DIRECTIONS } from "@/lib/transfer-direction";
import type { TransferDirection } from "@/lib/transfer-direction";

export const metadata: Metadata = { title: "Transfers" };

const STATUSES = ["all", ...transferStatusEnum.enumValues] as const;

const STATUS_OPTIONS: Record<(typeof STATUSES)[number], string> = {
  all: "Any status",
  ...TRANSFER_STATUS_LABELS,
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
  const status = enumParam(params, "status", STATUSES, "all");
  const direction = enumParam(params, "direction", TRANSFER_DIRECTIONS, "both");

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

      <form
        action="/transfers"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {oneBranch ? (
          <Field layout="inline">
            <FieldLabel tone="quiet">Show</FieldLabel>
            <Select
              className="w-auto"
              defaultValue={direction}
              name="direction"
              options={labelledOptions(TRANSFER_DIRECTIONS, DIRECTION_LABELS)}
            />
          </Field>
        ) : null}
        <Field layout="inline">
          <FieldLabel
            className={oneBranch ? "sr-only" : undefined}
            tone="quiet"
          >
            Status
          </FieldLabel>
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
          <p className="text-ink-2 p-8 text-center text-sm">
            No transfers match.
          </p>
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
    </>
  );
};

export default TransfersPage;
