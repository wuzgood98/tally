import { paginationRange } from "@ui-sdk/core/pagination";

import { formatCount } from "@/lib/format";

import { PaginationLinks } from "./pagination-links";

interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  /** Builds the link for a page number. */
  readonly href: (page: number) => string;
  readonly noun: string;
}

// `href` is a function and can't cross into the client part, so the URLs of
// the pages it can reach from here are resolved on the server.
const reachableHrefs = (
  page: number,
  pageCount: number,
  href: (page: number) => string
) => {
  const shown = paginationRange({ page, pageCount }).filter(
    (item) => item !== "ellipsis-start" && item !== "ellipsis-end"
  );

  return Object.fromEntries(
    [...new Set([page - 1, page + 1, ...shown])].flatMap((target) =>
      target >= 1 && target <= pageCount ? [[target, href(target)]] : []
    )
  );
};

export const Pagination = ({
  page,
  pageSize,
  total,
  href,
  noun,
}: PaginationProps) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-ink-2 tabular">
        {total === 0
          ? `No ${noun}`
          : `${formatCount(first)}–${formatCount(last)} of ${formatCount(total)} ${noun}`}
      </p>
      {pageCount > 1 ? (
        <PaginationLinks
          hrefs={reachableHrefs(page, pageCount, href)}
          page={page}
          pageCount={pageCount}
        />
      ) : null}
    </div>
  );
};
