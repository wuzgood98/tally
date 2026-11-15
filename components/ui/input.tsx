import { Input as InputPrimitive } from "@ui-sdk/react/input";
import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva("", {
  defaultVariants: { format: "text", look: "box", size: "md" },
  variants: {
    format: {
      /** Right-aligned figures, for quantities and money in a column. */
      amount: "tabular text-end",
      /** Barcodes and other codes typed exactly. */
      code: "font-mono",
      number: "tabular",
      /** SKUs and shelf locations: codes kept in capitals. */
      sku: "font-mono uppercase",
      text: "",
    },
    look: {
      /** The standard boxed field. */
      box: "field",
      /** Written on a printed rule, for the sign-in label. */
      line: "field-line",
      /** Written large on a printed rule, like the name on a staff badge. */
      display: "field-line-display",
    },
    size: {
      md: "",
      /** Fits a table row. */
      sm: "h-8",
    },
  },
});

type InputProps = Omit<
  ComponentProps<typeof InputPrimitive>,
  "className" | "size"
> &
  VariantProps<typeof inputVariants> & {
    /** Width only; the look comes from the variants. */
    readonly className?: string;
    /** A decorative icon at the start of the field. */
    readonly icon?: ReactNode;
  };

export const Input = ({
  className,
  format,
  look,
  size,
  icon,
  ...props
}: InputProps) => {
  const input = (
    <InputPrimitive
      className={cn(
        inputVariants({ format, look, size }),
        icon === undefined ? undefined : "ps-9",
        icon === undefined ? className : undefined
      )}
      {...props}
    />
  );

  if (icon === undefined) {
    return input;
  }

  return (
    <div className={cn("relative", className)}>
      <span className="text-ink-3 pointer-events-none absolute inset-y-0 start-3 flex items-center [&_svg]:size-4">
        {icon}
      </span>
      {input}
    </div>
  );
};

export const Textarea = ({
  className,
  ...props
}: Omit<ComponentProps<typeof TextareaPrimitive>, "className"> & {
  /** Width only; the look is fixed. */
  readonly className?: string;
}) => (
  <TextareaPrimitive
    className={cn("field h-auto min-h-20 py-2", className)}
    {...props}
  />
);
