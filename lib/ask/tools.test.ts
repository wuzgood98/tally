import { describe, expect, it } from "vitest";

import { resolveCoverage, resolveReportCoverage } from "@/lib/ask/context";
import type { AskBranch, AskContext, AskScope } from "@/lib/ask/context";
import type { AskData, PurchaseOrderRow, TransferRow } from "@/lib/ask/data";
import { askTools } from "@/lib/ask/tools";
import type { Actor } from "@/lib/permissions";
import type { ReorderLine } from "@/lib/queries/overview";
import type { SellerRow } from "@/lib/reports/sellers";
import { fakeData } from "@/test/ask-data";

const BRANCHES: readonly AskBranch[] = [
  { city: "Kumasi", id: "KSI", kind: "store", name: "Kumasi (Ahinsan)" },
  { city: "Accra", id: "SPX", kind: "store", name: "Spintex" },
  {
    city: "Tema",
    id: "TMA",
    kind: "warehouse",
    name: "Tema Distribution Centre",
  },
];

const ALL_IDS = BRANCHES.map((item) => item.id);

const admin: Actor = { branchId: null, id: "a", role: "admin" };
const manager: Actor = { branchId: "SPX", id: "m", role: "manager" };
const storekeeper: Actor = { branchId: "SPX", id: "s", role: "storekeeper" };
const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

const SPINTEX: AskScope = { branchId: "SPX", kind: "branch" };
const KUMASI: AskScope = { branchId: "KSI", kind: "branch" };
const ALL: AskScope = { kind: "all" };

const contextFor = (viewer: Actor, scope: AskScope = SPINTEX): AskContext => ({
  branches: BRANCHES,
  now: new Date("2026-11-15T12:00:00Z"),
  scope,
  viewer,
});

const reorderLine = (overrides: Partial<ReorderLine>): ReorderLine => ({
  branchId: "SPX",
  branchName: "Spintex",
  categoryName: "Rice & grains",
  inTransit: 0,
  name: "Rice 5kg",
  onHand: 2,
  onOrder: 0,
  productId: 1,
  reorderPoint: 10,
  requested: 0,
  sku: "RICE-5",
  supplierId: 1,
  supplierName: "Accra Foods",
  ...overrides,
});

const order = (id: number, day: number): PurchaseOrderRow => ({
  branchName: "Spintex",
  createdAt: new Date(Date.UTC(2026, 10, day)),
  expectedAt: null,
  id,
  number: `PO-SPX-00000${id}`,
  ordered: 10,
  received: 4,
  status: "approved",
  supplierName: "Accra Foods",
  totalCost: 50_000,
});

const transfer = (id: number): TransferRow => ({
  createdAt: new Date(Date.UTC(2026, 10, id)),
  fromName: "Tema Distribution Centre",
  id,
  number: `TRF-TMA-00000${id}`,
  status: "in_transit",
  toName: "Spintex",
  totalCost: 25_000,
  unitsSent: 12,
});

const seller = (productId: number): SellerRow => ({
  active: true,
  category: "Rice & grains",
  cost: 1000,
  daysOfCover: 5,
  margin: 500,
  name: `Product ${productId}`,
  onHand: 4,
  productId,
  returnedUnits: 0,
  sales: 1500,
  sku: `P-${productId}`,
  stockValue: 400,
  units: 3,
});

const toolsFor = (
  viewer: Actor,
  scope?: AskScope,
  answers?: Partial<AskData>
) => {
  const fake = fakeData(answers);

  const tools = askTools({
    context: contextFor(viewer, scope),
    data: fake.data,
  });

  if (tools === null) {
    throw new Error("Expected tools for this viewer");
  }

  return { ...fake, tools };
};

describe("which tools each role gets", () => {
  it("gives cashiers none", () => {
    expect(
      askTools({ context: contextFor(cashier), data: fakeData().data })
    ).toBeNull();
  });

  it("keeps the report tools from storekeepers", () => {
    const { tools } = toolsFor(storekeeper);

    expect(tools.lowStock).toBeDefined();
    expect(tools.sellersReport).toBeUndefined();
    expect(tools.shrinkageReport).toBeUndefined();
    expect(tools.stockValueReport).toBeUndefined();
  });

  it("gives managers and head office the reports", () => {
    for (const viewer of [manager, admin]) {
      const { tools } = toolsFor(viewer);

      expect(tools.sellersReport).toBeDefined();
      expect(tools.shrinkageReport).toBeDefined();
      expect(tools.stockValueReport).toBeDefined();
    }
  });
});

