import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  /** Builds the link for a page number. */
  readonly href: (page: number) => string;
  readonly noun: string;
}

const linkClass =
  "press border-line bg-surface hover:bg-surface-2 inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-sm";

export const Pagination = ({
  page,
  pageSize,
  total,
  href,
  noun,
}: PaginationProps) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
    >
      <p className="text-ink-2 tabular">
        {total === 0
          ? `No ${noun}`
          : `${formatCount(first)}–${formatCount(last)} of ${formatCount(total)} ${noun}`}
      </p>
      {pages > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link className={linkClass} href={href(page - 1)} rel="prev">
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link className={cn(linkClass)} href={href(page + 1)} rel="next">
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
};
