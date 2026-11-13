"use client";

import { useActionState } from "react";

import { saveStockSettings } from "@/app/(app)/products/actions";
import type { SettingsState } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface StockSettingsFormProps {
  readonly productId: number;
  readonly branchId: string;
  readonly branchName: string;
  readonly defaultReorderPoint: number;
  readonly reorderOverride: number | null;
  readonly binLocation: string | null;
}

export const StockSettingsForm = ({
  productId,
  branchId,
  branchName,
  defaultReorderPoint,
  reorderOverride,
  binLocation,
}: StockSettingsFormProps) => {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveStockSettings.bind(null, productId, branchId),
    { error: null, saved: false }
  );

  return (
    <form
      action={action}
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <Field>
        <FieldLabel>Reorder at {branchName}</FieldLabel>
        <Input
          format="number"
          defaultValue={reorderOverride === null ? "" : String(reorderOverride)}
          inputMode="numeric"
          name="reorderPoint"
          placeholder={`${defaultReorderPoint} (company default)`}
        />
      </Field>
      <Field>
        <FieldLabel>Shelf location</FieldLabel>
        <Input
          autoCapitalize="characters"
          format="sku"
          defaultValue={binLocation ?? ""}
          maxLength={20}
          name="binLocation"
          placeholder="e.g. A3-12-2"
          spellCheck={false}
        />
      </Field>
      <Button size="md" disabled={pending} type="submit" variant="outline">
        {pending ? "Saving…" : "Save"}
      </Button>
      <output
        aria-live="polite"
        className={
          state.error === null
            ? "text-good text-sm sm:col-span-3"
            : "text-danger text-sm sm:col-span-3"
        }
      >
        {state.error ?? (state.saved ? "Saved." : "")}
      </output>
    </form>
  );
};
