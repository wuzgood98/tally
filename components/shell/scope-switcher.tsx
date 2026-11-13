"use client";

import { Store } from "lucide-react";
import { useTransition } from "react";

import { setScope } from "@/app/(app)/scope-action";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import type { BranchSummary } from "@/lib/scope";

interface ScopeSwitcherProps {
  readonly stores: readonly BranchSummary[];
  readonly warehouses: readonly BranchSummary[];
  readonly value: string;
  readonly homeBranchId: string | null;
}

const branchOptions = (
  branches: readonly BranchSummary[],
  homeBranchId: string | null
): SelectOption[] =>
  branches.map((item) => ({
    label: item.id === homeBranchId ? `${item.name} (yours)` : item.name,
    value: item.id,
  }));

/** Which branch every screen shows. Choosing one saves it and reloads the data. */
export const ScopeSwitcher = ({
  stores,
  warehouses,
  value,
  homeBranchId,
}: ScopeSwitcherProps) => {
  const [, startTransition] = useTransition();

  return (
    // min-w-0 lets the switcher shrink on a phone: a long branch name such as
    // "Tema Distribution Centre (yours)" must not push sign-out off the screen.
    <div className="flex min-w-0 items-center gap-2">
      <Store aria-hidden="true" className="text-ink-3 size-4 shrink-0" />
      <Select
        aria-label="Show stock for"
        className="w-auto max-w-full min-w-0 sm:min-w-44"
        size="sm"
        defaultValue={value}
        onValueChange={(next) => {
          if (next === null) {
            return;
          }

          const formData = new FormData();
          formData.set("scope", next);
          startTransition(async () => {
            await setScope(formData);
          });
        }}
        options={[
          { label: "All branches", value: "all" },
          { label: "Stores", options: branchOptions(stores, homeBranchId) },
          {
            label: "Warehouse",
            options: branchOptions(warehouses, homeBranchId),
          },
        ]}
      />
    </div>
  );
};
