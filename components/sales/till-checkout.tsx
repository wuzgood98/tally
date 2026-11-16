"use client";

import { useShortcutHint } from "@ui-sdk/react/shortcuts";

import { ReceiptFooter } from "@/components/sales/receipt-footer";
import type { BasketLine } from "@/components/sales/till-line-row";
import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/choice";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import type { PaymentMethod } from "@/lib/db/schema";
import { formatCount } from "@/lib/format";
import { PESEWAS_PER_CEDI, formatCedis, pesewasToCashInput } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/stock/payment";
import { canCharge, quickCash } from "@/lib/stock/quick-cash";
import type { Tender } from "@/lib/stock/quick-cash";
import { cn } from "@/lib/utils";

/** Charges from anywhere on the till, the scan box included. */
export const CHARGE_SHORTCUT = "mod+enter";

interface TillCheckoutProps {
  readonly storeName: string;
  readonly lines: readonly BasketLine[];
  readonly total: number;
  readonly units: number;
  readonly paymentMethod: PaymentMethod;
  readonly onPaymentMethod: (method: PaymentMethod) => void;
  /** The cash field as typed. */
  readonly received: string;
  /** The cash field read against the total. */
  readonly tender: Tender;
  readonly onReceived: (received: string) => void;
  readonly pending: boolean;
  readonly error: string | null;
  /** Head office's receipt footer; null prints none. */
  readonly footer: string | null;
}

/** Change to hand back for cash, or what's still owed. */
const changeLine = (
  tender: Tender
): { readonly label: string; readonly amount: string } | null => {
  if (tender.kind === "none") {
    return null;
  }

  if (tender.kind === "invalid") {
    return { amount: "", label: "Enter the cash received in cedis." };
  }

  return {
    amount: formatCedis(tender.amount),
    label: tender.kind === "short" ? "Still to pay" : "Change",
  };
};

const ReceiptLines = ({ lines }: { readonly lines: readonly BasketLine[] }) => (
  <ul className="border-line-strong figures grid grid-cols-1 gap-1 border-y border-dashed py-3 text-xs">
    {lines.length === 0 ? (
      <li className="text-ink-3">Scan the first item.</li>
    ) : (
      lines.map((line) => {
        const quantity = wholeNumber(line.quantity);

        return (
          <li className="flex justify-between gap-3" key={line.product.id}>
            <span className="truncate">
              {quantity ?? "?"} {line.product.name}
            </span>
            <span className="shrink-0">
              {quantity === null
                ? "—"
                : formatCedis(quantity * line.product.sellPrice)}
            </span>
          </li>
        );
      })
    )}
  </ul>
);

interface QuickCashProps {
  readonly total: number;
  readonly tender: Tender;
  readonly onReceived: (received: string) => void;
}

/** One press fills the cash field: the exact total or a round amount above it. */
const QuickCash = ({ total, tender, onReceived }: QuickCashProps) => {
  const tendered =
    tender.kind === "short" || tender.kind === "change"
      ? tender.tendered
      : null;

  const options = [
    { label: "Exact", value: total },
    ...quickCash(total).map((value) => ({
      label: formatCount(value / PESEWAS_PER_CEDI),
      value,
    })),
  ];

  return (
    <fieldset className="grid grid-cols-4 gap-1.5">
      <legend className="sr-only">Quick cash</legend>
      {options.map((option) => (
        <Button
          aria-pressed={tendered === option.value}
          disabled={total === 0}
          key={option.label}
          onClick={() => {
            onReceived(pesewasToCashInput(option.value));
          }}
          size="md"
          variant="paper"
        >
          {option.label}
        </Button>
      ))}
    </fieldset>
  );
};

/**
 * The checkout as a printed receipt: the basket prints onto it as you scan
 * (without motion: scans come hundreds of times a day), then the total, how
 * the customer pays, and the button that rings it up.
 */
export const TillCheckout = ({
  storeName,
  lines,
  total,
  units,
  paymentMethod,
  onPaymentMethod,
  received,
  tender,
  onReceived,
  pending,
  error,
  footer,
}: TillCheckoutProps) => {
  const charge = useShortcutHint(CHARGE_SHORTCUT);
  const change = paymentMethod === "cash" ? changeLine(tender) : null;

  return (
    // The shadow is a filter on a wrapper, so it follows the torn edge.
    <div className="drop-shadow-receipt lg:sticky lg:top-20">
      <section
        aria-label="Receipt"
        className="label-paper label-tear grid grid-cols-1 gap-4 px-5 pt-7 pb-5"
      >
        <div className="figures text-ink-3 text-2xs flex justify-between gap-3 tracking-widest uppercase">
          <span className="truncate">{storeName} · Till</span>
          <span className="shrink-0">New sale</span>
        </div>

        <ReceiptLines lines={lines} />

        <div className="flex items-baseline justify-between gap-3">
          <p className="figures text-ink-3 text-2xs tracking-widest uppercase">
            Total · {formatCount(units)} {units === 1 ? "item" : "items"}
          </p>
          <p className="tabular text-3xl font-semibold tracking-tight">
            {formatCedis(total)}
          </p>
        </div>

        <Field layout="group">
          <FieldLabel className="sr-only">Payment</FieldLabel>
          <RadioGroup
            columns={3}
            name="paymentMethod"
            onValueChange={(value) => {
              const picked = PAYMENT_METHODS.find((method) => method === value);

              if (picked !== undefined) {
                onPaymentMethod(picked);
              }
            }}
            value={paymentMethod}
          >
            {PAYMENT_METHODS.map((method) => (
              <label
                className="border-line-strong has-data-checked:border-ink has-data-checked:bg-ink has-data-checked:text-paper has-focus-visible:ring-brand/40 relative grid cursor-pointer place-items-center rounded-sm border px-2 py-2 text-center text-sm font-medium has-focus-visible:ring-3"
                key={method}
              >
                <Radio bare value={method} />
                {PAYMENT_LABELS[method]}
              </label>
            ))}
          </RadioGroup>
        </Field>

        {paymentMethod === "cash" ? (
          <div className="grid gap-2">
            <QuickCash onReceived={onReceived} tender={tender} total={total} />
            <Field layout="rule">
              <FieldLabel tone="caption">Cash received</FieldLabel>
              <Input
                autoComplete="off"
                format="amount"
                inputMode="decimal"
                look="line"
                onChange={(event) => {
                  onReceived(event.target.value);
                }}
                placeholder="optional"
                value={received}
              />
            </Field>
            <output
              aria-live="polite"
              className="border-line-strong figures flex min-h-9 items-baseline justify-between border-t border-dashed pt-2 text-sm empty:border-0"
            >
              {change === null ? null : (
                <>
                  <span>{change.label}</span>
                  <span className="font-semibold">{change.amount}</span>
                </>
              )}
            </output>
          </div>
        ) : null}

        <output aria-live="polite" className="text-danger text-sm empty:hidden">
          {error}
        </output>

        <Button
          aria-keyshortcuts={charge.ariaKeyshortcuts}
          className="justify-between"
          disabled={!canCharge(total, pending)}
          size="till"
          type="submit"
          variant="ink"
        >
          {pending ? "Recording…" : `Charge ${formatCedis(total)}`}
          <Kbd
            aria-hidden="true"
            className={cn("pointer-coarse:hidden", pending && "invisible")}
            inverse
          >
            {charge.text}
          </Kbd>
        </Button>

        {footer === null ? null : <ReceiptFooter text={footer} />}
      </section>
    </div>
  );
};
