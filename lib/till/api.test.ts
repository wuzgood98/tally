import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { product, sale } from "@/lib/db/schema";
import { receiveGoods } from "@/lib/stock/receive";
import { recordSale } from "@/lib/stock/sales";
import {
  chargeTillSale,
  getTillCatalogue,
  getTillSales,
  getTillStockLevels,
  tillStoreIds,
} from "@/lib/till/api";
import {
  tillCatalogueReply,
  tillSaleReply,
  tillSalesReply,
  tillStockLevelsReply,
} from "@/lib/till/schema";
import { DAY_MS } from "@/lib/time";
import {
  createTestWorld,
  KUMASI,
  ledgerMismatches,
  onHand,
  rejection,
  saleMismatches,
  SPINTEX,
} from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;
let refs = 0;

const nextRef = (): string => {
  refs += 1;

  return `till-ref-${String(refs).padStart(4, "0")}`;
};

beforeAll(async () => {
  world = await createTestWorld();

  for (const branchId of [SPINTEX, KUMASI]) {
    // oxlint-disable-next-line no-await-in-loop -- two receipts, one after the other
    await receiveGoods(world.db, world.admin, {
      branchId,
      lines: [
        { productId: world.products.rice, quantity: 20, unitCost: 10_000 },
        { productId: world.products.kettle, quantity: 5, unitCost: 15_000 },
      ],
      supplierId: world.supplierId,
    });
  }
});

afterAll(async () => {
  await world.connection.close();
});

describe("till reads", () => {
  it("lists the stores each role may sell at", async () => {
    expect(await tillStoreIds(world.db, world.spintexCashier)).toEqual([
      SPINTEX,
    ]);
    expect(await tillStoreIds(world.db, world.spintexManager)).toEqual([
      SPINTEX,
    ]);
    expect(await tillStoreIds(world.db, world.spintexStorekeeper)).toEqual([]);
    expect(await tillStoreIds(world.db, world.admin)).toEqual([
      KUMASI,
      SPINTEX,
    ]);
  });

  it("serves active products with shelf prices and no costs", async () => {
    const products = await getTillCatalogue(world.db);

    expect(new Set(products.map((item) => item.id))).toEqual(
      new Set([world.products.rice, world.products.kettle])
    );

    for (const item of products) {
      expect(Object.keys(item)).not.toContain("averageCost");
    }

    expect(() => tillCatalogueReply.parse({ products })).not.toThrow();
  });

  it("gives a cashier only their own store's balances", async () => {
    const levels = await getTillStockLevels(world.db, world.spintexCashier);

    expect(levels.length).toBeGreaterThan(0);
    expect(new Set(levels.map((level) => level.branchId))).toEqual(
      new Set([SPINTEX])
    );
    expect(
      levels.find((level) => level.productId === world.products.rice)
    ).toMatchObject({ key: `${SPINTEX}:${String(world.products.rice)}` });
    expect(() => tillStockLevelsReply.parse({ levels })).not.toThrow();
    expect(
      await getTillStockLevels(world.db, world.spintexStorekeeper)
    ).toEqual([]);
  });
});

describe("charging from the till", () => {
  it("records the sale through the ledger and answers with fresh balances", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.rice);
    const clientRef = nextRef();

    const reply = await chargeTillSale(world.db, world.spintexCashier, {
      branchId: SPINTEX,
      clientRef,
      expectedTotal: 30_000,
      lines: [{ productId: world.products.rice, quantity: 2 }],
      paymentMethod: "cash",
    });

    expect(() => tillSaleReply.parse(reply)).not.toThrow();
    expect(reply.duplicate).toBe(false);
    expect(reply.sale).toMatchObject({
      branchId: SPINTEX,
      clientRef,
      expectedTotal: 30_000,
      total: 30_000,
      units: 2,
    });
    expect(reply.sale.number).toMatch(/^SAL-SPX-/u);
    expect(reply.levels).toEqual([
      {
        branchId: SPINTEX,
        key: `${SPINTEX}:${String(world.products.rice)}`,
        onHand: before - 2,
        productId: world.products.rice,
      },
    ]);
    expect(await ledgerMismatches(world.db)).toEqual([]);
    expect(await saleMismatches(world.db)).toEqual([]);
  });

  it("returns the first sale when the queue sends one again", async () => {
    const clientRef = nextRef();

    const body = {
      branchId: SPINTEX,
      clientRef,
      expectedTotal: 25_000,
      lines: [{ productId: world.products.kettle, quantity: 1 }],
      paymentMethod: "card" as const,
    };

    const first = await chargeTillSale(world.db, world.spintexCashier, body);
    const after = await onHand(world.db, SPINTEX, world.products.kettle);
    const again = await chargeTillSale(world.db, world.spintexCashier, body);

    expect(again.duplicate).toBe(true);
    expect(again.sale).toEqual(first.sale);
    expect(again.levels[0]?.onHand).toBe(after);
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(after);
  });

  it("charges the shelf price and keeps the till's total beside it", async () => {
    // The price went up while the sale sat in the till's offline queue.
    await world.db
      .update(product)
      .set({ sellPrice: 16_000 })
      .where(eq(product.id, world.products.rice));

    const reply = await chargeTillSale(world.db, world.spintexCashier, {
      branchId: SPINTEX,
      clientRef: nextRef(),
      expectedTotal: 15_000,
      lines: [{ productId: world.products.rice, quantity: 1 }],
      paymentMethod: "mobile_money",
    });

    expect(reply.sale.total).toBe(16_000);
    expect(reply.sale.expectedTotal).toBe(15_000);

    await world.db
      .update(product)
      .set({ sellPrice: 15_000 })
      .where(eq(product.id, world.products.rice));
  });

  it("refuses a store the cashier doesn't work at", async () => {
    const error = await rejection(
      chargeTillSale(world.db, world.spintexCashier, {
        branchId: KUMASI,
        clientRef: nextRef(),
        expectedTotal: 15_000,
        lines: [{ productId: world.products.rice, quantity: 1 }],
        paymentMethod: "cash",
      })
    );

    expect(error.code).toBe("forbidden");
  });
});

describe("the till's sales list", () => {
  it("lists today's sales by this person, each counting only its own units", async () => {
    // Someone else's sale at the same store stays off this cashier's list.
    await recordSale(world.db, world.spintexManager, {
      branchId: SPINTEX,
      clientRef: nextRef(),
      lines: [{ productId: world.products.rice, quantity: 7 }],
      paymentMethod: "cash",
    });

    const sales = await getTillSales(world.db, world.spintexCashier);

    expect(() => tillSalesReply.parse({ sales })).not.toThrow();
    expect(sales.map((item) => item.units)).toEqual([1, 1, 2]);
    expect(new Set(sales.map((item) => item.paymentMethod))).toEqual(
      new Set(["mobile_money", "card", "cash"])
    );
  });

  it("leaves out yesterday's sales", async () => {
    const tomorrow = new Date(Date.now() + DAY_MS);

    expect(await world.db.$count(sale)).toBeGreaterThan(0);
    expect(
      await getTillSales(world.db, world.spintexCashier, tomorrow)
    ).toEqual([]);
  });
});
