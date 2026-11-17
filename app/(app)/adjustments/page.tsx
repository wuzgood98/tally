import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MovementTable } from "@/components/stock/movement-table";
import { buttonVariants } from "@/components/ui/button";
import { EmptyLabel } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { operableBranchIds } from "@/lib/permissions";
import { listMovements } from "@/lib/queries/movements";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { intParam, queryString } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";

export const metadata: Metadata = { title: "Adjustments" };

const PAGE = 50;

const AdjustmentsPage = async ({ searchParams }: PageProps<"/adjustments">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const before = intParam(params, "before", 0) || undefined;

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  const branchId = scope.kind === "branch" ? scope.branchId : undefined;

  // One extra row tells us whether there's an older page.
  const rows = await listMovements(
    { beforeId: before, branchId, kind: "adjustment" },
    PAGE + 1
  );

  const page = rows.slice(0, PAGE);
  const older = rows.length > PAGE ? page.at(-1)?.id : undefined;

  const canAdjustSomewhere =
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    ).length > 0;

  return (
    <>
      <PageHeader
        actions={
          canAdjustSomewhere ? (
            <Link
              className={buttonVariants({ size: "md" })}
              href="/adjustments/new"
            >
              <ClipboardList aria-hidden="true" />
              Adjust stock
            </Link>
          ) : null
        }
        description={`Write-offs, finds and stock counts, newest first · ${scopeLabel(scope, branches)}`}
        title="Adjustments"
      />
      <Panel flush>
        {page.length === 0 ? (
          <EmptyLabel
            action={
              canAdjustSomewhere
                ? { href: "/adjustments/new", label: "Adjust stock" }
                : undefined
            }
            tag="Adjustments"
            title="No adjustments yet"
          >
            Write-offs, finds and stock counts show here, newest first.
          </EmptyLabel>
        ) : (
          <MovementTable
            caption="Stock adjustments"
            rows={page}
            showBranch={branchId === undefined}
          />
        )}
        {before !== undefined || older !== undefined ? (
          <div className="border-line flex justify-between gap-3 border-t px-4 py-3 text-sm">
            {before === undefined ? (
              <span />
            ) : (
              <Link className="text-brand hover:underline" href="/adjustments">
                Newest
              </Link>
            )}
            {older === undefined ? null : (
              <Link
                className="text-brand hover:underline"
                href={`/adjustments${queryString({ before: older })}`}
              >
                Older
              </Link>
            )}
          </div>
        ) : null}
      </Panel>
    </>
  );
};

export default AdjustmentsPage;
