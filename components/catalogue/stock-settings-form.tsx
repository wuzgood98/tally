"use client";

import { toast } from "@ui-sdk/react/toast";
import { useActionState } from "react";

import { saveStockSettings } from "@/app/(app)/products/actions";
import type { SettingsState } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PendingLabel } from "@/components/ui/spinner";

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
    async (previous, form) => {
      const next = await saveStockSettings(productId, branchId, previous, form);

      if (next.saved) {
        toast.success(`Saved for ${branchName}`);
      }

      return next;
    },
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
        <PendingLabel label="Saving…" pending={pending}>
          Save
        </PendingLabel>
      </Button>
      <output
        aria-live="polite"
        className="text-danger text-sm empty:hidden sm:col-span-3"
      >
        {state.error}
      </output>
    </form>
  );
};
