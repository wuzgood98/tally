/**
 * What Ask Tally reads, as a port. The server binds it to the real queries
 * (`lib/ask/data-server.ts`); tests bind it to fakes that record the scope
 * each call was made with, which is how they catch a leak between branches.
 *
 * Every function here trusts its caller about scope, as the queries do. The
 * tools (`lib/ask/tools.ts`) are the only callers, and they work out the
 * scope from the session.
 */

import type { AskScope } from "@/lib/ask/context";
import type {
  PurchaseOrderStatus,
  StockRequestStatus,
  TransferStatus,
  Unit,
} from "@/lib/db/schema";
import type { ReorderLine } from "@/lib/queries/overview";
import type { ReportPeriod } from "@/lib/reports/period";
import type { SellerRow } from "@/lib/reports/sellers";
import type { ShrinkageReport } from "@/lib/reports/shrinkage";
import type { StockValueDay } from "@/lib/reports/stock-value";
import type { TransferDirection } from "@/lib/transfer-direction";

export interface ProductMatch {
  readonly id: number;
  readonly name: string;
  readonly sku: string;
  readonly active: boolean;
}

export interface ProductInfo {
  readonly id: number;
  readonly name: string;
  readonly sku: string;
  readonly unit: Unit;
  /** Shelf price including VAT, in pesewas. */
  readonly sellPrice: number;
  readonly active: boolean;
  readonly categoryName: string;
  readonly supplierName: string | null;
}

export interface ProductLevel {
  readonly branchId: string;
  readonly onHand: number;
  readonly binLocation: string | null;
  readonly stocked: boolean;
}

/** Units by branch id. */
export type UnitsByBranch = ReadonlyMap<string, number>;

export interface StockTotals {
  readonly costValue: number;
  readonly retailValue: number;
  readonly units: number;
  readonly linesInStock: number;
  readonly lowLines: number;
  readonly outLines: number;
}

export interface SalesTotals {
  readonly count: number;
  readonly total: number;
}

export interface BestSellerRow {
  readonly productId: number;
  readonly name: string;
  readonly sku: string;
  readonly units: number;
  readonly revenue: number;
}

export interface Page<Row> {
  readonly rows: readonly Row[];
  readonly total: number;
}

export interface TransferRow {
  readonly id: number;
  readonly number: string;
  readonly status: TransferStatus;
  readonly fromName: string;
  readonly toName: string;
  readonly unitsSent: number;
  readonly totalCost: number;
  readonly createdAt: Date;
}

export interface PurchaseOrderRow {
  readonly id: number;
  readonly number: string;
  readonly status: PurchaseOrderStatus;
  readonly branchName: string;
  readonly supplierName: string;
  readonly ordered: number;
  readonly received: number;
  readonly totalCost: number;
  readonly expectedAt: Date | null;
  readonly createdAt: Date;
}

export interface StockRequestRow {
  readonly id: number;
  readonly number: string;
  readonly status: StockRequestStatus;
  readonly storeName: string;
  readonly units: number;
  readonly createdAt: Date;
}

export interface ReceiptRow {
  readonly id: number;
  readonly number: string;
  readonly branchName: string;
  readonly supplierName: string;
  readonly totalCost: number;
  readonly createdAt: Date;
}

export interface AskData {
  readonly searchProducts: (
    scope: AskScope,
    text: string
  ) => Promise<readonly ProductMatch[]>;
  readonly product: (id: number) => Promise<ProductInfo | null>;
  readonly productLevels: (id: number) => Promise<readonly ProductLevel[]>;
  readonly productInTransit: (id: number) => Promise<UnitsByBranch>;
  readonly productOnOrder: (id: number) => Promise<UnitsByBranch>;
  readonly productRequested: (id: number) => Promise<UnitsByBranch>;
  readonly productUnitsSold: (
    id: number,
    days: number
  ) => Promise<UnitsByBranch>;
  readonly reorderLines: (scope: AskScope) => Promise<readonly ReorderLine[]>;
  readonly stockTotals: (scope: AskScope) => Promise<StockTotals>;
  readonly todaySales: (scope: AskScope) => Promise<SalesTotals>;
  readonly bestSellers: (
    scope: AskScope,
    days: number,
    limit: number
  ) => Promise<readonly BestSellerRow[]>;
  readonly transfers: (
    scope: AskScope,
    status: TransferStatus | null,
    direction: TransferDirection
  ) => Promise<Page<TransferRow>>;
  readonly purchaseOrders: (
    scope: AskScope,
    status: PurchaseOrderStatus | null
  ) => Promise<Page<PurchaseOrderRow>>;
  readonly stockRequests: (
    scope: AskScope,
    status: StockRequestStatus | null
  ) => Promise<Page<StockRequestRow>>;
  readonly receipts: (scope: AskScope) => Promise<Page<ReceiptRow>>;
  readonly sellers: (
    branchIds: readonly string[],
    period: ReportPeriod
  ) => Promise<readonly SellerRow[]>;
  readonly shrinkage: (
    branchIds: readonly string[],
    period: ReportPeriod
  ) => Promise<ShrinkageReport>;
  readonly stockValue: (
    branchIds: readonly string[],
    period: ReportPeriod
  ) => Promise<readonly StockValueDay[]>;
}
