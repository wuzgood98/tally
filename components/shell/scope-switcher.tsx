"use client";

import { Store } from "lucide-react";

import { setScope } from "@/app/(app)/scope-action";
import type { BranchSummary } from "@/lib/scope";

interface ScopeSwitcherProps {
  readonly stores: readonly BranchSummary[];
  readonly warehouses: readonly BranchSummary[];
  readonly value: string;
  readonly homeBranchId: string | null;
}

const BranchOptions = ({
  branches,
  homeBranchId,
}: {
  readonly branches: readonly BranchSummary[];
  readonly homeBranchId: string | null;
}) =>
  branches.map((item) => (
    <option key={item.id} value={item.id}>
      {item.name}
      {item.id === homeBranchId ? " (yours)" : ""}
    </option>
  ));

/** Which branch every screen shows. Choosing one saves it and reloads the data. */
export const ScopeSwitcher = ({
  stores,
  warehouses,
  value,
  homeBranchId,
}: ScopeSwitcherProps) => (
  <form action={setScope} className="flex items-center gap-2">
    <label className="sr-only" htmlFor="scope">
      Show stock for
    </label>
    <Store aria-hidden="true" className="text-ink-3 size-4 shrink-0" />
    <select
      className="field h-8 w-auto min-w-44 text-sm font-medium"
      defaultValue={value}
      id="scope"
      name="scope"
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit();
      }}
    >
      <option value="all">All branches</option>
      <optgroup label="Stores">
        <BranchOptions branches={stores} homeBranchId={homeBranchId} />
      </optgroup>
      <optgroup label="Warehouse">
        <BranchOptions branches={warehouses} homeBranchId={homeBranchId} />
      </optgroup>
    </select>
    <noscript>
      <button className="text-brand text-sm font-medium" type="submit">
        Show
      </button>
    </noscript>
  </form>
);