describe("which branch a question covers", () => {
  it("follows the branch switcher when no branch is named", async () => {
    const { calls, tools } = toolsFor(storekeeper, KUMASI);
    const result = await tools.lowStock.run({});

    expect(calls).toEqual([{ args: [KUMASI], name: "reorderLines" }]);
    expect(result).toMatchObject({ covers: "Kumasi (Ahinsan)" });
  });

  it("lets anyone in the back office name another branch, or all", async () => {
    const { calls, tools } = toolsFor(storekeeper, SPINTEX);

    await tools.stockSummary.run({ branch: "kumasi" });
    await tools.stockSummary.run({ branch: "TMA" });
    await tools.stockSummary.run({ branch: "spin" });
    await tools.stockSummary.run({ branch: "all" });

    expect(calls.map((call) => call.args[0])).toEqual([
      KUMASI,
      { branchId: "TMA", kind: "branch" },
      SPINTEX,
      ALL,
    ]);
  });

  it("refuses a branch that doesn't exist, without reading anything", async () => {
    const { calls, tools } = toolsFor(admin, ALL);

    const result = await tools.transfers.run({
      branch: "Takoradi",
      direction: "both",
      status: "in_transit",
    });

    expect(result).toEqual({
      error:
        `There's no single branch called "Takoradi". The branches are ` +
        "Kumasi (Ahinsan) (KSI), Spintex (SPX), Tema Distribution Centre (TMA).",
    });
    expect(calls).toEqual([]);
  });

  it("keeps a cashier to their own store, should one ever get here", () => {
    const context = contextFor(cashier);

    expect(resolveCoverage(context, "Kumasi")).toEqual({
      error: "You can't see Kumasi (Ahinsan).",
    });
    expect(resolveCoverage(context, "all")).toEqual({
      error: "You can only see your own branch.",
    });
    expect(resolveCoverage(context, undefined)).toEqual({
      label: "Spintex",
      scope: SPINTEX,
    });
  });
});

describe("report coverage", () => {
  it("gives a manager their own branch, whatever the switcher says", async () => {
    const { calls, tools } = toolsFor(manager, KUMASI);
    const result = await tools.sellersReport?.run({ days: "7" });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0]).toEqual(["SPX"]);
    expect(result).toMatchObject({ covers: "Spintex", days: 7 });
  });

  it("refuses a manager who names another branch or all", async () => {
    const { calls, tools } = toolsFor(manager, SPINTEX);

    const report = tools.shrinkageReport;

    if (report === undefined) {
      throw new Error("Expected the shrinkage report");
    }

    const results = await Promise.all(
      ["Kumasi", "all"].map(
        async (branch) => await report.run({ branch, days: "30" })
      )
    );

    const refusal = {
      error: "Managers see reports for their own branch only (Spintex).",
    };

    expect(results).toEqual([refusal, refusal]);

    expect(calls).toEqual([]);
  });

  it("labels a manager's shrinkage total with their own branch", async () => {
    const { tools } = toolsFor(manager, KUMASI);
    const result = await tools.shrinkageReport?.run({ days: "30" });

    expect(result).toMatchObject({
      covers: "Spintex",
      total: { branch: "Spintex" },
    });
  });

  it("lets head office report on any branch or all of them", () => {
    expect(resolveReportCoverage(contextFor(admin, ALL), undefined)).toEqual({
      branchIds: ALL_IDS,
      label: "All branches",
    });
    expect(resolveReportCoverage(contextFor(admin, ALL), "Tema")).toEqual({
      branchIds: ["TMA"],
      label: "Tema Distribution Centre",
    });
  });

  it("refuses storekeepers even when called directly", () => {
    expect(resolveReportCoverage(contextFor(storekeeper), undefined)).toEqual({
      error: "Reports are for head office and branch managers.",
    });
  });

  it("runs the report over the chosen range, ending now", async () => {
    const { calls, tools } = toolsFor(admin, ALL);

    await tools.stockValueReport?.run({ days: "90" });

    expect(calls[0]?.args[1]).toMatchObject({
      days: 90,
      from: new Date("2026-08-18T00:00:00Z"),
      to: new Date("2026-11-15T12:00:00Z"),
    });
  });
});

