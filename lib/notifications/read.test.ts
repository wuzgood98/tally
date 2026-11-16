import { asc } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { notification } from "@/lib/db/schema";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/read";
import { receiveGoods } from "@/lib/stock/receive";
import { dispatchTransfer } from "@/lib/stock/transfer";
import { createTestWorld, KUMASI, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

beforeAll(async () => {
  world = await createTestWorld();
  await receiveGoods(world.db, world.admin, {
    branchId: SPINTEX,
    lines: [{ productId: world.products.rice, quantity: 20, unitCost: 100 }],
    supplierId: world.supplierId,
  });
});

afterAll(async () => {
  await world.connection.close();
});

beforeEach(async () => {
  await world.db.delete(notification);
  // Tells Kumasi's manager and storekeeper.
  await dispatchTransfer(world.db, world.spintexManager, {
    fromBranchId: SPINTEX,
    lines: [{ productId: world.products.rice, quantity: 1 }],
    toBranchId: KUMASI,
  });
});

const state = async () =>
  await world.db
    .select({
      id: notification.id,
      read: notification.readAt,
      userId: notification.userId,
    })
    .from(notification)
    .orderBy(asc(notification.userId));

describe("marking notifications read", () => {
  it("marks one, only for its owner", async () => {
    const [manager, storekeeper] = await state();

    if (manager === undefined || storekeeper === undefined) {
      throw new Error("Expected two notifications.");
    }

    // Someone else's id marks nothing.
    await markNotificationRead(
      world.db,
      world.kumasiManager.id,
      storekeeper.id
    );
    await markNotificationRead(world.db, world.kumasiManager.id, manager.id);

    const after = await state();

    expect(after.map((row) => [row.userId, row.read !== null])).toEqual([
      ["u-kmgr", true],
      ["u-ksk", false],
    ]);
  });

  it("marks all of one person's, and nobody else's", async () => {
    await markAllNotificationsRead(world.db, world.kumasiStorekeeper.id);

    const after = await state();

    expect(after.map((row) => [row.userId, row.read !== null])).toEqual([
      ["u-kmgr", false],
      ["u-ksk", true],
    ]);
  });
});
