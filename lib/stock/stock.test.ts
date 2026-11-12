import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adjustStock } from "@/lib/stock/adjust";
import { StockError } from "@/lib/stock/errors";
import { movingAverageCost, receiveGoods } from "@/lib/stock/receive";
import {
  averageCostOf,
  createTestWorld,
  KUMASI,
  ledgerMismatches,
  onHand,
  SPINTEX,
} from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

beforeAll(async () => {
  world = await createTestWorld();
});

afterAll(async () => {
  await world.connection.close();
});

const receive = async (
  branchId: string,
  lines: { productId: number; quantity: number; unitCost: number }[],
  actor = world.admin
) =>
  await receiveGoods(world.db, actor, {
    branchId,
    lines,
    supplierId: world.supplierId,
  });

const rejection = async (promise: Promise<unknown>): Promise<StockError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof StockError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected the promise to reject with a StockError.");
};

describe("movingAverageCost", () => {
  it("weights the old average by the units already held", () => {
    expect(movingAverageCost(10, 100, 10, 200)).toBe(150);
    expect(movingAverageCost(30, 100, 10, 200)).toBe(125);
  });

  it("takes the new cost when nothing is held", () => {
    expect(movingAverageCost(0, 999, 5, 120)).toBe(120);
  });

  it("ignores a negative holding rather than inflating the cost", () => {
    expect(movingAverageCost(-4, 100, 10, 200)).toBe(200);
  });
});

describe("receiveGoods", () => {
  it("adds stock, numbers the receipt per branch and totals its cost", async () => {
    const first = await receive(SPINTEX, [
      { productId: world.products.rice, quantity: 40, unitCost: 10_000 },
      { productId: world.products.kettle, quantity: 6, unitCost: 15_050 },
    ]);

    const second = await receive(SPINTEX, [
      { productId: world.products.rice, quantity: 10, unitCost: 10_000 },
    ]);

    const kumasi = await receive(KUMASI, [
      { productId: world.products.rice, quantity: 5, unitCost: 10_000 },
    ]);

    expect(first.number).toBe("GRN-SPX-000001");
    expect(second.number).toBe("GRN-SPX-000002");
    expect(kumasi.number).toBe("GRN-KSI-000001");
    expect(first.totalCost).toBe(40 * 10_000 + 6 * 15_050);
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(50);
    expect(await onHand(world.db, KUMASI, world.products.rice)).toBe(5);
  });

  it("updates the moving average cost across all branches", async () => {
    // 55 rice held company-wide at GH₵100.00; receive 55 more at GH₵120.00.
    await receive(KUMASI, [
      { productId: world.products.rice, quantity: 55, unitCost: 12_000 },
    ]);
    expect(await averageCostOf(world.db, world.products.rice)).toBe(11_000);
  });

  it("rejects a product listed twice", async () => {
    const error = await rejection(
      receive(SPINTEX, [
        { productId: world.products.rice, quantity: 1, unitCost: 1 },
        { productId: world.products.rice, quantity: 2, unitCost: 1 },
      ])
    );

    expect(error.code).toBe("invalid_input");
  });

  it("rejects zero, fractional and absurd quantities", async () => {
    for (const quantity of [0, 1.5, 1_000_000]) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(
        receive(SPINTEX, [
          { productId: world.products.rice, quantity, unitCost: 1 },
        ])
      );

      expect(error.code).toBe("invalid_input");
    }
  });

  it("refuses discontinued products", async () => {
    const error = await rejection(
      receive(SPINTEX, [
        { productId: world.products.old, quantity: 1, unitCost: 1 },
      ])
    );

    expect(error.message).toMatch(/discontinued/u);
  });

  it("only lets branch staff receive at their own branch", async () => {
    const error = await rejection(
      receive(
        KUMASI,
        [{ productId: world.products.rice, quantity: 1, unitCost: 1 }],
        world.spintexStorekeeper
      )
    );

    expect(error.code).toBe("forbidden");

    await expect(
      receive(
        SPINTEX,
        [{ productId: world.products.kettle, quantity: 1, unitCost: 15_000 }],
        world.spintexStorekeeper
      )
    ).resolves.toMatchObject({ number: "GRN-SPX-000003" });
  });
});

describe("adjustStock", () => {
  it("writes damaged stock off", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.kettle);

    const result = await adjustStock(world.db, world.spintexStorekeeper, {
      branchId: SPINTEX,
      mode: "change",
      productId: world.products.kettle,
      quantity: 2,
      reason: "damaged",
    });

    expect(result.quantity).toBe(-2);
    expect(result.balanceAfter).toBe(before - 2);
  });

  it("never takes stock below zero, and records nothing when it refuses", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.kettle);

    const error = await rejection(
      adjustStock(world.db, world.spintexManager, {
        branchId: SPINTEX,
        mode: "change",
        note: "Shelf empty",
        productId: world.products.kettle,
        quantity: before + 1,
        reason: "theft",
      })
    );

    expect(error.code).toBe("insufficient_stock");
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(before);
    expect(await ledgerMismatches(world.db)).toEqual([]);
  });

  it("lets only one of two racing write-offs take the last units", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.kettle);

    const takeMost = async () =>
      await adjustStock(world.db, world.spintexManager, {
        branchId: SPINTEX,
        mode: "change",
        note: "Staff canteen",
        productId: world.products.kettle,
        quantity: before - 1,
        reason: "internal_use",
      });

    const results = await Promise.allSettled([takeMost(), takeMost()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(1);
  });

  it("sets the balance to a counted figure", async () => {
    const result = await adjustStock(world.db, world.spintexManager, {
      branchId: SPINTEX,
      counted: 47,
      mode: "count",
      productId: world.products.rice,
    });

    expect(result.quantity).toBe(47 - 50);
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(47);
  });

  it("says so when a count matches", async () => {
    const error = await rejection(
      adjustStock(world.db, world.spintexManager, {
        branchId: SPINTEX,
        counted: 47,
        mode: "count",
        productId: world.products.rice,
      })
    );

    expect(error.code).toBe("no_change");
  });

  it("counts a product the branch has never stocked", async () => {
    const result = await adjustStock(world.db, world.admin, {
      branchId: KUMASI,
      counted: 3,
      mode: "count",
      productId: world.products.kettle,
    });

    expect(result).toMatchObject({ balanceAfter: 3, quantity: 3 });
  });

  it("keeps theft, counts and found stock for managers", async () => {
    const attempts = [
      { mode: "count", counted: 1 },
      { mode: "change", note: "x", quantity: 1, reason: "theft" },
      { mode: "change", note: "x", quantity: 1, reason: "found" },
    ] as const;

    for (const attempt of attempts) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(
        adjustStock(world.db, world.spintexStorekeeper, {
          ...attempt,
          branchId: SPINTEX,
          productId: world.products.rice,
        })
      );

      expect(error.code).toBe("forbidden");
      expect(error.message).toMatch(/manager/u);
    }
  });

  it("requires a note for theft", async () => {
    const error = await rejection(
      adjustStock(world.db, world.spintexManager, {
        branchId: SPINTEX,
        mode: "change",
        productId: world.products.rice,
        quantity: 1,
        reason: "theft",
      })
    );

    expect(error.message).toMatch(/note/u);
  });

  it("keeps every balance equal to the sum of its movements", async () => {
    expect(await ledgerMismatches(world.db)).toEqual([]);
  });
});
