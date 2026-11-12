import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createProduct,
  setStockSettings,
  updateProduct,
} from "@/lib/catalogue";
import { account, product, session, stockLevel, user } from "@/lib/db/schema";
import { createStaff, setStaffActive, temporaryPassword } from "@/lib/staff";
import { StockError } from "@/lib/stock/errors";
import { createTestWorld, KUMASI, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;
let categoryId: number;

beforeAll(async () => {
  world = await createTestWorld();

  const [row] = await world.db
    .select({ categoryId: product.categoryId })
    .from(product)
    .limit(1);

  categoryId = row?.categoryId ?? 0;
});

afterAll(async () => {
  await world.connection.close();
});

const failure = async (promise: Promise<unknown>): Promise<StockError> => {
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

const fan = {
  active: true,
  barcode: "6901234567892",
  categoryId: 0,
  defaultSupplierId: null,
  name: "Standing fan 16 inch",
  reorderPoint: 8,
  sellPrice: 29_000,
  sku: "sap-0101",
  unit: "each",
} as const;

describe("products", () => {
  it("lets head office add a product, normalising the SKU", async () => {
    const id = await createProduct(world.db, world.admin, {
      ...fan,
      categoryId,
    });

    const [row] = await world.db
      .select()
      .from(product)
      .where(eq(product.id, id));

    expect(row).toMatchObject({ barcode: "6901234567892", sku: "SAP-0101" });
  });

  it("refuses duplicate SKUs and barcodes, naming the clash", async () => {
    const dupSku = await failure(
      createProduct(world.db, world.admin, {
        ...fan,
        barcode: null,
        categoryId,
      })
    );

    expect(dupSku.message).toMatch(/SAP-0101 is already used by Standing fan/u);

    const dupBarcode = await failure(
      createProduct(world.db, world.admin, {
        ...fan,
        categoryId,
        sku: "SAP-0102",
      })
    );

    expect(dupBarcode.message).toMatch(/already belongs to Standing fan/u);
  });

  it("refuses a barcode with the wrong check digit", async () => {
    const error = await failure(
      createProduct(world.db, world.admin, {
        ...fan,
        barcode: "6901234567890",
        categoryId,
        sku: "SAP-0103",
      })
    );

    expect(error.message).toMatch(/check digit/u);
  });

  it("keeps the catalogue to head office", async () => {
    const error = await failure(
      createProduct(world.db, world.spintexManager, {
        ...fan,
        categoryId,
        sku: "X-1",
      })
    );

    expect(error.code).toBe("forbidden");
  });

  it("lets a product keep its own SKU when edited", async () => {
    await expect(
      updateProduct(world.db, world.admin, world.products.rice, {
        ...fan,
        barcode: null,
        categoryId,
        name: "Jasmine rice 5 kg (new pack)",
        sku: "GR-0001",
      })
    ).resolves.toBeUndefined();
  });
});

describe("branch stock settings", () => {
  it("lets a manager set their own branch's reorder point and shelf", async () => {
    await setStockSettings(world.db, world.spintexManager, {
      binLocation: "A3-12-2",
      branchId: SPINTEX,
      productId: world.products.kettle,
      reorderPoint: 4,
    });

    const [row] = await world.db
      .select()
      .from(stockLevel)
      .where(eq(stockLevel.productId, world.products.kettle));

    expect(row).toMatchObject({
      binLocation: "A3-12-2",
      onHand: 0,
      reorderPoint: 4,
    });
  });

  it("keeps managers out of other branches and storekeepers out entirely", async () => {
    const settings = {
      binLocation: null,
      productId: world.products.kettle,
      reorderPoint: 1,
    };

    await expect(
      setStockSettings(world.db, world.spintexManager, {
        ...settings,
        branchId: KUMASI,
      })
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      setStockSettings(world.db, world.spintexStorekeeper, {
        ...settings,
        branchId: SPINTEX,
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("staff", () => {
  it("makes readable temporary passwords", () => {
    expect(temporaryPassword()).toMatch(
      /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/u
    );
  });

  it("creates an account Better Auth can sign in with", async () => {
    const created = await createStaff(world.db, world.admin, {
      branchId: KUMASI,
      email: "  Esi.Owusu@Example.com ",
      name: "Esi Owusu",
      role: "storekeeper",
    });

    const [row] = await world.db
      .select()
      .from(user)
      .where(eq(user.id, created.id));

    const [credential] = await world.db
      .select()
      .from(account)
      .where(eq(account.userId, created.id));

    expect(row).toMatchObject({
      branchId: KUMASI,
      email: "esi.owusu@example.com",
      role: "storekeeper",
    });
    expect(credential?.providerId).toBe("credential");
    expect(
      await verifyPassword({
        hash: credential?.password ?? "",
        password: created.temporaryPassword,
      })
    ).toBe(true);
  });

  it("requires a branch for branch roles and a unique email", async () => {
    const noBranch = await failure(
      createStaff(world.db, world.admin, {
        branchId: null,
        email: "a@example.com",
        name: "Abu",
        role: "manager",
      })
    );

    expect(noBranch.message).toMatch(/need a branch/u);

    const taken = await failure(
      createStaff(world.db, world.admin, {
        branchId: SPINTEX,
        email: "sk@tally.test",
        name: "Kofi",
        role: "storekeeper",
      })
    );

    expect(taken.message).toMatch(/already has an account/u);
  });

  it("ends every session when someone is deactivated", async () => {
    await world.db.insert(session).values({
      expiresAt: new Date(Date.now() + 3_600_000),
      id: "s-1",
      token: "token-1",
      userId: world.spintexStorekeeper.id,
    });
    await setStaffActive(
      world.db,
      world.admin,
      world.spintexStorekeeper.id,
      false
    );

    const [row] = await world.db
      .select()
      .from(user)
      .where(eq(user.id, world.spintexStorekeeper.id));

    const sessions = await world.db
      .select()
      .from(session)
      .where(eq(session.userId, world.spintexStorekeeper.id));

    expect(row?.banned).toBe(true);
    expect(sessions).toEqual([]);

    await setStaffActive(
      world.db,
      world.admin,
      world.spintexStorekeeper.id,
      true
    );

    const [back] = await world.db
      .select()
      .from(user)
      .where(eq(user.id, world.spintexStorekeeper.id));

    expect(back?.banned).toBe(false);
  });

  it("never locks head office out", async () => {
    const self = await failure(
      setStaffActive(world.db, world.admin, world.admin.id, false)
    );

    expect(self.message).toMatch(/your own account/u);
  });
});
