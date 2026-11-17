"use client";

import { debounce, parseAsString, useQueryStates } from "nuqs";
import type { Options, SetValues } from "nuqs";
import { createContext, use, useMemo, useState, useTransition } from "react";
import type { ReactNode, TransitionStartFunction } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOptions } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { FilterParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";

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
 * The param and the ones it resets. Memoised on their JSON, so a fresh array
 * from a re-render doesn't rebuild the hook's parsers.
 */
const useKeys = (param: string, resets: readonly string[]): string[] => {
  const keysJson = JSON.stringify([param, ...resets]);

  return useMemo((): string[] => {
    const keys: unknown = JSON.parse(keysJson);

    return Array.isArray(keys)
      ? keys.filter((key): key is string => typeof key === "string")
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

/** Every other key back to its default: a new filter starts at page one. */
const cleared = (keys: readonly string[]): Record<string, null> =>
  Object.fromEntries(keys.map((key) => [key, null]));

const flatValues = (options: SelectOptions): string[] =>
  options.flatMap((entry) =>
    "options" in entry
      ? entry.options.map((option) => option.value)
      : [entry.value]
  );

interface UrlSelectProps {
  /**
   * The search param it writes, such as "status", and the value meaning "no
   * filter" (choosing it removes the param). The page reads the same one.
   */
  readonly filter: FilterParam;
  readonly options: SelectOptions;
  /** Params a new choice clears, such as the page or a cursor. */
  readonly resets?: readonly string[];
  readonly label: string;
  /**
   * Shows the label before a select sized to its value; otherwise the label
   * names it for screen readers and the select fills its column.
   */
  readonly visibleLabel?: boolean;
  /** Width only, for a select without a visible label. */
  readonly className?: string;
}

/**
 * A filter select that applies as soon as something is chosen. It keeps its
 * `name`, so without JavaScript it still submits with a GET form around it.
 */
export const UrlSelect = ({
  filter: { param, defaultValue },
  options,
  resets = NO_RESETS,
  label,
  visibleLabel = false,
  className,
}: UrlSelectProps) => {
  const keys = useKeys(param, resets);
  const { values, setValues } = useUrlKeys(keys);
  const raw = values[param] ?? defaultValue;
  // Anything the server wouldn't accept shows as the default, as it filters.
  const value = flatValues(options).includes(raw) ? raw : defaultValue;

  const choose = (next: string | null) => {
    const chosen = next === null || next === defaultValue ? null : next;

    // Nothing to wait for: the page's transition shows the update pending.
    void setValues({ ...cleared(resets), [param]: chosen });
  };

  if (!visibleLabel) {
    return (
      <Select
        aria-label={label}
        className={className}
        name={param}
        onValueChange={choose}
        options={options}
        value={value}
      />
    );
  }

  return (
    <Field layout="inline">
      <FieldLabel tone="quiet">{label}</FieldLabel>
      <Select
        className="w-auto"
        name={param}
        onValueChange={choose}
        options={options}
        value={value}
      />
    </Field>
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
  const keys = useKeys(param, resets);
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
