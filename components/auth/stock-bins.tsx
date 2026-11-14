/**
 * The sign-in page's backdrop: six stock bins, one per site, their shelves
 * filling as the page arrives. Purely decorative. The levels are fixed shapes,
 * not data, so nothing about real stock is shown before anyone signs in.
 */

/** Seven bars per bin, as a share of the bin's height (out of 9). */
const LEVELS = [
  [9, 8, 9, 7, 8, 9, 8],
  [6, 5, 7, 4, 5, 6, 5],
  [5, 4, 3, 4, 3, 2, 3],
  [4, 5, 4, 3, 4, 4, 5],
  [3, 2, 2, 1, 2, 1, 1],
  [6, 6, 5, 7, 6, 5, 6],
] as const;

/** Written out whole so Tailwind finds every class. */
const HEIGHT = {
  1: "h-1/9",
  2: "h-2/9",
  3: "h-3/9",
  4: "h-4/9",
  5: "h-5/9",
  6: "h-6/9",
  7: "h-7/9",
  8: "h-8/9",
  9: "h-full",
} as const;

const OUT_AT = 2;
const LOW_AT = 3;
const BIN_STAGGER_MS = 80;
const BAR_STAGGER_MS = 30;

const barTone = (level: number): string => {
  if (level <= OUT_AT) {
    return "bg-danger/80";
  }

  if (level <= LOW_AT) {
    return "bg-warn/80";
  }

  return "bg-line-strong";
};

export const StockBins = ({
  names,
}: {
  /** Site names for the bins' headings; none outside demo mode. */
  readonly names: readonly string[];
}) => (
  <div
    aria-hidden="true"
    className="bg-line absolute inset-0 grid grid-cols-2 grid-rows-3 gap-px sm:grid-cols-3 sm:grid-rows-2"
  >
    {LEVELS.map((levels, bin) => (
      <div
        className="bg-canvas flex flex-col justify-between p-4"
        // The bins never reorder; their position is their identity.
        // oxlint-disable-next-line no-array-index-key
        key={bin}
      >
        <p className="text-ink-3 text-2xs truncate font-medium tracking-wide uppercase">
          {names[bin] ?? ""}
        </p>
        <div className="flex h-2/5 min-h-12 items-end gap-0.75">
          {levels.map((level, bar) => (
            <span
              className={`bar-rise flex-1 rounded-t-xs ${HEIGHT[level]} ${barTone(level)}`}
              // oxlint-disable-next-line no-array-index-key
              key={bar}
              style={{
                "--bar-delay": `${bin * BIN_STAGGER_MS + bar * BAR_STAGGER_MS}ms`,
              }}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);
