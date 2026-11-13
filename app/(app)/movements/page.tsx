import type { Metadata } from "next";
import Link from "next/link";

import { MovementTable } from "@/components/stock/movement-table";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { labelledOptions } from "@/components/ui/select-options";
import type { MovementKind } from "@/lib/db/schema";
import { listMovements } from "@/lib/queries/movements";
import { getProduct } from "@/lib/queries/products";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { enumParam, intParam, queryString } from "@/lib/search-params";
import { requireBackOffice } from "@/lib/session";

export const metadata: Metadata = { title: "Movements" };

const PAGE = 50;

const KINDS = [
  "all",
  "sale",
  "sale_return",
  "receipt",
  "adjustment",
  "transfer_out",
  "transfer_in",
  "opening",
] as const;

const KIND_LABELS: Record<(typeof KINDS)[number], string> = {
  adjustment: "Adjustments",
  all: "Everything",
  opening: "Opening balances",
  receipt: "Deliveries",
  sale: "Sales",
  sale_return: "Customer returns",
  transfer_in: "Transfers in",
  transfer_out: "Transfers out",
};

const MovementsPage = async ({ searchParams }: PageProps<"/movements">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const kind = enumParam(params, "kind", KINDS, "all");
  const productId = intParam(params, "product", 0) || undefined;
  const before = intParam(params, "before", 0) || undefined;

  const [branches, scope, item] = await Promise.all([
    listBranches(),
    getScope(viewer),
    productId === undefined ? Promise.resolve(null) : getProduct(productId),
  ]);

  const branchId = scope.kind === "branch" ? scope.branchId : undefined;

  const rows = await listMovements(
    {
      beforeId: before,
      branchId,
      kind: kind === "all" ? undefined : (kind satisfies MovementKind),
      productId,
    },
    PAGE + 1
  );

  const page = rows.slice(0, PAGE);
  const older = rows.length > PAGE ? page.at(-1)?.id : undefined;
  const filters = { kind: kind === "all" ? null : kind, product: productId };

  return (
    <>
      <PageHeader
        description={`Every change to stock, newest first. Nothing here can be edited or deleted: mistakes are corrected with a new adjustment. · ${scopeLabel(scope, branches)}`}
        title="Movements"
      />

      <form
        action="/movements"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {productId === undefined ? null : (
          <input name="product" type="hidden" value={productId} />
        )}
        <Field layout="inline">
          <FieldLabel tone="quiet">Show</FieldLabel>
          <Select
            className="w-auto"
            defaultValue={kind}
            name="kind"
            options={labelledOptions(KINDS, KIND_LABELS)}
          />
        </Field>
        <button
          className={buttonVariants({ size: "md", variant: "outline" })}
          type="submit"
        >
          Apply
        </button>
        {item ? (
          <p className="bg-surface-2 ml-1 flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm">
            {item.name}
            <Link
              aria-label={`Stop filtering by ${item.name}`}
              className="hover:bg-line rounded-full px-2 py-0.5"
              href={`/movements${queryString({ kind: filters.kind })}`}
            >
              ×
            </Link>
          </p>
        ) : null}
      </form>

      <Panel flush>
        {page.length === 0 ? (
          <p className="text-ink-2 p-8 text-center text-sm">
            No movements match.
          </p>
        ) : (
          <MovementTable
            caption="Stock movements"
            rows={page}
            showBranch={branchId === undefined}
            showProduct={productId === undefined}
          />
        )}
        {before !== undefined || older !== undefined ? (
          <div className="border-line flex justify-between gap-3 border-t px-4 py-3 text-sm">
            {before === undefined ? (
              <span />
            ) : (
              <Link
                className="text-brand hover:underline"
                href={`/movements${queryString(filters)}`}
              >
                Newest
              </Link>
            )}
            {older === undefined ? null : (
              <Link
                className="text-brand hover:underline"
                href={`/movements${queryString({ ...filters, before: older })}`}
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

export default MovementsPage;
