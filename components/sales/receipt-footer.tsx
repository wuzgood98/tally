import { cn } from "@/lib/utils";

/**
 * Head office's footer, printed under the total on every receipt (the till's,
 * a sale's, and the preview on the settings page). Line breaks are kept.
 * `ruled` draws the dashed tear-off line above it; leave it off where the
 * container already draws one, like a panel's footer.
 */
export const ReceiptFooter = ({
  text,
  ruled = true,
  className,
}: {
  readonly text: string;
  readonly ruled?: boolean;
  readonly className?: string;
}) => (
  <p
    className={cn(
      "text-ink-2 text-center font-mono text-xs text-balance break-words whitespace-pre-line",
      ruled && "border-line-strong border-t border-dashed pt-3",
      className
    )}
  >
    {text}
  </p>
);
