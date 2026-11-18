"use client";

import { ScanBarcode } from "lucide-react";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { lookupProducts } from "@/app/(app)/lookup-action";
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
import { EmptyNote } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import { PendingLabel } from "@/components/ui/spinner";
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
      <Frame>
        <FramePanel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Deliver to</FieldLabel>
              <Select
                disabled={editing || branches.length === 1}
                onValueChange={(value) => {
                  setBranchId(value ?? "");
                }}
                options={namedOptions(branches)}
                placeholder="Choose a branch"
                value={branchId}
              />
            </Field>
            <Field>
              <FieldLabel>Supplier</FieldLabel>
              <Select
                disabled={editing}
                onValueChange={(value) => {
                  setSupplierId(value ?? "");
                  setError(null);
                }}
                options={namedOptions(suppliers)}
                placeholder="Choose a supplier"
                required
                value={supplierId === "" ? null : supplierId}
              />
            </Field>
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FramePanel flush>
          <div className="border-line border-b p-4">
            <ProductPicker
              autoFocus={initialLines.length === 0}
              label="Add products"
              lookup={lookupProducts}
              onPick={addProduct}
            />
          </div>
          {lines.length === 0 ? (
            <EmptyNote icon={ScanBarcode} title="Nothing on this order yet">
              Scan or find the first product.
            </EmptyNote>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Products on this order</caption>
                <thead>
                  <tr className="text-ink-2 border-line border-b text-left text-xs">
                    <th className="px-4 py-2 font-medium" scope="col">
                      Product
                    </th>
                    <th
                      className="px-2 py-2 text-right font-medium"
                      scope="col"
                    >
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
                    <th
                      className="px-2 py-2 text-right font-medium"
                      scope="col"
                    >
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
        </FramePanel>
      </Frame>

      <Field>
        <FieldLabel>
          <span>
            Note <span className="text-ink-3 font-normal">(optional)</span>
          </span>
        </FieldLabel>
        <Textarea
          maxLength={500}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder="Delivery instructions, promo stock, anything the supplier or head office should know"
          value={note}
        />
      </Field>

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
            <PendingLabel label="Saving…" pending={pending}>
              {saveLabel}
            </PendingLabel>
          </Button>
        </div>
      </div>
    </form>
  );
};
