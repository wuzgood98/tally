import Link from "next/link";

import { Table, Td, Th } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import type { PurchaseOrderDetail } from "@/lib/queries/purchase-orders";

/** Ordered against delivered, line by line, with what's still due. */
export const OrderLinesTable = ({
  order,
}: {
  readonly order: PurchaseOrderDetail;
}) => {
  const showProgress = order.status !== "draft" && order.status !== "cancelled";
  let ordered = 0;
  let received = 0;

  for (const line of order.lines) {
    ordered += line.quantity;
    received += line.quantityReceived;
  }

  return (
    <Table>
      <caption className="sr-only">Products on {order.number}</caption>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th numeric>Ordered</Th>
          {showProgress ? <Th numeric>Received</Th> : null}
          {showProgress ? <Th numeric>Still due</Th> : null}
          <Th numeric>Agreed cost</Th>
          <Th numeric>Line total</Th>
        </tr>
      </thead>
      <tbody>
        {order.lines.map((line) => {
          const due = line.quantity - line.quantityReceived;

          return (
            <tr key={line.productId}>
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
              <Td numeric weight="medium">
                {formatCount(line.quantity)}
              </Td>
              {showProgress ? (
                <Td numeric>{formatCount(line.quantityReceived)}</Td>
              ) : null}
              {showProgress ? (
                <Td
                  numeric
                  tone={due > 0 ? "warn" : "faint"}
                  weight={due > 0 ? "medium" : "normal"}
                >
                  {due > 0 ? formatCount(due) : "—"}
                </Td>
              ) : null}
              <Td numeric>{formatCedis(line.unitCost)}</Td>
              <Td numeric>{formatCedis(line.quantity * line.unitCost)}</Td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <Td weight="semibold">Total</Td>
          <Td numeric weight="semibold">
            {formatCount(ordered)}
          </Td>
          {showProgress ? (
            <Td numeric weight="semibold">
              {formatCount(received)}
            </Td>
          ) : null}
          {showProgress ? (
            <Td
              numeric
              tone={ordered > received ? "warn" : "faint"}
              weight="semibold"
            >
              {ordered > received ? formatCount(ordered - received) : "—"}
            </Td>
          ) : null}
          <Td />
          <Td numeric weight="semibold">
            {formatCedis(order.totalCost)}
          </Td>
        </tr>
      </tfoot>
    </Table>
  );
};
