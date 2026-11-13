"use client";

import {
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandItemIcon,
  CommandPage,
} from "@ui-sdk/react/command";
import { Building2, Check, ChevronRight, Store, Warehouse } from "lucide-react";
import type { ReactNode } from "react";

import {
  ALL_BRANCHES,
  BRANCH_PAGE,
  branchKindLabel,
  pickValue,
  switchValue,
} from "@/lib/palette-branches";
import type { PaletteBranch } from "@/lib/palette-branches";

const itemClass =
  "text-ink-2 data-highlighted:bg-ink/6 data-highlighted:text-ink flex min-h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none data-pending:cursor-progress data-pending:opacity-60";

const iconClass = "text-ink-3 [&_svg]:size-4";

const labelClass = "text-ink-3 px-2.5 pt-2 pb-1 text-xs";

interface BranchProps {
  readonly branches: readonly PaletteBranch[];
  /** "all", or the id of the branch every screen shows. */
  readonly scope: string;
}

const nameOf = (branches: readonly PaletteBranch[], scope: string): string =>
  scope === ALL_BRANCHES
    ? "All branches"
    : (branches.find((item) => item.id === scope)?.name ?? scope);

const BranchIcon = ({ branch }: { readonly branch: PaletteBranch }) =>
  branch.kind === "warehouse" ? (
    <Warehouse aria-hidden="true" />
  ) : (
    <Store aria-hidden="true" />
  );

/**
 * "Switch branch…", which opens the branch page, and a "Switch to …" row
 * for every other branch once something is typed: before that, five stores
 * and a warehouse would bury everything else.
 */
export const BranchGroup = ({
  branches,
  scope,
  query,
}: BranchProps & { readonly query: string }) => (
  <CommandGroup className="pb-1">
    <CommandGroupLabel className={labelClass}>Branch</CommandGroupLabel>
    <CommandItem
      className={itemClass}
      keywords={["branch", "store", "warehouse", "scope", "show stock for"]}
      label="Switch branch"
      page={BRANCH_PAGE}
      value="branch:page"
    >
      <CommandItemIcon className={iconClass}>
        <Building2 aria-hidden="true" />
      </CommandItemIcon>
      <span className="grow truncate">Switch branch…</span>
      <span className="text-ink-3 shrink-0 truncate text-xs">
        {nameOf(branches, scope)}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="text-ink-3 size-4 shrink-0 rtl:-scale-x-100"
      />
    </CommandItem>
    {query.trim() === ""
      ? null
      : branches.map((item) =>
          item.id === scope ? null : (
            <CommandItem
              className={itemClass}
              key={item.id}
              keywords={[item.id, branchKindLabel(item)]}
              label={`Switch to ${item.name}`}
              value={switchValue(item.id)}
            >
              <CommandItemIcon className={iconClass}>
                <BranchIcon branch={item} />
              </CommandItemIcon>
              <span className="truncate">Switch to {item.name}</span>
            </CommandItem>
          )
        )}
  </CommandGroup>
);

interface PickRowProps {
  readonly current: boolean;
  readonly label: string;
  readonly hint: string;
  readonly icon: ReactNode;
  readonly value: string;
  readonly keywords: string[];
}

const PickRow = ({
  current,
  label,
  hint,
  icon,
  value,
  keywords,
}: PickRowProps) => (
  <CommandItem
    className={itemClass}
    keywords={keywords}
    label={label}
    value={value}
  >
    <CommandItemIcon className={iconClass}>{icon}</CommandItemIcon>
    <span className="grow truncate">
      {label}
      {current ? <span className="sr-only"> (showing now)</span> : null}
    </span>
    <span className="text-ink-3 shrink-0 text-xs">{hint}</span>
    <Check
      aria-hidden="true"
      className={
        current ? "text-brand size-4 shrink-0" : "invisible size-4 shrink-0"
      }
    />
  </CommandItem>
);

/** Every branch, the one on screen ticked. */
export const BranchPage = ({ branches, scope }: BranchProps) => (
  <CommandPage value={BRANCH_PAGE}>
    <CommandGroup className="pb-1">
      <CommandGroupLabel className={labelClass}>
        Show stock for
      </CommandGroupLabel>
      <PickRow
        current={scope === ALL_BRANCHES}
        hint="Company"
        icon={<Building2 aria-hidden="true" />}
        keywords={["company", "everything"]}
        label="All branches"
        value={pickValue(ALL_BRANCHES)}
      />
      {branches.map((item) => (
        <PickRow
          current={scope === item.id}
          hint={branchKindLabel(item)}
          icon={<BranchIcon branch={item} />}
          key={item.id}
          keywords={[item.id, branchKindLabel(item)]}
          label={item.name}
          value={pickValue(item.id)}
        />
      ))}
    </CommandGroup>
  </CommandPage>
);
