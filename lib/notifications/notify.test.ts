import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { branch, notification, user } from "@/lib/db/schema";
import type { NotificationKind } from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  draftPurchaseOrder,
} from "@/lib/stock/purchase-orders";
import { receiveGoods } from "@/lib/stock/receive";
import {
  cancelStockRequest,
  fulfilStockRequest,
  requestStock,
} from "@/lib/stock/requests";
import {
  cancelTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/lib/stock/transfer";
import { createTestWorld, KUMASI, rejection, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;
const WAREHOUSE = "TMA";

const warehouseManager: Actor = {
  branchId: WAREHOUSE,
  id: "u-wmgr",
  role: "manager",
};

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
  await world.db.insert(user).values({
    ...warehouseManager,
    email: "wmgr@tally.test",
    name: "Nii Lamptey",
  });

  for (const branchId of [SPINTEX, WAREHOUSE]) {
    // oxlint-disable-next-line no-await-in-loop -- two setup deliveries, in order
    await receiveGoods(world.db, world.admin, {
      branchId,
      lines: [{ productId: world.products.rice, quantity: 50, unitCost: 100 }],
      supplierId: world.supplierId,
    });
  }
});

afterAll(async () => {
  await world.connection.close();
});

beforeEach(async () => {
  await world.db.delete(notification);
});

const sent = async () =>
  await world.db
    .select({
      kind: notification.kind,
      units: notification.units,
      userId: notification.userId,
    })
    .from(notification)
    .orderBy(asc(notification.id));

const to = (kind: NotificationKind, ...userIds: string[]) =>
  userIds.map((userId) => ({ kind, userId }));

const rice = (quantity: number) => [
  { productId: world.products.rice, quantity },
];

describe("purchase orders", () => {
  it("tell head office about a branch's draft, then the branch about approval", async () => {
    const order = await draftPurchaseOrder(world.db, world.spintexManager, {
      branchId: SPINTEX,
      lines: rice(5),
      supplierId: world.supplierId,
    });

    expect(await sent()).toMatchObject(to("po_drafted", "u-admin"));

    await world.db.delete(notification);
    await approvePurchaseOrder(world.db, world.admin, order.id);

    expect(await sent()).toMatchObject(to("po_approved", "u-mgr", "u-sk"));
  });

  it("send nothing for a lost race", async () => {
    const order = await draftPurchaseOrder(world.db, world.admin, {
      branchId: SPINTEX,
      lines: rice(5),
      supplierId: world.supplierId,
    });

    expect(await sent()).toEqual([]);

    await cancelPurchaseOrder(world.db, world.admin, {
      note: "Ordered twice",
      purchaseOrderId: order.id,
    });

    expect(await sent()).toMatchObject(to("po_cancelled", "u-mgr"));

    await world.db.delete(notification);
    await rejection(approvePurchaseOrder(world.db, world.admin, order.id));

    expect(await sent()).toEqual([]);
  });
});

describe("transfers", () => {
  it("tell the receiving branch it's coming, and the sender about a shortfall", async () => {
    const transfer = await dispatchTransfer(
      world.db,
      world.spintexStorekeeper,
      { fromBranchId: SPINTEX, lines: rice(10), toBranchId: KUMASI }
    );

    expect(await sent()).toMatchObject(
      to("transfer_dispatched", "u-kmgr", "u-ksk")
    );

    await world.db.delete(notification);
    await receiveTransfer(world.db, world.kumasiStorekeeper, {
      lines: [{ productId: world.products.rice, quantityReceived: 7 }],
      note: "Three bags torn",
      transferId: transfer.id,
    });

    expect(await sent()).toEqual([
      { kind: "transfer_received_short", units: 3, userId: "u-admin" },
      { kind: "transfer_received_short", units: 3, userId: "u-mgr" },
    ]);
  });

  it("say nothing when everything arrives", async () => {
    const transfer = await dispatchTransfer(world.db, world.spintexManager, {
      fromBranchId: SPINTEX,
      lines: rice(2),
      toBranchId: KUMASI,
    });

    await world.db.delete(notification);
    await receiveTransfer(world.db, world.kumasiManager, {
      lines: [{ productId: world.products.rice, quantityReceived: 2 }],
      transferId: transfer.id,
    });

    expect(await sent()).toEqual([]);
  });

  it("tell the receiving managers when one is called back", async () => {
    const transfer = await dispatchTransfer(world.db, world.spintexManager, {
      fromBranchId: SPINTEX,
      lines: rice(1),
      toBranchId: KUMASI,
    });

    await world.db.delete(notification);
    await cancelTransfer(world.db, world.spintexManager, {
      note: "Wrong branch",
      transferId: transfer.id,
    });

    expect(await sent()).toMatchObject(to("transfer_cancelled", "u-kmgr"));
  });

  it("send nothing when the dispatch fails", async () => {
    await rejection(
      dispatchTransfer(world.db, world.spintexManager, {
        fromBranchId: SPINTEX,
        lines: rice(10_000),
        toBranchId: KUMASI,
      })
    );

    expect(await sent()).toEqual([]);
  });

  it("skip deactivated staff", async () => {
    await world.db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, "u-ksk"));

    try {
      await dispatchTransfer(world.db, world.spintexManager, {
        fromBranchId: SPINTEX,
        lines: rice(1),
        toBranchId: KUMASI,
      });

      expect(await sent()).toMatchObject(to("transfer_dispatched", "u-kmgr"));
    } finally {
      await world.db
        .update(user)
        .set({ banned: false })
        .where(eq(user.id, "u-ksk"));
    }
  });
});

describe("stock requests", () => {
  it("tell the warehouse about a request, and the other side about a cancellation", async () => {
    const request = await requestStock(world.db, world.spintexManager, {
      branchId: SPINTEX,
      lines: rice(4),
    });

    expect(await sent()).toMatchObject(to("request_raised", "u-wmgr"));

    await world.db.delete(notification);
    await cancelStockRequest(world.db, warehouseManager, {
      note: "None to spare",
      requestId: request.id,
    });

    expect(await sent()).toMatchObject(to("request_cancelled", "u-mgr"));
  });

  it("are fulfilled with one notification: the transfer's", async () => {
    const request = await requestStock(world.db, world.spintexManager, {
      branchId: SPINTEX,
      lines: rice(4),
    });

    await world.db.delete(notification);
    await fulfilStockRequest(world.db, warehouseManager, {
      lines: rice(4),
      requestId: request.id,
    });

    expect(await sent()).toMatchObject(
      to("transfer_dispatched", "u-mgr", "u-sk")
    );
  });
});
