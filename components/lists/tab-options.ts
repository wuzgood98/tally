import type { EnumFilter } from "@/lib/search-params";

/** One tab of a list's main filter (`UrlTabs`). */
export interface TabOption {
  readonly value: string;
  readonly label: string;
  /** The list with this tab chosen, for a new tab or without JavaScript. */
  readonly href: string;
}

/**
 * A tab per value of the filter, each linking to the list filtered by it.
 * `href` gets null for the default, so its link drops the param. Kept out of
 * the client file so server pages can call it.
 */
export const tabOptions = <Value extends string>(
  filter: EnumFilter<Value>,
  labels: Readonly<Record<Value, string>>,
  href: (value: Value | null) => string
): TabOption[] =>
  filter.values.map((value) => ({
    href: href(value === filter.defaultValue ? null : value),
    label: labels[value],
    value,
  }));
