import { barRuns, ean13Modules } from "@/lib/barcode";

/** A real EAN-13 under Ghana's GS1 prefix (603), printed on the sign-in label. */
const LABEL_CODE = "6031000129471";
const MODULES = ean13Modules(LABEL_CODE);
const BARS = barRuns(MODULES);

/** Human-readable line under the bars: first digit, then the two halves. */
const READOUT = `${LABEL_CODE.slice(0, 1)} ${LABEL_CODE.slice(1, 7)} ${LABEL_CODE.slice(7)}`;

export const LabelBarcode = () => (
  <div aria-hidden="true" className="mt-4 grid justify-items-center gap-1">
    <svg
      className="h-10 w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${MODULES.length} 40`}
    >
      {BARS.map((bar) => (
        <rect
          fill="currentColor"
          height="40"
          key={bar.x}
          width={bar.width}
          x={bar.x}
        />
      ))}
    </svg>
    <span className="text-ink-2 text-2xs font-mono tracking-widest">
      {READOUT}
    </span>
  </div>
);
