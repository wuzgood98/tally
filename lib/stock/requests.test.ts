import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { branch, stockRequest, stockTransfer } from "@/lib/db/schema";
import { receiveGoods } from "@/lib/stock/receive";
import {
  cancelStockRequest,
  fulfilStockRequest,
  requestStock,
} from "@/lib/stock/requests";
import {
  createTestWorld,
  ledgerMismatches,
  onHand,
  rejection,
  SPINTEX,
  transferMismatches,
} from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;
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
    branchId: WAREHOUSE,
    lines: [
      { productId: world.products.rice, quantity: 100, unitCost: 10_000 },
      { productId: world.products.kettle, quantity: 3, unitCost: 15_000 },
    ],
    supplierId: world.supplierId,
  });
});

afterAll(async () => {
  await world.connection.close();
});

const ask = async (
  lines: { productId: number; quantity: number }[],
  actor = world.spintexManager
) => await requestStock(world.db, actor, { branchId: SPINTEX, lines });

const transferCount = async (): Promise<number> => {
  const [row] = await world.db.select({ total: count() }).from(stockTransfer);

  return row?.total ?? 0;
};

describe("requestStock", () => {
  it("lets a store's manager ask the warehouse", async () => {
    const result = await ask([
      { productId: world.products.rice, quantity: 20 },
    ]);

    expect(result).toMatchObject({
      number: "REQ-SPX-000001",
      status: "requested",
    });

    const [row] = await world.db
      .select({ fromBranchId: stockRequest.fromBranchId })
      .from(stockRequest)
      .where(eq(stockRequest.id, result.id));

    expect(row?.fromBranchId).toBe(WAREHOUSE);
  });

  it("is for managers and head office, and for stores only", async () => {
    const rice = [{ productId: world.products.rice, quantity: 1 }];

    for (const actor of [world.spintexStorekeeper, world.spintexCashier]) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(ask(rice, actor));
      expect(error.code).toBe("forbidden");
    }

    const warehouse = await rejection(
      requestStock(world.db, world.admin, { branchId: WAREHOUSE, lines: rice })
    );

    expect(warehouse.code).toBe("invalid_input");
  });
});

describe("fulfilStockRequest", () => {
  it("is for warehouse staff and head office", async () => {
    const request = await ask([
      { productId: world.products.rice, quantity: 5 },
    ]);

    const error = await rejection(
      fulfilStockRequest(world.db, world.spintexStorekeeper, {
        lines: [{ productId: world.products.rice, quantity: 5 }],
        requestId: request.id,
      })
    );

    expect(error.code).toBe("forbidden");
  });

  it("sends a transfer and closes the request, once", async () => {
    const request = await ask([
      { productId: world.products.rice, quantity: 12 },
    ]);

    const transfersBefore = await transferCount();

    const warehouseBefore = await onHand(
      world.db,
      WAREHOUSE,
      world.products.rice
    );

    const send = async () =>
      await fulfilStockRequest(world.db, world.admin, {
        lines: [{ productId: world.products.rice, quantity: 10 }],
        requestId: request.id,
      });

    const results = await Promise.allSettled([send(), send()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await transferCount()).toBe(transfersBefore + 1);
    expect(await onHand(world.db, WAREHOUSE, world.products.rice)).toBe(
      warehouseBefore - 10
    );

    const [row] = await world.db
      .select({
        status: stockRequest.status,
        transferId: stockRequest.transferId,
      })
      .from(stockRequest)
      .where(eq(stockRequest.id, request.id));

    expect(row?.status).toBe("fulfilled");
    expect(row?.transferId).not.toBeNull();
  });

  it("sends only what was asked for", async () => {
    const request = await ask([
      { productId: world.products.rice, quantity: 2 },
    ]);

    for (const lines of [
      [{ productId: world.products.rice, quantity: 3 }],
      [{ productId: world.products.kettle, quantity: 1 }],
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(
        fulfilStockRequest(world.db, world.admin, {
          lines,
          requestId: request.id,
        })
      );

      expect(error.code).toBe("invalid_input");
    }
  });

  it("stays open when the warehouse doesn't have enough", async () => {
    const request = await ask([
      { productId: world.products.kettle, quantity: 5 },
    ]);

    const transfersBefore = await transferCount();

    const error = await rejection(
      fulfilStockRequest(world.db, world.admin, {
        lines: [{ productId: world.products.kettle, quantity: 5 }],
        requestId: request.id,
      })
    );

    expect(error.code).toBe("insufficient_stock");
    expect(await transferCount()).toBe(transfersBefore);

    const [row] = await world.db
      .select({ status: stockRequest.status })
      .from(stockRequest)
      .where(eq(stockRequest.id, request.id));

    expect(row?.status).toBe("requested");
  });
});

describe("cancelStockRequest", () => {
  it("lets either side call it off, keeping the store's note", async () => {
    const request = await requestStock(world.db, world.spintexManager, {
      branchId: SPINTEX,
      lines: [{ productId: world.products.rice, quantity: 1 }],
      note: "For the weekend promo",
    });

    await cancelStockRequest(world.db, world.admin, {
      note: "Promo moved",
      requestId: request.id,
    });

    const [row] = await world.db
      .select({ note: stockRequest.note, status: stockRequest.status })
      .from(stockRequest)
      .where(eq(stockRequest.id, request.id));

    expect(row).toEqual({
      note: "For the weekend promo · Cancelled: Promo moved",
      status: "cancelled",
    });

    const late = await rejection(
      fulfilStockRequest(world.db, world.admin, {
        lines: [{ productId: world.products.rice, quantity: 1 }],
        requestId: request.id,
      })
    );

    expect(late.message).toMatch(/cancelled/u);
  });
});

describe("request invariants", () => {
  it("keeps the ledger and every transfer in step", async () => {
    expect(await ledgerMismatches(world.db)).toEqual([]);
    expect(await transferMismatches(world.db)).toEqual([]);
  });
});
