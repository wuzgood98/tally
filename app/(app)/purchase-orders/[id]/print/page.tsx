import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/purchasing/print-button";
import { buttonVariants } from "@/components/ui/button";
import { formatCount, formatDate } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { getCompanyName } from "@/lib/queries/company";
import { getPurchaseOrder } from "@/lib/queries/purchase-orders";
import { requireBackOffice } from "@/lib/session";

const orderId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/purchase-orders/[id]/print">): Promise<Metadata> => {
  await requireBackOffice();
  const route = await params;
  const id = orderId(route.id);
  const order = id === null ? null : await getPurchaseOrder(id);

  return {
    title: order === null ? "Purchase order" : `${order.number} (print)`,
  };
};

/** Shown across the top when the order shouldn't go to a supplier as it is. */
const WARNINGS = {
  cancelled: "Cancelled: do not supply.",
  draft: "Draft: not approved yet. Don't send this to the supplier.",
} as const;

const PrintPurchaseOrderPage = async ({
  params,
}: PageProps<"/purchase-orders/[id]/print">) => {
  const [, route, companyName] = await Promise.all([
    requireBackOffice(),
    params,
    getCompanyName(),
  ]);

  const id = orderId(route.id);
  const order = id === null ? null : await getPurchaseOrder(id);

  if (!order) {
    notFound();
  }

  const warning =
    order.status === "draft" || order.status === "cancelled"
      ? WARNINGS[order.status]
      : null;

  const supplierLines = [
    order.supplierContact,
    order.supplierPhone,
    order.supplierEmail,
  ].filter((line) => line !== null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <Link
          className={buttonVariants({ size: "md", variant: "outline" })}
          href={`/purchase-orders/${order.id}`}
        >
          Back to the order
        </Link>
      </div>

      <article className="bg-surface border-line rounded-xl border p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
        {warning === null ? null : (
          <p className="text-danger border-danger mb-6 rounded-md border-2 px-3 py-2 text-sm font-semibold">
            {warning}
          </p>
        )}

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">{companyName}</p>
            <p className="text-ink-2 text-sm">Purchase order</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold">{order.number}</p>
            <p className="text-ink-2 text-sm">
              {formatDate(order.approvedAt ?? order.createdAt)}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 text-sm sm:grid-cols-3">
          <div>
            <h2 className="text-ink-2 mb-1 text-xs font-medium uppercase">
              Supplier
            </h2>
            <p className="font-medium">{order.supplierName}</p>
            {supplierLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div>
            <h2 className="text-ink-2 mb-1 text-xs font-medium uppercase">
              Deliver to
            </h2>
            <p className="font-medium">
              {companyName}, {order.branchName}
            </p>
            <p>{order.branchAddress}</p>
            <p>{order.branchCity}</p>
          </div>
          <div>
            <h2 className="text-ink-2 mb-1 text-xs font-medium uppercase">
              Expected by
            </h2>
            <p className="font-medium">
              {order.expectedAt === null ? "—" : formatDate(order.expectedAt)}
            </p>
            {order.approvedBy === null ? null : (
              <p className="text-ink-2">Approved by {order.approvedBy}</p>
            )}
          </div>
        </section>

        <div className="relative mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Products ordered</caption>
            <thead>
              <tr className="border-ink border-b-2 text-left text-xs">
                <th className="py-2 pr-2 font-medium" scope="col">
                  SKU
                </th>
                <th className="py-2 pr-2 font-medium" scope="col">
                  Product
                </th>
                <th className="py-2 pr-2 text-right font-medium" scope="col">
                  Qty
                </th>
                <th className="py-2 pr-2 text-right font-medium" scope="col">
                  Unit cost
                </th>
                <th className="py-2 text-right font-medium" scope="col">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr className="border-line border-b" key={line.productId}>
                  <td className="py-2 pr-2 font-mono text-xs whitespace-nowrap">
                    {line.sku}
                  </td>
                  <td className="py-2 pr-2">
                    {line.name}
                    {line.barcode === null ? null : (
                      <span className="text-ink-2 block font-mono text-xs">
                        {line.barcode}
                      </span>
                    )}
                  </td>
                  <td className="tabular py-2 pr-2 text-right">
                    {formatCount(line.quantity)}
                  </td>
                  <td className="tabular py-2 pr-2 text-right whitespace-nowrap">
                    {formatCedis(line.unitCost)}
                  </td>
                  <td className="tabular py-2 text-right whitespace-nowrap">
                    {formatCedis(line.quantity * line.unitCost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-3 font-semibold" colSpan={4}>
                  Total
                </td>
                <td className="tabular py-3 text-right font-semibold whitespace-nowrap">
                  {formatCedis(order.totalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {order.note === null ? null : (
          <p className="border-line mt-4 border-t pt-3 text-sm">
            <span className="text-ink-2 block text-xs font-medium uppercase">
              Note
            </span>
            {order.note}
          </p>
        )}

        <p className="text-ink-2 mt-8 text-xs">
          Please quote {order.number} on your delivery note and invoice. Prices
          are in Ghana cedis.
        </p>
      </article>
    </div>
  );
};

export default PrintPurchaseOrderPage;
