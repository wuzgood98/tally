/**
 * Step two of adopting collections: on-demand sync. The other till
 * collections load everything up front (eager); a store's sales history is
 * too long for that, and the endpoint can filter, sort and page on the
 * server, so this collection loads only the subsets live queries ask for
 * (`syncMode: "on-demand"`). A live query's `where`, `orderBy`, `limit` and
 * `offset` arrive in `queryFn` as `loadSubsetOptions`; `historySearchParams`
 * turns them into the endpoint's query string, and refuses anything the
 * endpoint can't do rather than quietly dropping it.
 */

import type { QueryClient } from "@tanstack/query-core";
import {
  parseLoadSubsetOptions,
  queryCollectionOptions,
} from "@tanstack/query-db-collection";
import type {
  ParsedOrderBy,
  SimpleComparison,
} from "@tanstack/query-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import type { LoadSubsetOptions } from "@tanstack/react-db";
import { z } from "zod";

import { requestJson } from "@/lib/till/client/http";
import {
  HISTORY_PAGE_MAX,
  HISTORY_PARAMS,
  HISTORY_SORT_FIELDS,
  historyReply,
  historySale,
} from "@/lib/till/history-contract";

export const HISTORY_COLLECTION_ID = "till-sale-history";

/** The query key every subset's key starts with, so invalidating it reaches them all. */
const HISTORY_KEY = ["till", "sale-history"] as const;

/** A live query asked for something the history endpoint can't filter or sort by. */
export class UnsupportedHistoryQueryError extends Error {
  constructor(message: string) {
    super(`The sales history can't do this: ${message}`);
    this.name = "UnsupportedHistoryQueryError";
  }
}

/** A time as the endpoint takes it: the ISO string the browser compares by. */
const instant = z
  .union([z.iso.datetime({ offset: true }), z.date()])
  .transform((value) => new Date(value).toISOString());

const text = z.string().min(1);
const methods = z.array(text).min(1);
const amount = z.int().nonnegative();

const isSortField = (
  field: string
): field is (typeof HISTORY_SORT_FIELDS)[number] =>
  HISTORY_SORT_FIELDS.some((known) => known === field);

/** Puts one of the live query's comparisons on the query string, or refuses it. */
const addFilter = (
  params: URLSearchParams,
  { field, operator, value }: SimpleComparison
): void => {
  const name = `${field.join(".")}.${operator}`;

  switch (name) {
    case "branchId.eq": {
      params.set(HISTORY_PARAMS.branch, text.parse(value));

      return;
    }

    case "createdAt.gte": {
      params.set(HISTORY_PARAMS.from, instant.parse(value));

      return;
    }

    case "createdAt.lt": {
      params.set(HISTORY_PARAMS.to, instant.parse(value));

      return;
    }

    case "createdAt.eq": {
      params.set(HISTORY_PARAMS.at, instant.parse(value));

      return;
    }

    case "total.eq": {
      params.set(HISTORY_PARAMS.totalIs, String(amount.parse(value)));

      return;
    }

    case "paymentMethod.eq": {
      params.append(HISTORY_PARAMS.payment, text.parse(value));

      return;
    }

    case "paymentMethod.in": {
      for (const method of methods.parse(value)) {
        params.append(HISTORY_PARAMS.payment, method);
      }

      return;
    }

    default: {
      throw new UnsupportedHistoryQueryError(`filter ${name}.`);
    }
  }
};

/** The one sort the endpoint can do, or a refusal. */
const addSort = (
  params: URLSearchParams,
  sorts: readonly ParsedOrderBy[]
): void => {
  const [sort, ...extra] = sorts;

  if (extra.length > 0) {
    throw new UnsupportedHistoryQueryError("it sorts by one field.");
  }

  if (sort === undefined) {
    return;
  }

  const field = sort.field.join(".");

  if (!isSortField(field)) {
    throw new UnsupportedHistoryQueryError(`sort by ${field}.`);
  }

  // Times are ISO strings: sorted as plain strings they're in time order,
  // which the server matches. A locale-aware sort it can't match, and core
  // would fall back to loading every matching sale. (Totals are numbers, so
  // the string collation core reports for them doesn't apply.)
  if (field === "createdAt" && sort.stringSort === "locale") {
    throw new UnsupportedHistoryQueryError(
      `a locale-aware sort; order by ${field} with stringSort: "lexical".`
    );
  }

  params.set(HISTORY_PARAMS.sort, `${field}:${sort.direction}`);
};

