import Link from "next/link";

import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import type { TransferListRow } from "@/lib/queries/transfers";

interface OnTheWayPanelProps {
  readonly rows: readonly TransferListRow[];
  readonly total: number;
  /** Where "See all" goes: the transfer list, filtered the same way. */
  readonly href: string;
  readonly className?: string;
}

/** Transfers still on the road, so the receiving branch knows what's coming. */
export const OnTheWayPanel = ({
  rows,
  total,
  href,
  className,
}: OnTheWayPanelProps) => (
  <Panel
    action={
      <Link
        className="text-brand text-sm font-medium hover:underline"
        href={href}
      >
        {total > rows.length ? `All ${formatCount(total)}` : "See all"}
      </Link>
    }
    className={className}
    flush
    id="on-the-way"
    title="On the way"
  >
    <Table>
      <caption className="sr-only">Transfers in transit</caption>
      <thead>
        <tr>
          <Th>Transfer</Th>
          <Th>Route</Th>
          <Th>Sent</Th>
          <Th numeric>Units</Th>
          <Th numeric>Value</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td nowrap>
              <Link
                className="text-brand font-mono text-xs font-medium hover:underline"
                href={`/transfers/${row.id}`}
              >
                {row.number}
              </Link>
            </Td>
            <Td nowrap>
              {row.fromName} → {row.toName}
            </Td>
            <Td tone="muted" nowrap>
              <time className="tabular" dateTime={isoString(row.createdAt)}>
                {formatDateTime(row.createdAt)}
              </time>
            </Td>
            <Td numeric>{formatCount(row.unitsSent)}</Td>
            <Td numeric weight="medium">
              {formatCedis(row.totalCost)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  </Panel>
);
