import type { Metadata } from "next";
import Link from "next/link";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import { orderLine } from "@/components/purchasing/order-line";
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";
import type { DraftLine } from "@/components/stock/receipt-line-row";
import { PageHeader } from "@/components/ui/page-header";
import { canDraftPurchaseOrder } from "@/lib/permissions";
import { listSuppliers } from "@/lib/queries/products";
import { getScope, listBranches } from "@/lib/scope";
import { lineParam, param } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";
import { MAX_ORDER_LINES } from "@/lib/stock/purchase-orders";

export const metadata: Metadata = { title: "New purchase order" };

/** Products and quantities from `?lines=`, e.g. from the low-stock list. */
const loadLines = async (text: string): Promise<DraftLine[]> => {
  const wanted = lineParam(text, MAX_ORDER_LINES);

  const products = await Promise.all(
    wanted.map(async ({ id }) => await getPickedProduct(id))
  );

  const lines: DraftLine[] = [];
  const seen = new Set<number>();

  for (const [index, product] of products.entries()) {
    if (product !== null && !seen.has(product.id)) {
      seen.add(product.id);
      lines.push(orderLine(product, Math.max(wanted[index]?.quantity ?? 1, 1)));
    }
  }

  return lines;
};

const NewPurchaseOrderPage = async ({
  searchParams,
}: PageProps<"/purchase-orders/new">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const [branches, suppliers, scope, initialLines] = await Promise.all([
    listBranches(),
    listSuppliers(),
    getScope(viewer),
    loadLines(param(params, "lines")),
  ]);

  const draftable = branches.filter((item) =>
    canDraftPurchaseOrder(viewer, item.id)
  );

  if (draftable.length === 0) {
    return (
      <PageHeader
        description="Purchase orders are drafted by branch managers and head office."
        title="New purchase order"
      />
    );
  }

  const scoped = scope.kind === "branch" ? scope.branchId : "";

  const defaultBranchId =
    [param(params, "branch"), scoped, viewer.branchId ?? ""].find((id) =>
      draftable.some((item) => item.id === id)
    ) ??
    draftable[0]?.id ??
    "";

  const requestedSupplier = param(params, "supplier");

  const defaultSupplierId = suppliers.some(
    (item) => String(item.id) === requestedSupplier
  )
    ? requestedSupplier
    : "";

  return (
    <>
      <PageHeader
        description="Save it as a draft; head office approves it before it goes to the supplier."
        eyebrow={
          <Link
            className="hover:text-ink hover:underline"
            href="/purchase-orders"
          >
            Purchase orders
          </Link>
        }
        title="New purchase order"
      />
      <PurchaseOrderForm
        branches={draftable.map(({ id, name }) => ({ id, name }))}
        defaultBranchId={defaultBranchId}
        defaultSupplierId={defaultSupplierId}
        initialLines={initialLines}
        suppliers={suppliers.map(({ id, name }) => ({ id: String(id), name }))}
      />
    </>
  );
};

export default NewPurchaseOrderPage;
