"use client";

import { Trash2 } from "lucide-react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { Input } from "@/components/ui/input";
import { formatCount } from "@/lib/format";
import { formatCedis, parseCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";

/** A line as typed: quantities and costs stay text until submitted. */
export interface DraftLine {
  readonly product: PickedProduct;
  readonly quantity: string;
  readonly cost: string;
}

interface ReceiptLineRowProps {
  readonly line: DraftLine;
  readonly branchId: string;
  readonly onChange: (
    productId: number,
    patch: Partial<Pick<DraftLine, "quantity" | "cost">>
  ) => void;
  readonly onRemove: (productId: number) => void;
}

export const ReceiptLineRow = ({
  line,
  branchId,
  onChange,
  onRemove,
}: ReceiptLineRowProps) => {
  const { product } = line;
  const quantity = wholeNumber(line.quantity);
  const cost = parseCedis(line.cost);
  const quantityValid = quantity !== null && quantity > 0;

  return (
    <tr className="border-line border-b last:border-0">
      <td className="min-w-56 px-4 py-2">
        <span className="font-medium">{product.name}</span>
        <span className="text-ink-3 block font-mono text-xs">
          {product.sku}
        </span>
      </td>
      <td className="text-ink-2 tabular px-2 py-2 text-right">
        {formatCount(product.onHand[branchId] ?? 0)}
      </td>
      <td className="px-2 py-2">
        <Input
          aria-invalid={quantityValid ? undefined : true}
          aria-label={`Quantity of ${product.name}`}
          className="min-w-20"
          format="amount"
          size="sm"
          inputMode="numeric"
          onChange={(event) => {
            onChange(product.id, { quantity: event.target.value });
          }}
          onFocus={(event) => {
            event.target.select();
          }}
          placeholder="0"
          value={line.quantity}
        />
      </td>
      <td className="px-2 py-2">
        <Input
          aria-invalid={cost === null ? true : undefined}
          aria-label={`Unit cost of ${product.name} in cedis`}
          className="min-w-20"
          format="amount"
          size="sm"
          inputMode="decimal"
          onChange={(event) => {
            onChange(product.id, { cost: event.target.value });
          }}
          onFocus={(event) => {
            event.target.select();
          }}
          placeholder="0.00"
          value={line.cost}
        />
      </td>
      <td className="tabular px-2 py-2 text-right whitespace-nowrap">
        {quantityValid && cost !== null ? formatCedis(quantity * cost) : "—"}
      </td>
      <td className="px-2 py-2 text-center">
        <button
          aria-label={`Remove ${product.name}`}
          className="press text-ink-3 hover:text-danger hover:bg-danger-soft grid size-8 place-items-center rounded-md"
          onClick={() => {
            onRemove(product.id);
          }}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </td>
    </tr>
  );
};
