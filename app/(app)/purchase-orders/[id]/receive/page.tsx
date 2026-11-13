import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import type { DraftLine } from "@/components/stock/receipt-line-row";
import { ReceiveForm } from "@/components/stock/receive-form";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { pesewasToInput } from "@/lib/money";
import { canReceive } from "@/lib/permissions";
import { getPurchaseOrder } from "@/lib/queries/purchase-orders";
import { requireBackOffice } from "@/lib/session";

export const metadata: Metadata = { title: "Receive against an order" };

const orderId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const ReceiveAgainstOrderPage = async ({
  params,
}: PageProps<"/purchase-orders/[id]/receive">) => {
  const [viewer, route] = await Promise.all([requireBackOffice(), params]);
  const id = orderId(route.id);
  const order = id === null ? null : await getPurchaseOrder(id);

  if (!order || !canReceive(viewer, order.branchId)) {
    notFound();
  }

  // Only approved orders with something still due take deliveries.
  if (order.status !== "approved" && order.status !== "partly_received") {
    redirect(`/purchase-orders/${order.id}`);
  }

  const due = order.lines.filter(
    (line) => line.quantity > line.quantityReceived
  );

  const picked = await Promise.all(
    due.map(async (line) => await getPickedProduct(line.productId))
  );

  // Starts at everything still due, at the agreed cost: lower what didn't come.
  const initialLines: DraftLine[] = due.flatMap((line, index) => {
    const product = picked[index];

    return product === null || product === undefined
      ? []
      : [
          {
            cost: pesewasToInput(line.unitCost),
            product,
            quantity: String(line.quantity - line.quantityReceived),
          },
        ];
  });

  const discontinued = due.length - initialLines.length;

  const expected =
    order.expectedAt === null
      ? ""
      : ` Expected ${formatDate(order.expectedAt)}.`;

  const discontinuedNote =
    discontinued > 0
      ? ` ${discontinued} discontinued ${discontinued === 1 ? "line" : "lines"} can't be received; head office can close the order short.`
      : "";

  return (
    <>
      <PageHeader
        description={`${order.supplierName} → ${order.branchName}. Each line starts at what's still due; lower any that came short, or remove what didn't come.${expected}${discontinuedNote}`}
        eyebrow={
          <Link
            className="hover:text-ink hover:underline"
            href={`/purchase-orders/${order.id}`}
          >
            <span className="font-mono">{order.number}</span>
          </Link>
        }
        title="Receive a delivery"
      />
      <ReceiveForm
        branches={[{ id: order.branchId, name: order.branchName }]}
        defaultBranchId={order.branchId}
        initialLines={initialLines}
        initialProduct={null}
        order={{ id: order.id, supplierId: String(order.supplierId) }}
        suppliers={[{ id: String(order.supplierId), name: order.supplierName }]}
      />
    </>
  );
};

export default ReceiveAgainstOrderPage;
