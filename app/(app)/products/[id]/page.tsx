import { CircleCheck, ClipboardList, PackagePlus, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { StockSettingsForm } from "@/components/catalogue/stock-settings-form";
import { MovementTable } from "@/components/stock/movement-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import {
  canManageCatalogue,
  canSetReorderPoint,
  operableBranchIds,
} from "@/lib/permissions";
import { listMovements } from "@/lib/queries/movements";
import { getProduct, getProductLevels } from "@/lib/queries/products";
import { stockStatus } from "@/lib/queries/stock-status";
import { getScope, listBranches } from "@/lib/scope";
import { param, queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

const HISTORY = 25;

const productId = (raw: string): number | null => {
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/products/[id]">): Promise<Metadata> => {
  const route = await params;
  const id = productId(route.id);
  const item = id === null ? null : await getProduct(id);

  return { title: item?.name ?? "Product" };
};

const Fact = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div>
    <dt className="text-ink-2 text-xs">{label}</dt>
    <dd className="tabular mt-0.5 font-medium">{children}</dd>
  </div>
);

const NOTICES = {
  adjusted: "Adjustment saved. The new balance is below.",
  saved: "Product saved.",
} as const;

/** The confirmation to show after a redirect here, if any. */
const noticeFor = (
  query: Record<string, string | string[] | undefined>
): string | null => {
  if (param(query, "adjusted") === "1") {
    return NOTICES.adjusted;
  }

  return param(query, "saved") === "1" ? NOTICES.saved : null;
};

