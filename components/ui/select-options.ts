import type { SelectOption } from "./select";

/** Options for rows that have an id and a name, like branches or suppliers. */
export const namedOptions = (
  rows: readonly { readonly id: number | string; readonly name: string }[]
): SelectOption[] =>
  rows.map((row) => ({ label: row.name, value: String(row.id) }));

/** Options for a fixed set of values with their labels. */
export const labelledOptions = <Value extends string>(
  values: readonly Value[],
  labels: Readonly<Record<Value, string>>
): SelectOption[] => values.map((value) => ({ label: labels[value], value }));
