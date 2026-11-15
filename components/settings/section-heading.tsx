import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

/** "01 You", with a line under it saying what the section is for. */
export const SectionHeading = ({
  number,
  id,
  title,
  headOfficeOnly = false,
  children,
}: {
  readonly number: number;
  /** For the section's `aria-labelledby`. */
  readonly id: string;
  readonly title: string;
  /** Marks a section only head office sees. */
  readonly headOfficeOnly?: boolean;
  readonly children: ReactNode;
}) => (
  <div className="mb-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
    <span className="text-ink-3 font-mono text-xs font-medium tracking-wider">
      {String(number).padStart(2, "0")}
    </span>
    <h2 className="text-md font-semibold tracking-tight" id={id}>
      {title}
    </h2>
    {headOfficeOnly ? (
      <span className="border-line text-ink-3 inline-flex items-center gap-1 self-center rounded-full border px-1.75 text-xs whitespace-nowrap">
        <LockKeyhole aria-hidden="true" className="size-2.5" />
        Head office only
      </span>
    ) : null}
    <p className="text-ink-3 max-w-[56ch] basis-full text-sm text-pretty">
      {children}
    </p>
  </div>
);
