"use client";

import type { PaginationRangeItem } from "@ui-sdk/core/pagination";
import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationList,
  PaginationNext,
  PaginationPrevious,
} from "@ui-sdk/react/pagination";
import type { RenderProp } from "@ui-sdk/react/primitive";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface PaginationLinksProps {
  readonly page: number;
  readonly pageCount: number;
  /** The URL of every page the links can reach from this one. */
  readonly hrefs: Readonly<Record<number, string>>;
}

const stepClass =
  "press text-ink-2 hover:bg-surface-2 hover:text-ink inline-flex h-8 items-center gap-1 rounded-control px-2 text-sm data-disabled:pointer-events-none data-disabled:opacity-40";

const pageClass =
  "press tabular text-ink-2 hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-sm aria-[current=page]:font-medium";

// A step at either end loses its href, and Next's Link needs one.
const routerLink: RenderProp = ({ href, children, ...props }) =>
  href === undefined ? (
    <a {...props}>{children}</a>
  ) : (
    <Link href={String(href)} {...props}>
      {children}
    </Link>
  );

const isGap = (item: PaginationRangeItem) =>
  item === "ellipsis-start" || item === "ellipsis-end";

export const PaginationLinks = ({
  page,
  pageCount,
  hrefs,
}: PaginationLinksProps) => (
  <Pagination
    aria-label="Pages"
    getHref={(target) => hrefs[target] ?? ""}
    page={page}
    pageCount={pageCount}
  >
    <PaginationList className="flex flex-wrap items-center gap-1">
      {({ items }) => (
        <>
          <PaginationItem>
            <PaginationPrevious className={stepClass} render={routerLink}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">Previous</span>
            </PaginationPrevious>
          </PaginationItem>
          {items.map((item) => (
            <PaginationItem key={item}>
              {isGap(item) ? (
                <PaginationEllipsis className="text-ink-3 inline-flex h-8 w-6 items-center justify-center" />
              ) : (
                <PaginationLink
                  className={pageClass}
                  page={item}
                  render={routerLink}
                />
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext className={stepClass} render={routerLink}>
              <span className="max-sm:sr-only">Next</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </PaginationNext>
          </PaginationItem>
        </>
      )}
    </PaginationList>
  </Pagination>
);
