import type { Metadata } from "next";

import { ReorderTable } from "@/components/stock/reorder-table";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { formatCount } from "@/lib/format";
import { getReorderLines } from "@/lib/queries/overview";
import type { ReorderLine } from "@/lib/queries/overview";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Low stock" };

/** Enough for every line at a large store; the list is grouped, not paged. */
const LIMIT = 2000;

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

  const out = lines.filter((line) => line.onHand === 0).length;

  return (
    <>
      <PageHeader
        description={`${formatCount(lines.length)} lines at or below their reorder point, ${formatCount(out)} of them empty, grouped by supplier · ${scopeLabel(scope, branches)}`}
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
