import { QueryClient } from "@tanstack/query-core";
import {
  and,
  createLiveQueryCollection,
  eq,
  gte,
  inArray,
  lt,
} from "@tanstack/react-db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHistoryCollection } from "@/lib/till/client/history";
import type { HistoryCollection } from "@/lib/till/client/history";
import type { HistorySale } from "@/lib/till/history-contract";

const saleAt = (id: number, createdAt: string, total: number): HistorySale => ({
  branchId: "SPX",
  clientRef: `ref-${String(id).padStart(8, "0")}`,
  createdAt,
  expectedTotal: total,
  id,
  number: `SAL-SPX-${String(id).padStart(6, "0")}`,
  paymentMethod: "cash",
  total,
  units: 1,
});

const SALES = [
  saleAt(3, "2026-11-16T12:00:00.000Z", 9000),
  saleAt(2, "2026-11-16T11:00:00.000Z", 1000),
  saleAt(1, "2026-11-16T10:00:00.000Z", 5000),
];

let requested: URLSearchParams[] = [];
let queryClient: QueryClient;
let history: HistoryCollection;

beforeEach(() => {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      await Promise.resolve();
      const params = new URL(url, "http://till.test").searchParams;
      requested.push(params);
      const limit = Number(params.get("limit") ?? "100");
      const offset = Number(params.get("offset") ?? "0");

      return Response.json({ sales: SALES.slice(offset, offset + limit) });
    })
  );
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  history = createHistoryCollection(queryClient);
});

afterEach(async () => {
  queryClient.clear();
  await history.cleanup();
  vi.unstubAllGlobals();
});

describe("the on-demand sales history", () => {
  it("loads nothing until a live query asks", async () => {
    await history.preload();

    expect(requested).toEqual([]);
  });

  it("sends a live query's filters, sort and page to the endpoint", async () => {
    const day = createLiveQueryCollection((q) =>
      q
        .from({ sale: history })
        .where(({ sale }) =>
          and(
            eq(sale.branchId, "SPX"),
            gte(sale.createdAt, "2026-11-16T00:00:00.000Z"),
            lt(sale.createdAt, "2026-11-17T00:00:00.000Z"),
            inArray(sale.paymentMethod, ["cash", "card"])
          )
        )
        // Lexical: ISO times sort by time as plain strings, and the server can
        // do the same, so core can page with a cursor instead of loading all.
        .orderBy(({ sale }) => sale.createdAt, {
          direction: "desc",
          stringSort: "lexical",
        })
        .limit(2)
    );

    await day.preload();

    const [first] = requested;

    expect(first?.get("branchId")).toBe("SPX");
    expect(first?.get("createdAt.gte")).toBe("2026-11-16T00:00:00.000Z");
    expect(first?.get("createdAt.lt")).toBe("2026-11-17T00:00:00.000Z");
    expect(first?.getAll("paymentMethod")).toEqual(["cash", "card"]);
    expect(first?.get("sort")).toBe("createdAt:desc");
    expect(first?.get("limit")).toBe("2");
    // Then the sales tied with the window's last one, so a tie can't fall
    // between pages. Never the whole day: every request is bounded.
    expect(requested.map((params) => params.get("createdAt.eq"))).toEqual([
      null,
      "2026-11-16T11:00:00.000Z",
    ]);
    expect(
      requested.every(
        (params) => params.has("limit") || params.has("createdAt.eq")
      )
    ).toBe(true);
    expect(day.toArray.map((row) => row.id)).toEqual([3, 2]);

    await day.cleanup();
  });

  it("serves a short day by loading the whole window, not refusing it", async () => {
    // Fewer sales than the page: TanStack DB may then ask for the window's
    // whole set, with no limit. That's bounded by the day, so it's allowed.
    const cash = createLiveQueryCollection((q) =>
      q
        .from({ sale: history })
        .where(({ sale }) =>
          and(
            eq(sale.branchId, "SPX"),
            gte(sale.createdAt, "2026-11-16T00:00:00.000Z"),
            lt(sale.createdAt, "2026-11-17T00:00:00.000Z")
          )
        )
        .where(({ sale }) => eq(sale.paymentMethod, "cash"))
        .orderBy(({ sale }) => sale.createdAt, {
          direction: "desc",
          stringSort: "lexical",
        })
        .limit(20)
    );

    await cash.preload();

    expect(cash.toArray.map((row) => row.id)).toEqual([3, 2, 1]);
    expect(
      requested.every(
        (params) =>
          params.has("limit") ||
          params.has("createdAt.eq") ||
          (params.has("createdAt.gte") && params.has("createdAt.lt"))
      )
    ).toBe(true);
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.error !== null)
    ).toEqual([]);

    await cash.cleanup();
  });

  it("sorts by total on the server", async () => {
    const largest = createLiveQueryCollection((q) =>
      q
        .from({ sale: history })
        .where(({ sale }) => eq(sale.branchId, "SPX"))
        .orderBy(({ sale }) => sale.total, "desc")
        .limit(2)
    );

    await largest.preload();

    expect(requested[0]?.get("sort")).toBe("total:desc");

    await largest.cleanup();
  });

  it("refuses an unbounded or locale-sorted load instead of truncating it", async () => {
    const everything = createLiveQueryCollection((q) =>
      q.from({ sale: history }).where(({ sale }) => eq(sale.branchId, "SPX"))
    );

    const byLocale = createLiveQueryCollection((q) =>
      q
        .from({ sale: history })
        .where(({ sale }) => eq(sale.branchId, "SPX"))
        .orderBy(({ sale }) => sale.createdAt, "desc")
        .limit(2)
    );

    await Promise.all([
      everything.preload().catch(() => null),
      byLocale.preload().catch(() => null),
    ]);

    expect(
      requested.every(
        (params) => params.has("limit") || params.has("createdAt.eq")
      )
    ).toBe(true);
    expect(everything.toArray).toEqual([]);

    await Promise.all([everything.cleanup(), byLocale.cleanup()]);
  });

  it("refuses a filter the endpoint can't apply instead of dropping it", async () => {
    const odd = createLiveQueryCollection((q) =>
      q
        .from({ sale: history })
        .where(({ sale }) => and(eq(sale.branchId, "SPX"), eq(sale.units, 1)))
    );

    await odd.preload().catch(() => null);

    expect(requested).toEqual([]);
    expect(odd.toArray).toEqual([]);

    await odd.cleanup();
  });
});
