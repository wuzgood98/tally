"use client";

import { X } from "lucide-react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import type { AdjustmentReason } from "@/lib/db/schema";
import { formatCount, formatSigned } from "@/lib/format";
import { REASON_DIRECTION, REASON_LABELS } from "@/lib/stock/reasons";
import { cn } from "@/lib/utils";

export type ChangeReason = Exclude<AdjustmentReason, "count_correction">;

export type Mode = "change" | "count";

const REASON_HELP: Record<ChangeReason, string> = {
  damaged: "Broken, crushed or spoiled; can't be sold.",
  expired: "Past its date; taken off the shelf.",
  found: "Turned up after being written off.",
  internal_use: "Used by the shop itself, not sold.",
  theft: "Missing, with no other explanation.",
};

/** The product being adjusted, with what's on hand at the chosen branch. */
export const ChosenProduct = ({
  product,
  stockHere,
  onClear,
}: {
  readonly product: PickedProduct;
  readonly stockHere: number;
  readonly onClear: () => void;
}) => (
  <div className="border-line bg-paper flex items-start justify-between gap-3 rounded-lg border p-3">
    <div>
      <p className="font-medium">{product.name}</p>
      <p className="text-ink-3 font-mono text-xs">
        {product.sku}
        {product.barcode === null ? "" : ` · ${product.barcode}`}
      </p>
      <p className="text-ink-2 mt-1 text-sm">
        On hand here:{" "}
        <span className="tabular text-ink font-semibold">
          {formatCount(stockHere)}
        </span>
      </p>
    </div>
    <button
      className="press text-ink-2 hover:text-ink hover:bg-surface-2 flex items-center gap-1 rounded-md px-2 py-1 text-sm"
      onClick={onClear}
      type="button"
    >
      <X aria-hidden="true" className="size-4" />
      Change
    </button>
  </div>
);

const MODES = [
  ["change", "Write off or return"],
  ["count", "Record a count"],
] as const;

/** Segmented choice between a reasoned change and a shelf count. */
export const ModeToggle = ({
  mode,
  canCount,
  onChange,
}: {
  readonly mode: Mode;
  readonly canCount: boolean;
  readonly onChange: (mode: Mode) => void;
}) => (
  <div className="grid gap-2">
    <div className="bg-surface-2 grid grid-cols-2 gap-1 rounded-lg p-1">
      {MODES.map(([option, label]) => {
        const disabled = option === "count" && !canCount;

        return (
          <label
            className={cn(
              "press flex cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium has-focus-visible:outline-2",
              mode === option ? "bg-surface shadow-sm" : "text-ink-2",
              disabled && "cursor-not-allowed opacity-50"
            )}
            key={option}
          >
            <input
              checked={mode === option}
              className="sr-only"
              disabled={disabled}
              name="mode"
              onChange={() => {
                onChange(option);
              }}
              type="radio"
              value={option}
            />
            {label}
          </label>
        );
      })}
    </div>
    {canCount ? null : (
      <p className="text-ink-2 text-xs">
        Counts are recorded by a branch manager.
      </p>
    )}
  </div>
);

export const ReasonPicker = ({
  reasons,
  value,
  onChange,
}: {
  readonly reasons: readonly ChangeReason[];
  readonly value: ChangeReason | "";
  readonly onChange: (reason: ChangeReason) => void;
}) => (
  <fieldset className="grid gap-2">
    <legend className="mb-2 text-sm font-medium">Reason</legend>
    {reasons.map((reason) => (
      <label
        className="border-line hover:border-line-strong has-checked:border-brand has-checked:bg-brand-soft/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
        key={reason}
      >
        <input
          checked={value === reason}
          className="accent-brand mt-1"
          name="reason"
          onChange={() => {
            onChange(reason);
          }}
          type="radio"
          value={reason}
        />
        <span>
          <span className="text-sm font-medium">
            {REASON_LABELS[reason]}{" "}
            <span className="text-ink-3 font-normal">
              (
              {REASON_DIRECTION[reason] === "out"
                ? "takes stock out"
                : "puts stock back"}
              )
            </span>
          </span>
          <span className="text-ink-2 block text-xs">
            {REASON_HELP[reason]}
          </span>
        </span>
      </label>
    ))}
  </fieldset>
);

/** "Stock goes from 12 to 9 (−3)", or nothing until there's enough to say. */
export const BalancePreview = ({
  before,
  after,
}: {
  readonly before: number;
  readonly after: number | null;
}) => {
  if (after === null) {
    return null;
  }

  return (
    <p className={after < 0 ? "text-danger" : "text-ink-2"}>
      Stock goes from{" "}
      <span className="tabular text-ink font-semibold">
        {formatCount(before)}
      </span>{" "}
      to{" "}
      <span className="tabular text-ink font-semibold">
        {formatCount(after)}
      </span>
      {after === before ? null : (
        <span className="tabular"> ({formatSigned(after - before)})</span>
      )}
    </p>
  );
};
