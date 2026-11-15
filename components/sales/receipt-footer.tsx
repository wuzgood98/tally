import { cn } from "@/lib/utils";

/**
 * Head office's footer, printed under the total on every receipt (the till's,
 * a sale's, and the preview on the settings page). Line breaks are kept.
 */
export const ReceiptFooter = ({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
}) => (
  <p
    className={cn(
      "border-line-strong text-ink-2 border-t border-dashed pt-3 text-center font-mono text-xs text-balance break-words whitespace-pre-line",
      className
    )}
  >
    {text}
  </p>
);
