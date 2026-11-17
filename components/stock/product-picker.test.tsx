// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { LookupResult, PickedProduct } from "@/app/(app)/lookup-action";

import { ProductPicker } from "./product-picker";

// The picker's default lookup is a server-only action, which can't load under
// jsdom. These tests pass their own lookup, so the stub is never called.
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock("@/app/(app)/lookup-action", () => ({ lookupProducts: vi.fn() }));

const product = (id: number, name: string): PickedProduct => ({
  averageCost: null,
  barcode: null,
  id,
  name,
  onHand: {},
  sellPrice: 1000,
  sku: `GRN-000${id}`,
  unit: "each",
});

const RICE: readonly PickedProduct[] = [
  product(1, "Jasmine rice 5 kg"),
  product(2, "Jasmine rice 10 kg"),
  product(3, "Rice cooker 1.8 L"),
];

const lookup = (): LookupResult => ({ exact: null, matches: RICE });

const searchRice = async () => {
  const picked: PickedProduct[] = [];
  const user = userEvent.setup();
  render(
    <ProductPicker
      label="Scan items"
      lookup={lookup}
      onPick={(choice) => {
        picked.push(choice);
      }}
    />
  );
  const box = screen.getByRole("textbox", { name: "Scan items" });
  await user.type(box, "rice{Enter}");
  await screen.findByRole("list", { name: "Matching products" });

  return { box, picked, user };
};

const match = (name: RegExp) => screen.getByRole("button", { name });

it("picks a match by name with the arrow keys and Enter", async () => {
  const { box, picked, user } = await searchRice();

  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

  expect(picked).toStrictEqual([RICE[1]]);
  expect(document.activeElement).toBe(box);
  expect(box).toHaveProperty("value", "");
});

it("moves back up into the box from the first match", async () => {
  const { box, user } = await searchRice();

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(match(/Jasmine rice 5 kg/u));

  await user.keyboard("{End}");
  expect(document.activeElement).toBe(match(/Rice cooker/u));

  await user.keyboard("{Home}{ArrowUp}");
  expect(document.activeElement).toBe(box);
});

it("closes the matches with Escape and returns to the box", async () => {
  const { box, user } = await searchRice();

  await user.keyboard("{ArrowDown}{Escape}");

  expect(screen.queryByRole("list", { name: "Matching products" })).toBeNull();
  expect(document.activeElement).toBe(box);
});
