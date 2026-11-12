import Link from "next/link";

import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import type { ReorderLine } from "@/lib/queries/overview";
import { stockStatus } from "@/lib/queries/stock-status";

interface ReorderTableProps {
  readonly lines: readonly ReorderLine[];
  readonly showBranch: boolean;
  readonly showSupplier?: boolean;
}

export const ReorderTable = ({
  lines,
  showBranch,
  showSupplier = false,
}: ReorderTableProps) => (
  <Table>
    <caption className="sr-only">
      Lines at or below their reorder point, emptiest first
    </caption>
    <thead>
      <tr>
        <Th>Product</Th>
        {showBranch ? <Th>Branch</Th> : null}
        {showSupplier ? <Th>Supplier</Th> : null}
        <Th numeric>On hand</Th>
        <Th numeric>Reorder at</Th>
        <Th numeric>On the way</Th>
        <Th>Status</Th>
      </tr>
    </thead>
    <tbody>
      {lines.map((line) => (
        <tr key={`${line.branchId}-${line.productId}`}>
          <Td className="min-w-56">
            <Link
              className="hover:text-brand font-medium hover:underline"
              href={`/products/${line.productId}`}
            >
              {line.name}
            </Link>
            <span className="text-ink-3 block font-mono text-xs">
              {line.sku}
            </span>
          </Td>
          {showBranch ? <Td nowrap>{line.branchName}</Td> : null}
          {showSupplier ? (
            <Td tone="muted" className="min-w-40">
              {line.supplierName ?? "—"}
            </Td>
          ) : null}
          <Td numeric weight="medium">
            {formatCount(line.onHand)}
          </Td>
          <Td numeric tone="muted">
            {formatCount(line.reorderPoint)}
          </Td>
          <Td numeric tone={line.inTransit > 0 ? "good" : "faint"}>
            {line.inTransit > 0 ? `+${formatCount(line.inTransit)}` : "—"}
          </Td>
          <Td>
            <StockBadge status={stockStatus(line.onHand, line.reorderPoint)} />
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
);
