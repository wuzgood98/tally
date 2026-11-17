// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { RICE, lookupRice } from "@/test/picked-products";

import { ProductPicker } from "./product-picker";

const renderPicker = () => {
  const picked: PickedProduct[] = [];
  const user = userEvent.setup();
  render(
    <ProductPicker
      label="Scan items"
      lookup={lookupRice}
      onPick={(choice) => {
        picked.push(choice);
      }}
    />
  );
  const box = screen.getByRole("textbox", { name: "Scan items" });

  return { box, picked, user };
};

const searchRice = async () => {
  const picker = renderPicker();
  await picker.user.type(picker.box, "rice{Enter}");
  await screen.findByRole("list", { name: "Matching products" });

  return picker;
};

const matchList = () =>
  screen.queryByRole("list", { name: "Matching products" });

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

  await user.keyboard("{End}{ArrowDown}");
  expect(document.activeElement).toBe(match(/Rice cooker/u));

  await user.keyboard("{Home}{ArrowUp}");
  expect(document.activeElement).toBe(box);
});

it("closes the matches with Escape from a match and returns to the box", async () => {
  const { box, user } = await searchRice();

  await user.keyboard("{ArrowDown}{Escape}");

  expect(matchList()).toBeNull();
  expect(document.activeElement).toBe(box);
});

it("closes the matches with Escape from the box and claims the key", async () => {
  const { box, user } = await searchRice();
  let prevented: boolean | null = null;
  document.addEventListener(
    "keydown",
    (event) => {
      prevented = event.defaultPrevented;
    },
    { once: true }
  );

  await user.keyboard("{Escape}");

  expect(prevented).toBe(true);
  expect(matchList()).toBeNull();
  expect(document.activeElement).toBe(box);
});

it("leaves Down alone in the box when there are no matches", async () => {
  const { box, user } = renderPicker();

  await user.click(box);
  await user.keyboard("{ArrowDown}");

  expect(document.activeElement).toBe(box);
});

it("drops the matches once the text changes", async () => {
  const { box, user } = await searchRice();

  await user.type(box, "s");
  await user.keyboard("{ArrowDown}");

  expect(matchList()).toBeNull();
  expect(document.activeElement).toBe(box);
});
