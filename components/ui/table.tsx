import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Scrolls sideways on narrow screens instead of squashing columns. */
export const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <div className="relative overflow-x-auto">
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  </div>
);

const thVariants = cva(
  "text-ink-2 border-line bg-surface border-b px-4 py-2 text-xs font-medium whitespace-nowrap",
  {
    defaultVariants: { numeric: false },
    /** Right-aligned, over a column of figures. */
    variants: { numeric: { false: "text-left", true: "text-right" } },
  }
);

/** A column header. */
export const Th = ({
  numeric,
  className,
  ...props
}: ComponentProps<"th"> & VariantProps<typeof thVariants>) => (
  <th
    className={cn(thVariants({ numeric }), className)}
    scope="col"
    {...props}
  />
);

const tdVariants = cva("border-line border-b px-4 py-2.5 align-middle", {
  defaultVariants: {
    nowrap: false,
    numeric: false,
    tone: "ink",
    weight: "normal",
  },
  variants: {
    nowrap: { false: "", true: "whitespace-nowrap" },
    /** Right-aligned, tabular figures: quantities and money. */
    numeric: { false: "", true: "tabular text-right whitespace-nowrap" },
    tone: {
      danger: "text-danger",
      faint: "text-ink-3",
      good: "text-good",
      ink: "",
      muted: "text-ink-2",
      warn: "text-warn",
    },
    weight: { medium: "font-medium", normal: "", semibold: "font-semibold" },
  },
});

export type CellTone = NonNullable<VariantProps<typeof tdVariants>["tone"]>;

/** A table cell. `className` is for width only; look comes from the variants. */
export const Td = ({
  className,
  nowrap,
  numeric,
  tone,
  weight,
  ...props
}: ComponentProps<"td"> & VariantProps<typeof tdVariants>) => (
  <td
    className={cn(tdVariants({ nowrap, numeric, tone, weight }), className)}
    {...props}
  />
);
