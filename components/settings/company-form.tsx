"use client";

import { toast } from "@ui-sdk/react/toast";
import { useState } from "react";

import { saveCompanySettings } from "@/app/(app)/settings/actions";
import { ReceiptFooter } from "@/components/sales/receipt-footer";
import { useSettingsForm } from "@/components/settings/use-settings-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame";
import { Input, Textarea } from "@/components/ui/input";
import { PendingLabel } from "@/components/ui/spinner";
import { NAME_MAX_LENGTH, RECEIPT_FOOTER_MAX } from "@/lib/limits";
import { submitWithoutReset } from "@/lib/submit-without-reset";

/** A made-up sale, so the preview reads like a real receipt. */
const SAMPLE_LINES = [
  { amount: "420.00", name: "Long grain perfumed rice 25 kg" },
  { amount: "276.00", name: "Frytol cooking oil 5 L × 2" },
  { amount: "56.50", name: "Milo 400 g tin" },
] as const;

interface CompanyFormProps {
  readonly companyName: string;
  readonly defaultReorderPoint: number;
  readonly receiptFooter: string | null;
  /** "Efua Asante on 15 Nov 2026", or null if nobody has saved yet. */
  readonly lastSaved: string | null;
  /** A store's name for the preview's heading, as the till prints it. */
  readonly storeName: string;
}

/**
 * The receipt as the till prints it (`TillCheckout`): the same heading, a
 * made-up sale, and the footer updating as head office types.
 */
const ReceiptPreview = ({
  storeName,
  footer,
  highlight,
}: {
  readonly storeName: string;
  readonly footer: string;
  readonly highlight: boolean;
}) => (
  <figure className="drop-shadow-receipt mx-auto w-full max-w-79 motion-reduce:rotate-0 lg:mt-1.5 lg:rotate-[1.2deg]">
    <div className="label-paper label-tear figures grid gap-2.5 px-4.5 pt-6.5 pb-4.5 text-xs">
      <div className="text-ink-3 text-2xs flex justify-between gap-2.5 tracking-widest uppercase">
        <span className="truncate">{storeName} · Till</span>
        <span className="shrink-0">New sale</span>
      </div>
      <ul className="border-line-strong grid gap-0.75 border-y border-dashed py-2.5">
        {SAMPLE_LINES.map((line) => (
          <li className="flex justify-between gap-2.5" key={line.name}>
            <span className="truncate">{line.name}</span>
            <span className="shrink-0">{line.amount}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between">
        <span className="text-ink-3 text-2xs tracking-widest uppercase">
          Total
        </span>
        <b className="font-sans text-xl font-semibold tracking-tight">
          GH₵752.50
        </b>
      </div>
      {footer.trim() === "" ? (
        <p className="border-line-strong text-ink-3 border-t border-dashed pt-3 text-center">
          No footer. The receipt ends at the total.
        </p>
      ) : (
        <ReceiptFooter
          className={
            highlight
              ? "bg-brand-soft transition-colors duration-150"
              : "transition-colors duration-150"
          }
          text={footer}
        />
      )}
    </div>
    <figcaption className="sr-only">
      Preview of a receipt with this footer
    </figcaption>
  </figure>
);

const toastCompanySaved = () => {
  toast.success("Company settings saved", {
    description: "New receipts and new products use them now.",
  });
};

/**
 * Company (head office): the name, where new products' reorder points start,
 * and the receipt footer, beside a receipt that prints what you type.
 */
export const CompanyForm = (props: CompanyFormProps) => {
  // What's typed once they start; until then what's saved.
  const [typedFooter, setTypedFooter] = useState<string | null>(null);
  const [footerFocused, setFooterFocused] = useState(false);
  const footer = typedFooter ?? props.receiptFooter ?? "";

  const [state, action, pending] = useSettingsForm(
    saveCompanySettings,
    toastCompanySaved
  );

  const invalid = state.error === null ? undefined : true;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19.75rem] lg:gap-9">
      <form action={action} noValidate onSubmit={submitWithoutReset(action)}>
        <Frame>
          <FramePanel>
            <div className="grid gap-5">
              <Field>
                <FieldLabel>Company name</FieldLabel>
                <Input
                  autoComplete="organization"
                  defaultValue={props.companyName}
                  maxLength={NAME_MAX_LENGTH}
                  name="companyName"
                  placeholder="e.g. Akwaaba Mall"
                  required
                />
                <FieldDescription>
                  In the sidebar, on the sign-in label and on purchase orders.
                  Receipts carry the store&apos;s name.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Default reorder point for new products</FieldLabel>
                <Input
                  className="max-w-32"
                  defaultValue={String(props.defaultReorderPoint)}
                  format="number"
                  inputMode="numeric"
                  min={0}
                  name="defaultReorderPoint"
                  placeholder="e.g. 10"
                  required
                  type="number"
                />
                <FieldDescription>
                  A new product counts as running low at this many units until
                  you set its own. Products you already have keep theirs.
                </FieldDescription>
              </Field>
              <Field>
                <div className="flex items-baseline justify-between gap-3">
                  <FieldLabel>Receipt footer</FieldLabel>
                  <span
                    aria-hidden="true"
                    className="figures text-ink-3 text-xs"
                  >
                    {footer.length} / {RECEIPT_FOOTER_MAX}
                  </span>
                </div>
                <Textarea
                  defaultValue={props.receiptFooter ?? ""}
                  maxLength={RECEIPT_FOOTER_MAX}
                  name="receiptFooter"
                  onBlur={() => {
                    setFooterFocused(false);
                  }}
                  onChange={(event) => {
                    setTypedFooter(event.target.value);
                  }}
                  onFocus={() => {
                    setFooterFocused(true);
                  }}
                  placeholder="e.g. Thank you for shopping with us!"
                  rows={3}
                />
                <FieldDescription>
                  Printed under the total on every receipt. Up to{" "}
                  {RECEIPT_FOOTER_MAX} characters; leave it empty for none.
                </FieldDescription>
              </Field>
            </div>
          </FramePanel>
          <FrameFooter>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-3 text-xs">
                {props.lastSaved === null
                  ? "Not saved yet. These are the defaults."
                  : `Last saved by ${props.lastSaved}.`}
              </p>
              <Button
                data-pending={pending ? "" : undefined}
                disabled={pending}
                size="md"
                type="submit"
              >
                <PendingLabel label="Saving…" pending={pending}>
                  Save company
                </PendingLabel>
              </Button>
            </div>
          </FrameFooter>
          {invalid ? (
            <p className="text-danger px-3 pb-2 text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
        </Frame>
      </form>

      <ReceiptPreview
        footer={footer}
        highlight={footerFocused}
        storeName={props.storeName}
      />
    </div>
  );
};
