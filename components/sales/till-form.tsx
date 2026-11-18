"use client";

import { useShortcut } from "@ui-sdk/react/shortcuts";
import { ScanBarcode } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import type { ReactNode, Ref, SubmitEvent } from "react";

import { lookupProducts } from "@/app/(app)/lookup-action";
import type { PickedProduct } from "@/app/(app)/lookup-action";
import {
  CHARGE_SHORTCUT,
  TillCheckout,
} from "@/components/sales/till-checkout";
import { TillLineRow } from "@/components/sales/till-line-row";
import type { BasketLine } from "@/components/sales/till-line-row";
import { ProductPicker } from "@/components/stock/product-picker";
import { LastSale } from "@/components/till/last-sale";
import type { LastSaleFacts } from "@/components/till/last-sale";
import { TillAttention } from "@/components/till/till-attention";
import { useTillData } from "@/components/till/till-data-provider";
import { SyncLine, TillSyncStatus } from "@/components/till/till-sync-status";
import {
  TODAY_RECENT,
  TillToday,
  TodayPanel,
} from "@/components/till/till-today";
import { useBasketShelf } from "@/components/till/use-basket-shelf";
import type { ShelfFacts } from "@/components/till/use-basket-shelf";
import { EmptyNote } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Select } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import type { PaymentMethod } from "@/lib/db/schema";
import { wholeNumber } from "@/lib/numbers";
import {
  NO_TENDER,
  canCharge,
  changeDue,
  readTender,
} from "@/lib/stock/quick-cash";
import { ONLINE_LINE } from "@/lib/till/client/status-text";
import { chargeFailureMessage } from "@/lib/till/client/sync";
import type { ChargeOutcome } from "@/lib/till/client/sync";
import { lookupTillProducts } from "@/lib/till/lookup";
import type { TillSale } from "@/lib/till/schema";

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

/** How the customer pays, and the cash field as typed. */
interface Payment {
  readonly method: PaymentMethod;
  readonly received: string;
}

const FRESH_PAYMENT: Payment = { method: "cash", received: "" };

const SCAN_AREA = "border-line grid gap-4 border-b p-4";

const EmptyBasket = () => (
  <EmptyNote icon={ScanBarcode} title="The basket is empty">
    Scan the first item, or type a name or SKU.
  </EmptyNote>
);

/** The scan area and basket on the left, the receipt and checkout on the right. */
const TillColumns = ({
  scan,
  basket,
  checkout,
}: {
  readonly scan: ReactNode;
  readonly basket: ReactNode;
  readonly checkout: ReactNode;
}) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
    <Frame>
      <FramePanel flush>
        {scan}
        {basket}
      </FramePanel>
    </Frame>
    {checkout}
  </div>
);

/** The store a till is at, by name, for the receipt. */
const storeNameOf = (stores: readonly Option[], storeId: string): string =>
  stores.find((store) => store.id === storeId)?.name ?? "";

/** The store picker, for anyone with more than one store, above the scan box. */
const ScanArea = ({
  stores,
  storeId,
  onStore,
  ref,
  children,
}: {
  readonly stores: readonly Option[];
  readonly storeId: string;
  readonly onStore?: (storeId: string) => void;
  readonly ref?: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}) => (
  <div className={SCAN_AREA} ref={ref}>
    {stores.length > 1 ? (
      <Field>
        <FieldLabel>Till at</FieldLabel>
        <Select
          onValueChange={(value) => {
            onStore?.(value ?? "");
          }}
          options={namedOptions(stores)}
          placeholder="Choose a store"
          value={storeId}
        />
      </Field>
    ) : null}
    {children}
  </div>
);

const unusedInSample = (): void => {
  // The sample is only measured, never used.
};

/**
 * The till as it opens, with this person's sales today as the server saw
 * them: never seen, only measured by Skullet into the loading skeleton
 * (`TillDataProvider`), so the real till lands where its skeleton was.
 */
export const TillSample = ({
  stores,
  defaultStoreId,
  receiptFooter,
  salesToday,
}: Pick<TillFormProps, "stores" | "defaultStoreId" | "receiptFooter"> & {
  /** Today's sales by this person at `defaultStoreId`, newest first. */
  readonly salesToday: readonly TillSale[];
}) => (
  <div className="grid grid-cols-1 gap-6">
    <SyncLine line={ONLINE_LINE} />
    <TillColumns
      basket={<EmptyBasket />}
      checkout={
        <TillCheckout
          error={null}
          footer={receiptFooter}
          lines={[]}
          onPaymentMethod={unusedInSample}
          onReceived={unusedInSample}
          paymentMethod={FRESH_PAYMENT.method}
          pending={false}
          received=""
          storeName={storeNameOf(stores, defaultStoreId)}
          tender={NO_TENDER}
          total={0}
          units={0}
        />
      }
      scan={
        <ScanArea storeId={defaultStoreId} stores={stores}>
          <ProductPicker
            label="Scan items"
            lookup={lookupProducts}
            onPick={unusedInSample}
          />
        </ScanArea>
      }
    />
    <TodayPanel
      recent={salesToday.slice(0, TODAY_RECENT)}
      salesToday={salesToday.length}
      totalToday={salesToday.reduce((sum, sale) => sum + sale.total, 0)}
    />
  </div>
);

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
  const [lastSale, setLastSale] = useState<LastSaleFacts | null>(null);
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

  const storeName = storeNameOf(stores, storeId);

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
      let outcome: ChargeOutcome;

      try {
        // The sale shows in "Your sales today" and the shelf counts drop at
        // once. Without a connection it's saved on the till and sent later;
        // if Tally refuses it, both roll back and the basket stays.
        outcome = await till.sync.charge({
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
        const message =
          error_ instanceof Error ? chargeFailureMessage(error_) : null;

        if (message === null) {
          throw error_;
        }

        setError(message);

        return;
      }

      clientRef.current = null;
      setLastSale({ change, outcome, total: summary.total });
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
      <TillSyncStatus />
      <TillAttention />
      {lastSale === null ? null : <LastSale sale={lastSale} />}

      <TillColumns
        basket={
          lines.length === 0 ? (
            <EmptyBasket />
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
          )
        }
        checkout={
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
        }
        scan={
          <ScanArea
            onStore={setStoreId}
            ref={scanArea}
            storeId={storeId}
            stores={stores}
          >
            <ProductPicker
              autoFocus
              label="Scan items"
              lookup={lookup}
              onPick={addProduct}
            />
          </ScanArea>
        }
      />

      <TillToday storeId={storeId} />
    </form>
  );
};
