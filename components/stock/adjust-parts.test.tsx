// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { RICE, lookupRice } from "@/test/picked-products";

import { ProductChoice } from "./adjust-parts";

const Harness = ({
  initialProduct,
}: {
  readonly initialProduct: PickedProduct | null;
}) => {
  const [product, setProduct] = useState(initialProduct);

  return (
    <ProductChoice
      initialProduct={initialProduct}
      lookup={lookupRice}
      onChange={setProduct}
      product={product}
      stockHere={0}
    />
  );
};

it("moves focus to Change after a pick, and back to the box from it", async () => {
  const user = userEvent.setup();
  render(<Harness initialProduct={null} />);

  await user.type(
    screen.getByRole("textbox", { name: "Product" }),
    "rice{Enter}"
  );
  await screen.findByRole("list", { name: "Matching products" });
  await user.keyboard("{ArrowDown}{Enter}");

  const change = screen.getByRole("button", { name: "Change" });
  expect(document.activeElement).toBe(change);

  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Product" })
  );
});

it("leaves focus alone for the product the page opened with", () => {
  render(<Harness initialProduct={RICE[0] ?? null} />);

  expect(screen.getByRole("button", { name: "Change" })).not.toBe(
    document.activeElement
  );
});
