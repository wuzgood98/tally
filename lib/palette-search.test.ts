import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { product } from "@/lib/db/schema";
import { searchPaletteProducts } from "@/lib/palette-search";
import { receiveGoods } from "@/lib/stock/receive";
import { createTestWorld, KUMASI, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;
const KETTLE_BARCODE = "5012345678900";

beforeAll(async () => {
  world = await createTestWorld();
  await world.db
    .update(product)
    .set({ barcode: KETTLE_BARCODE })
    .where(eq(product.id, world.products.kettle));

  const receiveRice = async (branchId: string, quantity: number) => {
    await receiveGoods(world.db, world.admin, {
      branchId,
      lines: [{ productId: world.products.rice, quantity, unitCost: 10_000 }],
      supplierId: world.supplierId,
    });
  };

  await receiveRice(SPINTEX, 12);
  await receiveRice(KUMASI, 5);
});

afterAll(async () => {
  await world.connection.close();
});

const all = { kind: "all" } as const;
const spintex = { branchId: SPINTEX, kind: "branch" } as const;

describe("searchPaletteProducts", () => {
  it("finds products by part of the name, with on hand in the scope", async () => {
    const [rice] = await searchPaletteProducts(world.db, spintex, "jasmine");

    expect(rice).toMatchObject({
      active: true,
      exact: false,
      id: world.products.rice,
      onHand: 12,
    });
  });

  it("adds up every branch when viewing all of them", async () => {
    const [rice] = await searchPaletteProducts(world.db, all, "rice");

    expect(rice?.onHand).toBe(17);
  });

  it("says null for a product never stocked in the scope", async () => {
    const [kettle] = await searchPaletteProducts(world.db, spintex, "kettle");

    expect(kettle?.onHand).toBeNull();
  });

  it("marks a scanned barcode or a whole SKU, in any case, as exact", async () => {
    const [byBarcode] = await searchPaletteProducts(
      world.db,
      all,
      KETTLE_BARCODE
    );

    const [bySku] = await searchPaletteProducts(world.db, all, "gr-0001");

    expect(byBarcode).toMatchObject({ exact: true, id: world.products.kettle });
    expect(bySku).toMatchObject({ exact: true, id: world.products.rice });
  });

  it("puts SKU prefix matches before name matches", async () => {
    const rows = await searchPaletteProducts(world.db, all, "HK");

    expect(rows.map((row) => row.id)).toEqual([world.products.kettle]);
  });

  it("includes discontinued products after active ones", async () => {
    const rows = await searchPaletteProducts(world.db, all, "e");

    expect(rows.map((row) => row.id)).toContain(world.products.old);
    expect(rows.at(-1)).toMatchObject({ active: false });
  });

  it("treats LIKE wildcards as plain text and ignores empty input", async () => {
    expect(await searchPaletteProducts(world.db, all, "%")).toEqual([]);
    expect(await searchPaletteProducts(world.db, all, "   ")).toEqual([]);
  });
});
