"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { debounce, parseAsString, useQueryStates } from "nuqs";
import type { Options, SetValues } from "nuqs";
import {
  createContext,
  Fragment,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { MouseEvent, ReactNode, TransitionStartFunction } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOptions } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatCount, pluralNoun } from "@/lib/format";
import type { FilterParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";

import type { TabOption } from "./tab-options";

/** How long typing must pause before the list searches. */
export const SEARCH_DEBOUNCE_MS = 300;

interface ListTransition {
  readonly pending: boolean;
  readonly startTransition: TransitionStartFunction;
}

const ListTransitionContext = createContext<ListTransition | null>(null);

const useListTransition = (): ListTransition => {
  const value = use(ListTransitionContext);

  if (value === null) {
    throw new Error("List filters must sit inside <ListFilters>.");
  }

  return value;
};

/**
 * Wraps a list page's filters and its results. A filter change re-renders the
 * server page inside one transition, so the results can show it's pending.
 */
export const ListFilters = ({ children }: { readonly children: ReactNode }) => {
  const [pending, startTransition] = useTransition();

  const value = useMemo(
    () => ({ pending, startTransition }),
    [pending, startTransition]
  );

  return (
    <ListTransitionContext value={value}>{children}</ListTransitionContext>
  );
};

/** The row of filters above a list. */
export const FilterBar = ({ children }: { readonly children: ReactNode }) => (
  <search className="mb-4 flex flex-wrap items-center gap-2">{children}</search>
);

/** A trailing no-break space: a live region only speaks when its text changes. */
const REPEAT_MARK = "\u00A0";

/**
 * The announcement, changed by an invisible character each time a filter
 * change lands, so the same count ("7 products" again) is still read out.
 */
const useAnnouncement = (
  announce: string | undefined,
  pending: boolean
): string | undefined => {
  const [wasPending, setWasPending] = useState(pending);
  const [landed, setLanded] = useState(0);

  if (pending !== wasPending) {
    setWasPending(pending);

    if (!pending) {
      setLanded((count) => count + 1);
    }
  }

  if (announce === undefined) {
    return undefined;
  }

  return landed % 2 === 0 ? announce : `${announce}${REPEAT_MARK}`;
};

/**
 * The list under the filters: the last results stay on show, marked busy at
 * once and dimmed after 150 ms, until the new ones arrive.
 */
export const ListResults = ({
  announce,
  children,
}: {
  /** Read out when the results change, such as "12 products". */
  readonly announce?: string;
  readonly children: ReactNode;
}) => {
  const { pending } = useListTransition();
  const announcement = useAnnouncement(announce, pending);

  return (
    <div
      aria-busy={pending}
      className={cn(
        "transition-opacity duration-150",
        pending && "opacity-60 delay-150"
      )}
    >
      {announcement === undefined ? null : (
        <output className="sr-only">{announcement}</output>
      )}
      {children}
    </div>
  );
};

const NO_RESETS: readonly string[] = [];

type UrlParsers = Record<string, typeof parseAsString>;

interface UrlKeys {
  readonly pending: boolean;
  readonly values: Record<string, string | null>;
  readonly setValues: SetValues<UrlParsers>;
}

/** One string per key; the server page validates every value itself. */
const keysOf = (keys: readonly string[]): UrlParsers =>
  Object.fromEntries(keys.map((key) => [key, parseAsString]));

/**
 * The params a control reads or writes. Memoised on their JSON, so a fresh
 * array from a re-render doesn't rebuild the hook's parsers.
 */
const useKeys = (keys: readonly string[]): string[] => {
  const keysJson = JSON.stringify(keys);

  return useMemo((): string[] => {
    const parsed: unknown = JSON.parse(keysJson);

    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  }, [keysJson]);
};

/**
 * Filters update the URL in place (no new history entry per keystroke or
 * choice) and re-render the server page with it.
 */
const useUrlKeys = (keys: readonly string[]): UrlKeys => {
  const { pending, startTransition } = useListTransition();
  const parsers = useMemo(() => keysOf(keys), [keys]);

  const [values, setValues] = useQueryStates(parsers, {
    history: "replace",
    shallow: false,
    startTransition,
  });

  return { pending, setValues, values };
};

/** Every key back to its default: a new filter starts at page one. */
const cleared = (keys: readonly string[]): Record<string, null> =>
  Object.fromEntries(keys.map((key) => [key, null]));

/**
 * The value a filter shows: what the URL says, or the default when the
 * server wouldn't accept it (so it shows what the list is filtered by).
 */
const shownValue = (
  raw: string | null | undefined,
  { defaultValue }: FilterParam,
  allowed: readonly string[]
): string =>
  raw !== null && raw !== undefined && allowed.includes(raw)
    ? raw
    : defaultValue;

interface UrlTabsProps {
  /** The search param the tabs write, and the value meaning "no filter". */
  readonly filter: FilterParam;
  readonly options: readonly TabOption[];
  /** Params a new choice clears, such as the page or a cursor. */
  readonly resets?: readonly string[];
  /** Names the row for screen readers, such as "Stock status". */
  readonly label: string;
}

/** A plain click: anything else (a new tab, a new window) is the browser's. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/**
 * A list's main filter as a row of tabs, such as the stock status. Each tab
 * links to the filtered list; a plain click filters in place instead.
 */
export const UrlTabs = ({
  filter,
  options,
  resets = NO_RESETS,
  label,
}: UrlTabsProps) => {
  const keys = useKeys([filter.param, ...resets]);
  const { values, setValues } = useUrlKeys(keys);

  const current = shownValue(
    values[filter.param],
    filter,
    options.map((option) => option.value)
  );

  const row = useRef<HTMLElement>(null);

  // On a phone the row scrolls: keep the chosen tab in view, without moving
  // the page (which scrollIntoView would).
  useEffect(() => {
    const nav = row.current;

    const tab = nav?.querySelector<HTMLElement>(
      `[data-value="${CSS.escape(current)}"]`
    );

    if (!nav || !tab) {
      return;
    }

    const start = tab.offsetLeft - nav.offsetLeft;
    const end = start + tab.offsetWidth;

    if (start < nav.scrollLeft || end > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = start - (nav.clientWidth - tab.offsetWidth) / 2;
    }
  }, [current]);

  // The border sits on a wrapper, and the scrolling row overlaps it by a
  // pixel, so the chosen tab's underline covers it. Overflowing the row
  // instead (a tab's -mb-px) gave the row a vertical scroll: a box that
  // scrolls on one axis can't let content spill on the other.
  return (
    <div className="border-line mb-3 border-b">
      <nav
        aria-label={label}
        className="-mb-px flex [scrollbar-width:none] overflow-x-auto overflow-y-hidden"
        ref={row}
      >
        {options.map((option) => {
          const on = option.value === current;

          return (
            <Link
              aria-current={on ? "true" : undefined}
              data-value={option.value}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                on
                  ? "border-brand text-ink"
                  : "text-ink-2 hover:text-ink hover:border-line-strong border-transparent"
              )}
              href={option.href}
              key={option.value}
              onClick={(event) => {
                if (!isPlainClick(event)) {
                  return;
                }

                event.preventDefault();

                const chosen =
                  option.value === filter.defaultValue ? null : option.value;

                // Nothing to wait for: the page's transition shows the update pending.
                void setValues({ ...cleared(resets), [filter.param]: chosen });
              }}
              prefetch={false}
              replace
              scroll={false}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

const flatValues = (options: SelectOptions): string[] =>
  options.flatMap((entry) =>
    "options" in entry
      ? entry.options.map((option) => option.value)
      : [entry.value]
  );

interface UrlChipProps {
  /** The search param it writes, and the value meaning "no filter". */
  readonly filter: FilterParam;
  /** The choices, without the "no filter" one: the chip's × clears it. */
  readonly options: SelectOptions;
  /** Params a new choice clears, such as the page. */
  readonly resets?: readonly string[];
  /** What it filters by, such as "Category". */
  readonly label: string;
}

/**
 * A secondary filter as a chip: "+ Category" until something is chosen,
 * then "Category: Rice" with a × to clear it. It keeps its `name`, so
 * without JavaScript it still submits with a GET form around it.
 */
export const UrlChip = ({
  filter,
  options,
  resets = NO_RESETS,
  label,
}: UrlChipProps) => {
  const keys = useKeys([filter.param, ...resets]);
  const { values, setValues } = useUrlKeys(keys);
  const value = shownValue(values[filter.param], filter, flatValues(options));
  const chosen = value !== filter.defaultValue;

  const choose = (next: string | null) => {
    const kept = next === null || next === filter.defaultValue ? null : next;

    // Nothing to wait for: the page's transition shows the update pending.
    void setValues({ ...cleared(resets), [filter.param]: kept });
  };

  return (
    <span className="relative inline-flex max-w-full">
      <Select
        aria-label={label}
        leading={
          chosen ? (
            <span className="text-brand/75 shrink-0 font-normal">{label}:</span>
          ) : (
            <Plus aria-hidden="true" className="size-3.5 shrink-0" />
          )
        }
        name={filter.param}
        onValueChange={choose}
        options={options}
        placeholder={label}
        value={chosen ? value : null}
        variant={chosen ? "filter-on" : "filter"}
      />
      {chosen ? (
        <button
          aria-label={`Clear ${label.toLowerCase()}`}
          className="text-brand hover:bg-brand/15 absolute inset-y-0 end-1.5 my-auto grid size-6 place-items-center rounded-full"
          onClick={() => {
            choose(null);
          }}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
};

/** Clears every filter on the list at once, back on page one. */
const ClearFilters = ({ params }: { readonly params: readonly string[] }) => {
  const keys = useKeys(params);
  const { setValues } = useUrlKeys(keys);

  return (
    <button
      className="text-brand underline-offset-4 hover:underline"
      onClick={() => {
        // Nothing to wait for: the page's transition shows the update pending.
        void setValues(cleared(keys));
      }}
      type="button"
    >
      Clear filters
    </button>
  );
};

/** A filter's value inside a `FilterSummary`, such as "running low". */
const Term = ({ children }: { readonly children: ReactNode }) => (
  <strong className="text-ink font-medium">{children}</strong>
);

/** A filter's words after the noun in a `FilterSummary`: "in Drinks". */
export interface SummaryPhrase {
  /** Plain words before the value, such as "in". */
  readonly lead?: string;
  /** The filter's value, shown bold, such as "Drinks". */
  readonly term: string;
}

const NO_PHRASES: readonly (SummaryPhrase | null)[] = [];

interface FilterSummaryProps {
  /** Before the count, such as "Latest". */
  readonly prefix?: string;
  readonly count: number;
  /** A filter's value before the noun, such as "running low"; null if off. */
  readonly adjective?: string | null;
  /** What's counted, in the singular; it takes an "s" for more than one. */
  readonly noun: string;
  /** The plural, when it isn't the noun plus "s" ("deliveries"). */
  readonly plural?: string;
  /** Bold the noun as well, when it names the filter ("sales"). */
  readonly nounIsFilter?: boolean;
  /** Filters after the noun, in order; null for one that's off. */
  readonly phrases?: readonly (SummaryPhrase | null)[];
  /**
   * The params "Clear filters" clears (`clearParams`). Pass it only while a
   * filter is on; without it there's no button.
   */
  readonly clear?: readonly string[];
}

/**
 * The sentence above a list saying what it shows, such as "77 running low
 * products in Rice · Clear filters". Filter values are bold.
 */
export const FilterSummary = ({
  prefix,
  count,
  adjective = null,
  noun,
  plural,
  nounIsFilter = false,
  phrases = NO_PHRASES,
  clear,
}: FilterSummaryProps) => {
  const counted = pluralNoun(count, noun, plural);

  return (
    <p className="text-ink-2 mb-3 text-sm">
      {prefix === undefined ? null : `${prefix} `}
      {formatCount(count)}{" "}
      {adjective === null ? null : (
        <>
          <Term>{adjective}</Term>{" "}
        </>
      )}
      {nounIsFilter ? <Term>{counted}</Term> : counted}
      {phrases.map((phrase) =>
        phrase === null ? null : (
          <Fragment key={`${phrase.lead ?? ""}:${phrase.term}`}>
            {" "}
            {phrase.lead === undefined ? null : `${phrase.lead} `}
            <Term>{phrase.term}</Term>
          </Fragment>
        )
      )}
      {clear === undefined ? null : (
        <>
          {" · "}
          <ClearFilters params={clear} />
        </>
      )}
    </p>
  );
};

interface UrlSearchProps {
  /** The search param it writes, such as "q". */
  readonly param: string;
  /** Params a new search clears, such as the page. */
  readonly resets?: readonly string[];
  readonly label: string;
  readonly placeholder: string;
  readonly icon: ReactNode;
}

/**
 * A search box that searches as you type, once typing pauses. Enter searches
 * at once, and emptying the box (or its clear button) shows everything again
 * straight away.
 */
export const UrlSearch = ({
  param,
  resets = NO_RESETS,
  label,
  placeholder,
  icon,
}: UrlSearchProps) => {
  const keys = useKeys([param, ...resets]);
  const { pending, values, setValues } = useUrlKeys(keys);
  const text = values[param] ?? "";

  /** Blank (or only spaces) means no search, and shows everything at once. */
  const search = (next: string, options?: Options) => {
    const blank = next.trim() === "";

    // Nothing to wait for: the page's transition shows the update pending.
    void setValues(
      { ...cleared(resets), [param]: blank ? null : next },
      blank ? undefined : options
    );
  };

  return (
    <Field>
      <FieldLabel className="sr-only">{label}</FieldLabel>
      <div className="relative">
        <Input
          enterKeyHint="search"
          icon={icon}
          name={param}
          onChange={(event) => {
            search(event.currentTarget.value, {
              limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS),
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              // The form's own submit would navigate; search in place now.
              event.preventDefault();
              search(event.currentTarget.value);
            }
          }}
          placeholder={placeholder}
          type="search"
          value={text}
        />
        {pending ? (
          <span className="text-ink-3 pointer-events-none absolute inset-y-0 end-8 flex items-center">
            <Spinner />
          </span>
        ) : null}
      </div>
    </Field>
  );
};
