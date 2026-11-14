import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReturnForm } from "@/components/sales/return-form";
import { ReturnsList } from "@/components/sales/returns-list";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { canApproveReturn, canSeeBranch } from "@/lib/permissions";
import { getSale, getSaleReturns } from "@/lib/queries/sales";
import { requireViewer } from "@/lib/session";
import { PAYMENT_LABELS } from "@/lib/stock/payment";

const saleId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/sales/[id]">): Promise<Metadata> => {
  const [viewer, route] = await Promise.all([requireViewer(), params]);
  const id = saleId(route.id);
  const found = id === null ? null : await getSale(id);

  return {
    title:
      found !== null && canSeeBranch(viewer, found.branchId)
        ? found.number
        : "Sale",
  };
};

const SalePage = async ({ params }: PageProps<"/sales/[id]">) => {
  const [viewer, route] = await Promise.all([requireViewer(), params]);

  const id = saleId(route.id);
  const found = id === null ? null : await getSale(id);

  // Another store's sale is a 404 for a cashier, as if it didn't exist.
  if (!found || !canSeeBranch(viewer, found.branchId)) {
    notFound();
  }

  const returns = await getSaleReturns(found.id);
  const units = found.lines.reduce((sum, line) => sum + line.quantity, 0);

  const returnable = found.lines.flatMap((line) =>
    line.quantity > line.returned
      ? [{ ...line, returnable: line.quantity - line.returned }]
      : []
  );

  const canReturn =
    returnable.length > 0 && canApproveReturn(viewer, found.branchId);

  return (
    <>
      <PageHeader
        description={`${found.branchName} · ${PAYMENT_LABELS[found.paymentMethod]}`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/sales">
            Sales
          </Link>
        }
        title={<span className="font-mono">{found.number}</span>}
      />

      <Panel className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-ink-2 text-xs">When</dt>
            <dd className="mt-0.5 font-medium">
              <time dateTime={isoString(found.createdAt)}>
                {formatDateTime(found.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">Cashier</dt>
            <dd className="mt-0.5 font-medium">{found.cashier ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">Paid by</dt>
            <dd className="mt-0.5 font-medium">
              {PAYMENT_LABELS[found.paymentMethod]}
            </dd>
          </div>
          <div>
            <dt className="text-ink-2 text-xs">Total</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatCedis(found.total)}
            </dd>
          </div>
        </dl>
        <p className="border-line text-ink-3 mt-4 border-t pt-3 font-mono text-xs">
          Till reference {found.clientRef}
        </p>
      </Panel>

      <Panel
        flush
        title={`${formatCount(found.lines.length)} ${found.lines.length === 1 ? "line" : "lines"} · ${formatCount(units)} ${units === 1 ? "item" : "items"}`}
      >
        <Table>
          <caption className="sr-only">Items on {found.number}</caption>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Price</Th>
              <Th numeric>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {found.lines.map((line) => (
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
                <Td numeric>{formatCedis(line.unitPrice)}</Td>
                <Td numeric>{formatCedis(line.quantity * line.unitPrice)}</Td>
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
                {formatCedis(found.total)}
              </Td>
            </tr>
          </tfoot>
        </Table>
      </Panel>

      {returns.length > 0 ? (
        <div className="mt-6">
          <ReturnsList returns={returns} />
        </div>
      ) : null}

      {canReturn ? (
        <Panel className="mt-6" flush id="return" title="Return items">
          <ReturnForm lines={returnable} saleId={found.id} />
        </Panel>
      ) : null}
    </>
  );
};

export default SalePage;
