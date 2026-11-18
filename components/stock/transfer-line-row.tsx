"use client";

import { Trash2 } from "lucide-react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { Input } from "@/components/ui/input";
import { formatCount } from "@/lib/format";
import { wholeNumber } from "@/lib/numbers";

/** A line as typed: the quantity stays text until submitted. */
export interface TransferDraftLine {
  readonly product: PickedProduct;
  readonly quantity: string;
}

interface TransferLineRowProps {
  readonly line: TransferDraftLine;
  /** Units at the sending branch when the product was picked. */
  readonly available: number;
  readonly onChange: (productId: number, quantity: string) => void;
  readonly onRemove: (productId: number) => void;
}

export const TransferLineRow = ({
  line,
  available,
  onChange,
  onRemove,
}: TransferLineRowProps) => {
  const { product } = line;
  const quantity = wholeNumber(line.quantity);
  const tooMany = quantity !== null && quantity > available;
  const valid = quantity !== null && quantity > 0 && !tooMany;

  return (
    <tr className="border-line border-b last:border-0">
      <td className="min-w-56 px-4 py-2">
        <span className="font-medium">{product.name}</span>
        <span className="text-ink-3 block font-mono text-xs">
          {product.sku}
        </span>
      </td>
      <td
        className={
          available === 0
            ? "text-danger tabular px-2 py-2 text-right"
            : "text-ink-2 tabular px-2 py-2 text-right"
        }
      >
        {formatCount(available)}
      </td>
      <td className="px-2 py-2">
        <Input
          aria-invalid={valid ? undefined : true}
          aria-label={`Quantity of ${product.name} to send`}
          className="min-w-20"
          format="amount"
          size="sm"
          inputMode="numeric"
          onChange={(event) => {
            onChange(product.id, event.target.value);
          }}
          onFocus={(event) => {
            event.target.select();
          }}
          placeholder="0"
          value={line.quantity}
        />
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
