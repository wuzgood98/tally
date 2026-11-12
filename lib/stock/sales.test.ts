import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { branch, sale, saleLine, stockMovement } from "@/lib/db/schema";
import { adjustStock } from "@/lib/stock/adjust";
import { receiveGoods } from "@/lib/stock/receive";
import { returnSale } from "@/lib/stock/returns";
import { recordSale } from "@/lib/stock/sales";
import type { SaleRawInput } from "@/lib/stock/sales";
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

const RICE_PRICE = 15_000;
const KETTLE_PRICE = 25_000;
const WAREHOUSE = "TMA";

beforeAll(async () => {
  world = await createTestWorld();
  await world.db.insert(branch).values({
    address: "Harbour Road",
    city: "Tema",
    id: WAREHOUSE,
    kind: "warehouse",
    name: "Tema Distribution Centre",
    region: "Greater Accra",
  });
  await receiveGoods(world.db, world.admin, {
    branchId: SPINTEX,
    lines: [
      { productId: world.products.rice, quantity: 20, unitCost: 10_000 },
      { productId: world.products.kettle, quantity: 5, unitCost: 15_000 },
    ],
    supplierId: world.supplierId,
  });
});

afterAll(async () => {
  await world.connection.close();
});

/** A fresh till reference per sale, unless a test reuses one on purpose. */
const nextRef = (): string => {
  refs += 1;

  return `till-test-${String(refs).padStart(4, "0")}`;
};

const sell = async (
  lines: SaleRawInput["lines"],
  actor = world.spintexCashier,
  overrides: Partial<SaleRawInput> = {}
) =>
  await recordSale(world.db, actor, {
    branchId: SPINTEX,
    clientRef: nextRef(),
    lines,
    paymentMethod: "cash",
    ...overrides,
  });

const saleCount = async (): Promise<number> => {
  const [row] = await world.db.select({ total: count() }).from(sale);

  return row?.total ?? 0;
};

describe("recordSale", () => {
  it("takes stock out at the shelf price and keeps the cost of what was sold", async () => {
    const result = await sell([
      { productId: world.products.rice, quantity: 3 },
      { productId: world.products.kettle, quantity: 1 },
    ]);

    expect(result).toMatchObject({
      duplicate: false,
      number: "SAL-SPX-000001",
      total: 3 * RICE_PRICE + KETTLE_PRICE,
    });
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(17);
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(4);

    const lines = await world.db
      .select()
      .from(saleLine)
      .where(eq(saleLine.saleId, result.id));

    expect(lines).toContainEqual(
      expect.objectContaining({
        productId: world.products.rice,
        unitCost: 10_000,
        unitPrice: RICE_PRICE,
      })
    );
  });

  it("charges a price the till sends, for POS discounts", async () => {
    const result = await sell([
      { productId: world.products.rice, quantity: 1, unitPrice: 14_000 },
    ]);

    expect(result.total).toBe(14_000);
  });

  it("returns the first sale when a till sends the same one again", async () => {
    const clientRef = nextRef();
    const lines = [{ productId: world.products.rice, quantity: 2 }];
    const before = await onHand(world.db, SPINTEX, world.products.rice);

    const first = await sell(lines, world.spintexCashier, { clientRef });
    const again = await sell(lines, world.spintexCashier, { clientRef });

    expect(again).toEqual({ ...first, duplicate: true });
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(
      before - 2
    );
  });

  it("records a sale once when the same one arrives twice at the same moment", async () => {
    const clientRef = nextRef();
    const salesBefore = await saleCount();
    const before = await onHand(world.db, SPINTEX, world.products.rice);

    const send = async () =>
      await sell(
        [{ productId: world.products.rice, quantity: 1 }],
        world.spintexCashier,
        { clientRef }
      );

    const [a, b] = await Promise.all([send(), send()]);

    expect(a.id).toBe(b.id);
    expect([a.duplicate, b.duplicate].filter(Boolean)).toHaveLength(1);
    expect(await saleCount()).toBe(salesBefore + 1);
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(
      before - 1
    );

    // The duplicate rolled back, so it didn't use up a document number.
    const next = await sell([{ productId: world.products.rice, quantity: 1 }]);
    expect(next.number).toBe(
      `SAL-SPX-${String(salesBefore + 2).padStart(6, "0")}`
    );
  });

  it("sells stock the record says isn't there, and lets a count fix it", async () => {
    const kettles = await onHand(world.db, SPINTEX, world.products.kettle);

    await sell([{ productId: world.products.kettle, quantity: kettles + 2 }]);
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(-2);

    // Nothing else may take it lower.
    const writeOff = await rejection(
      adjustStock(world.db, world.spintexManager, {
        branchId: SPINTEX,
        mode: "change",
        productId: world.products.kettle,
        quantity: 1,
        reason: "damaged",
      })
    );

    expect(writeOff.code).toBe("insufficient_stock");

    const counted = await adjustStock(world.db, world.spintexManager, {
      branchId: SPINTEX,
      counted: 0,
      mode: "count",
      productId: world.products.kettle,
    });

    expect(counted.quantity).toBe(2);
  });

  it("sells a product the branch has never stocked", async () => {
    await sell(
      [{ productId: world.products.kettle, quantity: 1 }],
      world.admin,
      { branchId: KUMASI }
    );

    expect(await onHand(world.db, KUMASI, world.products.kettle)).toBe(-1);
  });

  it("is for cashiers and managers at their own store", async () => {
    const rice = [{ productId: world.products.rice, quantity: 1 }];

    const attempts = [
      sell(rice, world.spintexStorekeeper),
      sell(rice, world.spintexCashier, { branchId: KUMASI }),
    ];

    for (const attempt of attempts) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(attempt);
      expect(error.code).toBe("forbidden");
    }

    await expect(sell(rice, world.spintexManager)).resolves.toMatchObject({
      duplicate: false,
    });
  });

  it("refuses sales at the warehouse and bad baskets, writing nothing", async () => {
    const before = await saleCount();

    const attempts = [
      sell([{ productId: world.products.rice, quantity: 1 }], world.admin, {
        branchId: WAREHOUSE,
      }),
      sell([]),
      sell([{ productId: world.products.rice, quantity: 0 }]),
      sell([
        { productId: world.products.rice, quantity: 1 },
        { productId: world.products.rice, quantity: 1 },
      ]),
      sell([{ productId: world.products.rice, quantity: 1 }], world.admin, {
        clientRef: "short",
      }),
    ];

    for (const attempt of attempts) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(attempt);
      expect(error.code).toBe("invalid_input");
    }

    expect(await saleCount()).toBe(before);
  });
});

