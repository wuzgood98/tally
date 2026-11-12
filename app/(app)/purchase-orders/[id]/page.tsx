import { CircleCheck, PackagePlus, Pencil, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  ApproveOrderButton,
  ReasonOrderAction,
} from "@/components/purchasing/order-actions";
import { OrderLinesTable } from "@/components/purchasing/order-lines-table";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import {
  formatCount,
  formatDate,
  formatDateTime,
  isoString,
} from "@/lib/format";
import { formatCedis } from "@/lib/money";
import {
  canApprovePurchaseOrder,
  canCancelDraftPurchaseOrder,
  canDraftPurchaseOrder,
  canReceive,
} from "@/lib/permissions";
import { getPurchaseOrder } from "@/lib/queries/purchase-orders";
import type { PurchaseOrderDetail } from "@/lib/queries/purchase-orders";
import { param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";
import type { Viewer } from "@/lib/session";

const orderId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/purchase-orders/[id]">): Promise<Metadata> => {
  const route = await params;
  const id = orderId(route.id);
  const order = id === null ? null : await getPurchaseOrder(id);

  return { title: order?.number ?? "Purchase order" };
};

const NOTICES = {
  approved: "Approved. Print it or send it to the supplier.",
  cancelled: "Cancelled.",
  closed: "Closed short. Nothing more is expected against it.",
  saved: "Draft saved. Head office approves it before it goes out.",
} as const;

const NOTICE_KINDS = ["saved", "approved", "cancelled", "closed"] as const;

type Query = Record<string, string | string[] | undefined>;

const Notice = ({ query }: { readonly query: Query }) => {
  const kind = NOTICE_KINDS.find((key) => param(query, key) === "1");

  return kind === undefined ? null : (
    <output className="bg-brand-soft text-good mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
      <CircleCheck aria-hidden="true" className="size-4" />
      {NOTICES[kind]}
    </output>
  );
};

const Fact = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div>
    <dt className="text-ink-2 text-xs">{label}</dt>
    <dd className="mt-0.5 font-medium">{children}</dd>
  </div>
);

const When = ({ at }: { readonly at: Date | null }) =>
  at === null ? (
    <span className="text-ink-3">—</span>
  ) : (
    <time dateTime={isoString(at)}>{formatDateTime(at)}</time>
  );

/** What this person may do with the order at its current stage. */
const allowedActions = (order: PurchaseOrderDetail, viewer: Viewer) => {
  const draft = order.status === "draft";

  const open =
    order.status === "approved" || order.status === "partly_received";

  const headOffice = canApprovePurchaseOrder(viewer);

  return {
    approve: draft && headOffice,
    cancel:
      (draft && canCancelDraftPurchaseOrder(viewer, order.branchId)) ||
      (order.status === "approved" && headOffice),
    close: order.status === "partly_received" && headOffice,
    edit: draft && canDraftPurchaseOrder(viewer, order.branchId),
    receive: open && canReceive(viewer, order.branchId),
    waiting: draft && !headOffice,
  };
};

/** Receive, approve, edit, cancel or close: whatever this person may do now. */
const Actions = ({
  order,
  viewer,
}: {
  readonly order: PurchaseOrderDetail;
  readonly viewer: Viewer;
}) => {
  const allowed = allowedActions(order, viewer);
  const { approve, cancel, close, edit, receive } = allowed;

  if (!(approve || cancel || close || edit || receive)) {
    return null;
  }

  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-start gap-3">
        {receive ? (
          <Link
            className={buttonVariants({ size: "md" })}
            href={`/purchase-orders/${order.id}/receive`}
          >
            <PackagePlus aria-hidden="true" />
            Receive delivery
          </Link>
        ) : null}
        {approve ? (
          <ApproveOrderButton
            orderId={order.id}
            total={formatCedis(order.totalCost)}
          />
        ) : null}
        {edit ? (
          <Link
            className={buttonVariants({ size: "md", variant: "outline" })}
            href={`/purchase-orders/${order.id}/edit`}
          >
            <Pencil aria-hidden="true" />
            Edit draft
          </Link>
        ) : null}
        {cancel ? <ReasonOrderAction kind="cancel" orderId={order.id} /> : null}
        {close ? <ReasonOrderAction kind="close" orderId={order.id} /> : null}
      </div>
      {allowed.waiting ? (
        <p className="text-ink-2 mt-3 text-sm">
          Waiting for head office to approve it.
        </p>
      ) : null}
    </Panel>
  );
};

