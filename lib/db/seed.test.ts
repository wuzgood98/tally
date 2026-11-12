import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isValidGtin } from "@/lib/barcode";
import { connectPglite } from "@/lib/db/client";
import type { Connection } from "@/lib/db/client";
import { product } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import { ledgerMismatches } from "@/test/db";

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
