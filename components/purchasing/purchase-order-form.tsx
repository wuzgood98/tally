"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import {
  draftOrderAction,
  updateOrderAction,
} from "@/app/(app)/purchase-orders/actions";
import { orderLine } from "@/components/purchasing/order-line";
import { ProductPicker } from "@/components/stock/product-picker";
import { ReceiptLineRow } from "@/components/stock/receipt-line-row";
import type { DraftLine } from "@/components/stock/receipt-line-row";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { formatCedis, parseCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";

interface Option {
  readonly id: string;
  readonly name: string;
}

interface PurchaseOrderFormProps {
  readonly branches: readonly Option[];
  readonly suppliers: readonly Option[];
  readonly defaultBranchId: string;
  readonly defaultSupplierId: string;
  readonly initialLines: readonly DraftLine[];
  readonly defaultNote?: string;
  /** Set when editing a draft: branch and supplier can't change then. */
  readonly orderId?: number;
}

type Submission =
  | {
      readonly ok: true;
      readonly lines: {
        productId: number;
        quantity: number;
        unitCost: number;
      }[];
    }
  | { readonly ok: false; readonly productName: string };

const toSubmission = (lines: readonly DraftLine[]): Submission => {
  const result: { productId: number; quantity: number; unitCost: number }[] =
    [];

  for (const line of lines) {
    const quantity = wholeNumber(line.quantity);
    const unitCost = parseCedis(line.cost);

    if (quantity === null || quantity === 0 || unitCost === null) {
      return { ok: false, productName: line.product.name };
    }

    result.push({ productId: line.product.id, quantity, unitCost });
  }

  return { lines: result, ok: true };
};

const totals = (lines: readonly DraftLine[]) => {
  let cost = 0;
  let units = 0;

  for (const line of lines) {
    const quantity = wholeNumber(line.quantity) ?? 0;
    units += quantity;
    cost += quantity * (parseCedis(line.cost) ?? 0);
  }

  return { cost, units };
};

export const PurchaseOrderForm = ({
  branches,
  suppliers,
  defaultBranchId,
  defaultSupplierId,
  initialLines,
  defaultNote = "",
  orderId,
}: PurchaseOrderFormProps) => {
  const editing = orderId !== undefined;
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [note, setNote] = useState(defaultNote);
  const [lines, setLines] = useState(initialLines);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = totals(lines);
  const saveLabel = editing ? "Save draft" : "Save as draft";

  /** Scanning the same product again adds one more. */
  const addProduct = (product: PickedProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (existing === undefined) {
        return [...current, orderLine(product)];
      }

      return current.map((line) =>
        line === existing
          ? { ...line, quantity: String((wholeNumber(line.quantity) ?? 0) + 1) }
          : line
      );
    });
    setError(null);
  };

  const update = (
    productId: number,
    patch: Partial<Pick<DraftLine, "quantity" | "cost">>
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, ...patch } : line
      )
    );
  };

  const remove = (productId: number) => {
    setLines((current) =>
      current.filter((line) => line.product.id !== productId)
    );
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (supplierId === "") {
      setError("Choose a supplier.");

      return;
    }

    if (lines.length === 0) {
      setError("Scan or find at least one product.");

      return;
    }

    const submission = toSubmission(lines);

    if (!submission.ok) {
      setError(`Check the quantity and cost for ${submission.productName}.`);

      return;
    }

    startTransition(async () => {
      const result = editing
        ? await updateOrderAction({
            lines: submission.lines,
            note,
            purchaseOrderId: orderId,
          })
        : await draftOrderAction({
            branchId,
            lines: submission.lines,
            note,
            supplierId: Number(supplierId),
          });

      setError(result.error);
    });
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={onSubmit}>
      <div className="border-line bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Deliver to
          <select
            className="field"
            disabled={editing || branches.length === 1}
            onChange={(event) => {
              setBranchId(event.target.value);
            }}
            value={branchId}
          >
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Supplier
          <select
            className="field"
            disabled={editing}
            onChange={(event) => {
              setSupplierId(event.target.value);
              setError(null);
            }}
            required
            value={supplierId}
          >
            <option disabled value="">
              Choose a supplier
            </option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-line bg-surface rounded-xl border">
        <div className="border-line border-b p-4">
          <ProductPicker
            autoFocus={initialLines.length === 0}
            label="Add products"
            onPick={addProduct}
          />
        </div>
        {lines.length === 0 ? (
          <p className="text-ink-2 p-6 text-center text-sm">
            Nothing on this order yet. Scan or find the first product.
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Products on this order</caption>
              <thead>
                <tr className="text-ink-2 border-line border-b text-left text-xs">
                  <th className="px-4 py-2 font-medium" scope="col">
                    Product
                  </th>
                  <th className="px-2 py-2 text-right font-medium" scope="col">
                    Now at branch
                  </th>
                  <th
                    className="w-28 px-2 py-2 text-right font-medium"
                    scope="col"
                  >
                    Order
                  </th>
                  <th
                    className="w-36 px-2 py-2 text-right font-medium"
                    scope="col"
                  >
                    Agreed cost (GH₵)
                  </th>
                  <th className="px-2 py-2 text-right font-medium" scope="col">
                    Line total
                  </th>
                  <th className="w-12 px-2 py-2" scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <ReceiptLineRow
                    branchId={branchId}
                    key={line.product.id}
                    line={line}
                    onChange={update}
                    onRemove={remove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label className="grid gap-1.5 text-sm font-medium">
        <span>
          Note <span className="text-ink-3 font-normal">(optional)</span>
        </span>
        <textarea
          className="field h-auto min-h-20 py-2"
          maxLength={500}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder="Delivery instructions, promo stock, anything the supplier or head office should know"
          value={note}
        />
      </label>

      <div className="border-line bg-surface sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 pl-4 shadow-sm">
        <p className="tabular text-sm">
          <span className="font-semibold">{formatCedis(summary.cost)}</span>
          <span className="text-ink-2">
            {" "}
            · {formatCount(lines.length)}{" "}
            {lines.length === 1 ? "line" : "lines"},{" "}
            {formatCount(summary.units)}{" "}
            {summary.units === 1 ? "unit" : "units"}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <output aria-live="polite" className="text-danger text-sm">
            {error}
          </output>
          <Button disabled={pending} size="md" type="submit">
            {pending ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </form>
  );
};
