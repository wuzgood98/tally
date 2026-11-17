import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A small ring turning in the text's colour; still under reduced motion. */
export const Spinner = ({ className }: { readonly className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "animate-spin-fast inline-block size-3.5 shrink-0 rounded-full border-2 border-current border-e-transparent motion-reduce:animate-none",
      className
    )}
    data-slot="spinner"
  />
);

/**
 * A button's label: `children` normally, and `label` ("Saving…") after a
 * spinner while its action runs. One element either way, so a button laid
 * out with `justify-between` keeps the label where it was.
 */
export const PendingLabel = ({
  pending,
  label,
  children,
}: {
  readonly pending: boolean;
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode =>
  pending ? (
    <span className="inline-flex items-center gap-1.5">
      <Spinner />
      {label}
    </span>
  ) : (
    children
  );
