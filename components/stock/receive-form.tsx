"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { receiveAction } from "@/app/(app)/receipts/actions";
import { ProductPicker } from "@/components/stock/product-picker";
import { ReceiptLineRow } from "@/components/stock/receipt-line-row";
import type { DraftLine } from "@/components/stock/receipt-line-row";
import { Button } from "@/components/ui/button";
import { formInt, formText } from "@/lib/form";
import { formatCount } from "@/lib/format";
import { formatCedis, parseCedis, pesewasToInput } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";

interface Option {
  readonly id: string;
  readonly name: string;
}

interface ReceiveFormProps {
  readonly branches: readonly Option[];
  readonly suppliers: readonly Option[];
  readonly defaultBranchId: string;
  readonly initialProduct: PickedProduct | null;
}

interface SubmittedLine {
  readonly productId: number;
  readonly quantity: number;
  readonly unitCost: number;
}

const newLine = (product: PickedProduct): DraftLine => ({
  cost: pesewasToInput(product.averageCost),
  product,
  quantity: "1",
});

type Submission =
  | { readonly ok: true; readonly lines: SubmittedLine[] }
  | { readonly ok: false; readonly productName: string };

/** The lines as numbers, or the first product that needs fixing. */
const toSubmission = (lines: readonly DraftLine[]): Submission => {
  const result: SubmittedLine[] = [];

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

export const ReceiveForm = ({
  branches,
  suppliers,
  defaultBranchId,
  initialProduct,
}: ReceiveFormProps) => {
  const [branchId, setBranchId] = useState(defaultBranchId);

  const [lines, setLines] = useState<readonly DraftLine[]>(
    initialProduct === null ? [] : [newLine(initialProduct)]
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = totals(lines);

  /** Scanning the same product again adds one more, like a till does. */
  const addProduct = (product: PickedProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (existing === undefined) {
        return [...current, newLine(product)];
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
    const form = new FormData(event.currentTarget);

    if (lines.length === 0) {
      setError("Scan or find at least one product.");

      return;
    }

    const submission = toSubmission(lines);

    if (!submission.ok) {
      setError(
        `Check the quantity and unit cost for ${submission.productName}.`
      );

      return;
    }

    startTransition(async () => {
      const result = await receiveAction({
        branchId,
        lines: submission.lines,
        note: formText(form, "note"),
        supplierId: formInt(form, "supplierId"),
        supplierReference: formText(form, "supplierReference"),
      });

      setError(result.error);
    });
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={onSubmit}>
      <div className="border-line bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium">
          Receiving at
          <select
            className="field"
            disabled={branches.length === 1}
            name="branchId"
            onChange={(event) => {
              setBranchId(event.target.value);
            }}
            value={branchId}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Supplier
          <select className="field" defaultValue="" name="supplierId" required>
            <option disabled value="">
              Choose a supplier
            </option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          <span>
            Invoice or waybill no.{" "}
            <span className="text-ink-3 font-normal">(optional)</span>
          </span>
          <input
            autoComplete="off"
            className="field font-mono"
            maxLength={60}
            name="supplierReference"
          />
        </label>
      </div>

      <div className="border-line bg-surface rounded-xl border">
        <div className="border-line border-b p-4">
          <ProductPicker
            autoFocus={initialProduct === null}
            label="Add products"
            onPick={addProduct}
          />
        </div>
        {lines.length === 0 ? (
          <p className="text-ink-2 p-6 text-center text-sm">
            Nothing on this delivery yet. Scan the first item.
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Products on this delivery</caption>
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
                    Quantity
                  </th>
                  <th
                    className="w-36 px-2 py-2 text-right font-medium"
                    scope="col"
                  >
                    Unit cost (GH₵)
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
          name="note"
          placeholder="Short deliveries, damaged cartons, anything head office should know"
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
            {pending ? "Saving…" : "Receive goods"}
          </Button>
        </div>
      </div>
    </form>
  );
};
