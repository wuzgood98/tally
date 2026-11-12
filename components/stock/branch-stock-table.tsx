import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { stockStatus } from "@/lib/queries/stock-status";

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
  /** By branch id: units sold in the last `salesDays`. */
  readonly sold: ReadonlyMap<string, number>;
  readonly salesDays: number;
  /** The branch on screen, highlighted. */
  readonly highlightBranchId?: string;
}

/** Coming in: shown as "+12", or a dash when there's nothing. */
const Incoming = ({ units }: { readonly units: number }) => (
  <Td numeric tone={units > 0 ? "good" : "faint"}>
    {units > 0 ? `+${formatCount(units)}` : "—"}
  </Td>
);

/** One product's stock at every branch, with what's coming and what's selling. */
export const BranchStockTable = ({
  productName,
  levels,
  reorderPoint,
  inTransit,
  onOrder,
  sold,
  salesDays,
  highlightBranchId,
}: BranchStockTableProps) => (
  <Table>
    <caption className="sr-only">Stock of {productName} at each branch</caption>
    <thead>
      <tr>
        <Th>Branch</Th>
        <Th>Location</Th>
        <Th numeric>On hand</Th>
        <Th numeric>On the way</Th>
        <Th numeric>On order</Th>
        <Th numeric>Sold, {salesDays} days</Th>
        <Th numeric>Reorder at</Th>
        <Th>Status</Th>
      </tr>
    </thead>
    <tbody>
      {levels.map((level) => {
        const threshold = level.reorderOverride ?? reorderPoint;

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
            <Td numeric weight="medium">
              {formatCount(level.onHand)}
            </Td>
            <Incoming units={inTransit.get(level.branchId) ?? 0} />
            <Incoming units={onOrder.get(level.branchId) ?? 0} />
            <Td numeric tone="muted">
              {level.branchKind === "warehouse"
                ? "—"
                : formatCount(sold.get(level.branchId) ?? 0)}
            </Td>
            <Td numeric tone="muted">
              {formatCount(threshold)}
              {level.reorderOverride === null ? null : (
                <span className="sr-only"> (set for this branch)</span>
              )}
            </Td>
            <Td>
              {level.stocked ? (
                <StockBadge status={stockStatus(level.onHand, threshold)} />
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
