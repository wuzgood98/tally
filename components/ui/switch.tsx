import { Switch as SwitchPrimitive, SwitchThumb } from "@ui-sdk/react/switch";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/*
 * On is the brand blue. The thumb slides on transform with a strong ease-out,
 * and stretches a little while pressed, so it feels like it's being pushed.
 */
const trackVariants = cva(
  "bg-line-strong data-checked:bg-brand focus-visible:outline-brand group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-offset-2 transition-[background-color] duration-150 ease-out focus-visible:outline-2 data-disabled:cursor-not-allowed data-disabled:opacity-45",
  {
    defaultVariants: { size: "md" },
    variants: {
      size: {
        md: "h-5 w-9",
        /** A switch that turns on something big, like Ask Tally. */
        lg: "h-6.5 w-12",
      },
    },
  }
);

const thumbVariants = cva(
  "dark:bg-ink-2 group-data-checked/switch:bg-primary-foreground block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-[translate,width] duration-150 ease-(--ease-out-quick) motion-reduce:transition-none",
  {
    defaultVariants: { size: "md" },
    variants: {
      size: {
        md: "size-4 group-active/switch:not-group-data-disabled/switch:w-5 group-data-checked/switch:translate-x-4 group-data-checked/switch:group-active/switch:not-group-data-disabled/switch:translate-x-3",
        lg: "size-5.5 group-active/switch:not-group-data-disabled/switch:w-6.5 group-data-checked/switch:translate-x-5.5 group-data-checked/switch:group-active/switch:not-group-data-disabled/switch:translate-x-4.5",
      },
    },
  }
);

export const Switch = ({
  className,
  size,
  ...props
}: Omit<ComponentProps<typeof SwitchPrimitive>, "className" | "children"> &
  VariantProps<typeof trackVariants> & {
    readonly className?: string;
  }) => (
  <SwitchPrimitive
    className={cn(trackVariants({ size }), className)}
    {...props}
  >
    <SwitchThumb className={thumbVariants({ size })} />
  </SwitchPrimitive>
);
