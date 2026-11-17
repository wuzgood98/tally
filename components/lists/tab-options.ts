/** One tab of a list's main filter (`UrlTabs`). */
export interface TabOption {
  readonly value: string;
  readonly label: string;
  /** The list with this tab chosen, for a new tab or without JavaScript. */
  readonly href: string;
}

/**
 * Tabs for a fixed set of values, each linking to the list filtered by it.
 * Kept out of the client file so server pages can call it.
 */
export const tabOptions = <Value extends string>(
  values: readonly Value[],
  labels: Readonly<Record<Value, string>>,
  href: (value: Value) => string
): TabOption[] =>
  values.map((value) => ({ href: href(value), label: labels[value], value }));
