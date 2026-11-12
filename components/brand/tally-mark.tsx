/** Four strokes and a gate: the tally mark, the oldest stock count there is. */
export const TallyMark = ({ className }: { readonly className?: string }) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <rect fill="currentColor" height="24" rx="6" width="24" />
    <g stroke="var(--accent-ink, #fff)" strokeLinecap="round" strokeWidth="1.9">
      <path d="M7 6.5v11M10.3 6.5v11M13.6 6.5v11M16.9 6.5v11" />
      <path d="M5 15.5 19 8.5" />
    </g>
  </svg>
);
