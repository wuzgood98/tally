import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  ListFilters,
  ListResults,
  UrlSearch,
  UrlSelect,
} from "@/components/lists/list-filters";
import { buttonVariants } from "@/components/ui/button";
import { ListEmpty } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { namedOptions, labelledOptions } from "@/components/ui/select-options";
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
import { enumParam, intParam, param, queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Products" };

const STATUSES: readonly StatusFilter[] = ["all", "low", "out", "discontinued"];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All active",
  discontinued: "Discontinued",
  low: "Running low",
  out: "Out of stock",
};

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
  const categoryId = intParam(params, "category", 0) || null;
  const status = enumParam(params, "status", STATUSES, "all");
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
        <search className="mb-4">
          {/* Without JavaScript, Enter still searches through the form. */}
          <form
            action="/products"
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]"
          >
            <UrlSearch
              icon={<Search aria-hidden="true" />}
              label="Search products"
              param="q"
              placeholder="Name, SKU or scan a barcode"
              resets={["page"]}
            />
            <UrlSelect
              defaultValue=""
              label="Category"
              options={[
                { label: "All categories", value: "" },
                ...[...departments].map(([department, items]) => ({
                  label: department,
                  options: namedOptions(items),
                })),
              ]}
              param="category"
              resets={["page"]}
            />
            <UrlSelect
              defaultValue="all"
              label="Stock status"
              options={labelledOptions(STATUSES, STATUS_LABELS)}
              param="status"
              resets={["page"]}
            />
          </form>
        </search>

        <ListResults announce={countLabel(total, "product")}>
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
                filtered={
                  search !== "" || categoryId !== null || status !== "all"
                }
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
