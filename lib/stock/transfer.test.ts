import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { stockTransfer, stockTransferLine } from "@/lib/db/schema";
import { receiveGoods } from "@/lib/stock/receive";
import {
  cancelTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/lib/stock/transfer";
import type { DispatchRawInput } from "@/lib/stock/transfer";
import {
  averageCostOf,
  createTestWorld,
  KUMASI,
  ledgerMismatches,
  onHand,
  rejection,
  SPINTEX,
  transferMismatches,
} from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

const RICE_COST = 10_000;
const KETTLE_COST = 15_000;

beforeAll(async () => {
  world = await createTestWorld();
  await receiveGoods(world.db, world.admin, {
    branchId: SPINTEX,
    lines: [
      { productId: world.products.rice, quantity: 100, unitCost: RICE_COST },
      { productId: world.products.kettle, quantity: 10, unitCost: KETTLE_COST },
    ],
    supplierId: world.supplierId,
  });
});

afterAll(async () => {
  await world.connection.close();
});

const send = async (
  lines: DispatchRawInput["lines"],
  actor = world.spintexStorekeeper,
  overrides: Partial<DispatchRawInput> = {}
) =>
  await dispatchTransfer(world.db, actor, {
    fromBranchId: SPINTEX,
    lines,
    toBranchId: KUMASI,
    ...overrides,
  });

const transferCount = async (): Promise<number> => {
  const [row] = await world.db.select({ total: count() }).from(stockTransfer);

  return row?.total ?? 0;
};

const statusOf = async (transferId: number): Promise<string | undefined> => {
  const [row] = await world.db
    .select({ status: stockTransfer.status })
    .from(stockTransfer)
    .where(eq(stockTransfer.id, transferId));

  return row?.status;
};

describe("dispatchTransfer", () => {
  it("takes stock out of the sender and puts it in transit at average cost", async () => {
    const result = await send([
      { productId: world.products.rice, quantity: 30 },
      { productId: world.products.kettle, quantity: 2 },
    ]);

    expect(result).toMatchObject({
      number: "TRF-SPX-000001",
      status: "in_transit",
    });
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(70);
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(8);
    expect(await onHand(world.db, KUMASI, world.products.rice)).toBe(0);

    const [header] = await world.db
      .select({ totalCost: stockTransfer.totalCost })
      .from(stockTransfer)
      .where(eq(stockTransfer.id, result.id));

    expect(header?.totalCost).toBe(30 * RICE_COST + 2 * KETTLE_COST);

    const lines = await world.db
      .select()
      .from(stockTransferLine)
      .where(eq(stockTransferLine.transferId, result.id));

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.quantityReceived === null)).toBe(true);
  });

  it("rejects bad transfers before touching stock", async () => {
    const before = await transferCount();
    const rice = { productId: world.products.rice, quantity: 1 };

    const attempts = [
      send([rice], world.admin, { toBranchId: SPINTEX }),
      send([rice], world.admin, { toBranchId: "NOPE" }),
      send([rice, rice]),
      send([{ productId: world.products.old, quantity: 1 }]),
      send([{ productId: world.products.rice, quantity: 0 }]),
    ];

    for (const attempt of attempts) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(attempt);
      expect(["invalid_input", "not_found"]).toContain(error.code);
    }

    expect(await transferCount()).toBe(before);
  });

  it("only lets branch staff send from their own branch", async () => {
    const error = await rejection(
      send(
        [{ productId: world.products.rice, quantity: 1 }],
        world.spintexStorekeeper,
        {
          fromBranchId: KUMASI,
          toBranchId: SPINTEX,
        }
      )
    );

    expect(error.code).toBe("forbidden");
  });

  it("names the product that's short, and records nothing", async () => {
    const before = await transferCount();

    const error = await rejection(
      send([
        { productId: world.products.rice, quantity: 1 },
        { productId: world.products.kettle, quantity: 9 },
      ])
    );

    expect(error.code).toBe("insufficient_stock");
    expect(error.message).toMatch(/^Electric kettle/u);
    expect(await transferCount()).toBe(before);
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(70);
  });

  it("lets only one of two racing transfers take the last units", async () => {
    const takeKettles = async () =>
      await send([{ productId: world.products.kettle, quantity: 6 }]);

    const results = await Promise.allSettled([takeKettles(), takeKettles()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await onHand(world.db, SPINTEX, world.products.kettle)).toBe(2);
  });
});

describe("average cost with goods in transit", () => {
  it("still counts units on the road as held", async () => {
    // 70 rice on the shelf and 30 in transit, all at GH₵100.00. Receiving 100
    // at GH₵120.00 averages to GH₵110.00 only if the 30 are counted.
    await receiveGoods(world.db, world.admin, {
      branchId: KUMASI,
      lines: [
        { productId: world.products.rice, quantity: 100, unitCost: 12_000 },
      ],
      supplierId: world.supplierId,
    });

    expect(await averageCostOf(world.db, world.products.rice)).toBe(11_000);
  });
});

