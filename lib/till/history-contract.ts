/**
 * The sales-history endpoint's contract (`GET /api/till/sales/history`),
 * shared by the browser, which builds the query string from a live query,
 * and the server, which parses it. The parameter names mirror TanStack DB's
 * comparisons (`field.operator`), so the mapping either side reads as one.
 *
 * Everything is on an allow-list: one store, a time window, payment methods,
 * one sort, a page, and an exact value of the sort field. TanStack DB asks
 * for that last one to fetch every sale tied at the edge of a page (it pages
 * with the sort value, so ties could otherwise fall between pages). Anything else is a 400, never ignored, since ignoring a
 * filter under a limit would hand back the wrong page of sales.
 */

import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/stock/payment";
import { tillSale } from "@/lib/till/schema";

export const HISTORY_PAGE_MAX = 100;

/**
 * A request without a limit asks for every sale in its window: TanStack DB
 * does that when a page comes back short and it wants the whole set. Allowed
 * only for a bounded window (a time range, or an exact sort value), and only
 * up to this many sales; beyond that it's an error, never a silent cut.
 */
export const HISTORY_WINDOW_MAX = 1000;

/** How far back a page can start: the offset is a cheap pager, not a cursor. */
const HISTORY_OFFSET_MAX = 10_000;

export const HISTORY_SORT_FIELDS = ["createdAt", "total"] as const;

export type HistorySortField = (typeof HISTORY_SORT_FIELDS)[number];

/** The query string, by name. */
export const HISTORY_PARAMS = {
  at: "createdAt.eq",
  branch: "branchId",
  from: "createdAt.gte",
  limit: "limit",
  offset: "offset",
  payment: "paymentMethod",
  sort: "sort",
  to: "createdAt.lt",
  totalIs: "total.eq",
} as const;

const isoDateTime = z.iso.datetime({ offset: true });

export const historyQuery = z
  .object({
    /** Sales recorded at exactly this instant. */
    at: isoDateTime.optional(),
    branchId: z.string().min(1),
    /** Sales at or after this instant. */
    from: isoDateTime.optional(),
    /** A page of this many; left out, every sale in the (bounded) window. */
    limit: z.coerce.number().int().min(1).max(HISTORY_PAGE_MAX).optional(),
    offset: z.coerce.number().int().min(0).max(HISTORY_OFFSET_MAX).default(0),
    /** Any of these; all methods when left out. */
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1).optional(),
    sort: z
      .object({
        direction: z.enum(["asc", "desc"]),
        field: z.enum(HISTORY_SORT_FIELDS),
      })
      .default({ direction: "desc", field: "createdAt" }),
    /** Sales before this instant. */
    to: isoDateTime.optional(),
    /** Sales of exactly this total, in pesewas. */
    totalIs: z.coerce.number().int().nonnegative().optional(),
  })
  .refine(
    (query) =>
      query.limit !== undefined ||
      (query.from !== undefined && query.to !== undefined) ||
      query.at !== undefined ||
      query.totalIs !== undefined,
    {
      message:
        "Give a limit, or a time window (createdAt.gte and createdAt.lt) to load all of.",
      path: ["limit"],
    }
  );

export type HistoryQuery = z.output<typeof historyQuery>;

/** A sale in the history: always one Tally recorded, so it has its id and number. */
export const historySale = tillSale.extend({
  id: z.int().positive(),
  number: z.string(),
});

export type HistorySale = z.output<typeof historySale>;

export const historyReply = z.object({ sales: z.array(historySale) });

const SORT = /^(?<field>[A-Za-z]+):(?<direction>asc|desc)$/u;

export type ParsedHistory =
  | { readonly ok: true; readonly query: HistoryQuery }
  | { readonly ok: false; readonly message: string };

const KNOWN = new Set<string>(Object.values(HISTORY_PARAMS));

/** The one parameter that may repeat: each is another payment method. */
const REPEATABLE = new Set<string>([HISTORY_PARAMS.payment]);

/**
 * Reads the query string. A parameter that isn't on the list, or one given
 * twice that takes a single value, is an error, not ignored.
 */
export const parseHistoryParams = (params: URLSearchParams): ParsedHistory => {
  const keys = [...params.keys()];
  const unknown = keys.find((key) => !KNOWN.has(key));

  if (unknown !== undefined) {
    return {
      message: `${unknown}: not a filter this list supports.`,
      ok: false,
    };
  }

  const repeated = keys.find(
    (key, index) => !REPEATABLE.has(key) && keys.indexOf(key) !== index
  );

  if (repeated !== undefined) {
    return { message: `${repeated}: give it once.`, ok: false };
  }

  const sortText = params.get(HISTORY_PARAMS.sort);
  const sort = SORT.exec(sortText ?? "")?.groups;
  const payments = params.getAll(HISTORY_PARAMS.payment);

  const parsed = historyQuery.safeParse({
    at: params.get(HISTORY_PARAMS.at) ?? undefined,
    branchId: params.get(HISTORY_PARAMS.branch) ?? "",
    from: params.get(HISTORY_PARAMS.from) ?? undefined,
    limit: params.get(HISTORY_PARAMS.limit) ?? undefined,
    offset: params.get(HISTORY_PARAMS.offset) ?? undefined,
    paymentMethods: payments.length === 0 ? undefined : payments,
    sort:
      sortText === null
        ? undefined
        : { direction: sort?.direction, field: sort?.field },
    to: params.get(HISTORY_PARAMS.to) ?? undefined,
    totalIs: params.get(HISTORY_PARAMS.totalIs) ?? undefined,
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;

    return {
      message:
        issue === undefined
          ? "Check the filters."
          : `${issue.path.join(".") || "query"}: ${issue.message}`,
      ok: false,
    };
  }

  return { ok: true, query: parsed.data };
};
