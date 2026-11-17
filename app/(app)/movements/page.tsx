import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  FilterBar,
  FilterSummary,
  ListFilters,
  ListResults,
  Term,
  UrlTabs,
} from "@/components/lists/list-filters";
import { tabOptions } from "@/components/lists/tab-options";
import { MovementTable } from "@/components/stock/movement-table";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { MovementKind } from "@/lib/db/schema";
import { countLabel, formatCount } from "@/lib/format";
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

/** How the summary sentence names what's shown: one, and more than one. */
const KIND_NOUNS: Record<(typeof KINDS)[number], readonly [string, string]> = {
  adjustment: ["adjustment", "adjustments"],
  all: ["movement", "movements"],
  opening: ["opening balance", "opening balances"],
  receipt: ["delivery", "deliveries"],
  sale: ["sale", "sales"],
  sale_return: ["customer return", "customer returns"],
  transfer_in: ["transfer in", "transfers in"],
  transfer_out: ["transfer out", "transfers out"],
};

/** Every filter param, and the cursor: what "Clear filters" clears. */
const FILTER_PARAMS = ["kind", "product", "before"] as const;

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

/** "Latest 50 sales of Jasmine rice 5 kg", above the list. */
const MovementsSummary = ({
  shown,
  kind,
  productName,
  latest,
  filtered,
}: {
  readonly shown: number;
  readonly kind: (typeof KINDS)[number];
  readonly productName: string | undefined;
  /** The first page, with older movements after it. */
  readonly latest: boolean;
  readonly filtered: boolean;
}) => {
  const [one, many] = KIND_NOUNS[kind];
  const noun = shown === 1 ? one : many;

  return (
    <FilterSummary clear={filtered ? FILTER_PARAMS : undefined}>
      {latest ? "Latest " : ""}
      {formatCount(shown)} {kind === "all" ? noun : <Term>{noun}</Term>}
      {productName === undefined ? null : (
        <>
          {" "}
          of <Term>{productName}</Term>
        </>
      )}
    </FilterSummary>
  );
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
  const filtered = filters.kind !== null || productId !== undefined;

  return (
    <>
      <PageHeader
        description={`Every change to stock, newest first. Nothing here can be edited or deleted: mistakes are corrected with a new adjustment. · ${scopeLabel(scope, branches)}`}
        title="Movements"
      />

      <ListFilters>
        <UrlTabs
          filter={KIND_FILTER}
          label="Kind of movement"
          options={tabOptions(
            KINDS,
            KIND_LABELS,
            (value) =>
              `/movements${queryString({ kind: value === "all" ? null : value, product: productId })}`
          )}
          resets={["before"]}
        />

        {item ? (
          <FilterBar>
            <p className="bg-brand-soft text-brand flex h-9 items-center gap-1 rounded-full ps-3.5 pe-1.5 text-sm font-medium">
              <span className="text-brand/75 font-normal">Product:</span>
              {item.name}
              <Link
                aria-label={`Stop filtering by ${item.name}`}
                className="hover:bg-brand/15 grid size-6 place-items-center rounded-full"
                href={`/movements${queryString({ kind: filters.kind })}`}
              >
                <X aria-hidden="true" className="size-3.5" />
              </Link>
            </p>
          </FilterBar>
        ) : null}

        <ListResults announce={shownLabel(page.length, older !== undefined)}>
          {page.length === 0 ? null : (
            <MovementsSummary
              filtered={filtered}
              kind={kind}
              latest={before === undefined && older !== undefined}
              productName={item?.name}
              shown={page.length}
            />
          )}
          <Panel flush>
            {page.length === 0 ? (
              <ListEmpty
                filtered={filtered}
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
