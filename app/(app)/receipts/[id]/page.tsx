import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { getReceipt } from "@/lib/queries/receipts";
import { requireBackOffice } from "@/lib/session";

const receiptId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/receipts/[id]">): Promise<Metadata> => {
  await requireBackOffice();
  const route = await params;
  const id = receiptId(route.id);
  const receipt = id === null ? null : await getReceipt(id);

  return { title: receipt?.number ?? "Receipt" };
};

const ReceiptPage = async ({ params }: PageProps<"/receipts/[id]">) => {
  const [, route] = await Promise.all([requireBackOffice(), params]);

  const id = receiptId(route.id);
  const receipt = id === null ? null : await getReceipt(id);

  if (!receipt) {
    notFound();
  }

  const units = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <PageHeader
        actions={
          receipt.purchaseOrderId === null ? undefined : (
            <Link
              className="text-brand text-sm font-medium hover:underline"
              href={`/purchase-orders/${receipt.purchaseOrderId}`}
            >
              Against{" "}
              <span className="font-mono">{receipt.purchaseOrderNumber}</span>
            </Link>
          )
        }
        description={`${receipt.supplierName} → ${receipt.branchName}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/receipts">
            Goods received
          </Link>
        }
        title={<span className="font-mono">{receipt.number}</span>}
      />

      <Panel className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-ink-2 text-xs">Received</dt>
            <dd className="mt-0.5 font-medium">
              <time dateTime={isoString(receipt.createdAt)}>
                {formatDateTime(receipt.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">By</dt>
            <dd className="mt-0.5 font-medium">{receipt.receivedBy ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">Supplier reference</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium">
              {receipt.supplierReference ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">Total cost</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatCedis(receipt.totalCost)}
            </dd>
          </div>
        </dl>
        {receipt.note !== null && receipt.note !== undefined ? (
          <p className="border-line text-ink-2 mt-4 border-t pt-3 text-sm">
            {receipt.note}
          </p>
        ) : null}
      </Panel>

      <Panel
        flush
        title={`${formatCount(receipt.lines.length)} lines · ${formatCount(units)} units`}
      >
        <Table>
          <caption className="sr-only">Products on {receipt.number}</caption>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th numeric>Quantity</Th>
              <Th numeric>Unit cost</Th>
              <Th numeric>Line total</Th>
              <Th numeric>Stock after</Th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
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
                  {formatCount(line.quantity)}
                </Td>
                <Td numeric>{formatCedis(line.unitCost ?? 0)}</Td>
                <Td numeric>
                  {formatCedis(line.quantity * (line.unitCost ?? 0))}
                </Td>
                <Td numeric tone="muted">
                  {formatCount(line.balanceAfter)}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <Td weight="semibold">Total</Td>
              <Td numeric weight="semibold">
                {formatCount(units)}
              </Td>
              <Td />
              <Td numeric weight="semibold">
                {formatCedis(receipt.totalCost)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </Table>
      </Panel>
    </>
  );
};

export default ReceiptPage;
