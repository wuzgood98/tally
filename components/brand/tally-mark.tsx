import { MARK_GEOMETRY } from "@/lib/brand";

/** Four strokes and a gate: the tally mark, the oldest stock count there is. */
export const TallyMark = ({ className }: { readonly className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox={MARK_GEOMETRY.viewBox}
  >
    <rect
      fill="currentColor"
      height="24"
      rx={MARK_GEOMETRY.radius}
      width="24"
    />
    <g
      stroke="var(--accent-ink, #fff)"
      strokeLinecap="round"
      strokeWidth={MARK_GEOMETRY.strokeWidth}
    >
      <path d={MARK_GEOMETRY.strokes} />
      <path d={MARK_GEOMETRY.gate} />
    </g>
  </svg>
);
