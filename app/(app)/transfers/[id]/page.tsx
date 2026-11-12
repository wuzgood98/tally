import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelTransferForm } from "@/components/stock/cancel-transfer-form";
import { ReceiveTransferForm } from "@/components/stock/receive-transfer-form";
import { TransferStatusBadge } from "@/components/stock/transfer-status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { canCancelTransfer, canReceiveTransfer } from "@/lib/permissions";
import { getTransfer } from "@/lib/queries/transfers";
import type { TransferDetail } from "@/lib/queries/transfers";
import { param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

const transferId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/transfers/[id]">): Promise<Metadata> => {
  const route = await params;
  const id = transferId(route.id);
  const transfer = id === null ? null : await getTransfer(id);

  return { title: transfer?.number ?? "Transfer" };
};

const Moment = ({ at }: { readonly at: Date }) => (
  <time dateTime={isoString(at)}>{formatDateTime(at)}</time>
);

/** Where the transfer ended up: arrived, called back, or still on the road. */
const Outcome = ({ transfer }: { readonly transfer: TransferDetail }) => {
  if (transfer.receivedAt !== null) {
    return (
      <>
        <div>
          <dt className="text-ink-2 text-xs">Received</dt>
          <dd className="mt-0.5 font-medium">
            <Moment at={transfer.receivedAt} />
          </dd>
        </div>
        <div>
          <dt className="text-ink-2 text-xs">Received by</dt>
          <dd className="mt-0.5 font-medium">{transfer.receivedBy ?? "—"}</dd>
        </div>
      </>
    );
  }

  if (transfer.cancelledAt !== null) {
    return (
      <>
        <div>
          <dt className="text-ink-2 text-xs">Cancelled</dt>
          <dd className="mt-0.5 font-medium">
            <Moment at={transfer.cancelledAt} />
          </dd>
        </div>
        <div>
          <dt className="text-ink-2 text-xs">Cancelled by</dt>
          <dd className="mt-0.5 font-medium">{transfer.cancelledBy ?? "—"}</dd>
        </div>
      </>
    );
  }

  return (
    <div className="col-span-2">
      <dt className="text-ink-2 text-xs">Arrival</dt>
      <dd className="mt-0.5 font-medium">On the way to {transfer.toName}</dd>
    </div>
  );
};

const NOTE_LABELS = {
  cancelled: "Why it was cancelled",
  in_transit: "",
  received: "On arrival",
} as const;

