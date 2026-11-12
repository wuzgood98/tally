"use client";

import { useActionState } from "react";

import { saveStockSettings } from "@/app/(app)/products/actions";
import type { SettingsState } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";

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
      <label className="grid gap-1.5 text-sm font-medium">
        Reorder at {branchName}
        <input
          className="field tabular"
          defaultValue={reorderOverride ?? ""}
          inputMode="numeric"
          name="reorderPoint"
          placeholder={`${defaultReorderPoint} (company default)`}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Shelf location
        <input
          autoCapitalize="characters"
          className="field font-mono uppercase"
          defaultValue={binLocation ?? ""}
          maxLength={20}
          name="binLocation"
          placeholder="e.g. A3-12-2"
          spellCheck={false}
        />
      </label>
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
