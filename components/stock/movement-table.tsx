import Link from "next/link";

import { Table, Td, Th } from "@/components/ui/table";
import {
  formatCount,
  formatDateTime,
  formatSigned,
  isoString,
} from "@/lib/format";
import type { MovementRow } from "@/lib/queries/movements";
import { REASON_LABELS } from "@/lib/stock/reasons";

interface MovementTableProps {
  readonly rows: readonly MovementRow[];
  readonly showBranch?: boolean;
  readonly showProduct?: boolean;
  readonly caption: string;
}

const TransferLink = ({ row }: { readonly row: MovementRow }) =>
  row.transferId === null ? null : (
    <Link
      className="text-brand ml-1.5 font-mono text-xs hover:underline"
      href={`/transfers/${row.transferId}`}
    >
      {row.transferNumber}
    </Link>
  );

/** Sent away, arrived, or came back because the transfer was cancelled. */
const transferLabel = (row: MovementRow): string => {
  if (row.kind === "transfer_out") {
    return `Sent to ${row.transferToName ?? "another branch"}`;
  }

  return row.branchId === row.transferFromId
    ? "Returned: transfer cancelled"
    : `Received from ${row.transferFromName ?? "another branch"}`;
};

const What = ({ row }: { readonly row: MovementRow }) => {
  if (row.kind === "transfer_out" || row.kind === "transfer_in") {
    return (
      <span>
        {transferLabel(row)}
        <TransferLink row={row} />
      </span>
    );
  }

  if (row.kind === "receipt") {
    return row.receiptId === null ? (
      <span>Delivery</span>
    ) : (
      <Link
        className="text-brand font-mono text-xs hover:underline"
        href={`/receipts/${row.receiptId}`}
      >
        {row.receiptNumber ?? "Delivery"}
      </Link>
    );
  }

  if (row.kind === "adjustment" && row.reason) {
    return <span>{REASON_LABELS[row.reason]}</span>;
  }

  return <span className="text-ink-2">Opening balance</span>;
};

export const MovementTable = ({
  rows,
  showBranch = false,
  showProduct = true,
  caption,
}: MovementTableProps) => (
  <Table>
    <caption className="sr-only">{caption}</caption>
    <thead>
      <tr>
        <Th>When</Th>
        {showProduct ? <Th>Product</Th> : null}
        {showBranch ? <Th>Branch</Th> : null}
        <Th>What</Th>
        <Th numeric>Change</Th>
        <Th numeric>Balance</Th>
        <Th>By</Th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.id}>
          <Td tone="muted" nowrap>
            <time className="tabular" dateTime={isoString(row.createdAt)}>
              {formatDateTime(row.createdAt)}
            </time>
          </Td>
          {showProduct ? (
            <Td className="min-w-56">
              <Link
                className="hover:text-brand font-medium hover:underline"
                href={`/products/${row.productId}`}
              >
                {row.productName}
              </Link>
              <span className="text-ink-3 block font-mono text-xs">
                {row.sku}
              </span>
            </Td>
          ) : null}
          {showBranch ? <Td nowrap>{row.branchName}</Td> : null}
          <Td className="min-w-40">
            <What row={row} />
            {row.note !== null && row.note !== undefined ? (
              <span className="text-ink-2 block text-xs">{row.note}</span>
            ) : null}
          </Td>
          <Td
            numeric
            tone={row.quantity > 0 ? "good" : "danger"}
            weight="medium"
          >
            {formatSigned(row.quantity)}
          </Td>
          <Td numeric>{formatCount(row.balanceAfter)}</Td>
          <Td tone="muted" nowrap>
            {row.userName ?? "System"}
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
);
