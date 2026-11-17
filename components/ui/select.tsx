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
import type { ReactNode } from "react";

import { FILTER_CHIP, FILTER_CHIP_ON } from "@/components/ui/filter-chip";
import { ListScrollArea } from "@/components/ui/list-scroll-area";
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

type SelectVariant = "field" | "chip" | "filter" | "filter-on";

/** Each look's trigger. */
const TRIGGER_CLASSES: Record<SelectVariant, string> = {
  chip: "press border-line-strong bg-surface text-ink aria-expanded:bg-surface-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-2 inline-flex h-7 max-w-full items-center gap-2 rounded-control border ps-2.5 pe-2 text-start text-sm",
  field: "field flex min-w-0 items-center justify-between gap-2 text-start",
  filter: `press ${FILTER_CHIP} border-line-strong text-ink-2 aria-expanded:bg-surface-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-ink border-dashed`,
  "filter-on": `press ${FILTER_CHIP_ON} pe-9`,
};

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
  /** `sm` fits a table row. */
  readonly size?: "md" | "sm";
  /**
   * `field` lines up with the form's other inputs. `chip` is a compact
   * control sized to its value, for a toolbar such as the header bar.
   * `filter` is a list's filter chip: dashed while nothing is chosen,
   * brand-tinted once something is (`filter-on`), with room at its end
   * for a clear button laid over it.
   */
  readonly variant?: SelectVariant;
  /** Shown inside the trigger before the value, such as a status dot. */
  readonly leading?: ReactNode;
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
    className="text-ink data-highlighted:bg-ink/6 relative flex cursor-default items-center gap-2 rounded-md py-1.5 ps-2 pe-8 text-sm outline-none select-none data-disabled:opacity-50 data-selected:font-medium"
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
  variant = "field",
  leading,
  ...props
}: SelectProps) => (
  <SelectPrimitive
    items={toListData(options)}
    onValueChange={(value: string | null) => {
      onValueChange?.(value);
    }}
    {...props}
  >
    {/* min-w-0 drops ui-sdk's 12rem floor so a field fits its column. */}
    <SelectTrigger
      aria-label={ariaLabel}
      className={cn(
        TRIGGER_CLASSES[variant],
        variant === "field" && size === "sm" && "h-8",
        className
      )}
      id={id}
    >
      {leading}
      <SelectValue className="data-placeholder:text-ink-3 min-w-0 truncate" />
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "text-ink-3 shrink-0",
          variant === "field" ? "size-4" : "size-3.5"
        )}
      />
    </SelectTrigger>
    <SelectContent
      className={cn(
        "border-line-strong bg-surface-2 pop-in shadow-popover z-50 flex max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) flex-col overflow-hidden rounded-xl border p-0",
        // A chip is narrower than the names in its list.
        variant !== "field" && "min-w-56"
      )}
    >
      {/* The list scrolls inside, so its scrollbar matches the app's. */}
      <ListScrollArea>
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
      </ListScrollArea>
    </SelectContent>
  </SelectPrimitive>
);
