import {
  Checkbox as CheckboxPrimitive,
  CheckboxIndicator,
} from "@ui-sdk/react/checkbox";
import {
  Radio as RadioPrimitive,
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator,
} from "@ui-sdk/react/radio";
import {
  SegmentedControl as SegmentedControlPrimitive,
  SegmentedControlIndicator,
  SegmentedControlItem as SegmentedControlItemPrimitive,
} from "@ui-sdk/react/segmented-control";
import { Check } from "lucide-react";
import type { ComponentProps, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type WithClassName<T extends ElementType> = Omit<
  ComponentProps<T>,
  "className" | "children"
> & {
  readonly className?: string;
};

export const Checkbox = ({
  className,
  ...props
}: WithClassName<typeof CheckboxPrimitive>) => (
  <CheckboxPrimitive
    className={cn(
      "border-input bg-surface data-checked:border-brand data-checked:bg-brand text-primary-foreground grid size-4 shrink-0 place-items-center rounded-sm border",
      className
    )}
    {...props}
  >
    <CheckboxIndicator>
      <Check aria-hidden="true" className="size-3" strokeWidth={3} />
    </CheckboxIndicator>
  </CheckboxPrimitive>
);

const COLUMNS = { 1: "", 3: "grid-cols-3" } as const;

/** Radios as a grid of cards: one per row, or `columns={3}` side by side. */
export const RadioGroup = ({
  columns = 1,
  ...props
}: Omit<ComponentProps<typeof RadioGroupPrimitive>, "className"> & {
  readonly columns?: keyof typeof COLUMNS;
}) => (
  <RadioGroupPrimitive
    className={cn("grid gap-2", COLUMNS[columns])}
    {...props}
  />
);

/** A round radio with a dot. For a whole card that acts as one, pass `bare`. */
export const Radio = ({
  className,
  bare = false,
  ...props
}: WithClassName<typeof RadioPrimitive> & { readonly bare?: boolean }) => (
  <RadioPrimitive
    className={cn(
      bare
        ? "sr-only"
        : "border-input bg-surface data-checked:border-brand grid size-4 shrink-0 place-items-center rounded-full border",
      className
    )}
    {...props}
  >
    {bare ? null : <RadioIndicator className="bg-brand size-2 rounded-full" />}
  </RadioPrimitive>
);

export const SegmentedControl = ({
  className,
  children,
  ...props
}: Omit<
  ComponentProps<typeof SegmentedControlPrimitive>,
  "className" | "children"
> & {
  readonly className?: string;
  readonly children: ReactNode;
}) => (
  <SegmentedControlPrimitive
    className={cn(
      "bg-surface-2 rounded-control relative isolate grid auto-cols-fr grid-flow-col gap-1 p-1",
      className
    )}
    {...props}
  >
    <SegmentedControlIndicator className="bg-surface ease-in-out-strong absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-[calc(var(--control-radius)-4px)] shadow-sm transition-[left,width] duration-200 motion-reduce:transition-none" />
    {children}
  </SegmentedControlPrimitive>
);

export const SegmentedControlItem = ({
  className,
  ...props
}: Omit<ComponentProps<typeof SegmentedControlItemPrimitive>, "className"> & {
  readonly className?: string;
}) => (
  <SegmentedControlItemPrimitive
    className={cn(
      "press text-ink-2 data-checked:text-ink flex items-center justify-center rounded-[calc(var(--control-radius)-4px)] px-3 py-1.5 text-sm font-medium data-disabled:cursor-not-allowed data-disabled:opacity-50",
      className
    )}
    {...props}
  />
);
