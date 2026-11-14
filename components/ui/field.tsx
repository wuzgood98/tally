import {
  Field as FieldPrimitive,
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldLabel as FieldLabelPrimitive,
} from "@ui-sdk/react/field";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ElementType } from "react";

import { cn } from "@/lib/utils";

type WithClassName<T extends ElementType> = Omit<
  ComponentProps<T>,
  "className"
> & {
  readonly className?: string;
};

const fieldVariants = cva("", {
  defaultVariants: { layout: "stack" },
  variants: {
    layout: {
      /** A set of choices, like radios, under one label. */
      group: "grid gap-2",
      /** Label beside the control, for filter bars. */
      inline: "flex flex-row items-center gap-2",
      /** Label beside a ruled field, like a printed shelf label. */
      rule: "grid grid-cols-[5rem_1fr] items-center gap-x-2",
      /** Label above the control. */
      stack: "grid content-start gap-1.5",
    },
  },
});

export const Field = ({
  className,
  layout,
  ...props
}: WithClassName<typeof FieldPrimitive> &
  VariantProps<typeof fieldVariants>) => (
  <FieldPrimitive
    className={cn(fieldVariants({ layout }), className)}
    {...props}
  />
);

const labelVariants = cva("text-sm", {
  defaultVariants: { tone: "strong" },
  variants: {
    tone: {
      /** Reads as a prompt beside a filter, not a heading. */
      quiet: "text-ink-2",
      /** Small capitals on a printed label. */
      caption: "text-ink-2 text-2xs font-medium tracking-widest uppercase",
      strong: "font-medium",
    },
  },
});

export const FieldLabel = ({
  className,
  tone,
  ...props
}: WithClassName<typeof FieldLabelPrimitive> &
  VariantProps<typeof labelVariants>) => (
  <FieldLabelPrimitive
    className={cn(labelVariants({ tone }), className)}
    {...props}
  />
);

export const FieldDescription = ({
  className,
  ...props
}: WithClassName<typeof FieldDescriptionPrimitive>) => (
  <FieldDescriptionPrimitive
    className={cn("text-ink-2 text-xs", className)}
    {...props}
  />
);

export const FieldError = ({
  className,
  ...props
}: WithClassName<typeof FieldErrorPrimitive>) => (
  <FieldErrorPrimitive
    className={cn("text-danger text-xs", className)}
    {...props}
  />
);