const LinesTable = ({ transfer }: { readonly transfer: TransferDetail }) => {
  const received = transfer.status === "received";

  const unitsSent = transfer.lines.reduce(
    (sum, line) => sum + line.quantitySent,
    0
  );

  const unitsReceived = transfer.lines.reduce(
    (sum, line) => sum + (line.quantityReceived ?? 0),
    0
  );

  return (
    <Table>
      <caption className="sr-only">Products on {transfer.number}</caption>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th numeric>Sent</Th>
          {received ? <Th numeric>Received</Th> : null}
          {received ? <Th numeric>Lost</Th> : null}
          <Th numeric>Unit cost</Th>
          <Th numeric>Value sent</Th>
        </tr>
      </thead>
      <tbody>
        {transfer.lines.map((line) => {
          const lost = line.quantitySent - (line.quantityReceived ?? 0);

          return (
            <tr key={line.productId}>
              <Td className="min-w-56">
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
                {formatCount(line.quantitySent)}
              </Td>
              {received ? (
                <Td numeric>{formatCount(line.quantityReceived ?? 0)}</Td>
              ) : null}
              {received ? (
                <Td
                  numeric
                  tone={lost > 0 ? "danger" : "faint"}
                  weight={lost > 0 ? "medium" : "normal"}
                >
                  {lost > 0 ? formatCount(lost) : "—"}
                </Td>
              ) : null}
              <Td numeric>{formatCedis(line.unitCost)}</Td>
              <Td numeric>{formatCedis(line.quantitySent * line.unitCost)}</Td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <Td weight="semibold">Total</Td>
          <Td numeric weight="semibold">
            {formatCount(unitsSent)}
          </Td>
          {received ? (
            <Td numeric weight="semibold">
              {formatCount(unitsReceived)}
            </Td>
          ) : null}
          {received ? (
            <Td
              numeric
              tone={unitsSent > unitsReceived ? "danger" : "faint"}
              weight="semibold"
            >
              {unitsSent > unitsReceived
                ? formatCount(unitsSent - unitsReceived)
                : "—"}
            </Td>
          ) : null}
          <Td />
          <Td numeric weight="semibold">
            {formatCedis(transfer.totalCost)}
          </Td>
        </tr>
      </tfoot>
    </Table>
  );
};

type Query = Record<string, string | string[] | undefined>;

const NOTICE_KINDS = ["sent", "received", "cancelled"] as const;

const noticeText = (
  kind: (typeof NOTICE_KINDS)[number],
  transfer: TransferDetail
): string => {
  const sent = transfer.lines.reduce((sum, line) => sum + line.quantitySent, 0);

  const received = transfer.lines.reduce(
    (sum, line) => sum + (line.quantityReceived ?? 0),
    0
  );

  if (kind === "sent") {
    return `Sent. ${formatCount(sent)} units left ${transfer.fromName} and are on the way to ${transfer.toName}.`;
  }

  if (kind === "cancelled") {
    return `Cancelled. ${formatCount(sent)} units are back at ${transfer.fromName}.`;
  }

  const lost = sent - received;
  const added = `Received. ${formatCount(received)} units added to ${transfer.toName}`;

  return lost > 0
    ? `${added}; ${formatCount(lost)} recorded as lost in transit.`
    : `${added}.`;
};

/** The confirmation after sending, receiving or cancelling, if any. */
const Notice = ({
  query,
  transfer,
}: {
  readonly query: Query;
  readonly transfer: TransferDetail;
}) => {
  const kind = NOTICE_KINDS.find(
    (candidate) => param(query, candidate) === "1"
  );

  if (kind === undefined) {
    return null;
  }

  return (
    <output className="bg-brand-soft text-good mb-6 flex flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
      <CircleCheck aria-hidden="true" className="size-4" />
      {noticeText(kind, transfer)}
      {kind === "sent" ? (
        <Link className="ml-auto underline" href="/transfers/new">
          Send another
        </Link>
      ) : null}
    </output>
  );
};

const TransferPage = async ({
  params,
  searchParams,
}: PageProps<"/transfers/[id]">) => {
  const [viewer, route, query] = await Promise.all([
    requireViewer(),
    params,
    searchParams,
  ]);

  const id = transferId(route.id);
  const transfer = id === null ? null : await getTransfer(id);

  if (!transfer) {
    notFound();
  }

  const units = transfer.lines.reduce(
    (sum, line) => sum + line.quantitySent,
    0
  );

  const unitsLost = transfer.lines.reduce(
    (sum, line) =>
      sum +
      (line.quantityReceived === null
        ? 0
        : line.quantitySent - line.quantityReceived),
    0
  );

  const inTransit = transfer.status === "in_transit";

  const receivable =
    inTransit && canReceiveTransfer(viewer, transfer.toBranchId);

  const cancellable =
    inTransit && canCancelTransfer(viewer, transfer.fromBranchId);

  return (
    <>
      <Notice query={query} transfer={transfer} />

      <PageHeader
        actions={
          <TransferStatusBadge status={transfer.status} unitsLost={unitsLost} />
        }
        description={`${transfer.fromName} → ${transfer.toName}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/transfers">
            Transfers
          </Link>
        }
        title={<span className="font-mono">{transfer.number}</span>}
      />

      <Panel className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
          <div>
            <dt className="text-ink-2 text-xs">Sent</dt>
            <dd className="mt-0.5 font-medium">
              <Moment at={transfer.createdAt} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">Sent by</dt>
            <dd className="mt-0.5 font-medium">
              {transfer.dispatchedBy ?? "—"}
            </dd>
          </div>
          <Outcome transfer={transfer} />
          <div>
            <dt className="text-ink-2 text-xs">Value at cost</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatCedis(transfer.totalCost)}
            </dd>
          </div>
        </dl>
        {transfer.note === null ? null : (
          <p className="border-line text-ink-2 mt-4 border-t pt-3 text-sm">
            {transfer.note}
          </p>
        )}
        {transfer.receiveNote === null ? null : (
          <p className="border-line mt-4 border-t pt-3 text-sm">
            <span className="text-ink-2 block text-xs">
              {NOTE_LABELS[transfer.status]}
            </span>
            {transfer.receiveNote}
          </p>
        )}
      </Panel>

      {receivable ? (
        <Panel flush title={`Count it in · ${formatCount(units)} units sent`}>
          <ReceiveTransferForm
            lines={transfer.lines}
            transferId={transfer.id}
          />
        </Panel>
      ) : (
        <Panel
          flush
          title={`${formatCount(transfer.lines.length)} ${transfer.lines.length === 1 ? "line" : "lines"} · ${formatCount(units)} units`}
        >
          <LinesTable transfer={transfer} />
        </Panel>
      )}

      {cancellable ? (
        <Panel className="mt-6">
          <CancelTransferForm
            fromName={transfer.fromName}
            transferId={transfer.id}
          />
        </Panel>
      ) : null}
    </>
  );
};

export default TransferPage;
