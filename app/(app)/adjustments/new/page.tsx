import type { Metadata } from "next";
import Link from "next/link";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import { AdjustForm } from "@/components/stock/adjust-form";
import type { BranchRules } from "@/components/stock/adjust-form";
import { PageHeader } from "@/components/ui/page-header";
import { canAdjust, operableBranchIds } from "@/lib/permissions";
import { getScope, listBranches } from "@/lib/scope";
import { intParam, param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";
import { ADJUSTMENT_REASONS } from "@/lib/stock/reasons";

export const metadata: Metadata = { title: "Adjust stock" };

const CHANGE_REASONS = ADJUSTMENT_REASONS.filter(
  (reason) => reason !== "count_correction"
);

const NewAdjustmentPage = async ({
  searchParams,
}: PageProps<"/adjustments/new">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const allowed = new Set(
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    )
  );

  const rules: BranchRules[] = [];

  for (const item of branches) {
    if (allowed.has(item.id)) {
      rules.push({
        canCount: canAdjust(viewer, item.id, "count_correction"),
        id: item.id,
        name: item.name,
        reasons: CHANGE_REASONS.filter((reason) =>
          canAdjust(viewer, item.id, reason)
        ),
      });
    }
  }

  if (rules.length === 0) {
    return (
      <PageHeader
        description="Your account isn't attached to a branch. Ask head office to set one."
        title="Adjust stock"
      />
    );
  }

  const requested = param(params, "branch");
  const scoped = scope.kind === "branch" ? scope.branchId : "";

  const defaultBranchId =
    [requested, scoped, viewer.branchId ?? ""].find((id) => allowed.has(id)) ??
    rules[0]?.id ??
    "";

  const productId = intParam(params, "product", 0);
  const initialProduct = productId ? await getPickedProduct(productId) : null;

  return (
    <>
      <PageHeader
        description="Write off damaged, expired or missing stock, or correct the balance after counting a shelf."
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/adjustments">
            Adjustments
          </Link>
        }
        title="Adjust stock"
      />
      <AdjustForm
        branches={rules}
        defaultBranchId={defaultBranchId}
        initialProduct={initialProduct}
      />
    </>
  );
};

export default NewAdjustmentPage;
