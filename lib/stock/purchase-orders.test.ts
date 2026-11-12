import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { purchaseOrder, purchaseOrderLine, supplier } from "@/lib/db/schema";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  draftPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/stock/purchase-orders";
import type { DraftOrderRawInput } from "@/lib/stock/purchase-orders";
import { receiveGoods } from "@/lib/stock/receive";
import {
  createTestWorld,
  KUMASI,
  ledgerMismatches,
  onHand,
  purchaseOrderMismatches,
  rejection,
  SPINTEX,
} from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;
let otherSupplierId = 0;

const NOW = new Date("2026-11-12T10:00:00Z");
const LEAD_DAYS = 7;

beforeAll(async () => {
  world = await createTestWorld();

  const [other] = await world.db
    .insert(supplier)
    .values({ name: "Volta Beverages" })
    .returning({ id: supplier.id });

  otherSupplierId = other?.id ?? 0;
});

afterAll(async () => {
  await world.connection.close();
});

const draft = async (
  lines: DraftOrderRawInput["lines"],
  actor = world.spintexManager,
  overrides: Partial<DraftOrderRawInput> = {}
) =>
  await draftPurchaseOrder(world.db, actor, {
    branchId: SPINTEX,
    lines,
    supplierId: world.supplierId,
    ...overrides,
  });

const statusOf = async (id: number) => {
  const [row] = await world.db
    .select({ status: purchaseOrder.status })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.id, id));

  return row?.status;
};

const deliver = async (
  purchaseOrderId: number,
  lines: { productId: number; quantity: number }[],
  overrides: { branchId?: string; supplierId?: number } = {}
) =>
  await receiveGoods(world.db, world.spintexStorekeeper, {
    branchId: overrides.branchId ?? SPINTEX,
    lines: lines.map((line) => ({ ...line, unitCost: 9000 })),
    purchaseOrderId,
    supplierId: overrides.supplierId ?? world.supplierId,
  });

describe("drafting", () => {
  it("lets a manager draft for their own branch, at the agreed or average cost", async () => {
    const result = await draft([
      { productId: world.products.rice, quantity: 40, unitCost: 9000 },
      { productId: world.products.kettle, quantity: 5 },
    ]);

    expect(result).toMatchObject({ number: "PO-SPX-000001", status: "draft" });

    const lines = await world.db
      .select()
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, result.id));

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.quantityReceived === 0)).toBe(true);
  });

  it("is for managers at the branch and head office", async () => {
    const rice = [{ productId: world.products.rice, quantity: 1 }];

    for (const attempt of [
      draft(rice, world.spintexStorekeeper),
      draft(rice, world.spintexCashier),
      draft(rice, world.spintexManager, { branchId: KUMASI }),
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(attempt);
      expect(error.code).toBe("forbidden");
    }

    await expect(
      draft(rice, world.admin, { branchId: KUMASI })
    ).resolves.toMatchObject({ status: "draft" });
  });

  it("refuses discontinued products and products listed twice", async () => {
    const old = await rejection(
      draft([{ productId: world.products.old, quantity: 1 }])
    );

    expect(old.message).toMatch(/discontinued/u);

    const twice = await rejection(
      draft([
        { productId: world.products.rice, quantity: 1 },
        { productId: world.products.rice, quantity: 2 },
      ])
    );

    expect(twice.code).toBe("invalid_input");
  });

  it("can be edited until it's approved", async () => {
    const order = await draft([
      { productId: world.products.rice, quantity: 10 },
    ]);

    await updatePurchaseOrder(world.db, world.spintexManager, {
      lines: [{ productId: world.products.kettle, quantity: 3, unitCost: 100 }],
      purchaseOrderId: order.id,
    });

    const [header] = await world.db
      .select({ totalCost: purchaseOrder.totalCost })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, order.id));

    expect(header?.totalCost).toBe(300);

    await approvePurchaseOrder(world.db, world.admin, order.id, NOW);

    const late = await rejection(
      updatePurchaseOrder(world.db, world.spintexManager, {
        lines: [{ productId: world.products.rice, quantity: 1 }],
        purchaseOrderId: order.id,
      })
    );

    expect(late.code).toBe("conflict");
  });
});

describe("approving", () => {
  it("is head office's, sets the expected date, and happens once", async () => {
    const order = await draft([
      { productId: world.products.rice, quantity: 10 },
    ]);

    const manager = await rejection(
      approvePurchaseOrder(world.db, world.spintexManager, order.id, NOW)
    );

    expect(manager.code).toBe("forbidden");

    const results = await Promise.allSettled([
      approvePurchaseOrder(world.db, world.admin, order.id, NOW),
      approvePurchaseOrder(world.db, world.admin, order.id, NOW),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const [row] = await world.db
      .select({ expectedAt: purchaseOrder.expectedAt })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, order.id));

    expect(row?.expectedAt?.getTime()).toBe(
      NOW.getTime() + LEAD_DAYS * 86_400_000
    );
  });
});

