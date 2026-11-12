import type { Metadata } from "next";
import Link from "next/link";

import { getPickedProduct } from "@/app/(app)/lookup-action";
import { TransferForm } from "@/components/stock/transfer-form";
import type { TransferDraftLine } from "@/components/stock/transfer-line-row";
import { PageHeader } from "@/components/ui/page-header";
import { noStockBranchMessage } from "@/lib/access-messages";
import { operableBranchIds } from "@/lib/permissions";
import { getScope, listBranches } from "@/lib/scope";
import { lineParam, param } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";
import { MAX_TRANSFER_LINES } from "@/lib/stock/transfer";

export const metadata: Metadata = { title: "New transfer" };

const loadLines = async (text: string): Promise<TransferDraftLine[]> => {
  const wanted = lineParam(text, MAX_TRANSFER_LINES);

  const products = await Promise.all(
    wanted.map(async ({ id }) => await getPickedProduct(id))
  );

  const lines: TransferDraftLine[] = [];
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

const NewTransferPage = async ({
  searchParams,
}: PageProps<"/transfers/new">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);

  const [branches, scope, initialLines] = await Promise.all([
    listBranches(),
    getScope(viewer),
    loadLines(param(params, "lines")),
  ]);

  const allowed = new Set(
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    )
  );

  const sources = branches.filter((item) => allowed.has(item.id));

  if (sources.length === 0) {
    return (
      <PageHeader
        description={noStockBranchMessage(viewer.role)}
        title="New transfer"
      />
    );
  }

  const scoped = scope.kind === "branch" ? scope.branchId : "";

  const defaultFromId =
    [param(params, "from"), scoped, viewer.branchId ?? ""].find((id) =>
      allowed.has(id)
    ) ??
    sources[0]?.id ??
    "";

  const requestedTo = param(params, "to");

  const defaultToId =
    requestedTo !== defaultFromId &&
    branches.some((item) => item.id === requestedTo)
      ? requestedTo
      : "";

  return (
    <>
      <PageHeader
        description="Send stock to another branch. It leaves this branch when you save, and arrives when the other branch counts it in."
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/transfers">
            Transfers
          </Link>
        }
        title="New transfer"
      />
      <TransferForm
        defaultFromId={defaultFromId}
        defaultToId={defaultToId}
        destinations={branches.map(({ id, name }) => ({ id, name }))}
        initialLines={initialLines}
        sources={sources.map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
};

export default NewTransferPage;
