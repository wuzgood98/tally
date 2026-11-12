import type { Metadata } from "next";
import Link from "next/link";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import { ReceiveForm } from "@/components/stock/receive-form";
import { PageHeader } from "@/components/ui/page-header";
import { operableBranchIds } from "@/lib/permissions";
import { listSuppliers } from "@/lib/queries/products";
import { getScope, listBranches } from "@/lib/scope";
import { intParam, param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Receive goods" };

const NewReceiptPage = async ({ searchParams }: PageProps<"/receipts/new">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);

  const [branches, suppliers, scope] = await Promise.all([
    listBranches(),
    listSuppliers(),
    getScope(viewer),
  ]);

  const allowed = new Set(
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    )
  );

  const options = branches.filter((item) => allowed.has(item.id));

  if (options.length === 0) {
    return (
      <PageHeader
        description="Your account isn't attached to a branch. Ask head office to set one."
        title="Receive goods"
      />
    );
  }

  const requested = param(params, "branch");
  const scoped = scope.kind === "branch" ? scope.branchId : "";

  const defaultBranchId =
    [requested, scoped, viewer.branchId ?? ""].find((id) => allowed.has(id)) ??
    options[0]?.id ??
    "";

  const productId = intParam(params, "product", 0);
  const initialProduct = productId ? await getPickedProduct(productId) : null;

  return (
    <>
      <PageHeader
        description="Record a delivery as it comes off the truck. Stock goes up the moment you save."
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/receipts">
            Goods received
          </Link>
        }
        title="Receive goods"
      />
      <ReceiveForm
        branches={options.map(({ id, name }) => ({ id, name }))}
        defaultBranchId={defaultBranchId}
        initialProduct={initialProduct}
        suppliers={suppliers.map(({ id, name }) => ({ id: String(id), name }))}
      />
    </>
  );
};

export default NewReceiptPage;