describe("receiving against an order", () => {
  let orderId = 0;

  beforeAll(async () => {
    ({ id: orderId } = await draft([
      { productId: world.products.rice, quantity: 30, unitCost: 9000 },
      { productId: world.products.kettle, quantity: 4, unitCost: 9000 },
    ]));
  });

  /** Everything still due on the rice line. */
  const remaining = async () =>
    await deliver(orderId, [{ productId: world.products.rice, quantity: 10 }]);

  it("can't start before the order is approved", async () => {
    const error = await rejection(
      deliver(orderId, [{ productId: world.products.rice, quantity: 1 }])
    );

    expect(error.message).toMatch(/isn't open for deliveries/u);
    await approvePurchaseOrder(world.db, world.admin, orderId, NOW);
  });

  it("refuses anything not ordered, too much, or for the wrong branch or supplier", async () => {
    const attempts = [
      deliver(orderId, [{ productId: world.products.old, quantity: 1 }]),
      deliver(orderId, [{ productId: world.products.rice, quantity: 31 }]),
      deliver(orderId, [{ productId: world.products.rice, quantity: 1 }], {
        supplierId: otherSupplierId,
      }),
    ];

    for (const attempt of attempts) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(attempt);
      expect(["invalid_input", "not_found"]).toContain(error.code);
    }

    expect(await statusOf(orderId)).toBe("approved");
  });

  it("keeps the order open after a part delivery", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.rice);

    await deliver(orderId, [{ productId: world.products.rice, quantity: 20 }]);

    expect(await statusOf(orderId)).toBe("partly_received");
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(
      before + 20
    );
  });

  it("lets only one of two deliveries take what's still due", async () => {
    const results = await Promise.allSettled([remaining(), remaining()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("closes itself when everything has arrived", async () => {
    await deliver(orderId, [{ productId: world.products.kettle, quantity: 4 }]);

    expect(await statusOf(orderId)).toBe("received");

    const more = await rejection(
      deliver(orderId, [{ productId: world.products.kettle, quantity: 1 }])
    );

    expect(more.code).toBe("conflict");
  });
});

describe("cancelling and closing", () => {
  it("lets a manager drop a draft, but only head office an approved order", async () => {
    const first = await draft([
      { productId: world.products.rice, quantity: 5 },
    ]);

    await expect(
      cancelPurchaseOrder(world.db, world.spintexManager, {
        note: "Ordered by mistake",
        purchaseOrderId: first.id,
      })
    ).resolves.toMatchObject({ status: "cancelled" });

    const second = await draft([
      { productId: world.products.rice, quantity: 5 },
    ]);

    await approvePurchaseOrder(world.db, world.admin, second.id, NOW);

    const manager = await rejection(
      cancelPurchaseOrder(world.db, world.spintexManager, {
        note: "Changed our mind",
        purchaseOrderId: second.id,
      })
    );

    expect(manager.code).toBe("forbidden");

    await expect(
      cancelPurchaseOrder(world.db, world.admin, {
        note: "Supplier out of stock",
        purchaseOrderId: second.id,
      })
    ).resolves.toMatchObject({ status: "cancelled" });
  });

  it("closes a part-delivered order short, but never cancels it", async () => {
    const order = await draft([
      { productId: world.products.rice, quantity: 10 },
    ]);

    await approvePurchaseOrder(world.db, world.admin, order.id, NOW);
    await deliver(order.id, [{ productId: world.products.rice, quantity: 6 }]);

    const cancel = await rejection(
      cancelPurchaseOrder(world.db, world.admin, {
        note: "x",
        purchaseOrderId: order.id,
      })
    );

    expect(cancel.code).toBe("conflict");

    const manager = await rejection(
      closePurchaseOrder(world.db, world.spintexManager, {
        note: "Rest discontinued",
        purchaseOrderId: order.id,
      })
    );

    expect(manager.code).toBe("forbidden");

    await closePurchaseOrder(world.db, world.admin, {
      note: "Supplier can't send the rest",
      purchaseOrderId: order.id,
    });
    expect(await statusOf(order.id)).toBe("closed");
  });
});

describe("purchase order invariants", () => {
  it("keeps every balance equal to the sum of its movements", async () => {
    expect(await ledgerMismatches(world.db)).toEqual([]);
  });

  it("keeps every order's lines and status in step with its deliveries", async () => {
    expect(await purchaseOrderMismatches(world.db)).toEqual([]);
  });
});
