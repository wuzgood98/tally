"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { Input } from "@/components/ui/input";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";

/** A basket line as typed: the quantity stays text until the sale. */
export interface BasketLine {
  readonly product: PickedProduct;
  readonly quantity: string;
}

interface TillLineRowProps {
  readonly line: BasketLine;
  readonly branchId: string;
  readonly onChange: (productId: number, quantity: string) => void;
  readonly onRemove: (productId: number) => void;
  /** Bumps on every repeat scan of this product; each new value flashes the row. */
  readonly flash?: number;
}

const FLASH_MS = 600;

/** The project's --ease-out-quick. */
const FLASH_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

export const TillLineRow = ({
  line,
  branchId,
  onChange,
  onRemove,
  flash = 0,
}: TillLineRowProps) => {
  const row = useRef<HTMLTableRowElement>(null);
  const { product } = line;
  const quantity = wholeNumber(line.quantity);
  const valid = quantity !== null && quantity > 0;
  const onShelf = product.onHand[branchId] ?? 0;
  const beyondRecord = valid && quantity > onShelf;

  // A repeat scan only changes one digit, so wash the row to show it landed.
  // Colour only, so it stays on under reduced motion.
  useEffect(() => {
    const element = row.current;

    if (flash === 0 || element === null) {
      return;
    }

    const tint = getComputedStyle(element).getPropertyValue("--accent-soft");
    element.animate(
      [{ backgroundColor: tint }, { backgroundColor: "transparent" }],
      { duration: FLASH_MS, easing: FLASH_EASING }
    );
  }, [flash]);

  return (
    <tr className="border-line border-b last:border-0" ref={row}>
      <td className="min-w-52 px-4 py-2">
        <span className="font-medium">{product.name}</span>
        <span className="text-ink-3 block font-mono text-xs">
          {product.sku}
        </span>
        {beyondRecord ? (
          <span className="text-warn block text-xs">
            The record shows {formatCount(onShelf)} here. The sale still goes
            through, and the line is flagged for a count.
          </span>
        ) : null}
      </td>
      <td className="tabular text-ink-2 px-2 py-2 text-right whitespace-nowrap">
        {formatCedis(product.sellPrice)}
      </td>
      <td className="px-2 py-2">
        <Input
          aria-invalid={valid ? undefined : true}
          aria-label={`Quantity of ${product.name}`}
          className="min-w-16"
          format="amount"
          size="sm"
          inputMode="numeric"
          onChange={(event) => {
            onChange(product.id, event.target.value);
          }}
          onFocus={(event) => {
            event.target.select();
          }}
          value={line.quantity}
        />
      </td>
      <td className="tabular px-2 py-2 text-right font-medium whitespace-nowrap">
        {valid ? formatCedis(quantity * product.sellPrice) : "—"}
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
