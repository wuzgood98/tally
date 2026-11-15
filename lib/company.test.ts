import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { companyInput, readCompanySettings, saveCompany } from "@/lib/company";
import { createTestWorld, rejection } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

beforeAll(async () => {
  world = await createTestWorld();
});

afterAll(async () => {
  await world.connection.close();
});

describe("readCompanySettings", () => {
  it("falls back to the deployment's name and the defaults", async () => {
    const settings = await readCompanySettings(world.db, {
      TALLY_COMPANY_NAME: "Kumasi Traders",
    });

    expect(settings).toMatchObject({
      askTally: { on: false, turnedOff: null, turnedOn: null },
      companyName: "Kumasi Traders",
      defaultReorderPoint: 10,
      receiptFooter: null,
      saved: null,
    });
  });
});

describe("saveCompany", () => {
  it("lets head office save, and records who", async () => {
    await saveCompany(world.db, world.admin, {
      companyName: "  Akwaaba Mall Ltd ",
      defaultReorderPoint: 24,
      receiptFooter: "Thank you!\r\n\r\n  Medaase  ",
    });

    const settings = await readCompanySettings(world.db, {});

    expect(settings.companyName).toBe("Akwaaba Mall Ltd");
    expect(settings.defaultReorderPoint).toBe(24);
    expect(settings.receiptFooter).toBe("Thank you!\nMedaase");
    expect(settings.saved?.by).toBeTypeOf("string");
  });

  it("writes the one row in place, and an empty footer prints nothing", async () => {
    await saveCompany(world.db, world.admin, {
      companyName: "Akwaaba Mall",
      defaultReorderPoint: 0,
      receiptFooter: "   ",
    });

    const settings = await readCompanySettings(world.db, {});

    expect(settings.defaultReorderPoint).toBe(0);
    expect(settings.receiptFooter).toBeNull();
  });

  it("refuses anyone but head office", async () => {
    const errors = await Promise.all(
      [
        world.spintexManager,
        world.spintexStorekeeper,
        world.spintexCashier,
      ].map(
        async (actor) =>
          await rejection(
            saveCompany(world.db, actor, {
              companyName: "Not Ours",
              defaultReorderPoint: 5,
              receiptFooter: "",
            })
          )
      )
    );

    expect(errors.map((error) => error.code)).toEqual([
      "forbidden",
      "forbidden",
      "forbidden",
    ]);
  });
});

describe("companyInput", () => {
  it("caps the footer at 160 characters and wants whole units", () => {
    const long = companyInput.safeParse({
      companyName: "Akwaaba Mall",
      defaultReorderPoint: 10,
      receiptFooter: "x".repeat(161),
    });

    const fraction = companyInput.safeParse({
      companyName: "Akwaaba Mall",
      defaultReorderPoint: 2.5,
      receiptFooter: "",
    });

    expect(long.error?.issues[0]?.message).toBe(
      "Keep the footer to 160 characters."
    );
    expect(fraction.error?.issues[0]?.message).toBe(
      "Use a whole number of units."
    );
  });
});
