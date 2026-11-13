// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Checkbox,
  Radio,
  RadioGroup,
  SegmentedControl,
  SegmentedControlItem,
} from "./choice";
import { Field, FieldDescription, FieldLabel } from "./field";
import { Input } from "./input";
import { PasswordInput } from "./password-input";
import { Select } from "./select";

const isChecked = (element: HTMLElement) =>
  element.getAttribute("aria-checked") === "true" ||
  (element instanceof HTMLInputElement && element.checked);

const description = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.querySelector(`#${id}`)?.textContent ?? "")
    .join(" ")
    .trim();

const submitted = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries());

const formOf = (element: HTMLElement) => {
  const form = element.closest("form");

  if (form === null) {
    throw new Error("Expected the control to sit inside a form");
  }

  return form;
};

const STORES = [
  { label: "Accra Mall", value: "accra" },
  { label: "Kumasi City", value: "kumasi" },
];

describe("Select", () => {
  it("is named by its field label and submits its default value", () => {
    render(
      <form>
        <Field>
          <FieldLabel>Store</FieldLabel>
          <Select defaultValue="kumasi" name="branchId" options={STORES} />
        </Field>
      </form>
    );
    const trigger = screen.getByRole("combobox", { name: "Store" });

    expect(trigger.textContent).toContain("Kumasi City");
    expect(submitted(formOf(trigger))).toEqual({ branchId: "kumasi" });
  });

  it("submits the option chosen with the pointer", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Select
          aria-label="Store"
          defaultValue="accra"
          name="branchId"
          options={STORES}
        />
      </form>
    );
    const trigger = screen.getByRole("combobox", { name: "Store" });

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Kumasi City" }));

    expect(trigger.textContent).toContain("Kumasi City");
    expect(submitted(formOf(trigger))).toEqual({ branchId: "kumasi" });
  });

  it("chooses an option from the keyboard and returns focus", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Select
          aria-label="Store"
          defaultValue="accra"
          name="branchId"
          options={STORES}
        />
      </form>
    );
    const trigger = screen.getByRole("combobox", { name: "Store" });

    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(submitted(formOf(trigger))).toEqual({ branchId: "kumasi" });
    expect(document.activeElement).toBe(trigger);
  });

  it("blocks a required form until something is chosen", () => {
    render(
      <form>
        <Field>
          <FieldLabel>Supplier</FieldLabel>
          <Select
            name="supplierId"
            options={STORES}
            placeholder="Choose a supplier"
            required
          />
        </Field>
      </form>
    );
    const trigger = screen.getByRole("combobox", { name: "Supplier" });

    expect(trigger.textContent).toContain("Choose a supplier");
    expect(formOf(trigger).checkValidity()).toBe(false);
  });

  it("submits an empty value for an 'all' option, like a native select", () => {
    render(
      <form>
        <Select
          aria-label="Category"
          defaultValue=""
          name="category"
          options={[
            { label: "All categories", value: "" },
            { label: "Food", options: [{ label: "Rice", value: "3" }] },
          ]}
        />
      </form>
    );
    const trigger = screen.getByRole("combobox", { name: "Category" });

    expect(trigger.textContent).toContain("All categories");
    expect(submitted(formOf(trigger))).toEqual({ category: "" });
  });
});

describe("Field and Input", () => {
  it("labels and describes the input", () => {
    render(
      <Field>
        <FieldLabel>SKU</FieldLabel>
        <Input name="sku" />
        <FieldDescription>Letters, numbers and dashes.</FieldDescription>
      </Field>
    );

    expect(description(screen.getByRole("textbox", { name: "SKU" }))).toBe(
      "Letters, numbers and dashes."
    );
  });

  it("keeps an icon out of the accessible name", () => {
    render(
      <Field>
        <FieldLabel>Search products</FieldLabel>
        <Input icon={<svg aria-hidden="true" />} name="q" type="search" />
      </Field>
    );

    expect(
      screen.getByRole("searchbox", { name: "Search products" }).tagName
    ).toBe("INPUT");
  });

  it("marks the input invalid when its field is", () => {
    render(
      <Field invalid>
        <FieldLabel>Work email</FieldLabel>
        <Input name="email" type="email" />
      </Field>
    );

    expect(
      screen
        .getByRole("textbox", { name: "Work email" })
        .getAttribute("aria-invalid")
    ).toBe("true");
  });
});

describe("Checkbox", () => {
  it("toggles from its label and submits 'on' only while checked", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <label>
          <Checkbox defaultChecked name="active" value="on" />
          Active
        </label>
      </form>
    );
    const box = screen.getByRole("checkbox", { name: "Active" });

    expect(submitted(formOf(box))).toEqual({ active: "on" });
    await user.click(screen.getByText("Active"));
    expect(isChecked(box)).toBe(false);
    expect(submitted(formOf(box))).toEqual({});
    await user.keyboard(" ");
    expect(isChecked(box)).toBe(true);
  });
});

describe("RadioGroup", () => {
  it("takes its name from the field and moves with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Field layout="group">
          <FieldLabel>Payment</FieldLabel>
          <RadioGroup columns={3} defaultValue="cash" name="paymentMethod">
            {["cash", "momo", "card"].map((method) => (
              <label key={method}>
                <Radio bare value={method} />
                {method}
              </label>
            ))}
          </RadioGroup>
        </Field>
      </form>
    );
    const group = screen.getByRole("radiogroup", { name: "Payment" });
    const cash = screen.getByRole("radio", { name: "cash" });

    expect(isChecked(cash)).toBe(true);
    cash.focus();
    await user.keyboard("{ArrowRight}");
    expect(isChecked(screen.getByRole("radio", { name: "momo" }))).toBe(true);
    expect(submitted(formOf(group))).toEqual({ paymentMethod: "momo" });
  });
});

describe("SegmentedControl", () => {
  it("skips a disabled item", async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl aria-label="What happened" defaultValue="change">
        <SegmentedControlItem value="change">Write off</SegmentedControlItem>
        <SegmentedControlItem disabled value="count">
          Record a count
        </SegmentedControlItem>
      </SegmentedControl>
    );
    const change = screen.getByRole("radio", { name: "Write off" });

    change.focus();
    await user.keyboard("{ArrowRight}");

    expect(isChecked(change)).toBe(true);
    expect(
      isChecked(screen.getByRole("radio", { name: "Record a count" }))
    ).toBe(false);
  });
});

describe("PasswordInput", () => {
  it("is labelled by its field and can be shown", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Field>
          <FieldLabel>Password</FieldLabel>
          <PasswordInput name="password" required />
        </Field>
      </form>
    );
    const field = screen.getByLabelText("Password", { selector: "input" });

    expect(field.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field.getAttribute("type")).toBe("text");
  });
});
