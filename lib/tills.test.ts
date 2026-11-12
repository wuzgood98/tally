import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { branch, product, sale, till } from "@/lib/db/schema";
import { postTillSale } from "@/lib/sales-api";
import { authenticateTill, createTill, revokeTill } from "@/lib/tills";
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
let key = "";
let tillId = 0;

const RICE_BARCODE = "6030001000017";

beforeAll(async () => {
  world = await createTestWorld();
  await world.db.insert(branch).values({
    address: "Harbour Road",
    city: "Tema",
    id: "TMA",
    kind: "warehouse",
    name: "Tema Distribution Centre",
    region: "Greater Accra",
  });
  await world.db
    .update(product)
    .set({ barcode: RICE_BARCODE })
    .where(eq(product.id, world.products.rice));
  ({ id: tillId, key } = await createTill(world.db, world.admin, {
    branchId: SPINTEX,
    name: "Till 1",
  }));
});

afterAll(async () => {
  await world.connection.close();
});

const bearer = (value: string): string => `Bearer ${value}`;

/** The till created in beforeAll, as the API sees it after authentication. */
const identity = () => ({ branchId: SPINTEX, tillId });

describe("createTill", () => {
  it("shows the key once and stores only its hash", async () => {
    expect(key).toMatch(/^tly_[\w-]{43}$/u);

    const [row] = await world.db.select().from(till).where(eq(till.id, tillId));

    expect(row?.keyHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(row?.keyHash).not.toContain(key);
    expect(row?.keyPrefix).toBe(key.slice(0, 12));
  });

  it("is for head office, and for stores only", async () => {
    const manager = await rejection(
      createTill(world.db, world.spintexManager, {
        branchId: SPINTEX,
        name: "Till 2",
      })
    );

    expect(manager.code).toBe("forbidden");

    const warehouse = await rejection(
      createTill(world.db, world.admin, { branchId: "TMA", name: "Dock" })
    );

    expect(warehouse.code).toBe("invalid_input");
  });
});

describe("authenticateTill", () => {
  it("knows a till by its key, and nothing else", async () => {
    expect(await authenticateTill(world.db, bearer(key))).toEqual({
      branchId: SPINTEX,
      tillId,
    });

    for (const header of [
      null,
      key,
      bearer("tly_not-a-real-key"),
      bearer(`${key}x`),
      `Basic ${key}`,
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      expect(await authenticateTill(world.db, header)).toBeNull();
    }
  });

  it("stops a revoked till at once", async () => {
    const spare = await createTill(world.db, world.admin, {
      branchId: KUMASI,
      name: "Spare",
    });

    await revokeTill(world.db, world.admin, spare.id);

    expect(await authenticateTill(world.db, bearer(spare.key))).toBeNull();

    const again = await rejection(revokeTill(world.db, world.admin, spare.id));
    expect(again.code).toBe("conflict");
  });
});

describe("postTillSale", () => {
  it("records a sale by SKU or barcode at the till's own store", async () => {
    const before = await onHand(world.db, SPINTEX, world.products.rice);

    const result = await postTillSale(world.db, identity(), {
      clientRef: "pos-receipt-0001",
      lines: [
        { quantity: 2, sku: "gr-0001" },
        { quantity: 1, sku: "HK-0001", unitPrice: 20_000 },
      ],
      paymentMethod: "mobile_money",
    });

    expect(result).toMatchObject({ duplicate: false, total: 50_000 });
    expect(await onHand(world.db, SPINTEX, world.products.rice)).toBe(
      before - 2
    );

    const [row] = await world.db
      .select({
        cashierId: sale.cashierId,
        paymentMethod: sale.paymentMethod,
        tillId: sale.tillId,
      })
      .from(sale)
      .where(eq(sale.id, result.id));

    expect(row).toEqual({
      cashierId: null,
      paymentMethod: "mobile_money",
      tillId,
    });

    const byBarcode = await postTillSale(world.db, identity(), {
      clientRef: "pos-receipt-0002",
      lines: [{ barcode: RICE_BARCODE, quantity: 1 }],
      paymentMethod: "cash",
    });

    expect(byBarcode.total).toBe(15_000);
  });

  it("returns the first sale when the till resends it", async () => {
    const body = {
      clientRef: "pos-receipt-0001",
      lines: [{ quantity: 2, sku: "GR-0001" }],
      paymentMethod: "cash" as const,
    };

    const again = await postTillSale(world.db, identity(), body);
    expect(again.duplicate).toBe(true);
  });

  it("names a product it can't find", async () => {
    const error = await rejection(
      postTillSale(world.db, identity(), {
        clientRef: "pos-receipt-0003",
        lines: [{ quantity: 1, sku: "NOPE-1" }],
        paymentMethod: "cash",
      })
    );

    expect(error.code).toBe("not_found");
    expect(error.message).toMatch(/SKU NOPE-1/u);
  });

  it("keeps the ledger and every sale in step", async () => {
    expect(await ledgerMismatches(world.db)).toEqual([]);
    expect(await saleMismatches(world.db)).toEqual([]);
  });
});