describe("receiveTransfer", () => {
  it("is for the receiving branch only", async () => {
    const sent = await send([{ productId: world.products.rice, quantity: 5 }]);

    const error = await rejection(
      receiveTransfer(world.db, world.spintexManager, {
        lines: [{ productId: world.products.rice, quantityReceived: 5 }],
        transferId: sent.id,
      })
    );

    expect(error.code).toBe("forbidden");
  });

  it("adds what arrived to the receiving branch, once", async () => {
    const sent = await send([{ productId: world.products.rice, quantity: 10 }]);
    const kumasiBefore = await onHand(world.db, KUMASI, world.products.rice);

    const receive = async () =>
      await receiveTransfer(world.db, world.kumasiStorekeeper, {
        lines: [{ productId: world.products.rice, quantityReceived: 10 }],
        transferId: sent.id,
      });

    const results = await Promise.allSettled([receive(), receive()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await onHand(world.db, KUMASI, world.products.rice)).toBe(
      kumasiBefore + 10
    );
    expect(await statusOf(sent.id)).toBe("received");

    const again = await rejection(receive());
    expect(again.code).toBe("conflict");
    expect(again.message).toMatch(/already been received/u);
  });

  it("records units lost in transit, with a note", async () => {
    const sent = await send([{ productId: world.products.rice, quantity: 8 }]);
    const kumasiBefore = await onHand(world.db, KUMASI, world.products.rice);

    const short = {
      lines: [{ productId: world.products.rice, quantityReceived: 6 }],
      transferId: sent.id,
    };

    const noNote = await rejection(
      receiveTransfer(world.db, world.kumasiStorekeeper, short)
    );

    expect(noNote.message).toMatch(/note/u);

    const result = await receiveTransfer(world.db, world.kumasiStorekeeper, {
      ...short,
      note: "Two bags torn on the truck",
    });

    expect(result.unitsLost).toBe(2);
    expect(await onHand(world.db, KUMASI, world.products.rice)).toBe(
      kumasiBefore + 6
    );

    const [line] = await world.db
      .select({ received: stockTransferLine.quantityReceived })
      .from(stockTransferLine)
      .where(eq(stockTransferLine.transferId, sent.id));

    expect(line?.received).toBe(6);
  });

  it("refuses counts that don't match the transfer", async () => {
    const sent = await send([
      { productId: world.products.rice, quantity: 3 },
      { productId: world.products.kettle, quantity: 1 },
    ]);

    const attempts = [
      // More than was sent.
      [
        { productId: world.products.rice, quantityReceived: 4 },
        { productId: world.products.kettle, quantityReceived: 1 },
      ],
      // A line missing.
      [{ productId: world.products.rice, quantityReceived: 3 }],
      // A product that wasn't sent.
      [
        { productId: world.products.rice, quantityReceived: 3 },
        { productId: world.products.old, quantityReceived: 1 },
      ],
    ];

    for (const lines of attempts) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(
        receiveTransfer(world.db, world.kumasiManager, {
          lines,
          transferId: sent.id,
        })
      );

      expect(error.code).toBe("invalid_input");
    }

    expect(await statusOf(sent.id)).toBe("in_transit");
  });
});

describe("cancelTransfer", () => {
  it("is for managers at the sending branch, with a reason", async () => {
    const sent = await send([{ productId: world.products.rice, quantity: 4 }]);

    for (const actor of [world.spintexStorekeeper, world.kumasiManager]) {
      // oxlint-disable-next-line no-await-in-loop
      const error = await rejection(
        cancelTransfer(world.db, actor, {
          note: "Wrong branch",
          transferId: sent.id,
        })
      );

      expect(error.code).toBe("forbidden");
    }

    const noNote = await rejection(
      cancelTransfer(world.db, world.spintexManager, {
        note: " ",
        transferId: sent.id,
      })
    );

    expect(noNote.code).toBe("invalid_input");
  });

  it("puts the stock back at the sender, and can't then be received", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.rice);
    const sent = await send([{ productId: world.products.rice, quantity: 4 }]);

    await cancelTransfer(world.db, world.spintexManager, {
      note: "Truck broke down",
      transferId: sent.id,
    });

    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(before);
    expect(await statusOf(sent.id)).toBe("cancelled");

    const error = await rejection(
      receiveTransfer(world.db, world.kumasiStorekeeper, {
        lines: [{ productId: world.products.rice, quantityReceived: 4 }],
        transferId: sent.id,
      })
    );

    expect(error.message).toMatch(/cancelled/u);
  });
});

describe("transfer invariants", () => {
  it("keeps every balance equal to the sum of its movements", async () => {
    expect(await ledgerMismatches(world.db)).toEqual([]);
  });

  it("keeps every transfer's movements equal to its lines", async () => {
    expect(await transferMismatches(world.db)).toEqual([]);
  });
});