/** The page: a limit (or an exact sort value, for a page's edge), and an offset. */
const addPage = (
  params: URLSearchParams,
  limit: number | undefined,
  offset: number | undefined
): void => {
  const exact =
    params.has(HISTORY_PARAMS.at) || params.has(HISTORY_PARAMS.totalIs);

  const window =
    params.has(HISTORY_PARAMS.from) && params.has(HISTORY_PARAMS.to);

  // Without a limit TanStack DB wants every matching sale (a page came back
  // short). Fine for a day, or the sales tied at a page's edge; refused for
  // anything open-ended, since the server would have to cut it off.
  if (limit === undefined && !exact && !window) {
    throw new UnsupportedHistoryQueryError(
      "every sale at once; give it a time window or a limit."
    );
  }

  if (limit !== undefined) {
    if (limit > HISTORY_PAGE_MAX) {
      throw new UnsupportedHistoryQueryError(
        `more than ${String(HISTORY_PAGE_MAX)} sales at once.`
      );
    }

    params.set(HISTORY_PARAMS.limit, String(limit));
  }

  if (offset !== undefined && offset > 0) {
    params.set(HISTORY_PARAMS.offset, String(offset));
  }
};

/**
 * The endpoint's query string for one subset. Throws
 * `UnsupportedHistoryQueryError` for any filter, sort or page it doesn't
 * support, rather than dropping it.
 */
export const historySearchParams = (
  subset: LoadSubsetOptions | undefined
): URLSearchParams => {
  const { filters, sorts, limit } = parseLoadSubsetOptions(subset);
  const params = new URLSearchParams();

  for (const comparison of filters) {
    addFilter(params, comparison);
  }

  if (!params.has(HISTORY_PARAMS.branch)) {
    throw new UnsupportedHistoryQueryError("it needs one store (branchId).");
  }

  addSort(params, sorts);
  addPage(params, limit, subset?.offset);

  return params;
};

/**
 * Each subset gets its own query key under the shared prefix: the base key
 * (no subset) is the prefix of every derived one, as TanStack Query's prefix
 * matching needs.
 */
const historyKey = (subset: LoadSubsetOptions) => {
  if (subset.where === undefined) {
    return [...HISTORY_KEY];
  }

  try {
    return [...HISTORY_KEY, historySearchParams(subset).toString()];
  } catch {
    // queryFn throws the same error and reports it; the key only has to be stable.
    return [...HISTORY_KEY, "unsupported"];
  }
};

export const createHistoryCollection = (queryClient: QueryClient) => {
  const history = createCollection(
    queryCollectionOptions({
      getKey: (item) => item.id,
      id: HISTORY_COLLECTION_ID,
      queryClient,
      queryFn: async ({ meta, signal }) =>
        await requestJson(
          `/api/till/sales/history?${historySearchParams(meta?.loadSubsetOptions).toString()}`,
          historyReply,
          { signal }
        ),
      queryKey: historyKey,
      schema: historySale,
      select: (reply) => reply.sales,
      staleTime: 60_000,
      syncMode: "on-demand",
    })
  );

  // The history's live queries sort by these. An index only serves a query
  // with the same comparison, so these match it: plain (lexical) string order
  // for the ISO times, nulls first, TanStack DB's default.
  const sortsLike = {
    compareOptions: { direction: "asc", nulls: "first", stringSort: "lexical" },
  } as const;

  history.createIndex((row) => row.createdAt, {
    indexType: BasicIndex,
    options: sortsLike,
  });
  history.createIndex((row) => row.total, {
    indexType: BasicIndex,
    options: sortsLike,
  });

  return history;
};

export type HistoryCollection = ReturnType<typeof createHistoryCollection>;