describe("what the tools hand the model", () => {
  it("formats money and adds up totals so the model never does", async () => {
    const { tools } = toolsFor(manager, SPINTEX, {
      product: async () =>
        await Promise.resolve({
          active: true,
          categoryName: "Rice & grains",
          id: 7,
          name: "Rice 5kg",
          sellPrice: 15_050,
          sku: "RICE-5",
          supplierName: "Accra Foods",
          unit: "each",
        }),
      productInTransit: async () =>
        await Promise.resolve(new Map([["KSI", 6]])),
      productLevels: async () =>
        await Promise.resolve([
          { binLocation: "A3", branchId: "SPX", onHand: 12, stocked: true },
          { binLocation: null, branchId: "KSI", onHand: -2, stocked: true },
          { binLocation: null, branchId: "TMA", onHand: 0, stocked: false },
        ]),
      productUnitsSold: async () =>
        await Promise.resolve(new Map([["SPX", 30]])),
    });

    const result = await tools.productStock.run({ productId: 7 });

    expect(result).toMatchObject({
      link: "[Rice 5kg](/products/7)",
      sellPrice: "GH₵150.50",
      totalOnHand: 12,
    });
    expect(result).toHaveProperty("branches", [
      expect.objectContaining({
        branch: "Kumasi (Ahinsan)",
        onHand: 0,
        onTheWay: 6,
        out: true,
      }),
      expect.objectContaining({
        branch: "Spintex",
        onHand: 12,
        out: false,
        unitsSold: 30,
      }),
      expect.objectContaining({
        branch: "Tema Distribution Centre",
        stocked: false,
      }),
    ]);
  });

  it("says so when a product doesn't exist", async () => {
    const { tools } = toolsFor(admin);

    expect(await tools.productStock.run({ productId: 999 })).toEqual({
      error: "There's no such product.",
    });
  });

  it("caps long lists and keeps the true total", async () => {
    const lines = Array.from({ length: 14 }, (_, index) =>
      reorderLine({ onHand: -1, productId: index + 1 })
    );

    const { tools } = toolsFor(admin, ALL, {
      reorderLines: async () => await Promise.resolve(lines),
    });

    const result = await tools.lowStock.run({});

    expect(result).toMatchObject({
      showing: "Showing 10 of 14. Say there are 14 in all.",
      total: 14,
    });
    expect(result).toHaveProperty("lines.length", 10);
    expect(result).toHaveProperty("lines.0.onHand", 0);
  });

  it("says when the sellers report's lists were cut short", async () => {
    const rows = Array.from({ length: 13 }, (_, index) => seller(index + 1));

    const { tools } = toolsFor(admin, ALL, {
      sellers: async () => await Promise.resolve(rows),
    });

    const result = await tools.sellersReport?.run({});

    expect(result).toMatchObject({
      fast: {
        showing: "Showing 10 of 13. Say there are 13 in all.",
        total: 13,
      },
      unsold: { showing: null, total: 0 },
    });
    expect(result).toHaveProperty("fast.products.length", 10);
  });

  it("adds up a list's units and value only when it read every row", async () => {
    const whole = toolsFor(manager, SPINTEX, {
      transfers: async () =>
        await Promise.resolve({ rows: [transfer(1), transfer(2)], total: 2 }),
    });

    const part = toolsFor(manager, SPINTEX, {
      transfers: async () =>
        await Promise.resolve({ rows: [transfer(1)], total: 31 }),
    });

    expect(await whole.tools.transfers.run({})).toMatchObject({
      totalUnits: 24,
      totalValueAtCost: "GH₵500.00",
    });
    expect(await part.tools.transfers.run({})).toMatchObject({
      totalUnits: null,
      totalValueAtCost: null,
    });
  });

  it("reads open purchase orders as approved and part received, newest first", async () => {
    const { calls, tools } = toolsFor(manager, SPINTEX, {
      purchaseOrders: async (_scope, status) =>
        await Promise.resolve(
          status === "approved"
            ? { rows: [order(1, 2)], total: 1 }
            : { rows: [order(2, 9)], total: 1 }
        ),
    });

    const result = await tools.purchaseOrders.run({ status: "open" });

    expect(calls.map((call) => call.args)).toEqual([
      [SPINTEX, "approved"],
      [SPINTEX, "partly_received"],
    ]);
    expect(result).toMatchObject({
      orders: [
        { number: "PO-SPX-000002", unitsDue: 6, valueAtCost: "GH₵500.00" },
        { number: "PO-SPX-000001" },
      ],
      total: 2,
    });
  });

  it("lists transfers still on the road unless asked otherwise", async () => {
    const { calls, tools } = toolsFor(storekeeper, SPINTEX);

    await tools.transfers.run({});
    await tools.transfers.run({ direction: "incoming", status: "any" });

    expect(calls.map((call) => call.args)).toEqual([
      [SPINTEX, "in_transit", "both"],
      [SPINTEX, null, "incoming"],
    ]);
  });
});
