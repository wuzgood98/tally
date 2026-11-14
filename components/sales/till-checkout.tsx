"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/choice";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/lib/db/schema";
import { formatCount } from "@/lib/format";
import { formatCedis, parseCedis } from "@/lib/money";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/stock/payment";

interface TillCheckoutProps {
  readonly total: number;
  readonly units: number;
  readonly paymentMethod: PaymentMethod;
  readonly onPaymentMethod: (method: PaymentMethod) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

/** Change to hand back for cash, or why there's none to show yet. */
const changeText = (received: string, total: number): string | null => {
  if (received.trim() === "") {
    return null;
  }

  const tendered = parseCedis(received);

  if (tendered === null) {
    return "Enter the cash received in cedis.";
  }

  return tendered < total
    ? `${formatCedis(total - tendered)} still to pay`
    : `Change: ${formatCedis(tendered - total)}`;
};

/** The total, how the customer pays, and the button that rings it up. */
export const TillCheckout = ({
  total,
  units,
  paymentMethod,
  onPaymentMethod,
  pending,
  error,
}: TillCheckoutProps) => {
  const id = useId();
  const [received, setReceived] = useState("");
  const change = paymentMethod === "cash" ? changeText(received, total) : null;

  return (
    <Frame className="lg:sticky lg:top-20">
      <FramePanel>
        <div className="grid content-start gap-4">
          <div>
            <p className="text-ink-2 text-sm">
              Total · {formatCount(units)} {units === 1 ? "item" : "items"}
            </p>
            <p className="tabular text-3xl font-semibold tracking-tight">
              {formatCedis(total)}
            </p>
          </div>

          <Field layout="group">
            <FieldLabel className="mb-2">Payment</FieldLabel>
            <RadioGroup
              columns={3}
              name="paymentMethod"
              onValueChange={(value) => {
                const picked = PAYMENT_METHODS.find(
                  (method) => method === value
                );

                if (picked !== undefined) {
                  onPaymentMethod(picked);
                }
              }}
              value={paymentMethod}
            >
              {PAYMENT_METHODS.map((method) => (
                <label
                  className="border-line has-data-checked:border-brand has-data-checked:bg-brand-soft has-focus-visible:ring-brand/40 relative grid cursor-pointer place-items-center rounded-lg border px-2 py-2 text-center text-sm font-medium has-focus-visible:ring-3"
                  key={method}
                >
                  <Radio bare value={method} />
                  {PAYMENT_LABELS[method]}
                </label>
              ))}
            </RadioGroup>
          </Field>

          {paymentMethod === "cash" ? (
            <Field>
              <FieldLabel>
                Cash received (GH₵){" "}
                <span className="text-ink-3 font-normal">(optional)</span>
              </FieldLabel>
              <Input
                autoComplete="off"
                format="amount"
                id={`${id}-cash`}
                inputMode="decimal"
                onChange={(event) => {
                  setReceived(event.target.value);
                }}
                value={received}
              />
              <output
                className="tabular text-sm font-medium"
                htmlFor={`${id}-cash`}
              >
                {change}
              </output>
            </Field>
          ) : null}

          <output
            aria-live="polite"
            className="text-danger text-sm empty:hidden"
          >
            {error}
          </output>

          <Button disabled={pending || total === 0} size="md" type="submit">
            {pending ? "Recording…" : `Charge ${formatCedis(total)}`}
          </Button>
        </div>
      </FramePanel>
    </Frame>
  );
};
