import { asc, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isValidGtin } from "@/lib/barcode";
import { readCompanySettings } from "@/lib/company";
import { connectPglite } from "@/lib/db/client";
import type { Connection } from "@/lib/db/client";
import {
  notification,
  product,
  purchaseOrder,
  sale,
  saleReturnLine,
  stockLevel,
  stockRequest,
  stockTransfer,
  stockTransferLine,
  user,
} from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import {
  bookValueTotals,
  ledgerMismatches,
  movementsOutOfOrder,
  purchaseOrderMismatches,
  saleMismatches,
  transferMismatches,
} from "@/test/db";

let connection: Connection;

/**
 * The seed runs a month of deliveries, transfers and sales through the real
 * domain code: about 30 s alone, longer while other test files share the CPU.
 */
const SEED_TIMEOUT_MS = 180_000;

const SEEDED_AT = "2026-11-12T12:00:00Z";
const TODAY = "2026-11-12T00:00:00Z";

beforeAll(async () => {
  connection = connectPglite();
  await connection.migrate();
  await seed(connection.db, new Date(SEEDED_AT));
}, SEED_TIMEOUT_MS);

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

  it("keeps every sale's and return's movements equal to its lines", async () => {
    expect(await saleMismatches(connection.db)).toEqual([]);
  });

  it("seeds a month of sales, including today, and both kinds of return", async () => {
    const [sales] = await connection.db
      .select({
        today: sql<number>`count(*) filter (where ${sale.createdAt} >= '2026-11-12')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(sale);

    expect(sales?.total).toBeGreaterThan(300);
    expect(sales?.today).toBeGreaterThan(0);

    const dispositions = await connection.db
      .selectDistinct({ disposition: saleReturnLine.disposition })
      .from(saleReturnLine);

    expect(dispositions.map((row) => row.disposition).toSorted()).toEqual([
      "damaged",
      "restock",
    ]);
  });

  it("leaves exactly one line needing a count: the deliberate oversell", async () => {
    const negative = await connection.db
      .select({ branchId: stockLevel.branchId })
      .from(stockLevel)
      .where(sql`${stockLevel.onHand} < 0`);

    expect(negative).toEqual([{ branchId: "SPX" }]);
  });

  it("keeps every purchase order's received quantities equal to its deliveries", async () => {
    expect(await purchaseOrderMismatches(connection.db)).toEqual([]);
  });

  it("seeds purchase orders in every state", async () => {
    const rows = await connection.db
      .select({
        branchId: purchaseOrder.branchId,
        status: purchaseOrder.status,
      })
      .from(purchaseOrder)
      .orderBy(purchaseOrder.status, purchaseOrder.branchId);

    const branchesWith = (status: string) =>
      rows.flatMap((row) => (row.status === status ? [row.branchId] : []));

    expect(branchesWith("received")).toHaveLength(6);
    expect(branchesWith("partly_received")).toHaveLength(5);
    expect(branchesWith("closed")).toEqual(["SPX"]);
    expect(branchesWith("approved")).toEqual(["TMA"]);
    expect(branchesWith("draft")).toEqual(["SPX"]);
    expect(branchesWith("cancelled")).toEqual(["KSI"]);
  });

  it("seeds requests fulfilled, open and cancelled", async () => {
    const rows = await connection.db
      .select({
        branchId: stockRequest.branchId,
        status: stockRequest.status,
      })
      .from(stockRequest)
      .orderBy(stockRequest.status, stockRequest.branchId);

    const branchesWith = (status: string) =>
      rows.flatMap((row) => (row.status === status ? [row.branchId] : []));

    expect(branchesWith("fulfilled")).toEqual([
      "AMS",
      "ASH",
      "KSI",
      "SPX",
      "WJA",
    ]);
    expect(branchesWith("requested")).toEqual(["WJA"]);
    expect(branchesWith("cancelled")).toEqual(["AMS"]);

    const sent = await connection.db
      .select({ status: stockTransfer.status })
      .from(stockRequest)
      .innerJoin(
        stockTransfer,
        sql`${stockTransfer.id} = ${stockRequest.transferId}`
      );

    expect(sent.map((row) => row.status)).toEqual(
      Array.from({ length: 5 }, () => "received")
    );
  });

  it("keeps the ledger's book value within 1% of units × average cost", async () => {
    const { atAverage, book } = await bookValueTotals(connection.db);

    expect(atAverage).toBeGreaterThan(0);
    expect(Math.abs(book - atAverage) / atAverage).toBeLessThan(0.01);
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

  it("dates notifications with their events and leaves only today's unread", async () => {
    const unread = sql`${notification.readAt} is null`;

    const [row] = await connection.db
      .select({
        future: sql<number>`count(*) filter (where ${notification.createdAt} > ${SEEDED_AT})::int`,
        headOffice: sql<number>`count(*) filter (where ${unread} and ${user.email} = 'efua.asante@akwaaba.example')::int`,
        stale: sql<number>`count(*) filter (where ${unread} and ${notification.createdAt} < ${TODAY})::int`,
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where ${unread})::int`,
      })
      .from(notification)
      .innerJoin(user, sql`${user.id} = ${notification.userId}`);

    expect(row).toMatchObject({ future: 0, stale: 0 });
    expect(row?.total).toBeGreaterThan(20);
    expect(row?.unread).toBeGreaterThan(0);
    // Spintex's draft from this morning waits for head office's approval.
    expect(row?.headOffice).toBeGreaterThan(0);
  });

  it("keeps notification ids in time order", async () => {
    const rows = await connection.db
      .select({ createdAt: notification.createdAt })
      .from(notification)
      .orderBy(asc(notification.id));

    const behind = rows.filter(
      (row, index) =>
        index > 0 &&
        row.createdAt < (rows[index - 1]?.createdAt ?? row.createdAt)
    );

    expect(behind).toEqual([]);
  });

  it("turns Ask Tally on, as head office, for the demo", async () => {
    const settings = await readCompanySettings(connection.db, {});

    expect(settings.askTally.on).toBe(true);
    expect(settings.askTally.turnedOn?.by).toBe("Efua Asante");
  });

  it("refuses to seed twice", async () => {
    await expect(seed(connection.db)).rejects.toThrow(/already has data/u);
  });
});
