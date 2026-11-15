import { StockGauge } from "@/components/stock/stock-gauge";
import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { stockStatus } from "@/lib/queries/stock-status";
import { shelfStatus } from "@/lib/stock/coverage";

interface BranchLevel {
  readonly branchId: string;
  readonly branchName: string;
  readonly branchKind: "store" | "warehouse";
  readonly binLocation: string | null;
  readonly onHand: number;
  readonly reorderOverride: number | null;
  readonly stocked: boolean;
}

interface BranchStockTableProps {
  readonly productName: string;
  readonly levels: readonly BranchLevel[];
  /** The product's company-wide reorder point, for branches without their own. */
  readonly reorderPoint: number;
  /** By branch id: units on a transfer towards it. */
  readonly inTransit: ReadonlyMap<string, number>;
  /** By branch id: units still due on approved purchase orders. */
  readonly onOrder: ReadonlyMap<string, number>;
  /** By branch id: units on its open requests to the warehouse. */
  readonly requested: ReadonlyMap<string, number>;
  /** By branch id: units sold in the last `salesDays`. */
  readonly sold: ReadonlyMap<string, number>;
  readonly salesDays: number;
  /** The branch on screen, highlighted. */
  readonly highlightBranchId?: string;
  /**
   * Just where it is and how many: for a cashier, who doesn't need what's
   * coming in, what's selling or when it's reordered.
   */
  readonly brief?: boolean;
}

/** One product's stock at every branch, with what's coming and what's selling. */
export const BranchStockTable = ({
  productName,
  levels,
  reorderPoint,
  inTransit,
  onOrder,
  requested,
  sold,
  salesDays,
  highlightBranchId,
  brief = false,
}: BranchStockTableProps) => (
  <Table>
    <caption className="sr-only">Stock of {productName} at each branch</caption>
    <thead>
      <tr>
        <Th>Branch</Th>
        <Th>Location</Th>
        {brief ? (
          <Th numeric>On hand</Th>
        ) : (
          <>
            <Th>On hand / reorder at</Th>
            <Th numeric>Sold, {salesDays} days</Th>
          </>
        )}
        <Th>Status</Th>
      </tr>
    </thead>
    <tbody>
      {levels.map((level) => {
        const threshold = level.reorderOverride ?? reorderPoint;

        const line = {
          inTransit: inTransit.get(level.branchId) ?? 0,
          onHand: level.onHand,
          onOrder: onOrder.get(level.branchId) ?? 0,
          reorderPoint: threshold,
          requested: requested.get(level.branchId) ?? 0,
        };

        return (
          <tr
            className={
              level.branchId === highlightBranchId
                ? "bg-brand-soft/40"
                : undefined
            }
            key={level.branchId}
          >
            <Td nowrap>
              <span className="font-medium">{level.branchName}</span>
              {level.branchKind === "warehouse" ? (
                <span className="text-ink-3 block text-xs">Warehouse</span>
              ) : null}
            </Td>
            <Td tone="muted">
              <span className="font-mono text-xs">
                {level.binLocation ?? "—"}
              </span>
            </Td>
            {brief ? (
              <Td numeric weight="medium">
                {formatCount(level.onHand)}
              </Td>
            ) : (
              <>
                <Td className="w-2/5 min-w-40">
                  {level.stocked ? (
                    <StockGauge
                      line={line}
                      reorderNote={
                        level.reorderOverride === null
                          ? undefined
                          : "set for this branch"
                      }
                    />
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </Td>
                <Td numeric tone="muted">
                  {level.branchKind === "warehouse"
                    ? "—"
                    : formatCount(sold.get(level.branchId) ?? 0)}
                </Td>
              </>
            )}
            <Td>
              {level.stocked ? (
                <StockBadge
                  status={
                    brief
                      ? stockStatus(level.onHand, threshold)
                      : shelfStatus(line)
                  }
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
);
