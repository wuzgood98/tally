import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isValidGtin } from "@/lib/barcode";
import { connectPglite } from "@/lib/db/client";
import type { Connection } from "@/lib/db/client";
import { product, stockTransfer, stockTransferLine } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import {
  ledgerMismatches,
  movementsOutOfOrder,
  transferMismatches,
} from "@/test/db";

let connection: Connection;

beforeAll(async () => {
  connection = connectPglite();
  await connection.migrate();
  await seed(connection.db, new Date("2026-11-12T12:00:00Z"));
});

afterAll(async () => {
  await connection.close();
});

describe("seed", () => {
  it("leaves every balance equal to its ledger", async () => {
    expect(await ledgerMismatches(connection.db)).toEqual([]);
  });

  it("keeps every transfer's movements equal to its lines", async () => {
    expect(await transferMismatches(connection.db)).toEqual([]);
  });

  it("seeds transfers received, short, cancelled and still on the road", async () => {
    const rows = await connection.db
      .select({
        count: sql<number>`count(distinct ${stockTransfer.id})::int`,
        short: sql<number>`count(distinct ${stockTransfer.id}) filter (where ${stockTransferLine.quantityReceived} < ${stockTransferLine.quantitySent})::int`,
        status: stockTransfer.status,
      })
      .from(stockTransfer)
      .innerJoin(
        stockTransferLine,
        sql`${stockTransferLine.transferId} = ${stockTransfer.id}`
      )
      .groupBy(stockTransfer.status);

    const byStatus = new Map(rows.map((row) => [row.status, row]));

    expect(byStatus.get("received")?.count).toBeGreaterThanOrEqual(8);
    expect(byStatus.get("received")?.short).toBe(1);
    expect(byStatus.get("cancelled")?.count).toBe(1);
    expect(byStatus.get("in_transit")?.count).toBeGreaterThanOrEqual(2);
  });

  it("keeps movement ids in time order, as the ledger lists them", async () => {
    expect(await movementsOutOfOrder(connection.db)).toEqual([]);
  });

  it("gives every barcode a valid check digit", async () => {
    const rows = await connection.db
      .select({ barcode: product.barcode })
      .from(product)
      .where(sql`${product.barcode} is not null`);

    expect(rows.length).toBeGreaterThan(100);

    for (const { barcode } of rows) {
      expect(isValidGtin(barcode ?? "")).toBe(true);
    }
  });

  it("refuses to seed twice", async () => {
    await expect(seed(connection.db)).rejects.toThrow(/already has data/u);
  });
});