describe("returnSale", () => {
  let saleId = 0;

  beforeAll(async () => {
    ({ id: saleId } = await sell([
      { productId: world.products.rice, quantity: 3 },
    ]));
  });

  it("needs a manager", async () => {
    const error = await rejection(
      returnSale(world.db, world.spintexCashier, {
        lines: [
          {
            disposition: "restock",
            productId: world.products.rice,
            quantity: 1,
          },
        ],
        reason: "Wrong size",
        saleId,
      })
    );

    expect(error.code).toBe("forbidden");
  });

  it("puts restocked items back and refunds the price paid", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.rice);

    const result = await returnSale(world.db, world.spintexManager, {
      lines: [
        { disposition: "restock", productId: world.products.rice, quantity: 1 },
      ],
      reason: "Customer bought two by mistake",
      saleId,
    });

    expect(result).toMatchObject({
      number: "RET-SPX-000001",
      refund: RICE_PRICE,
    });
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(
      before + 1
    );
  });

  it("writes damaged returns straight off, so the loss is on record", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.rice);

    const result = await returnSale(world.db, world.spintexManager, {
      lines: [
        { disposition: "damaged", productId: world.products.rice, quantity: 1 },
      ],
      reason: "Bag split, rice spoiled",
      saleId,
    });

    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(before);

    const writeOffs = await world.db
      .select({ quantity: stockMovement.quantity })
      .from(stockMovement)
      .where(eq(stockMovement.saleReturnId, result.id));

    expect(
      writeOffs.map((row) => row.quantity).toSorted((x, y) => x - y)
    ).toEqual([-1, 1]);
  });

  it("never returns more than was sold, even two returns at once", async () => {
    const one = {
      lines: [
        {
          disposition: "restock" as const,
          productId: world.products.rice,
          quantity: 1,
        },
      ],
      reason: "Changed mind",
      saleId,
    };

    // One unit of three is left to return.
    const results = await Promise.allSettled([
      returnSale(world.db, world.spintexManager, one),
      returnSale(world.db, world.spintexManager, one),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const error = await rejection(
      returnSale(world.db, world.spintexManager, one)
    );

    expect(error.message).toMatch(/returned in full/u);
  });

  it("refuses items that weren't on the sale", async () => {
    const error = await rejection(
      returnSale(world.db, world.spintexManager, {
        lines: [
          {
            disposition: "restock",
            productId: world.products.kettle,
            quantity: 1,
          },
        ],
        reason: "Not ours",
        saleId,
      })
    );

    expect(error.message).toMatch(/isn't on that sale/u);
  });
});

describe("sale invariants", () => {
  it("keeps every balance equal to the sum of its movements", async () => {
    expect(await ledgerMismatches(world.db)).toEqual([]);
  });

  it("keeps every sale's and return's movements equal to its lines", async () => {
    expect(await saleMismatches(world.db)).toEqual([]);
  });
});
