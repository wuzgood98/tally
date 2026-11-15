import Link from "next/link";

import { StockGauge } from "@/components/stock/stock-gauge";
import { StockBadge } from "@/components/ui/stock-badge";
import { Table, Td, Th } from "@/components/ui/table";
import type { ReorderLine } from "@/lib/queries/overview";
import { shelfStatus } from "@/lib/stock/coverage";

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
        {showBranch ? <Th className="hidden sm:table-cell">Branch</Th> : null}
        {showSupplier ? (
          <Th className="hidden sm:table-cell">Supplier</Th>
        ) : null}
        <Th className="hidden sm:table-cell">On hand / reorder at</Th>
        <Th>Status</Th>
      </tr>
    </thead>
    <tbody>
      {lines.map((line) => (
        <tr key={`${line.branchId}-${line.productId}`}>
          <Td className="w-full sm:w-auto sm:min-w-52">
            <Link
              className="hover:text-brand font-medium hover:underline"
              href={`/products/${line.productId}`}
            >
              {line.name}
            </Link>
            <span className="text-ink-3 block font-mono text-xs">
              {line.sku}
              {showBranch ? (
                <span className="font-sans sm:hidden">
                  {" "}
                  · {line.branchName}
                </span>
              ) : null}
            </span>
            {/* On a phone the gauge sits under the name, so nothing scrolls. */}
            <div className="mt-2 sm:hidden">
              <StockGauge line={line} />
            </div>
          </Td>
          {showBranch ? (
            <Td className="hidden sm:table-cell" nowrap>
              {line.branchName}
            </Td>
          ) : null}
          {showSupplier ? (
            <Td className="hidden min-w-40 sm:table-cell" tone="muted">
              {line.supplierName ?? "—"}
            </Td>
          ) : null}
          <Td className="hidden w-2/5 min-w-40 sm:table-cell">
            <StockGauge line={line} />
          </Td>
          <Td>
            <StockBadge status={shelfStatus(line)} />
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
);
