import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ReorderTable } from "@/components/stock/reorder-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { formatCount } from "@/lib/format";
import { canDispatchTransfer } from "@/lib/permissions";
import { getReorderLines } from "@/lib/queries/overview";
import type { ReorderLine } from "@/lib/queries/overview";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import type { BranchSummary, Scope } from "@/lib/scope";
import { queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";
import type { Viewer } from "@/lib/session";
import { topUpLinesParam } from "@/lib/stock/top-up";

export const metadata: Metadata = { title: "Low stock" };

/** Enough for every line at a large store; the list is grouped, not paged. */
const LIMIT = 2000;

/**
 * A pre-filled transfer from the warehouse to the store on screen, for people
 * who can send from the warehouse. Null when that doesn't apply.
 */
const warehouseTopUpHref = (
  viewer: Viewer,
  scope: Scope,
  branches: readonly BranchSummary[],
  lines: readonly ReorderLine[]
): string | null => {
  const warehouse = branches.find((item) => item.kind === "warehouse");

  const store = branches.find(
    (item) => scope.kind === "branch" && item.id === scope.branchId
  );

  if (
    warehouse === undefined ||
    store?.kind !== "store" ||
    !canDispatchTransfer(viewer, warehouse.id)
  ) {
    return null;
  }

  const prefill = topUpLinesParam(lines);

  return prefill === ""
    ? null
    : `/transfers/new${queryString({ from: warehouse.id, lines: prefill, to: store.id })}`;
};

const LowStockPage = async () => {
  const viewer = await requireViewer();

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const lines = await getReorderLines(scope, LIMIT);

  // Grouped by supplier: that's how the reorder gets placed.
  const bySupplier = [
    ...Map.groupBy(
      lines,
      (line: ReorderLine) => line.supplierName ?? "No supplier set"
    ),
  ].toSorted(([, a], [, b]) => b.length - a.length);

  let out = 0;
  let needCount = 0;

  for (const line of lines) {
    if (line.onHand === 0) {
      out += 1;
    }

    // Tills sold more than the record held: someone needs to count the shelf.
    if (line.onHand < 0) {
      needCount += 1;
    }
  }

  const countNote =
    needCount > 0
      ? `, ${formatCount(needCount)} ${needCount === 1 ? "needs" : "need"} a count`
      : "";

  const topUpHref = warehouseTopUpHref(viewer, scope, branches, lines);

  return (
    <>
      <PageHeader
        actions={
          topUpHref === null ? undefined : (
            <Link className={buttonVariants({ size: "md" })} href={topUpHref}>
              <Truck aria-hidden="true" />
              Transfer from warehouse
            </Link>
          )
        }
        description={`${formatCount(lines.length)} lines at or below their reorder point, ${formatCount(out)} of them empty${countNote}, grouped by supplier · ${scopeLabel(scope, branches)}`}
        title="Low stock"
      />
      {lines.length === 0 ? (
        <Panel>
          <p className="text-ink-2 text-center text-sm">
            Every line is above its reorder point.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-6">
          {bySupplier.map(([supplierName, supplierLines]) => (
            <Panel
              action={
                <span className="text-ink-2 tabular text-sm">
                  {formatCount(supplierLines.length)}{" "}
                  {supplierLines.length === 1 ? "line" : "lines"}
                </span>
              }
              flush
              id={`supplier-${supplierName.replaceAll(/\W+/gu, "-").toLowerCase()}`}
              key={supplierName}
              title={supplierName}
            >
              <ReorderTable
                lines={supplierLines}
                showBranch={scope.kind === "all"}
              />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
};

export default LowStockPage;
