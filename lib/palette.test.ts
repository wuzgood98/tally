import { describe, expect, it } from "vitest";

import { paletteCommands } from "@/lib/palette";
import type { Actor } from "@/lib/permissions";
import type { BranchSummary } from "@/lib/scope";

const BRANCHES: BranchSummary[] = [
  { city: "Accra", id: "SPX", kind: "store", name: "Spintex" },
  { city: "Kumasi", id: "KSI", kind: "store", name: "Kumasi" },
  { city: "Tema", id: "TMA", kind: "warehouse", name: "Tema" },
];

const admin: Actor = { branchId: null, id: "a", role: "admin" };
const manager: Actor = { branchId: "SPX", id: "m", role: "manager" };
const warehouseManager: Actor = { branchId: "TMA", id: "w", role: "manager" };
const storekeeper: Actor = { branchId: "SPX", id: "s", role: "storekeeper" };
const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

const valuesIn = (viewer: Actor, group: string): string[] =>
  paletteCommands(viewer, BRANCHES)
    .find((item) => item.label === group)
    ?.commands.map((command) => command.value) ?? [];

const allValues = (viewer: Actor): string[] =>
  paletteCommands(viewer, BRANCHES).flatMap((group) =>
    group.commands.map((command) => command.value)
  );

describe("paletteCommands", () => {
  it("gives head office every page and every create", () => {
    expect(valuesIn(admin, "Go to")).toEqual([
      "go:/",
      "go:/till",
      "go:/sales",
      "go:/products",
      "go:/low-stock",
      "go:/receipts",
      "go:/transfers",
      "go:/requests",
      "go:/adjustments",
      "go:/movements",
      "go:/purchase-orders",
      "go:/reports",
      "go:/reports/stock-value",
      "go:/reports/sellers",
      "go:/reports/shrinkage",
      "go:/staff",
      "go:/tills",
      "go:/settings",
    ]);
    expect(valuesIn(admin, "Create")).toEqual([
      "new:sale",
      "new:receipt",
      "new:adjustment",
      "new:transfer",
      "new:purchase-order",
      "new:request",
      "new:product",
    ]);
  });

  it("gives a store manager reports, ordering and requests, but no admin pages", () => {
    const values = allValues(manager);

    expect(values).toContain("go:/reports/shrinkage");
    expect(values).toContain("new:purchase-order");
    expect(values).toContain("new:request");
    expect(values).not.toContain("go:/staff");
    expect(values).not.toContain("go:/tills");
    expect(values).not.toContain("new:product");
    expect(values).toContain("go:/settings");
  });

  it("doesn't offer a warehouse manager a stock request: only stores ask", () => {
    expect(valuesIn(warehouseManager, "Create")).not.toContain("new:request");
    expect(valuesIn(warehouseManager, "Create")).toContain(
      "new:purchase-order"
    );
  });

  it("keeps storekeepers off the till, reports and ordering", () => {
    const values = allValues(storekeeper);

    expect(values).not.toContain("go:/till");
    expect(values).not.toContain("new:sale");
    expect(values).not.toContain("go:/reports");
    expect(values).not.toContain("new:purchase-order");
    expect(values).toContain("go:/settings");
    expect(valuesIn(storekeeper, "Create")).toEqual([
      "new:receipt",
      "new:adjustment",
      "new:transfer",
    ]);
  });

  it("gives a cashier the till, sales, products and their settings, and nothing else", () => {
    expect(valuesIn(cashier, "Go to")).toEqual([
      "go:/till",
      "go:/sales",
      "go:/products",
      "go:/settings",
    ]);
    expect(valuesIn(cashier, "Create")).toEqual(["new:sale"]);
  });

  it("always offers sign out, and every value is unique", () => {
    for (const viewer of [admin, manager, storekeeper, cashier]) {
      const values = allValues(viewer);

      expect(values).toContain("account:sign-out");
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("leaves out the Create group when there is nothing to create", () => {
    const noStores = BRANCHES.filter((item) => item.kind === "warehouse");
    const groups = paletteCommands(cashier, noStores).map((item) => item.label);

    expect(groups).toEqual(["Go to", "Account"]);
  });
});
