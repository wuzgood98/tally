import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CancelRequestForm,
  FulfilRequestForm,
} from "@/components/stock/fulfil-request-form";
import { RequestStatusBadge } from "@/components/stock/request-status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { canDispatchTransfer, canRequestStock } from "@/lib/permissions";
import { getStockRequest } from "@/lib/queries/requests";
import type { StockRequestDetail } from "@/lib/queries/requests";
import { param } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";

const requestId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/requests/[id]">): Promise<Metadata> => {
  await requireBackOffice();
  const route = await params;
  const id = requestId(route.id);
  const request = id === null ? null : await getStockRequest(id);

  return { title: request?.number ?? "Stock request" };
};

/** What happened to it: sent on a transfer, called off, or still waiting. */
const Outcome = ({ request }: { readonly request: StockRequestDetail }) => {
  if (request.status === "fulfilled" && request.transferId !== null) {
    return (
      <p className="text-sm">
        Sent on{" "}
        <Link
          className="text-brand font-mono text-xs font-medium hover:underline"
          href={`/transfers/${request.transferId}`}
        >
          {request.transferNumber}
        </Link>
        {request.fulfilledAt === null ? null : (
          <span className="text-ink-2">
            {" "}
            ·{" "}
            <time dateTime={isoString(request.fulfilledAt)}>
              {formatDateTime(request.fulfilledAt)}
            </time>
          </span>
        )}
      </p>
    );
  }

  if (request.status === "cancelled") {
    return <p className="text-ink-2 text-sm">Cancelled.</p>;
  }

  return (
    <p className="text-ink-2 text-sm">
      Waiting for {request.warehouseName} to send it.
    </p>
  );
};

const RequestedLines = ({
  request,
}: {
  readonly request: StockRequestDetail;
}) => (
  <Table>
    <caption className="sr-only">Products requested</caption>
    <thead>
      <tr>
        <Th>Product</Th>
        <Th numeric>Asked</Th>
        <Th numeric>In the warehouse</Th>
      </tr>
    </thead>
    <tbody>
      {request.lines.map((line) => (
        <tr key={line.productId}>
          <Td className="min-w-52">
            <Link
              className="hover:text-brand font-medium hover:underline"
              href={`/products/${line.productId}`}
            >
              {line.name}
            </Link>
            <span className="text-ink-3 block font-mono text-xs">
              {line.sku}
            </span>
          </Td>
          <Td numeric weight="medium">
            {formatCount(line.quantity)}
          </Td>
          <Td numeric tone="muted">
            {formatCount(line.atWarehouse)}
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
);

const RequestPage = async ({
  params,
  searchParams,
}: PageProps<"/requests/[id]">) => {
  const [viewer, route, query] = await Promise.all([
    requireBackOffice(),
    params,
    searchParams,
  ]);

  const id = requestId(route.id);
  const request = id === null ? null : await getStockRequest(id);

  if (!request) {
    notFound();
  }

  const open = request.status === "requested";
  const canFulfil = open && canDispatchTransfer(viewer, request.fromBranchId);

  const canCancel =
    open &&
    (canRequestStock(viewer, request.branchId) ||
      canDispatchTransfer(viewer, request.fromBranchId));

  const notice =
    param(query, "requested") === "1"
      ? `Request sent to ${request.warehouseName}.`
      : null;

  return (
    <>
      {notice === null ? null : (
        <output className="bg-brand-soft text-good mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
          <CircleCheck aria-hidden="true" className="size-4" />
          {notice}
        </output>
      )}
      <PageHeader
        actions={<RequestStatusBadge status={request.status} />}
        description={`${request.storeName} asks ${request.warehouseName}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/requests">
            Stock requests
          </Link>
        }
        title={<span className="font-mono">{request.number}</span>}
      />

      <Panel className="mb-6">
        <div className="grid gap-2">
          <p className="text-sm">
            Asked by {request.requestedBy ?? "—"} ·{" "}
            <time dateTime={isoString(request.createdAt)}>
              {formatDateTime(request.createdAt)}
            </time>
          </p>
          <Outcome request={request} />
          {request.note === null ? null : (
            <p className="text-ink-2 border-line border-t pt-2 text-sm">
              {request.note}
            </p>
          )}
        </div>
      </Panel>

      {canFulfil ? (
        <Panel flush id="fulfil" title="Send it">
          <FulfilRequestForm lines={request.lines} requestId={request.id} />
        </Panel>
      ) : (
        <Panel
          flush
          title={`${formatCount(request.lines.length)} ${request.lines.length === 1 ? "line" : "lines"}`}
        >
          <RequestedLines request={request} />
        </Panel>
      )}

      {canCancel ? (
        <Panel className="mt-6">
          <CancelRequestForm requestId={request.id} />
        </Panel>
      ) : null}
    </>
  );
};

export default RequestPage;
