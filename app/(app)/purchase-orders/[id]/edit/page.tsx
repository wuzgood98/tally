import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";
import type { DraftLine } from "@/components/stock/receipt-line-row";
import { PageHeader } from "@/components/ui/page-header";
import { pesewasToInput } from "@/lib/money";
import { canDraftPurchaseOrder } from "@/lib/permissions";
import { getPurchaseOrder } from "@/lib/queries/purchase-orders";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Edit purchase order" };

const orderId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const EditPurchaseOrderPage = async ({
  params,
}: PageProps<"/purchase-orders/[id]/edit">) => {
  const [viewer, route] = await Promise.all([requireViewer(), params]);
  const id = orderId(route.id);
  const order = id === null ? null : await getPurchaseOrder(id);

  if (!order || !canDraftPurchaseOrder(viewer, order.branchId)) {
    notFound();
  }

  // Only drafts change; anything else goes back to the order itself.
  if (order.status !== "draft") {
    redirect(`/purchase-orders/${order.id}`);
  }

  // The agreed costs and quantities as saved, with today's stock for context.
  const picked = await Promise.all(
    order.lines.map(async (line) => await getPickedProduct(line.productId))
  );

  const initialLines: DraftLine[] = order.lines.flatMap((line, index) => {
    const product = picked[index];

    return product === null || product === undefined
      ? []
      : [
          {
            cost: pesewasToInput(line.unitCost),
            product,
            quantity: String(line.quantity),
          },
        ];
  });

  // Discontinued since the draft was saved: they can't be ordered, so say so.
  const dropped = order.lines.length - initialLines.length;

  const droppedNote =
    dropped > 0
      ? ` ${dropped} discontinued ${dropped === 1 ? "product was" : "products were"} left out; saving removes ${dropped === 1 ? "it" : "them"}.`
      : "";

  return (
    <>
      <PageHeader
        description={`${order.supplierName} → ${order.branchName}.${droppedNote}`}
        eyebrow={
          <Link
            className="hover:text-ink hover:underline"
            href={`/purchase-orders/${order.id}`}
          >
            <span className="font-mono">{order.number}</span>
          </Link>
        }
        title="Edit draft"
      />
      <PurchaseOrderForm
        branches={[{ id: order.branchId, name: order.branchName }]}
        defaultBranchId={order.branchId}
        defaultNote={order.note ?? ""}
        defaultSupplierId={String(order.supplierId)}
        initialLines={initialLines}
        orderId={order.id}
        suppliers={[{ id: String(order.supplierId), name: order.supplierName }]}
      />
    </>
  );
};

export default EditPurchaseOrderPage;
