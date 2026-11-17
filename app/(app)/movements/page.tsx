import type { Metadata } from "next";
import Link from "next/link";

import {
  FilterBar,
  ListFilters,
  ListResults,
  UrlSelect,
} from "@/components/lists/list-filters";
import { MovementTable } from "@/components/stock/movement-table";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { labelledOptions } from "@/components/ui/select-options";
import type { MovementKind } from "@/lib/db/schema";
import { countLabel } from "@/lib/format";
import { listMovements } from "@/lib/queries/movements";
import { getProduct } from "@/lib/queries/products";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import { enumFilter, intParam, queryString } from "@/lib/search-params";
import type { EnumFilter } from "@/lib/search-params";
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

const KIND_FILTER: EnumFilter<(typeof KINDS)[number]> = {
  defaultValue: "all",
  param: "kind",
  values: KINDS,
};

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

/**
 * What a screen reader hears once the list updates. There's no total (the
 * list pages by cursor), so it counts what's shown and says if there's more.
 */
const shownLabel = (shown: number, more: boolean): string =>
  more
    ? `${countLabel(shown, "movement")} shown, more older`
    : countLabel(shown, "movement");

/** What to try when the kind or product filter matches nothing. */
const noMatchHint = (byKind: boolean, byProduct: boolean): string => {
  if (byKind && byProduct) {
    return "This product has had no movements of that kind here. Try another kind.";
  }

  if (byProduct) {
    return "This product hasn't moved here yet.";
  }

  return "Nothing of that kind has moved here. Try another kind.";
};

const MovementsPage = async ({ searchParams }: PageProps<"/movements">) => {
  const [viewer, params] = await Promise.all([
    requireBackOffice(),
    searchParams,
  ]);

  const kind = enumFilter(params, KIND_FILTER);
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

      <ListFilters>
        <FilterBar>
          <UrlSelect
            filter={KIND_FILTER}
            label="Show"
            options={labelledOptions(KINDS, KIND_LABELS)}
            resets={["before"]}
            visibleLabel
          />
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
        </FilterBar>

        <ListResults announce={shownLabel(page.length, older !== undefined)}>
          <Panel flush>
            {page.length === 0 ? (
              <ListEmpty
                filtered={filters.kind !== null || productId !== undefined}
                firstPageHref={
                  before === undefined
                    ? undefined
                    : `/movements${queryString(filters)}`
                }
                listHref="/movements"
                noMatchHint={noMatchHint(
                  filters.kind !== null,
                  productId !== undefined
                )}
                tag="Movements"
                title="No stock has moved yet"
              >
                Every receipt, sale, transfer and adjustment shows here.
              </ListEmpty>
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
        </ListResults>
      </ListFilters>
    </>
  );
};

export default MovementsPage;
