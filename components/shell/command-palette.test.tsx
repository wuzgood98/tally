// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaletteGroup } from "@/lib/palette";
import type { PaletteProduct } from "@/lib/palette-search";

import {
  CommandPalette,
  PaletteFieldTrigger,
  PaletteIconTrigger,
} from "./command-palette";

const push = vi.fn((_href: string) => {
  /* records where the palette navigated */
});

const signOut = vi.fn(async () => {
  /* the app's action redirects to /login */
});

const RICE: PaletteProduct = {
  active: true,
  exact: false,
  id: 7,
  name: "Jasmine rice 5 kg",
  onHand: 12,
  sku: "GR-0001",
};

const OLD_KETTLE: PaletteProduct = {
  active: false,
  exact: false,
  id: 9,
  name: "Kettle, old model",
  onHand: null,
  sku: "HK-0009",
};

const matchingProducts = (text: string): PaletteProduct[] => {
  const needle = text.trim().toLowerCase();

  if (needle === "5012345678900") {
    return [{ ...RICE, exact: true }];
  }

  return [RICE, OLD_KETTLE].filter((item) =>
    item.name.toLowerCase().includes(needle)
  );
};

const searchProducts = vi.fn(
  async (text: string): Promise<PaletteProduct[]> =>
    await Promise.resolve(matchingProducts(text))
);

const GROUPS: PaletteGroup[] = [
  {
    commands: [
      {
        href: "/",
        icon: "overview",
        kind: "link",
        label: "Overview",
        value: "go:/",
      },
      {
        href: "/low-stock",
        icon: "low-stock",
        keywords: ["reorder"],
        kind: "link",
        label: "Low stock",
        value: "go:/low-stock",
      },
    ],
    label: "Go to",
  },
  {
    commands: [
      {
        href: "/transfers/new",
        icon: "transfers",
        kind: "link",
        label: "New transfer",
        value: "new:transfer",
      },
    ],
    label: "Create",
  },
  {
    commands: [
      {
        icon: "sign-out",
        kind: "sign-out",
        label: "Sign out",
        value: "account:sign-out",
      },
    ],
    label: "Account",
  },
];

const renderPalette = () =>
  render(
    <CommandPalette
      groups={GROUPS}
      onNavigate={push}
      onSignOut={signOut}
      searchProducts={searchProducts}
    >
      <PaletteFieldTrigger />
      <PaletteIconTrigger />
    </CommandPalette>
  );

const agent = createAgent();

beforeEach(() => {
  push.mockClear();
  signOut.mockClear();
  searchProducts.mockClear();
});

const openAndType = async (text: string) => {
  const user = userEvent.setup();
  renderPalette();
  await user.keyboard("{Control>}k{/Control}");
  await user.type(await screen.findByRole("combobox"), text);

  return user;
};

describe("CommandPalette", () => {
  it("opens with Ctrl+K and goes to a page found by a keyword", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");

    const field = await screen.findByRole("combobox", {
      name: "Search or jump to",
    });

    await user.type(field, "reorder");

    const overview = screen
      .getByText("Overview")
      .closest('[data-slot="command-item"]');

    expect(overview?.hasAttribute("hidden")).toBe(true);

    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/low-stock");
  });

  it("opens from either trigger and runs a create command by click", async () => {
    const user = userEvent.setup();
    renderPalette();

    const [fieldTrigger] = screen.getAllByRole("button", {
      name: /Search or jump to/u,
    });

    await user.click(fieldTrigger ?? document.body);
    await user.click(await screen.findByText("New transfer"));

    expect(push).toHaveBeenCalledWith("/transfers/new");
  });

  it("signs out without navigating", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByRole("combobox"), "sign");
    await user.keyboard("{Enter}");

    expect(signOut).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByRole("combobox"), "zzzz");

    expect(await screen.findByText("Nothing matches “zzzz”.")).toBeTruthy();
  });

  it("shows products with their stock, and opens one", async () => {
    const user = await openAndType("rice");
    const rice = await screen.findByRole("option", { name: /Jasmine rice/u });

    expect(rice.textContent).toContain("12 on hand");

    await user.click(rice);

    expect(push).toHaveBeenCalledWith("/products/7");
  });

  it("tags discontinued products and says when one isn't stocked", async () => {
    await openAndType("kettle");
    const kettle = await screen.findByRole("option", { name: /Kettle/u });

    expect(kettle.textContent).toContain("Discontinued");
    expect(kettle.textContent).toContain("Not stocked");
  });

  it("opens a scanned barcode with Enter", async () => {
    const user = await openAndType("5012345678900");

    await screen.findByRole("option", { name: /Jasmine rice/u });
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/products/7");
  });

  it("keeps a matching page above products, and links to every result", async () => {
    const user = await openAndType("low");

    await vi.waitFor(() => {
      expect(searchProducts).toHaveBeenCalledWith("low");
    });

    const first = screen
      .getAllByRole("option")
      .find((option) => option.hidden === false);

    expect(first?.textContent).toBe("Low stock");

    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "rice");
    await user.click(
      await screen.findByRole("option", { name: /See all results/u })
    );

    expect(push).toHaveBeenCalledWith("/products?q=rice");
  });

  it("doesn't search products for a single letter", async () => {
    await openAndType("r");

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it("lets an agent find the palette and search it", async () => {
    renderPalette();

    const components = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true);

    for (const entry of components) {
      expect(
        entry.label,
        `${entry.component} ${entry.ref} has no name`
      ).toBeTruthy();
    }

    const command = components.find((entry) => entry.component === "command");
    const dialog = components.find((entry) => entry.component === "dialog");

    expect(command?.label).toBe("Search or jump to");
    expect(dialog?.label).toBe("Search or jump to");

    const result = await agent.act({
      steps: [
        { action: "setOpen", args: [true], ref: dialog?.ref ?? "" },
        { action: "setQuery", args: ["reorder"], ref: command?.ref ?? "" },
        { action: "setValue", args: ["Low stock"], ref: command?.ref ?? "" },
      ],
    });

    expect(result.ok, result.error?.message).toBe(true);
    expect(
      screen
        .getByRole("option", { name: "Low stock" })
        .getAttribute("aria-selected")
    ).toBe("true");
  });

  // ui-sdk 0.1.0-beta.1: Command offers agents setValue, setQuery and setPages, but no way to run the highlighted command.
  it.fails("lets an agent run a command", async () => {
    renderPalette();

    const command = agent
      .snapshot()
      .find((entry) => entry.offPage !== true && entry.component === "command");

    const result = await agent.act({
      steps: [
        { action: "press", args: ["Low stock"], ref: command?.ref ?? "" },
      ],
    });

    expect(result.ok, result.error?.message).toBe(true);
  });
});
