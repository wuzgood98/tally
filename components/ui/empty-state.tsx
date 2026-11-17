import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The one next step an empty place offers, such as "Open till". */
interface EmptyAction {
  readonly href: string;
  readonly label: string;
}

/** Why a list is empty, printed in the label's corner. */
type EmptyKind = "empty" | "noMatch" | "pastEnd" | "clear";

const CORNER: Record<
  EmptyKind,
  { readonly label: string; readonly good: boolean }
> = {
  clear: { good: true, label: "All clear" },
  empty: { good: false, label: "Empty" },
  noMatch: { good: false, label: "No match" },
  pastEnd: { good: false, label: "End of list" },
};

/** Bar widths of the label's stand-in barcode, each with an id for its key. */
const BARS = [
  ["a", "w-0.5"],
  ["b", "w-px"],
  ["c", "w-1"],
  ["d", "w-px"],
  ["e", "w-0.5"],
  ["f", "w-1"],
  ["g", "w-px"],
  ["h", "w-0.5"],
  ["i", "w-px"],
  ["j", "w-1"],
  ["k", "w-0.5"],
  ["l", "w-px"],
  ["m", "w-1"],
  ["n", "w-0.5"],
] as const;

interface EmptyLabelProps {
  /** The place, printed small at the top: "Sales". */
  readonly tag: string;
  readonly title: string;
  /** A sentence on what will show here, or what to try. */
  readonly children?: ReactNode;
  readonly kind?: EmptyKind;
  readonly action?: EmptyAction;
}

/**
 * A whole list with nothing in it: an empty bin with its shelf label still
 * on, printed on the same paper as the sign-in label and the till's receipt.
 * For lists and searches only; a panel, popover or form line uses EmptyNote.
 */
export const EmptyLabel = ({
  tag,
  title,
  children,
  kind = "empty",
  action,
}: EmptyLabelProps) => (
  <div className="bg-surface-2/60 grid place-items-center px-4 py-10 sm:py-12">
    <div className="drop-shadow-receipt w-full max-w-72 -rotate-1">
      <div className="label-paper label-tear px-5 pt-6 pb-4">
        <p className="figures text-ink-3 text-2xs flex justify-between gap-3 tracking-widest uppercase">
          <span>{tag}</span>
          <span
            className={cn(
              "flex items-center gap-1",
              CORNER[kind].good ? "text-good" : null
            )}
          >
            {CORNER[kind].good ? (
              <Check aria-hidden="true" className="size-3" />
            ) : null}
            {CORNER[kind].label}
          </span>
        </p>
        <p className="text-md mt-1.5 font-semibold tracking-tight text-balance">
          {title}
        </p>
        {children === undefined ? null : (
          <p className="text-ink-2 mt-1 text-xs text-pretty">{children}</p>
        )}
        <div className="border-line-strong mt-3.5 flex items-end justify-between gap-3 border-t border-dashed pt-3">
          <div aria-hidden="true" className="flex h-5 gap-0.5">
            {BARS.map(([id, width]) => (
              <span className={cn("bg-ink", width)} key={id} />
            ))}
          </div>
          {action === undefined ? null : (
            <Link
              className={buttonVariants({ size: "sm", variant: "ink" })}
              href={action.href}
            >
              {action.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  </div>
);

interface EmptyNoteProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly children?: ReactNode;
  /** Empty because all is well, such as nothing running low. */
  readonly good?: boolean;
}

/**
 * Part of a page with nothing in it (a dashboard panel, the bell, a form's
 * lines, the till's basket): one quiet row, read left to right like the rows
 * it stands in for.
 */
export const EmptyNote = ({
  icon: Icon,
  title,
  children,
  good = false,
}: EmptyNoteProps) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md ring-1 ring-inset",
        good
          ? "bg-good/10 text-good ring-good/20"
          : "bg-surface text-ink-2 ring-line-strong"
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
    <div className="min-w-48 flex-1">
      <p className="font-medium">{title}</p>
      {children === undefined ? null : (
        <p className="text-ink-2 text-xs text-pretty">{children}</p>
      )}
    </div>
  </div>
);

interface ListEmptyProps {
  /** The place, printed small at the top: "Transfers". */
  readonly tag: string;
  /** The bare list, with no filters and on its first page. */
  readonly listHref: string;
  /** Said when the list has nothing at all: "No transfers yet". */
  readonly title: string;
  /** What will show here once there is something. */
  readonly children?: ReactNode;
  /** The page's own create action, only for people who can use it. */
  readonly create?: EmptyAction;
  /** Any filter or search is on. */
  readonly filtered?: boolean;
  /** What to try when the filters match nothing. */
  readonly noMatchHint?: ReactNode;
  /**
   * The first page with the filters kept, set only on a later page or an
   * older cursor, where an empty result means past the end, not none at all.
   */
  readonly firstPageHref?: string;
}

/**
 * An empty list page. It tells three cases apart: past the last page, a
 * filter that matches nothing, and a list with nothing in it yet.
 */
export const ListEmpty = ({
  tag,
  listHref,
  title,
  children,
  create,
  filtered = false,
  noMatchHint = "Try another filter.",
  firstPageHref,
}: ListEmptyProps) => {
  if (firstPageHref !== undefined) {
    return (
      <EmptyLabel
        action={{ href: firstPageHref, label: "Back to the first page" }}
        kind="pastEnd"
        tag={tag}
        title="Nothing on this page"
      >
        This page is past the end of the list.
      </EmptyLabel>
    );
  }

  if (filtered) {
    return (
      <EmptyLabel
        action={{ href: listHref, label: "Clear the filters" }}
        kind="noMatch"
        tag={tag}
        title={`No ${tag.toLowerCase()} match`}
      >
        {noMatchHint}
      </EmptyLabel>
    );
  }

  return (
    <EmptyLabel action={create} tag={tag} title={title}>
      {children}
    </EmptyLabel>
  );
};
