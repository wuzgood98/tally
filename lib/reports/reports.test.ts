import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { stockMovement } from "@/lib/db/schema";
import { reportBranchIds, reportPeriod } from "@/lib/reports/period";
import { getSellers } from "@/lib/reports/sellers";
import { getShrinkage } from "@/lib/reports/shrinkage";
import { getStockValueSeries } from "@/lib/reports/stock-value";
import { adjustStock } from "@/lib/stock/adjust";
import { receiveGoods } from "@/lib/stock/receive";
import { returnSale } from "@/lib/stock/returns";
import { recordSale } from "@/lib/stock/sales";
import { dispatchTransfer, receiveTransfer } from "@/lib/stock/transfer";
import { createTestWorld, KUMASI, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

const RICE_PRICE = 15_000;
const BOTH = [KUMASI, SPINTEX];

/** A week's report, run a moment after the test's last movement. */
const lastWeek = () => reportPeriod(7, new Date(Date.now() + 1000));

/**
 * One product's month, in pesewas:
 * - Spintex receives 10 at 100, Kumasi 10 at 200: average 150.
 * - Kumasi sends Spintex 5 (out at 150). While they're on the road Spintex
 *   receives 10 at 300: average (20 × 150 + 10 × 300) ÷ 30 = 200.
 * - 4 of the 5 arrive (in at 150, their cost at dispatch); 1 is lost.
 * - Spintex sells 3 (out at 200); 1 comes back damaged (in and written off
 *   at 200); 1 is stolen (out at 200).
 */
beforeAll(async () => {
  world = await createTestWorld();
  const { db, admin, products, supplierId } = world;
  const { rice } = products;

  await receiveGoods(db, admin, {
    branchId: SPINTEX,
    lines: [{ productId: rice, quantity: 10, unitCost: 100 }],
    supplierId,
  });
  await receiveGoods(db, admin, {
    branchId: KUMASI,
    lines: [{ productId: rice, quantity: 10, unitCost: 200 }],
    supplierId,
  });

  const sent = await dispatchTransfer(db, world.kumasiManager, {
    fromBranchId: KUMASI,
    lines: [{ productId: rice, quantity: 5 }],
    toBranchId: SPINTEX,
  });

  await receiveGoods(db, admin, {
    branchId: SPINTEX,
    lines: [{ productId: rice, quantity: 10, unitCost: 300 }],
    supplierId,
  });
  await receiveTransfer(db, world.spintexStorekeeper, {
    lines: [{ productId: rice, quantityReceived: 4 }],
    note: "One bag split on the truck",
    transferId: sent.id,
  });

  const sale = await recordSale(db, world.spintexCashier, {
    branchId: SPINTEX,
    clientRef: "REPORT-1",
    lines: [{ productId: rice, quantity: 3 }],
    paymentMethod: "cash",
  });

  await returnSale(db, world.spintexManager, {
    lines: [{ disposition: "damaged", productId: rice, quantity: 1 }],
    reason: "Bag torn",
    saleId: sale.id,
  });
  await adjustStock(db, world.spintexManager, {
    branchId: SPINTEX,
    mode: "change",
    note: "Missing after stock check",
    productId: rice,
    quantity: 1,
    reason: "theft",
  });
});

afterAll(async () => {
  await world.connection.close();
});

describe("movement cost", () => {
  it("records a cost on every movement: the caller's, or the average now", async () => {
    const rows = await world.db
      .select({
        kind: stockMovement.kind,
        quantity: stockMovement.quantity,
        unitCost: stockMovement.unitCost,
      })
      .from(stockMovement)
      .where(eq(stockMovement.productId, world.products.rice))
      .orderBy(stockMovement.id);

    expect(rows.map((row) => [row.kind, row.quantity, row.unitCost])).toEqual([
      ["receipt", 10, 100],
      ["receipt", 10, 200],
      ["transfer_out", -5, 150],
      ["receipt", 10, 300],
      ["transfer_in", 4, 150],
      ["sale", -3, 200],
      ["sale_return", 1, 200],
      ["adjustment", -1, 200],
      ["adjustment", -1, 200],
    ]);
  });
});

describe("stock value over time", () => {
  it("values each branch at its running book value, today last", async () => {
    const series = await getStockValueSeries(world.db, BOTH, lastWeek());

    expect(series).toHaveLength(7);
    expect(series.slice(0, -1).every((day) => day.total === 0)).toBe(true);
    // Spintex: 1,000 + 3,000 + 600 − 600 + 200 − 200 − 200. Kumasi: 2,000 − 750.
    expect(series.at(-1)).toMatchObject({
      byBranch: { [KUMASI]: 1250, [SPINTEX]: 3800 },
      inTransit: 0,
      onShelves: 5050,
      total: 5050,
    });
  });

  it("counts goods on the road towards the branch they're going to", async () => {
    const sent = await dispatchTransfer(world.db, world.spintexManager, {
      fromBranchId: SPINTEX,
      lines: [{ productId: world.products.rice, quantity: 2 }],
      toBranchId: KUMASI,
    });

    const [kumasi, spintex] = await Promise.all([
      getStockValueSeries(world.db, [KUMASI], lastWeek()),
      getStockValueSeries(world.db, [SPINTEX], lastWeek()),
    ]);

    expect(kumasi.at(-1)).toMatchObject({ inTransit: 400, onShelves: 1250 });
    expect(spintex.at(-1)).toMatchObject({ inTransit: 0, onShelves: 3400 });

    await receiveTransfer(world.db, world.kumasiStorekeeper, {
      lines: [{ productId: world.products.rice, quantityReceived: 2 }],
      transferId: sent.id,
    });

    const after = await getStockValueSeries(world.db, [KUMASI], lastWeek());

    expect(after.at(-1)).toMatchObject({ inTransit: 0, onShelves: 1650 });
  });

  it("returns nothing for no branches", async () => {
    expect(await getStockValueSeries(world.db, [], lastWeek())).toEqual([]);
  });
});

describe("sellers", () => {
  it("nets returns off units, takings and cost, with days of cover", async () => {
    const [rice] = await getSellers(world.db, [SPINTEX], lastWeek());

    // Spintex now holds 20 − 2 sent to Kumasi = 18; 2 net sold in 7 days.
    expect(rice).toMatchObject({
      cost: 400,
      daysOfCover: 63,
      margin: 2 * RICE_PRICE - 400,
      onHand: 18,
      productId: world.products.rice,
      returnedUnits: 1,
      sales: 2 * RICE_PRICE,
      units: 2,
    });
  });

  it("lists stock that hasn't sold, and leaves out lines with neither", async () => {
    const rows = await getSellers(world.db, [KUMASI], lastWeek());

    expect(rows).toEqual([
      expect.objectContaining({
        daysOfCover: null,
        onHand: 7,
        productId: world.products.rice,
        units: 0,
      }),
    ]);
  });
});

describe("shrinkage", () => {
  it("costs each loss where it happened, and transit losses by route", async () => {
    const report = await getShrinkage(world.db, [SPINTEX], lastWeek());

    expect(report.lines).toEqual([
      { branchId: SPINTEX, cause: "returned_damaged", units: -1, value: -200 },
      { branchId: SPINTEX, cause: "theft", units: -1, value: -200 },
    ]);
    expect(report.transit).toEqual([
      {
        fromBranchId: KUMASI,
        toBranchId: SPINTEX,
        transfers: 1,
        units: 1,
        value: 150,
      },
    ]);
    // Three sold at 200, one returned.
    expect(report.salesCost).toEqual({ [SPINTEX]: 400 });
  });

  it("shows a transit loss to either end of the route", async () => {
    const report = await getShrinkage(world.db, [KUMASI], lastWeek());

    expect(report.lines).toEqual([]);
    expect(report.transit).toHaveLength(1);
  });
});

describe("who sees which branches", () => {
  const all = [KUMASI, SPINTEX];

  it("follows the switcher for head office", () => {
    expect(reportBranchIds(world.admin, { kind: "all" }, all)).toEqual(all);
    expect(
      reportBranchIds(world.admin, { branchId: KUMASI, kind: "branch" }, all)
    ).toEqual([KUMASI]);
  });

  it("keeps a manager to their own branch, whatever the switcher says", () => {
    expect(reportBranchIds(world.spintexManager, { kind: "all" }, all)).toEqual(
      [SPINTEX]
    );
    expect(
      reportBranchIds(
        world.spintexManager,
        { branchId: KUMASI, kind: "branch" },
        all
      )
    ).toEqual([SPINTEX]);
  });

  it("shows storekeepers and cashiers nothing", () => {
    expect(
      reportBranchIds(world.spintexStorekeeper, { kind: "all" }, all)
    ).toEqual([]);
    expect(reportBranchIds(world.spintexCashier, { kind: "all" }, all)).toEqual(
      []
    );
  });
});
