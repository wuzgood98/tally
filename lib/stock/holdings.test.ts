import { afterAll, beforeAll, expect, it } from "vitest";

import { companyUnitsHeld } from "@/lib/stock/holdings";
import { receiveGoods } from "@/lib/stock/receive";
import { dispatchTransfer } from "@/lib/stock/transfer";
import { createTestWorld, KUMASI, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

beforeAll(async () => {
  world = await createTestWorld();
});

afterAll(async () => {
  await world.connection.close();
});

it("counts goods in transit whatever the transfer's id", async () => {
  await receiveGoods(world.db, world.admin, {
    branchId: SPINTEX,
    lines: [{ productId: world.products.kettle, quantity: 10, unitCost: 100 }],
    supplierId: world.supplierId,
  });

  // Transfer 1 carries the kettle (product 2): the ids deliberately differ.
  const sent = await dispatchTransfer(world.db, world.admin, {
    fromBranchId: SPINTEX,
    lines: [{ productId: world.products.kettle, quantity: 4 }],
    toBranchId: KUMASI,
  });

  expect(sent.id).not.toBe(world.products.kettle);
  expect(await companyUnitsHeld(world.db, world.products.kettle)).toBe(10);
});
