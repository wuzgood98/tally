import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sale } from "@/lib/db/schema";
import { receiveGoods } from "@/lib/stock/receive";
import { recordSale } from "@/lib/stock/sales";
import { getSaleHistory } from "@/lib/till/api";
import {
  HISTORY_WINDOW_MAX,
  historyQuery,
  parseHistoryParams,
} from "@/lib/till/history-contract";
import type { HistoryQuery } from "@/lib/till/history-contract";
import { createTestWorld, KUMASI, rejection, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

/** Five Spintex sales, an hour apart from 08:00 on 10 November, and one at Kumasi. */
const SPINTEX_SALES = [
  { at: "2026-11-10T08:00:00.000Z", method: "cash", quantity: 1 },
  { at: "2026-11-10T09:00:00.000Z", method: "card", quantity: 3 },
  { at: "2026-11-10T10:00:00.000Z", method: "cash", quantity: 2 },
  { at: "2026-11-10T11:00:00.000Z", method: "mobile_money", quantity: 5 },
  { at: "2026-11-11T08:00:00.000Z", method: "cash", quantity: 4 },
] as const;

const query = (input: Partial<HistoryQuery> = {}): HistoryQuery =>
  historyQuery.parse({ branchId: SPINTEX, limit: 20, ...input });

beforeAll(async () => {
  world = await createTestWorld();

  for (const branchId of [SPINTEX, KUMASI]) {
    // oxlint-disable-next-line no-await-in-loop -- two receipts, one after the other
    await receiveGoods(world.db, world.admin, {
      branchId,
      lines: [
        { productId: world.products.rice, quantity: 50, unitCost: 10_000 },
      ],
      supplierId: world.supplierId,
    });
  }

  /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- sales in order, each backdated */
  for (const [index, item] of SPINTEX_SALES.entries()) {
    const recorded = await recordSale(world.db, world.spintexCashier, {
      branchId: SPINTEX,
      clientRef: `history-${String(index).padStart(4, "0")}`,
      lines: [{ productId: world.products.rice, quantity: item.quantity }],
      paymentMethod: item.method,
    });

    await world.db
      .update(sale)
      .set({ createdAt: new Date(item.at) })
      .where(eq(sale.id, recorded.id));
  }
  /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

  await recordSale(world.db, world.kumasiManager, {
    branchId: KUMASI,
    clientRef: "history-kumasi",
    lines: [{ productId: world.products.rice, quantity: 1 }],
    paymentMethod: "cash",
  });
});

afterAll(async () => {
  await world.connection.close();
});

describe("parseHistoryParams", () => {
  it("fills in the defaults", () => {
    expect(
      parseHistoryParams(new URLSearchParams("branchId=SPX&limit=20"))
    ).toEqual({
      ok: true,
      query: {
        branchId: SPINTEX,
        limit: 20,
        offset: 0,
        sort: { direction: "desc", field: "createdAt" },
      },
    });
  });

  it("takes a whole window without a limit", () => {
    expect(
      parseHistoryParams(
        new URLSearchParams(
          "branchId=SPX&createdAt.gte=2026-11-10T00:00:00.000Z&createdAt.lt=2026-11-11T00:00:00.000Z"
        )
      ).ok
    ).toBe(true);
  });

  it("reads every filter", () => {
    const parsed = parseHistoryParams(
      new URLSearchParams(
        "branchId=SPX&createdAt.gte=2026-11-10T00:00:00.000Z&createdAt.lt=2026-11-11T00:00:00.000Z&paymentMethod=cash&paymentMethod=card&sort=total:asc&limit=5&offset=10"
      )
    );

    expect(parsed).toMatchObject({
      ok: true,
      query: {
        from: "2026-11-10T00:00:00.000Z",
        limit: 5,
        offset: 10,
        paymentMethods: ["cash", "card"],
        sort: { direction: "asc", field: "total" },
        to: "2026-11-11T00:00:00.000Z",
      },
    });
  });

  it.each([
    ["an unknown parameter", "branchId=SPX&units.eq=2"],
    ["no store", "limit=5"],
    ["no limit and no window", "branchId=SPX"],
    [
      "no limit and half a window",
      "branchId=SPX&createdAt.gte=2026-11-10T00:00:00.000Z",
    ],
    ["too big a page", "branchId=SPX&limit=500"],
    ["a sort it can't do", "branchId=SPX&sort=units:desc"],
    ["a malformed sort", "branchId=SPX&sort=createdAt"],
    ["a time that isn't one", "branchId=SPX&createdAt.gte=yesterday"],
    ["an unknown payment method", "branchId=SPX&paymentMethod=cheque"],
  ])("refuses %s", (_label, search) => {
    expect(parseHistoryParams(new URLSearchParams(search)).ok).toBe(false);
  });
});

describe("getSaleHistory", () => {
  it("filters by time window and payment method, newest first", async () => {
    const rows = await getSaleHistory(
      world.db,
      world.spintexCashier,
      query({
        from: "2026-11-10T00:00:00.000Z",
        paymentMethods: ["cash", "card"],
        to: "2026-11-11T00:00:00.000Z",
      })
    );

    expect(
      rows.map((row) => [row.createdAt, row.paymentMethod, row.units])
    ).toEqual([
      ["2026-11-10T10:00:00.000Z", "cash", 2],
      ["2026-11-10T09:00:00.000Z", "card", 3],
      ["2026-11-10T08:00:00.000Z", "cash", 1],
    ]);
  });

  it("sorts by total and pages without overlap", async () => {
    const sorted = { direction: "asc", field: "total" } as const;

    const first = await getSaleHistory(
      world.db,
      world.spintexCashier,
      query({ limit: 2, sort: sorted })
    );

    const second = await getSaleHistory(
      world.db,
      world.spintexCashier,
      query({ limit: 2, offset: 2, sort: sorted })
    );

    expect([...first, ...second].map((row) => row.units)).toEqual([1, 2, 3, 4]);
    expect(first.every((row) => row.branchId === SPINTEX)).toBe(true);
  });

  it("finds the sales at an exact time, for the edge of a page", async () => {
    const rows = await getSaleHistory(
      world.db,
      world.spintexCashier,
      query({ at: "2026-11-10T11:00:00.000Z" })
    );

    expect(rows.map((row) => row.paymentMethod)).toEqual(["mobile_money"]);
  });

  it("returns a whole window when no limit is given", async () => {
    const rows = await getSaleHistory(
      world.db,
      world.spintexCashier,
      query({
        from: "2026-11-10T00:00:00.000Z",
        limit: undefined,
        to: "2026-11-12T00:00:00.000Z",
      })
    );

    expect(rows).toHaveLength(SPINTEX_SALES.length);
  });

  it("refuses a whole window too big to send, rather than cutting it off", async () => {
    const at = new Date("2020-01-01T08:00:00.000Z");

    await world.db.insert(sale).values(
      Array.from({ length: HISTORY_WINDOW_MAX + 1 }, (_, index) => ({
        branchId: KUMASI,
        clientRef: `bulk-${String(index).padStart(5, "0")}`,
        createdAt: at,
        number: `SAL-KSI-B${String(index).padStart(5, "0")}`,
        paymentMethod: "cash" as const,
        total: 100,
      }))
    );

    const error = await rejection(
      getSaleHistory(
        world.db,
        world.admin,
        query({
          branchId: KUMASI,
          from: "2020-01-01T00:00:00.000Z",
          limit: undefined,
          to: "2020-01-02T00:00:00.000Z",
        })
      )
    );

    expect(error.code).toBe("invalid_input");
  });

  it("keeps a cashier to their own store, but not a manager", async () => {
    const error = await rejection(
      getSaleHistory(
        world.db,
        world.spintexCashier,
        query({ branchId: KUMASI })
      )
    );

    expect(error.code).toBe("forbidden");

    const kumasi = await getSaleHistory(
      world.db,
      world.spintexManager,
      query({ branchId: KUMASI })
    );

    expect(kumasi.map((row) => row.clientRef)).toContain("history-kumasi");
  });
});
