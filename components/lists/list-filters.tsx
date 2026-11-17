"use client";

import { debounce, parseAsString, useQueryStates } from "nuqs";
import type { Options } from "nuqs";
import { createContext, use, useMemo, useTransition } from "react";
import type { ReactNode, TransitionStartFunction } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOptions } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
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

/**
 * The list under the filters: the last results stay on show, dimmed and
 * marked busy, until the new ones arrive.
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

  return (
    <div
      aria-busy={pending}
      className={cn(
        "transition-opacity duration-150",
        pending && "opacity-60 delay-150"
      )}
    >
      {announce === undefined ? null : (
        <output className="sr-only">{announce}</output>
      )}
      {children}
    </div>
  );
};

const NO_RESETS: readonly string[] = [];

/** One string per key; the server page validates every value itself. */
const keysOf = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, parseAsString]));

/**
 * The param and the ones it resets. Keyed on their text, so a fresh array
 * from a re-render doesn't rebuild the hook's parsers.
 */
const useKeys = (param: string, resets: readonly string[]) => {
  const text = [param, ...resets].join(",");

  return useMemo(() => text.split(","), [text]);
};

/**
 * Filters update the URL in place (no new history entry per keystroke or
 * choice) and re-render the server page with it.
 */
const useUrlKeys = (keys: readonly string[]) => {
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
const cleared = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, null]));

const flatValues = (options: SelectOptions): string[] =>
  options.flatMap((entry) =>
    "options" in entry
      ? entry.options.map((option) => option.value)
      : [entry.value]
  );

interface UrlSelectProps {
  /** The search param it writes, such as "status". */
  readonly param: string;
  readonly options: SelectOptions;
  /** The value meaning "no filter"; choosing it removes the param. */
  readonly defaultValue: string;
  /** Params a new choice clears, such as the page or a cursor. */
  readonly resets?: readonly string[];
  readonly label: string;
  /** Shows the label before the select; otherwise it names it for screen readers. */
  readonly visibleLabel?: boolean;
  readonly className?: string;
}

/** A filter select that applies as soon as something is chosen. */
export const UrlSelect = ({
  param,
  options,
  defaultValue,
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

    void setValues({ ...cleared(resets), [param]: chosen });
  };

  if (!visibleLabel) {
    return (
      <Select
        aria-label={label}
        className={className}
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
        className={className}
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

  const search = (next: string, options?: Options) => {
    void setValues(
      { ...cleared(resets), [param]: next === "" ? null : next },
      options
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
            const next = event.currentTarget.value;

            search(
              next,
              next.trim() === ""
                ? undefined
                : { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) }
            );
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
