import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
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

  const search = param(params, "q");
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

      <search className="mb-4">
        <form
          action="/products"
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto]"
        >
          <label className="relative">
            <span className="sr-only">Search products</span>
            <Search
              aria-hidden="true"
              className="text-ink-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              className="field pl-9"
              defaultValue={search}
              enterKeyHint="search"
              name="q"
              placeholder="Name, SKU or scan a barcode"
              type="search"
            />
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select
              className="field"
              defaultValue={categoryId ?? ""}
              name="category"
            >
              <option value="">All categories</option>
              {[...departments].map(([department, items]) => (
                <optgroup key={department} label={department}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Stock status</span>
            <select className="field" defaultValue={status} name="status">
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <button
            className={buttonVariants({ size: "md", variant: "outline" })}
            type="submit"
          >
            Filter
          </button>
        </form>
      </search>

      <Panel flush>
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">No products match.</p>
            <p className="text-ink-2 mt-1 text-sm">
              {search ? `Nothing found for “${search}”. ` : ""}
              <Link className="text-brand hover:underline" href="/products">
                Clear the filters
              </Link>
            </p>
          </div>
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
        <div className="border-line border-t">
          <Pagination
            href={hrefFor}
            noun="products"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
          />
        </div>
      </Panel>
    </>
  );
};

export default ProductsPage;
