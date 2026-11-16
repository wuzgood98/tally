"use client";

import { useShortcut } from "@ui-sdk/react/shortcuts";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import {
  CHARGE_SHORTCUT,
  TillCheckout,
} from "@/components/sales/till-checkout";
import { TillLineRow } from "@/components/sales/till-line-row";
import type { BasketLine } from "@/components/sales/till-line-row";
import { ProductPicker } from "@/components/stock/product-picker";
import { useTillData } from "@/components/till/till-data-provider";
import { TillToday } from "@/components/till/till-today";
import { useBasketShelf } from "@/components/till/use-basket-shelf";
import type { ShelfFacts } from "@/components/till/use-basket-shelf";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Select } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import type { PaymentMethod } from "@/lib/db/schema";
import { formatCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";
import {
  NO_TENDER,
  canCharge,
  changeDue,
  readTender,
} from "@/lib/stock/quick-cash";
import type { SaleResult } from "@/lib/stock/sales";
import { TillHttpError } from "@/lib/till/client/http";
import { lookupTillProducts } from "@/lib/till/lookup";
import type { TillSaleReply } from "@/lib/till/schema";

interface Option {
  readonly id: string;
  readonly name: string;
}

interface TillFormProps {
  /** The signed-in person; every sale carries it, so a queued one is never sent as someone else. */
  readonly cashierId: string;
  readonly stores: readonly Option[];
  readonly defaultStoreId: string;
  /** Printed at the foot of the receipt; null for none. */
  readonly receiptFooter: string | null;
}

/** The line a repeat scan last bumped; each new count restarts its flash. */
interface Bump {
  readonly productId: number;
  readonly count: number;
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

/**
 * The basket with the prices and shelf counts the till knows now, so a price
 * that changes while the customer waits shows before Charge, not after.
 */
const withShelf = (
  lines: readonly BasketLine[],
  shelf: ReadonlyMap<number, ShelfFacts>,
  storeId: string
): BasketLine[] =>
  lines.map((line) => {
    const facts = shelf.get(line.product.id);

    if (facts === undefined) {
      return line;
    }

    return {
      ...line,
      product: {
        ...line.product,
        onHand: { ...line.product.onHand, [storeId]: facts.onHand },
        sellPrice: facts.sellPrice,
      },
    };
  });

const recordedFrom = (reply: TillSaleReply): SaleResult => ({
  duplicate: reply.duplicate,
  id: reply.sale.id ?? 0,
  number: reply.sale.number ?? reply.sale.clientRef,
  total: reply.sale.total,
});

/** The sale just rung up, and the cash it left to hand back. */
interface RecordedSale {
  readonly recorded: SaleResult;
  /** Cash to hand back, in pesewas; null when none is due. */
  readonly change: number | null;
}

/** Stays until the next sale, so the change due never times out. */
const LastSale = ({
  sale: { recorded, change },
}: {
  readonly sale: RecordedSale;
}) => (
  <output className="bg-brand-soft text-good flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-3 text-sm font-medium">
    <span className="flex items-center gap-2">
      <CircleCheck aria-hidden="true" className="size-4" />
      {recorded.duplicate
        ? `Already recorded as ${recorded.number}: nothing was charged twice.`
        : `${recorded.number} recorded · ${formatCedis(recorded.total)}.`}
    </span>
    {change === null || recorded.duplicate ? null : (
      <span className="text-ink">
        Change{" "}
        <span className="tabular text-lg font-semibold">
          {formatCedis(change)}
        </span>
      </span>
    )}
    <Link className="ml-auto underline" href={`/sales/${recorded.id}`}>
      Receipt
    </Link>
  </output>
);

/** How the customer pays, and the cash field as typed. */
interface Payment {
  readonly method: PaymentMethod;
  readonly received: string;
}

const FRESH_PAYMENT: Payment = { method: "cash", received: "" };

/**
 * The till. Scan to fill the basket, pick how the customer pays, charge.
 * Each sale gets an id from the till the first time it's charged and keeps it
 * until it succeeds, so a retry after a dropped connection can't double-charge.
 */
export const TillForm = ({
  cashierId,
  stores,
  defaultStoreId,
  receiptFooter,
}: TillFormProps) => {
  const till = useTillData();
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [basket, setBasket] = useState<readonly BasketLine[]>([]);
  const [payment, setPayment] = useState<Payment>(FRESH_PAYMENT);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<RecordedSale | null>(null);
  const [pending, startTransition] = useTransition();
  const [bump, setBump] = useState<Bump | null>(null);
  const clientRef = useRef<string | null>(null);
  const scanArea = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const shelf = useBasketShelf(
    storeId,
    basket.map((line) => line.product.id)
  );

  const lines = withShelf(basket, shelf, storeId);
  const summary = totals(lines);

  // Scans are looked up in the browser's copy of the catalogue: no round trip.
  const lookup = (text: string) =>
    lookupTillProducts(text, till.products.toArray, till.stockLevels.toArray);

  const tender =
    payment.method === "cash"
      ? readTender(payment.received, summary.total)
      : NO_TENDER;

  const storeName = stores.find((store) => store.id === storeId)?.name ?? "";

  // Charge without leaving the scan box. It takes a modifier, so a barcode
  // scanner (plain characters and Enter) can never set it off.
  useShortcut(
    CHARGE_SHORTCUT,
    () => {
      form.current?.requestSubmit();
    },
    {
      allowInInput: true,
      description: "Charge the sale",
      when: () => canCharge(summary.total, pending),
    }
  );

  /** Scanning the same product again adds one more. */
  const addProduct = (product: PickedProduct) => {
    if (lines.some((line) => line.product.id === product.id)) {
      setBump((previous) => ({
        count: (previous?.count ?? 0) + 1,
        productId: product.id,
      }));
    }

    setBasket((current) => {
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
    setBasket((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line
      )
    );
  };

  const remove = (productId: number) => {
    setBasket((current) =>
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

    const change = changeDue(tender);

    startTransition(async () => {
      let reply: TillSaleReply;

      try {
        // The sale shows in "Your sales today" and the shelf counts drop at
        // once; both roll back if Tally refuses it or can't be reached.
        reply = await till.charge({
          branchId: storeId,
          cashierId,
          clientRef: ref,
          expectedTotal: summary.total,
          lines: lines.map((line) => ({
            productId: line.product.id,
            quantity: wholeNumber(line.quantity) ?? 0,
          })),
          paymentMethod: payment.method,
        });
      } catch (error_) {
        if (!(error_ instanceof TillHttpError)) {
          throw error_;
        }

        setError(error_.message);

        return;
      }

      clientRef.current = null;
      setLastSale({ change, recorded: recordedFrom(reply) });
      setBasket([]);
      setPayment(FRESH_PAYMENT);
      setError(null);
      // Ready for the next customer's first scan. Not the store picker's
      // hidden input, which comes first for anyone with more than one store.
      scanArea.current
        ?.querySelector<HTMLInputElement>("input:not([aria-hidden])")
        ?.focus();
    });
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={onSubmit} ref={form}>
      {lastSale === null ? null : <LastSale sale={lastSale} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <Frame>
          <FramePanel flush>
            <div className="border-line grid gap-4 border-b p-4" ref={scanArea}>
              {stores.length > 1 ? (
                <Field>
                  <FieldLabel>Till at</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      setStoreId(value ?? "");
                    }}
                    options={namedOptions(stores)}
                    value={storeId}
                  />
                </Field>
              ) : null}
              <ProductPicker
                autoFocus
                label="Scan items"
                lookup={lookup}
                onPick={addProduct}
              />
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
                        flash={
                          bump?.productId === line.product.id ? bump.count : 0
                        }
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

        <TillCheckout
          error={error}
          footer={receiptFooter}
          lines={lines}
          onPaymentMethod={(method) => {
            setPayment((current) => ({ ...current, method }));
          }}
          onReceived={(received) => {
            setPayment((current) => ({ ...current, received }));
          }}
          paymentMethod={payment.method}
          pending={pending}
          received={payment.received}
          storeName={storeName}
          tender={tender}
          total={summary.total}
          units={summary.units}
        />
      </div>

      <TillToday storeId={storeId} />
    </form>
  );
};
