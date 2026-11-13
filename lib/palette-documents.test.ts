import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  documentAccessFor,
  searchPaletteDocuments,
} from "@/lib/palette-documents";
import { draftPurchaseOrder } from "@/lib/stock/purchase-orders";
import { receiveGoods } from "@/lib/stock/receive";
import { recordSale } from "@/lib/stock/sales";
import { dispatchTransfer } from "@/lib/stock/transfer";
import { createTestWorld, KUMASI, SPINTEX } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

const receive = async (branchId: string) => {
  await receiveGoods(world.db, world.admin, {
    branchId,
    lines: [{ productId: world.products.rice, quantity: 50, unitCost: 10_000 }],
    supplierId: world.supplierId,
  });
};

beforeAll(async () => {
  world = await createTestWorld();
  // GRN-SPX-000001, GRN-SPX-000002 and GRN-KSI-000001.
  await receive(SPINTEX);
  await receive(SPINTEX);
  await receive(KUMASI);
  await dispatchTransfer(world.db, world.admin, {
    fromBranchId: SPINTEX,
    lines: [{ productId: world.products.rice, quantity: 5 }],
    toBranchId: KUMASI,
  });
  await draftPurchaseOrder(world.db, world.spintexManager, {
    branchId: SPINTEX,
    lines: [{ productId: world.products.rice, quantity: 10, unitCost: 9000 }],
    supplierId: world.supplierId,
  });
  await recordSale(world.db, world.spintexCashier, {
    branchId: SPINTEX,
    clientRef: "palette-test-1",
    lines: [{ productId: world.products.rice, quantity: 1 }],
    paymentMethod: "cash",
  });
});

afterAll(async () => {
  await world.connection.close();
});

const numbersFor = async (text: string): Promise<string[]> => {
  const { documents } = await searchPaletteDocuments(world.db, text);

  return documents.map((item) => item.number);
};

describe("searchPaletteDocuments", () => {
  it("opens a whole number straight away, with its branch and status", async () => {
    const { documents, documentLike } = await searchPaletteDocuments(
      world.db,
      "PO-SPX-000001"
    );

    expect(documentLike).toBe(true);
    expect(documents).toEqual([
      expect.objectContaining({
        detail: "Spintex · Draft",
        exact: true,
        kind: "Purchase order",
        number: "PO-SPX-000001",
      }),
    ]);
    expect(documents[0]?.href).toMatch(/^\/purchase-orders\/\d+$/u);
  });

  it("finds a number typed loosely, across every kind of document", async () => {
    expect(await numbersFor("grn spx 2")).toEqual(["GRN-SPX-000002"]);
    expect(await numbersFor("ksi-1")).toEqual(["GRN-KSI-000001"]);

    const everyFirst = await numbersFor("000001");

    expect(everyFirst).toEqual(
      expect.arrayContaining([
        "GRN-SPX-000001",
        "GRN-KSI-000001",
        "TRF-SPX-000001",
        "PO-SPX-000001",
        "SAL-SPX-000001",
      ])
    );
    expect(everyFirst).toHaveLength(5);
  });

  it("shows a transfer's route and status", async () => {
    const { documents } = await searchPaletteDocuments(world.db, "trf 1");

    expect(documents[0]).toMatchObject({
      detail: "Spintex → Kumasi · In transit",
      exact: false,
    });
    expect(documents[0]?.href).toMatch(/^\/transfers\/\d+$/u);
  });

  it("ranks the same serial above numbers that only contain it", async () => {
    const [first] = await numbersFor("grn 1");

    expect(first).toMatch(/^GRN-(?:SPX|KSI)-000001$/u);
  });

  it("only searches when there's a serial number", async () => {
    expect(await searchPaletteDocuments(world.db, "rice")).toEqual({
      documentLike: false,
      documents: [],
    });
    expect(await numbersFor("5012345678900")).toEqual([]);
    expect(await numbersFor("PO-SPX-999")).toEqual([]);
  });

  it("finds a cashier only their own store's sales and returns", async () => {
    const access = documentAccessFor(world.spintexCashier, [SPINTEX, KUMASI]);

    const { documents } = await searchPaletteDocuments(
      world.db,
      "000001",
      access
    );

    expect(documents.map((item) => item.number)).toEqual(["SAL-SPX-000001"]);

    const kumasi = documentAccessFor(
      { ...world.spintexCashier, branchId: KUMASI },
      [SPINTEX, KUMASI]
    );

    const elsewhere = await searchPaletteDocuments(
      world.db,
      "SAL-SPX-000001",
      kumasi
    );

    expect(elsewhere.documents).toEqual([]);
  });

  it("gives back-office staff every branch and every kind", () => {
    for (const actor of [
      world.admin,
      world.spintexManager,
      world.kumasiStorekeeper,
    ]) {
      expect(documentAccessFor(actor, [SPINTEX, KUMASI]).branchIds).toBeNull();
    }
  });
});
