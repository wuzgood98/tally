import { ClipboardList, PackagePlus, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { StockSettingsForm } from "@/components/catalogue/stock-settings-form";
import { BranchStockTable } from "@/components/stock/branch-stock-table";
import { MovementTable } from "@/components/stock/movement-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import {
  canManageCatalogue,
  canBrowseBackOffice,
  canSetReorderPoint,
  operableBranchIds,
} from "@/lib/permissions";
import { listMovements } from "@/lib/queries/movements";
import { getProduct, getProductLevels } from "@/lib/queries/products";
import { getProductOnOrder } from "@/lib/queries/purchase-orders";
import { getProductRequested } from "@/lib/queries/requests";
import { getProductUnitsSold } from "@/lib/queries/sales";
import { getProductInTransit } from "@/lib/queries/transfers";
import { getScope, listBranches } from "@/lib/scope";
import { queryString } from "@/lib/search-params";
import { requireViewer } from "@/lib/session";

const HISTORY = 25;
const SALES_DAYS = 30;

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

const CostFacts = ({
  averageCost,
  sellPrice,
  supplierName,
}: {
  readonly averageCost: number;
  readonly sellPrice: number;
  readonly supplierName: string | null;
}) => {
  const margin = sellPrice > 0 ? (sellPrice - averageCost) / sellPrice : 0;

  return (
    <>
      <Fact label="Average cost">
        {formatCedis(averageCost)}
        <span className="text-ink-2 block text-xs font-normal">
          {Math.round(margin * 100)}% margin
        </span>
      </Fact>
      <Fact label="Supplier">{supplierName ?? "Not set"}</Fact>
    </>
  );
};

/** The latest movements: at the branch on screen, or everywhere. */
const HistoryPanel = async ({
  productId: id,
  productName,
  branchId,
}: {
  readonly productId: number;
  readonly productName: string;
  readonly branchId: string | undefined;
}) => {
  const history = await listMovements({ branchId, productId: id }, HISTORY);

  return (
    <Panel
      action={
        <Link
          className="text-brand text-sm font-medium hover:underline"
          href={`/movements${queryString({ product: id })}`}
        >
          All movements
        </Link>
      }
      flush
      id="history"
      title={branchId === undefined ? "History" : "History at this branch"}
    >
      {history.length === 0 ? (
        <p className="text-ink-2 p-4 text-sm">No stock has moved yet.</p>
      ) : (
        <MovementTable
          caption={`Stock movements for ${productName}`}
          rows={history}
          showBranch={branchId === undefined}
          showProduct={false}
        />
      )}
    </Panel>
  );
};

const sumOf = (byBranch: ReadonlyMap<string, number>): number => {
  let total = 0;

  for (const units of byBranch.values()) {
    total += units;
  }

  return total;
};

/** "1,240 units in total · 30 on the way · 120 on order" */
const LevelsSummary = ({
  onHand,
  unit,
  inTransit,
  onOrder,
}: {
  readonly onHand: number;
  readonly unit: string;
  readonly inTransit: ReadonlyMap<string, number>;
  readonly onOrder: ReadonlyMap<string, number>;
}) => {
  const parts = [
    `${formatCount(onHand)} ${unit === "each" ? "units" : unit} in total`,
  ];

  const travelling = sumOf(inTransit);
  const ordered = sumOf(onOrder);

  if (travelling > 0) {
    parts.push(`${formatCount(travelling)} on the way`);
  }

  if (ordered > 0) {
    parts.push(`${formatCount(ordered)} on order`);
  }

  return (
    <span className="text-ink-2 tabular text-sm">{parts.join(" · ")}</span>
  );
};

const ProductPage = async ({ params }: PageProps<"/products/[id]">) => {
  const [viewer, route] = await Promise.all([requireViewer(), params]);

  const id = productId(route.id);
  const item = id === null ? null : await getProduct(id);

  if (!item) {
    notFound();
  }

  const [levels, inTransit, onOrder, requested, sold, scope, branches] =
    await Promise.all([
      getProductLevels(item.id),
      getProductInTransit(item.id),
      getProductOnOrder(item.id),
      getProductRequested(item.id),
      getProductUnitsSold(item.id, SALES_DAYS),
      getScope(viewer),
      listBranches(),
    ]);

  const historyBranch = scope.kind === "branch" ? scope.branchId : undefined;

  // A cashier sees where it is and the shelf price: no cost, supplier,
  // reorder figures or history.
  const backOffice = canBrowseBackOffice(viewer);

  const totalOnHand = levels.reduce((sum, level) => sum + level.onHand, 0);

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

  return (
    <>
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
          {backOffice ? (
            <CostFacts
              averageCost={item.averageCost}
              sellPrice={item.sellPrice}
              supplierName={item.supplierName}
            />
          ) : null}
        </dl>
      </Panel>

      <div className="grid gap-6">
        <Panel
          action={
            backOffice ? (
              <LevelsSummary
                inTransit={inTransit}
                onHand={totalOnHand}
                onOrder={onOrder}
                unit={item.unit}
              />
            ) : null
          }
          flush
          id="levels"
          title="Stock by branch"
        >
          <BranchStockTable
            brief={!backOffice}
            highlightBranchId={historyBranch}
            inTransit={inTransit}
            levels={levels}
            onOrder={onOrder}
            productName={item.name}
            requested={requested}
            reorderPoint={item.reorderPoint}
            salesDays={SALES_DAYS}
            sold={sold}
          />
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

        {backOffice ? (
          <HistoryPanel
            branchId={historyBranch}
            productId={item.id}
            productName={item.name}
          />
        ) : null}
      </div>
    </>
  );
};

export default ProductPage;
