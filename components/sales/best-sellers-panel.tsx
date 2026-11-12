import Link from "next/link";

import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import type { BestSeller } from "@/lib/queries/sales";

export const BestSellersPanel = ({
  rows,
  days,
  className,
}: {
  readonly rows: readonly BestSeller[];
  readonly days: number;
  readonly className?: string;
}) => (
  <Panel
    action={
      <Link
        className="text-brand text-sm font-medium hover:underline"
        href="/sales"
      >
        All sales
      </Link>
    }
    className={className}
    flush
    id="best-sellers"
    title={`Best sellers, last ${days} days`}
  >
    {rows.length === 0 ? (
      <p className="text-ink-2 p-4 text-sm">Nothing sold in that time.</p>
    ) : (
      <Table>
        <caption className="sr-only">
          Most units sold in the last {days} days
        </caption>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th numeric>Units</Th>
            <Th numeric>Sales</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId}>
              <Td className="min-w-48">
                <Link
                  className="hover:text-brand font-medium hover:underline"
                  href={`/products/${row.productId}`}
                >
                  {row.name}
                </Link>
                <span className="text-ink-3 block font-mono text-xs">
                  {row.sku}
                </span>
              </Td>
              <Td numeric weight="medium">
                {formatCount(row.units)}
              </Td>
              <Td numeric>{formatCedis(row.revenue)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    )}
  </Panel>
);
