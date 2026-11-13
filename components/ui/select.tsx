"use client";

import {
  Select as SelectPrimitive,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import type { ListData } from "@ui-sdk/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectOptionGroup {
  readonly label: string;
  readonly options: readonly SelectOption[];
}

export type SelectOptions = readonly (SelectOption | SelectOptionGroup)[];

interface SelectProps {
  readonly options: SelectOptions;
  readonly name?: string;
  readonly defaultValue?: string | null;
  readonly value?: string | null;
  readonly onValueChange?: (value: string | null) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly form?: string;
  readonly id?: string;
  /** Names the trigger when no Field label does. */
  readonly "aria-label"?: string;
  /** `sm` fits a table row or the header bar. */
  readonly size?: "md" | "sm";
  /** Width only; the look comes from `size`. */
  readonly className?: string;
}

const isGroup = (
  entry: SelectOption | SelectOptionGroup
): entry is SelectOptionGroup => "options" in entry;

const toListData = (options: SelectOptions): ListData =>
  options.map((entry) =>
    isGroup(entry)
      ? {
          items: entry.options.map((option) => ({ ...option })),
          label: entry.label,
          type: "group" as const,
        }
      : { ...entry }
  );

const OptionItem = ({ option }: { readonly option: SelectOption }) => (
  <SelectItem
    className="text-ink data-highlighted:bg-surface-2 relative flex cursor-default items-center gap-2 rounded-md py-1.5 ps-2 pe-8 text-sm outline-none select-none data-disabled:opacity-50 data-selected:font-medium"
    disabled={option.disabled}
    value={option.value}
  >
    {option.label}
    <SelectItemIndicator className="text-brand absolute end-2">
      <Check aria-hidden="true" className="size-4" />
    </SelectItemIndicator>
  </SelectItem>
);

/** A styled single-choice select that submits with its form like a native one. */
export const Select = ({
  options,
  className,
  id,
  "aria-label": ariaLabel,
  onValueChange,
  size = "md",
  ...props
}: SelectProps) => (
  <SelectPrimitive
    items={toListData(options)}
    onValueChange={(value: string | null) => {
      onValueChange?.(value);
    }}
    {...props}
  >
    <SelectTrigger
      aria-label={ariaLabel}
      className={cn(
        "field flex items-center justify-between gap-2 text-start",
        size === "sm" && "h-8",
        className
      )}
      id={id}
    >
      <SelectValue className="data-placeholder:text-ink-3 min-w-0 truncate" />
      <ChevronDown aria-hidden="true" className="text-ink-3 size-4 shrink-0" />
    </SelectTrigger>
    <SelectContent className="border-line bg-surface z-50 max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto rounded-lg border p-1 shadow-lg">
      {options.map((entry) =>
        isGroup(entry) ? (
          <SelectGroup key={`group:${entry.label}`}>
            <SelectGroupLabel className="text-ink-3 px-2 pt-2 pb-1 text-xs font-medium">
              {entry.label}
            </SelectGroupLabel>
            {entry.options.map((option) => (
              <OptionItem key={option.value} option={option} />
            ))}
          </SelectGroup>
        ) : (
          <OptionItem key={entry.value} option={entry} />
        )
      )}
    </SelectContent>
  </SelectPrimitive>
);
