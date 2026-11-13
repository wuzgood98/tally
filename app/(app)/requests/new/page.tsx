import type { Metadata } from "next";
import Link from "next/link";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import { RequestForm } from "@/components/stock/request-form";
import type { RequestDraftLine } from "@/components/stock/request-form";
import { PageHeader } from "@/components/ui/page-header";
import { canRequestStock } from "@/lib/permissions";
import { getScope, listBranches } from "@/lib/scope";
import { lineParam, param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";
import { MAX_REQUEST_LINES } from "@/lib/stock/requests";

export const metadata: Metadata = { title: "Request stock" };

/** Products and quantities from `?lines=`, e.g. from the low-stock list. */
const loadLines = async (text: string): Promise<RequestDraftLine[]> => {
  const wanted = lineParam(text, MAX_REQUEST_LINES);

  const products = await Promise.all(
    wanted.map(async ({ id }) => await getPickedProduct(id))
  );

  const lines: RequestDraftLine[] = [];
  const seen = new Set<number>();

  for (const [index, product] of products.entries()) {
    if (product !== null && !seen.has(product.id)) {
      seen.add(product.id);
      lines.push({
        product,
        quantity: String(Math.max(wanted[index]?.quantity ?? 1, 1)),
      });
    }
  }

  return lines;
};

const NewRequestPage = async ({ searchParams }: PageProps<"/requests/new">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);

  const [branches, scope, initialLines] = await Promise.all([
    listBranches(),
    getScope(viewer),
    loadLines(param(params, "lines")),
  ]);

  const stores = branches.filter(
    (item) => item.kind === "store" && canRequestStock(viewer, item.id)
  );

  const warehouse = branches.find((item) => item.kind === "warehouse");

  if (stores.length === 0 || warehouse === undefined) {
    return (
      <PageHeader
        description="Store managers and head office request stock from the warehouse."
        title="Request stock"
      />
    );
  }

  const scoped = scope.kind === "branch" ? scope.branchId : "";

  const defaultStoreId =
    [param(params, "branch"), scoped, viewer.branchId ?? ""].find((id) =>
      stores.some((item) => item.id === id)
    ) ??
    stores[0]?.id ??
    "";

  return (
    <>
      <PageHeader
        description={`Ask ${warehouse.name} for stock. Warehouse staff send it as a transfer; you'll see it on the way.`}
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/requests">
            Requests
          </Link>
        }
        title="Request stock"
      />
      <RequestForm
        defaultStoreId={defaultStoreId}
        initialLines={initialLines}
        stores={stores.map(({ id, name }) => ({ id, name }))}
        warehouse={{ id: warehouse.id, name: warehouse.name }}
      />
    </>
  );
};

export default NewRequestPage;
