import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  FilterSummary,
  ListFilters,
  ListResults,
  UrlChip,
  UrlSearch,
  UrlTabs,
} from "@/components/lists/list-filters";
import { tabOptions } from "@/components/lists/tab-options";
import { buttonVariants } from "@/components/ui/button";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { namedOptions } from "@/components/ui/select-options";
import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { countLabel, formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { canManageCatalogue } from "@/lib/permissions";
import {
  listCategories,
  listProducts,
  PAGE_SIZE,
} from "@/lib/queries/products";
import type { ProductListRow, StatusFilter } from "@/lib/queries/products";
import { stockStatus } from "@/lib/queries/stock-status";
import { getScope, listBranches, scopeLabel } from "@/lib/scope";
import type { Scope } from "@/lib/scope";
import {
  clearParams,
  enumFilter,
  intParam,
  param,
  queryString,
} from "@/lib/search-params";
import type { EnumFilter, FilterParam } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Products" };

const STATUSES: readonly StatusFilter[] = ["all", "low", "out", "discontinued"];

const STATUS_FILTER: EnumFilter<StatusFilter> = {
  defaultValue: "all",
  param: "status",
  values: STATUSES,
};

/** A category id; the empty default is every category. */
const CATEGORY_FILTER: FilterParam = { defaultValue: "", param: "category" };

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All active",
  discontinued: "Discontinued",
  low: "Running low",
  out: "Out of stock",
};

/** How the summary sentence names a status: "77 running low products". */
const STATUS_TERMS: Record<StatusFilter, string | null> = {
  all: null,
  discontinued: "discontinued",
  low: "running low",
  out: "out-of-stock",
};

/** What "Clear filters" clears: the filters, the search and the page. */
const CLEAR = clearParams([STATUS_FILTER, CATEGORY_FILTER], ["q", "page"]);

const StatusCell = ({
  row,
  scope,
}: {
  readonly row: ProductListRow;
  readonly scope: Scope;
}) => {
  if (!row.active) {
    return <span className="text-ink-3 text-xs">Discontinued</span>;
  }

  if (!row.stocked) {
    return <span className="text-ink-3 text-xs">Not stocked</span>;
  }

  if (scope.kind === "branch") {
    return (
      <StockBadge status={stockStatus(row.onHand, row.reorderPoint ?? 0)} />
    );
  }

  if (row.branchesOut > 0) {
    return <StockBadge label={`Out at ${row.branchesOut}`} status="out" />;
  }

  if (row.branchesLow > 0) {
    return <StockBadge label={`Low at ${row.branchesLow}`} status="low" />;
  }

  return <StockBadge status="ok" />;
};

const ProductsPage = async ({ searchParams }: PageProps<"/products">) => {
  const [viewer, params] = await Promise.all([requireViewer(), searchParams]);

  const [branches, scope, categories] = await Promise.all([
    listBranches(),
    getScope(viewer),
    listCategories(),
  ]);

  const search = param(params, "q").trim();
  const categoryId = intParam(params, CATEGORY_FILTER.param, 0) || null;
  const status = enumFilter(params, STATUS_FILTER);
  const page = intParam(params, "page", 1);

  const { rows, total } = await listProducts(scope, {
    categoryId,
    page,
    search,
    status,
  });

  const departments = Map.groupBy(categories, (item) => item.department);

  const hrefFor = (target: number) =>
    `/products${queryString({ category: categoryId, page: target > 1 ? target : null, q: search, status: status === "all" ? null : status })}`;

  const filtered = search !== "" || categoryId !== null || status !== "all";
  const categoryName = categories.find((item) => item.id === categoryId)?.name;

  return (
    <>
      <PageHeader
        actions={
          canManageCatalogue(viewer) ? (
            <Link
              className={buttonVariants({ size: "md" })}
              href="/products/new"
            >
              <Plus aria-hidden="true" />
              New product
            </Link>
          ) : null
        }
        description={`Stock shown for ${scopeLabel(scope, branches)}. Search by name, SKU or barcode.`}
        title="Products"
      />

      <ListFilters>
        <UrlTabs
          filter={STATUS_FILTER}
          label="Stock status"
          options={tabOptions(
            STATUS_FILTER,
            STATUS_LABELS,
            (value) =>
              `/products${queryString({ category: categoryId, q: search, status: value })}`
          )}
          resets={["page"]}
        />

        <search className="mb-3">
          {/* Without JavaScript, Enter still searches through the form, keeping the other filters. */}
          <form
            action="/products"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="min-w-60 grow sm:max-w-96">
              <UrlSearch
                icon={<Search aria-hidden="true" />}
                label="Search products"
                param="q"
                placeholder="Name, SKU or scan a barcode"
                resets={["page"]}
              />
            </div>
            <UrlChip
              filter={CATEGORY_FILTER}
              label="Category"
              options={[...departments].map(([department, items]) => ({
                label: department,
                options: namedOptions(items),
              }))}
              resets={["page"]}
            />
            {status === "all" ? null : (
              <input name="status" type="hidden" value={status} />
            )}
          </form>
        </search>

        <ListResults announce={countLabel(total, "product")}>
          {rows.length === 0 ? null : (
            <FilterSummary
              adjective={STATUS_TERMS[status]}
              clear={filtered ? CLEAR : undefined}
              count={total}
              noun="product"
              phrases={[
                categoryName === undefined
                  ? null
                  : { lead: "in", term: categoryName },
                search === ""
                  ? null
                  : { lead: "matching", term: `“${search}”` },
              ]}
            />
          )}
          <Panel
            flush
            footer={
              <Pagination
                href={hrefFor}
                noun="products"
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
              />
            }
          >
            {rows.length === 0 ? (
              <ListEmpty
                create={
                  canManageCatalogue(viewer)
                    ? { href: "/products/new", label: "New product" }
                    : undefined
                }
                filtered={filtered}
                firstPageHref={page > 1 && total > 0 ? hrefFor(1) : undefined}
                listHref="/products"
                noMatchHint={
                  search === ""
                    ? "Nothing in that category has that status."
                    : `Nothing found for “${search}”. Check the spelling, or scan the barcode instead.`
                }
                tag="Products"
                title="No products yet"
              >
                Everything the company sells is listed here.
              </ListEmpty>
            ) : (
              <Table>
                <caption className="sr-only">
                  Products, {scopeLabel(scope, branches)}
                </caption>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Barcode</Th>
                    <Th>Category</Th>
                    <Th numeric>Shelf price</Th>
                    <Th numeric>On hand</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="hover:bg-surface-2/60" key={row.id}>
                      <Td className="min-w-64">
                        <Link
                          className="hover:text-brand font-medium hover:underline"
                          href={`/products/${row.id}`}
                        >
                          {row.name}
                        </Link>
                        <span className="text-ink-3 block font-mono text-xs">
                          {row.sku}
                        </span>
                      </Td>
                      <Td nowrap>
                        {row.barcode === null ? (
                          <span className="text-ink-3 text-xs">None</span>
                        ) : (
                          <span className="text-ink-2 font-mono text-xs">
                            {row.barcode}
                          </span>
                        )}
                      </Td>
                      <Td tone="muted" nowrap>
                        {row.categoryName}
                      </Td>
                      <Td numeric>{formatCedis(row.sellPrice)}</Td>
                      <Td numeric weight="medium">
                        {formatCount(row.onHand)}
                        {row.unit === "each" ? null : (
                          <span className="text-ink-3 ml-1 text-xs font-normal">
                            {row.unit}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <StatusCell row={row} scope={scope} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </ListResults>
      </ListFilters>
    </>
  );
};

export default ProductsPage;