const ProductPage = async ({
  params,
  searchParams,
}: PageProps<"/products/[id]">) => {
  const [viewer, route, query] = await Promise.all([
    requireViewer(),
    params,
    searchParams,
  ]);

  const id = productId(route.id);
  const item = id === null ? null : await getProduct(id);

  if (!item) {
    notFound();
  }

  const [levels, scope, branches] = await Promise.all([
    getProductLevels(item.id),
    getScope(viewer),
    listBranches(),
  ]);

  const historyBranch = scope.kind === "branch" ? scope.branchId : undefined;

  const history = await listMovements(
    { branchId: historyBranch, productId: item.id },
    HISTORY
  );

  const totalOnHand = levels.reduce((sum, level) => sum + level.onHand, 0);

  const margin =
    item.sellPrice > 0
      ? (item.sellPrice - item.averageCost) / item.sellPrice
      : 0;

  const ownBranches = operableBranchIds(
    viewer,
    branches.map((branch) => branch.id)
  );

  const actionBranch =
    scope.kind === "branch" && ownBranches.includes(scope.branchId)
      ? scope.branchId
      : ownBranches[0];

  // Reorder point and shelf: for the branch on screen, or your own.
  const settingsBranchId = [historyBranch, viewer.branchId ?? undefined].find(
    (candidate) =>
      candidate !== undefined && canSetReorderPoint(viewer, candidate)
  );

  const settingsLevel = levels.find(
    (level) => level.branchId === settingsBranchId
  );

  const notice = noticeFor(query);

  return (
    <>
      {notice === null ? null : (
        <output className="bg-brand-soft text-good mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
          <CircleCheck aria-hidden="true" className="size-4" />
          {notice}
        </output>
      )}
      <PageHeader
        actions={
          <>
            {item.active && actionBranch ? (
              <>
                <Link
                  className={buttonVariants({ size: "md", variant: "outline" })}
                  href={`/receipts/new${queryString({ branch: actionBranch, product: item.id })}`}
                >
                  <PackagePlus aria-hidden="true" />
                  Receive
                </Link>
                <Link
                  className={buttonVariants({ size: "md", variant: "outline" })}
                  href={`/adjustments/new${queryString({ branch: actionBranch, product: item.id })}`}
                >
                  <ClipboardList aria-hidden="true" />
                  Adjust
                </Link>
              </>
            ) : null}
            {canManageCatalogue(viewer) ? (
              <Link
                className={buttonVariants({ size: "md", variant: "outline" })}
                href={`/products/${item.id}/edit`}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            ) : null}
          </>
        }
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/products">
            Products
          </Link>
        }
        title={
          <>
            {item.name}
            {item.active ? null : (
              <span className="bg-surface-2 text-ink-2 ml-3 rounded-full px-2 py-0.5 align-middle text-xs font-medium">
                Discontinued
              </span>
            )}
          </>
        }
      />

      <Panel className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="SKU">
            <span className="font-mono text-sm">{item.sku}</span>
          </Fact>
          <Fact label="Barcode">
            <span className="font-mono text-sm">{item.barcode ?? "None"}</span>
          </Fact>
          <Fact label="Category">
            {item.categoryName}
            <span className="text-ink-2 block text-xs font-normal">
              {item.department}
            </span>
          </Fact>
          <Fact label="Shelf price">{formatCedis(item.sellPrice)}</Fact>
          <Fact label="Average cost">
            {formatCedis(item.averageCost)}
            <span className="text-ink-2 block text-xs font-normal">
              {Math.round(margin * 100)}% margin
            </span>
          </Fact>
          <Fact label="Supplier">{item.supplierName ?? "Not set"}</Fact>
        </dl>
      </Panel>

      <div className="grid gap-6">
        <Panel
          action={
            <span className="text-ink-2 tabular text-sm">
              {formatCount(totalOnHand)}{" "}
              {item.unit === "each" ? "units" : item.unit} in total
            </span>
          }
          flush
          id="levels"
          title="Stock by branch"
        >
          <Table>
            <caption className="sr-only">
              Stock of {item.name} at each branch
            </caption>
            <thead>
              <tr>
                <Th>Branch</Th>
                <Th>Location</Th>
                <Th numeric>On hand</Th>
                <Th numeric>Reorder at</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const reorderPoint = level.reorderOverride ?? item.reorderPoint;

                return (
                  <tr
                    className={
                      level.branchId === historyBranch
                        ? "bg-brand-soft/40"
                        : undefined
                    }
                    key={level.branchId}
                  >
                    <Td nowrap>
                      <span className="font-medium">{level.branchName}</span>
                      {level.branchKind === "warehouse" ? (
                        <span className="text-ink-3 block text-xs">
                          Warehouse
                        </span>
                      ) : null}
                    </Td>
                    <Td tone="muted">
                      <span className="font-mono text-xs">
                        {level.binLocation ?? "—"}
                      </span>
                    </Td>
                    <Td numeric weight="medium">
                      {formatCount(level.onHand)}
                    </Td>
                    <Td numeric tone="muted">
                      {formatCount(reorderPoint)}
                      {level.reorderOverride === null ? null : (
                        <span className="sr-only"> (set for this branch)</span>
                      )}
                    </Td>
                    <Td>
                      {level.stocked ? (
                        <StockBadge
                          status={stockStatus(level.onHand, reorderPoint)}
                        />
                      ) : (
                        <span className="text-ink-3 text-xs">Not stocked</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>

        {settingsLevel ? (
          <Panel
            id="settings"
            title={`Settings at ${settingsLevel.branchName}`}
          >
            <StockSettingsForm
              binLocation={settingsLevel.binLocation}
              branchId={settingsLevel.branchId}
              branchName={settingsLevel.branchName}
              defaultReorderPoint={item.reorderPoint}
              productId={item.id}
              reorderOverride={settingsLevel.reorderOverride}
            />
          </Panel>
        ) : null}

        <Panel
          action={
            <Link
              className="text-brand text-sm font-medium hover:underline"
              href={`/movements${queryString({ product: item.id })}`}
            >
              All movements
            </Link>
          }
          flush
          id="history"
          title={
            historyBranch === undefined ? "History" : "History at this branch"
          }
        >
          {history.length === 0 ? (
            <p className="text-ink-2 p-4 text-sm">No stock has moved yet.</p>
          ) : (
            <MovementTable
              caption={`Stock movements for ${item.name}`}
              rows={history}
              showBranch={historyBranch === undefined}
              showProduct={false}
            />
          )}
        </Panel>
      </div>
    </>
  );
};

export default ProductPage;
