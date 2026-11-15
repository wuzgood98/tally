/**
 * Ghana cedis. Amounts are integers in pesewas (GH₵1 = 100 pesewas) everywhere
 * except at the edges: parse on the way in, format on the way out.
 */

const PESEWAS_PER_CEDI = 100;

const cedis = new Intl.NumberFormat("en-GH", {
  currency: "GHS",
  style: "currency",
});

const compactCedis = new Intl.NumberFormat("en-GH", {
  compactDisplay: "short",
  currency: "GHS",
  // Three figures everywhere: "GH₵601K" beside "GH₵693K", never "GH₵601.2K".
  maximumSignificantDigits: 3,
  notation: "compact",
  style: "currency",
});

/** 123456 → "GH₵1,234.56" */
export const formatCedis = (pesewas: number): string =>
  cedis.format(pesewas / PESEWAS_PER_CEDI);

/** 123456789 → "GH₵1.23M", for dashboard totals. */
export const formatCedisCompact = (pesewas: number): string =>
  compactCedis.format(pesewas / PESEWAS_PER_CEDI);

/** Accepts "12", "12.5", "1,234.50", "GH₵ 12.00"; at most two decimal places. */
const CEDI_PATTERN =
  /^(?:GH₵|GHS|₵)?\s*(?<whole>\d{1,3}(?:,\d{3})+|\d+)(?:\.(?<fraction>\d{1,2}))?$/iu;

/** Parses a typed cedi amount into pesewas, or returns null if it isn't one. */
export const parseCedis = (input: string): number | null => {
  const match = CEDI_PATTERN.exec(input.trim());

  if (match === null) {
    return null;
  }

  const { whole = "", fraction = "" } = match.groups ?? {};

  const pesewas =
    Number(whole.replaceAll(",", "")) * PESEWAS_PER_CEDI +
    Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(pesewas) ? pesewas : null;
};

/** For prefilling inputs: 1250 → "12.50" (no symbol, no grouping). */
export const pesewasToInput = (pesewas: number): string =>
  (pesewas / PESEWAS_PER_CEDI).toFixed(2);
