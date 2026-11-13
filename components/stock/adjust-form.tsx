"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { adjustAction } from "@/app/(app)/adjustments/actions";
import type { AdjustState } from "@/app/(app)/adjustments/actions";
import type { PickedProduct } from "@/app/(app)/lookup-action";
import {
  BalancePreview,
  ChosenProduct,
  ModeToggle,
  ReasonPicker,
} from "@/components/stock/adjust-parts";
import type { ChangeReason, Mode } from "@/components/stock/adjust-parts";
import { ProductPicker } from "@/components/stock/product-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import { formatCount } from "@/lib/format";
import { wholeNumber } from "@/lib/numbers";
import { NOTE_REQUIRED, REASON_DIRECTION } from "@/lib/stock/reasons";

export interface BranchRules {
  readonly id: string;
  readonly name: string;
  /** Reasons this person may record here. */
  readonly reasons: readonly ChangeReason[];
  readonly canCount: boolean;
}

interface AdjustFormProps {
  readonly branches: readonly BranchRules[];
  readonly defaultBranchId: string;
  readonly initialProduct: PickedProduct | null;
}

interface Draft {
  readonly mode: Mode;
  readonly reason: ChangeReason | "";
  readonly amount: number | null;
  readonly note: string;
  readonly onHand: number;
}

/** The balance after saving, or null while the form is incomplete. */
const balanceAfter = ({
  mode,
  reason,
  amount,
  onHand,
}: Draft): number | null => {
  if (amount === null) {
    return null;
  }

  if (mode === "count") {
    return amount;
  }

  if (reason === "") {
    return null;
  }

  return REASON_DIRECTION[reason] === "out" ? onHand - amount : onHand + amount;
};

/** What's wrong with the draft, in words, or null when it can be saved. */
const problemWith = (
  draft: Draft,
  product: PickedProduct | null
): string | null => {
  if (product === null) {
    return "Scan or find the product first.";
  }

  if (draft.mode === "change" && draft.reason === "") {
    return "Choose a reason.";
  }

  if (
    draft.amount === null ||
    (draft.mode === "change" && draft.amount === 0)
  ) {
    return draft.mode === "count"
      ? "Enter the number you counted."
      : "Enter how many units.";
  }

  const after = balanceAfter(draft);

  if (after !== null && after < 0) {
    return `Only ${formatCount(draft.onHand)} on hand: you can't take out ${formatCount(draft.amount)}.`;
  }

  if (
    draft.mode === "change" &&
    draft.reason !== "" &&
    NOTE_REQUIRED.has(draft.reason) &&
    draft.note.trim() === ""
  ) {
    return "Add a note explaining what happened.";
  }

  return null;
};

const submit = async (
  draft: Draft,
  branchId: string,
  productId: number
): Promise<AdjustState> => {
  const base = { branchId, note: draft.note, productId };

  if (draft.mode === "count" || draft.reason === "") {
    return await adjustAction({
      ...base,
      counted: draft.amount ?? 0,
      mode: "count",
    });
  }

  return await adjustAction({
    ...base,
    mode: "change",
    quantity: draft.amount ?? 0,
    reason: draft.reason,
  });
};

export const AdjustForm = ({
  branches,
  defaultBranchId,
  initialProduct,
}: AdjustFormProps) => {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [product, setProduct] = useState<PickedProduct | null>(initialProduct);
  const [mode, setMode] = useState<Mode>("change");
  const [reason, setReason] = useState<ChangeReason | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rules =
    branches.find((branch) => branch.id === branchId) ?? branches[0];

  const canCount = rules?.canCount;
  const reasons = rules?.reasons ?? [];

  const draft: Draft = {
    amount: wholeNumber(amount),
    mode: mode === "count" && !canCount ? "change" : mode,
    note,
    onHand: product?.onHand[branchId] ?? 0,
    reason: reason !== "" && reasons.includes(reason) ? reason : "",
  };

  const noteRequired =
    draft.mode === "change" &&
    draft.reason !== "" &&
    NOTE_REQUIRED.has(draft.reason);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = problemWith(draft, product);

    if (problem !== null || product === null) {
      setError(problem);

      return;
    }

    startTransition(async () => {
      const result = await submit(draft, branchId, product.id);
      setError(result.error);
    });
  };

  return (
    <form className="grid max-w-2xl gap-6" onSubmit={onSubmit}>
      <div className="border-line bg-surface grid gap-4 rounded-xl border p-4">
        <Field>
          <FieldLabel>Branch</FieldLabel>
          <Select
            disabled={branches.length === 1}
            onValueChange={(value) => {
              setBranchId(value ?? "");
            }}
            options={namedOptions(branches)}
            value={branchId}
          />
        </Field>
        {product === null ? (
          <ProductPicker autoFocus label="Product" onPick={setProduct} />
        ) : (
          <ChosenProduct
            onClear={() => {
              setProduct(null);
            }}
            stockHere={draft.onHand}
            product={product}
          />
        )}
      </div>

      <div className="border-line bg-surface grid gap-4 rounded-xl border p-4">
        <ModeToggle canCount={canCount} mode={draft.mode} onChange={setMode} />
        {draft.mode === "change" ? (
          <ReasonPicker
            onChange={setReason}
            reasons={reasons}
            value={draft.reason}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>
              {draft.mode === "count" ? "Counted on the shelf" : "Units"}
            </FieldLabel>
            <Input
              format="number"
              inputMode="numeric"
              onChange={(event) => {
                setAmount(event.target.value);
              }}
              value={amount}
            />
          </Field>
          <div aria-live="polite" className="flex items-end pb-2 text-sm">
            {product === null ? null : (
              <BalancePreview
                after={balanceAfter(draft)}
                before={draft.onHand}
              />
            )}
          </div>
        </div>

        <Field>
          <FieldLabel>
            <span>
              Note{" "}
              <span className="text-ink-3 font-normal">
                {noteRequired ? "(required)" : "(optional)"}
              </span>
            </span>
          </FieldLabel>
          <Textarea
            maxLength={500}
            onChange={(event) => {
              setNote(event.target.value);
            }}
            required={noteRequired}
            value={note}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} size="md" type="submit">
          {pending ? "Saving…" : "Save"}
        </Button>
        <output aria-live="polite" className="text-danger text-sm">
          {error}
        </output>
      </div>
    </form>
  );
};