const PurchaseOrderPage = async ({
  params,
  searchParams,
}: PageProps<"/purchase-orders/[id]">) => {
  const [viewer, route, query] = await Promise.all([
    requireViewer(),
    params,
    searchParams,
  ]);

  const id = orderId(route.id);
  const order = id === null ? null : await getPurchaseOrder(id);

  if (!order) {
    notFound();
  }

  const supplierContact = [order.supplierContact, order.supplierPhone]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      <Notice query={query} />
      <PageHeader
        actions={
          <>
            <PurchaseOrderStatusBadge status={order.status} />
            <Link
              className={buttonVariants({ size: "md", variant: "outline" })}
              href={`/purchase-orders/${order.id}/print`}
            >
              <Printer aria-hidden="true" />
              Print
            </Link>
          </>
        }
        description={`${order.supplierName} → ${order.branchName}`}
        eyebrow={
          <Link
            className="hover:text-ink hover:underline"
            href="/purchase-orders"
          >
            Purchase orders
          </Link>
        }
        title={<span className="font-mono">{order.number}</span>}
      />

      <Actions order={order} viewer={viewer} />

      <Panel className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Supplier">
            {order.supplierName}
            {supplierContact === "" ? null : (
              <span className="text-ink-2 block text-xs font-normal">
                {supplierContact}
              </span>
            )}
          </Fact>
          <Fact label="Deliver to">{order.branchName}</Fact>
          <Fact label="Drafted">
            <When at={order.createdAt} />
            <span className="text-ink-2 block text-xs font-normal">
              {order.createdBy ?? "—"}
            </span>
          </Fact>
          <Fact label="Approved">
            <When at={order.approvedAt} />
            {order.approvedBy === null ? null : (
              <span className="text-ink-2 block text-xs font-normal">
                {order.approvedBy}
              </span>
            )}
          </Fact>
          <Fact label="Expected">
            {order.expectedAt === null ? (
              <span className="text-ink-3">After approval</span>
            ) : (
              <time dateTime={isoString(order.expectedAt)}>
                {formatDate(order.expectedAt)}
              </time>
            )}
          </Fact>
          <Fact label="Value at agreed cost">
            <span className="tabular">{formatCedis(order.totalCost)}</span>
          </Fact>
        </dl>
        {order.note === null ? null : (
          <p className="border-line text-ink-2 mt-4 border-t pt-3 text-sm">
            {order.note}
          </p>
        )}
        {order.closeNote === null ? null : (
          <p className="border-line mt-4 border-t pt-3 text-sm">
            <span className="text-ink-2 block text-xs">
              {order.status === "cancelled" ? "Cancelled" : "Closed short"} by{" "}
              {order.closedBy ?? "—"}
            </span>
            {order.closeNote}
          </p>
        )}
      </Panel>

      <Panel
        flush
        title={`${formatCount(order.lines.length)} ${order.lines.length === 1 ? "line" : "lines"}`}
      >
        <OrderLinesTable order={order} />
      </Panel>

      {order.receipts.length > 0 ? (
        <Panel className="mt-6" id="deliveries" title="Deliveries against it">
          <ul className="grid gap-2 text-sm">
            {order.receipts.map((receipt) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-2"
                key={receipt.id}
              >
                <Link
                  className="text-brand font-mono text-xs font-medium hover:underline"
                  href={`/receipts/${receipt.id}`}
                >
                  {receipt.number}
                </Link>
                <span className="text-ink-2 text-xs">
                  <When at={receipt.createdAt} /> ·{" "}
                  {formatCedis(receipt.totalCost)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
};

export default PurchaseOrderPage;
