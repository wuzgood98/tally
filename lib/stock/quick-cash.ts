/**
 * Cash at the till: what a customer is likely to hand over, and what that
 * leaves to hand back. Amounts are pesewas.
 */
import { PESEWAS_PER_CEDI, parseCedis } from "@/lib/money";

/** Rounding steps, in cedis: GH₵5 up to GH₵200, as the notes go. */
const STEPS = [5, 10, 20, 50, 100, 200] as const;

const SUGGESTIONS = 3;

/** Up to three round amounts above the total, smallest first. */
export const quickCash = (total: number): number[] => {
  if (total <= 0) {
    return [];
  }

  const amounts = new Set<number>();

  for (const step of STEPS) {
    const unit = step * PESEWAS_PER_CEDI;
    const rounded = Math.ceil(total / unit) * unit;

    // An exact match is the "Exact" button's job.
    if (rounded > total) {
      amounts.add(rounded);
    }
  }

  return [...amounts].toSorted((a, b) => a - b).slice(0, SUGGESTIONS);
};

/** The Charge button and its shortcut agree on when a sale can be rung up. */
export const canCharge = (total: number, pending: boolean): boolean =>
  total > 0 && !pending;

/** The cash field, read once against the total. */
export type Tender =
  | { readonly kind: "none" }
  | { readonly kind: "invalid" }
  | {
      readonly kind: "short";
      readonly tendered: number;
      readonly amount: number;
    }
  | {
      readonly kind: "change";
      readonly tendered: number;
      /** Zero when the customer paid exactly. */
      readonly amount: number;
    };

export const NO_TENDER: Tender = { kind: "none" };

/** What the typed cash means: nothing yet, a typo, still owed, or change. */
export const readTender = (received: string, total: number): Tender => {
  if (received.trim() === "") {
    return NO_TENDER;
  }

  const tendered = parseCedis(received);

  if (tendered === null) {
    return { kind: "invalid" };
  }

  return tendered < total
    ? { amount: total - tendered, kind: "short", tendered }
    : { amount: tendered - total, kind: "change", tendered };
};

/** Change to hand back, or null when none is due. */
export const changeDue = (tender: Tender): number | null =>
  tender.kind === "change" && tender.amount > 0 ? tender.amount : null;
