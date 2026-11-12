"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { tillSaleAction } from "@/app/(app)/till/actions";
import { TillCheckout } from "@/components/sales/till-checkout";
import { TillLineRow } from "@/components/sales/till-line-row";
import type { BasketLine } from "@/components/sales/till-line-row";
import { ProductPicker } from "@/components/stock/product-picker";
import type { PaymentMethod } from "@/lib/db/schema";
import { formatCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";
import type { SaleResult } from "@/lib/stock/sales";

interface Option {
  readonly id: string;
  readonly name: string;
}

interface TillFormProps {
  readonly stores: readonly Option[];
  readonly defaultStoreId: string;
}

const totals = (lines: readonly BasketLine[]) => {
  let total = 0;
  let units = 0;

  for (const line of lines) {
    const quantity = wholeNumber(line.quantity) ?? 0;
    units += quantity;
    total += quantity * line.product.sellPrice;
  }

  return { total, units };
};

const LastSale = ({ recorded }: { readonly recorded: SaleResult }) => (
  <output className="bg-brand-soft text-good flex flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
    <CircleCheck aria-hidden="true" className="size-4" />
    {recorded.duplicate
      ? `Already recorded as ${recorded.number}: nothing was charged twice.`
      : `${recorded.number} recorded · ${formatCedis(recorded.total)}.`}
    <Link className="ml-auto underline" href={`/sales/${recorded.id}`}>
      Receipt
    </Link>
  </output>
);

/**
 * The till. Scan to fill the basket, pick how the customer pays, charge.
 * Each sale gets an id from the till the first time it's charged and keeps it
 * until it succeeds, so a retry after a dropped connection can't double-charge.
 */
export const TillForm = ({ stores, defaultStoreId }: TillFormProps) => {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [lines, setLines] = useState<readonly BasketLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [pending, startTransition] = useTransition();
  const clientRef = useRef<string | null>(null);
  const scanArea = useRef<HTMLDivElement>(null);
  const summary = totals(lines);

  /** Scanning the same product again adds one more. */
  const addProduct = (product: PickedProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (existing === undefined) {
        return [...current, { product, quantity: "1" }];
      }

      return current.map((line) =>
        line === existing
          ? { ...line, quantity: String((wholeNumber(line.quantity) ?? 0) + 1) }
          : line
      );
    });
    setError(null);
  };

  const update = (productId: number, quantity: string) => {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line
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

    const invalid = lines.find((line) => {
      const quantity = wholeNumber(line.quantity);

      return quantity === null || quantity === 0;
    });

    if (invalid !== undefined) {
      setError(`Check the quantity for ${invalid.product.name}.`);

      return;
    }

    // Kept until the sale succeeds, so a retry reuses it (see above).
    const ref = clientRef.current ?? crypto.randomUUID();
    clientRef.current = ref;

    startTransition(async () => {
      const result = await tillSaleAction({
        branchId: storeId,
        clientRef: ref,
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: wholeNumber(line.quantity) ?? 0,
        })),
        paymentMethod,
      });

      if (result.sale === null) {
        setError(result.error);

        return;
      }

      clientRef.current = null;
      setLastSale(result.sale);
      setLines([]);
      setPaymentMethod("cash");
      setError(null);
      // Ready for the next customer's first scan.
      scanArea.current?.querySelector("input")?.focus();
    });
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={onSubmit}>
      {lastSale === null ? null : <LastSale recorded={lastSale} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="border-line bg-surface min-w-0 rounded-xl border">
          <div className="border-line grid gap-4 border-b p-4" ref={scanArea}>
            {stores.length > 1 ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Till at
                <select
                  className="field"
                  onChange={(event) => {
                    setStoreId(event.target.value);
                  }}
                  value={storeId}
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ProductPicker autoFocus label="Scan items" onPick={addProduct} />
          </div>
          {lines.length === 0 ? (
            <p className="text-ink-2 p-6 text-center text-sm">
              The basket is empty. Scan the first item.
            </p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Basket</caption>
                <thead>
                  <tr className="text-ink-2 border-line border-b text-left text-xs">
                    <th className="px-4 py-2 font-medium" scope="col">
                      Item
                    </th>
                    <th
                      className="px-2 py-2 text-right font-medium"
                      scope="col"
                    >
                      Price
                    </th>
                    <th
                      className="w-24 px-2 py-2 text-right font-medium"
                      scope="col"
                    >
                      Qty
                    </th>
                    <th
                      className="px-2 py-2 text-right font-medium"
                      scope="col"
                    >
                      Amount
                    </th>
                    <th className="w-12 px-2 py-2" scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <TillLineRow
                      branchId={storeId}
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

        <TillCheckout
          error={error}
          // A fresh checkout per sale, so the cash received doesn't carry over.
          key={lastSale?.id ?? 0}
          onPaymentMethod={setPaymentMethod}
          paymentMethod={paymentMethod}
          pending={pending}
          total={summary.total}
          units={summary.units}
        />
      </div>
    </form>
  );
};
