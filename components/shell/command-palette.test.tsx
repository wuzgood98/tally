// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaletteGroup } from "@/lib/palette";
import type { PaletteDocument } from "@/lib/palette-documents";
import type { PaletteResults } from "@/lib/palette-results";
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

const ORDER: PaletteDocument = {
  detail: "Spintex · Draft",
  exact: false,
  href: "/purchase-orders/3",
  kind: "Purchase order",
  number: "PO-SPX-000012",
};

const matchingDocuments = (text: string): PaletteDocument[] => {
  const needle = text.trim().toUpperCase();

  if (needle === "PO-SPX-000012") {
    return [{ ...ORDER, exact: true }];
  }

  return needle.endsWith("12") ? [ORDER] : [];
};

const search = vi.fn(
  async (text: string): Promise<PaletteResults> =>
    await Promise.resolve({
      documents: matchingDocuments(text),
      products: matchingProducts(text),
    })
);

const switchScope = vi.fn(async (_scope: string) => {
  /* the app's action sets the scope cookie */
});

const setTheme = vi.fn(async (_theme: string) => {
  /* the app's action sets the theme cookie */
});

const BRANCHES = [
  { id: "SPX", kind: "store", name: "Spintex" },
  { id: "KSI", kind: "store", name: "Kumasi" },
  { id: "TMA", kind: "warehouse", name: "Tema Distribution Centre" },
] as const;

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
        shortcut: "alt+shift+l",
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
      branches={BRANCHES}
      onSetTheme={setTheme}
      onSwitchScope={switchScope}
      scope="SPX"
      search={search}
      theme="system"
    >
      <PaletteFieldTrigger />
      <PaletteIconTrigger />
    </CommandPalette>
  );

const agent = createAgent();

beforeEach(() => {
  push.mockClear();
  signOut.mockClear();
  search.mockClear();
  switchScope.mockClear();
  setTheme.mockClear();
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

  it("goes to a page from its shortcut, palette closed", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Alt>}{Shift>}l{/Shift}{/Alt}");

    expect(push).toHaveBeenCalledWith("/low-stock");
  });

  it("shows a command's shortcut on its row and the keys in the footer", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("combobox");

    const lowStock = screen
      .getByText("Low stock")
      .closest('[data-slot="command-item"]');

    expect(lowStock?.getAttribute("aria-keyshortcuts")).toBe("Alt+Shift+L");
    expect(lowStock?.querySelector("kbd")?.textContent).toContain(
      "Alt+Shift+L"
    );

    const overview = screen
      .getByText("Overview")
      .closest('[data-slot="command-item"]');

    expect(overview?.querySelector("kbd")).toBeNull();

    for (const label of ["Open", "Move", "Close"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    expect(screen.queryByText("Back")).toBeNull();
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
      expect(search).toHaveBeenCalledWith("low");
    });

    const first = screen
      .getAllByRole("option")
      .find((option) => option.hidden === false);

    expect(first).toBe(screen.getByRole("option", { name: "Low stock" }));

    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "rice");
    await user.click(
      await screen.findByRole("option", { name: /See all results/u })
    );

    expect(push).toHaveBeenCalledWith("/products?q=rice");
  });

  it("finds a document by number and opens it", async () => {
    const user = await openAndType("po 12");
    const order = await screen.findByRole("option", { name: /PO-SPX-000012/u });

    expect(order.textContent).toContain("Spintex · Draft");

    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/purchase-orders/3");
  });

  it("opens a whole document number with Enter, above matching pages", async () => {
    const user = await openAndType("PO-SPX-000012");

    await screen.findByRole("option", { name: /PO-SPX-000012/u });
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/purchase-orders/3");
  });

  it("switches branch from the branch page, showing the current one", async () => {
    const user = await openAndType("switch br");

    await user.keyboard("{Enter}");

    const current = await screen.findByRole("option", { name: /^Spintex/u });

    expect(current.hidden).toBe(false);
    expect(current.textContent).toContain("(showing now)");

    await user.type(screen.getByRole("combobox"), "tema");
    await user.keyboard("{Enter}");

    expect(switchScope).toHaveBeenCalledWith("TMA");
    expect(push).not.toHaveBeenCalled();
  });

  it("offers Switch to a branch only once its name is typed", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Control>}k{/Control}");

    expect(
      screen.queryByRole("option", { name: "Switch to Kumasi" })
    ).toBeNull();
    expect(
      screen.queryByRole("option", { name: "Switch to Spintex" })
    ).toBeNull();

    await user.type(screen.getByRole("combobox"), "kum");
    await user.click(screen.getByRole("option", { name: "Switch to Kumasi" }));

    expect(switchScope).toHaveBeenCalledWith("KSI");
  });

  it("has no Branch group for someone fixed to their store", async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        branches={[]}
        groups={GROUPS}
        onNavigate={push}
        onSetTheme={setTheme}
        onSignOut={signOut}
        onSwitchScope={switchScope}
        scope="SPX"
        search={search}
        theme="system"
      >
        <PaletteFieldTrigger />
      </CommandPalette>
    );
    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByRole("combobox"), "branch");

    expect(screen.queryByRole("option", { name: /Switch branch/u })).toBeNull();
  });

  it("picks a theme from the theme page", async () => {
    const user = await openAndType("dark");

    expect(
      screen.getByRole("option", { name: /^Theme/u }).textContent
    ).toContain("Match this device");

    await user.keyboard("{Enter}");
    await user.type(screen.getByRole("combobox"), "dark");
    await user.keyboard("{Enter}");

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("collapses the sidebar from the palette", async () => {
    const user = userEvent.setup();

    const toggleSidebar = vi.fn(() => {
      /* the app flips the sidebar */
    });

    render(
      <CommandPalette
        branches={BRANCHES}
        groups={GROUPS}
        onNavigate={push}
        onSetTheme={setTheme}
        onSignOut={signOut}
        onSwitchScope={switchScope}
        scope="SPX"
        search={search}
        sidebar={{ collapsed: false, onToggle: toggleSidebar }}
        theme="system"
      >
        <PaletteFieldTrigger />
      </CommandPalette>
    );
    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByRole("combobox"), "sidebar");
    await user.keyboard("{Enter}");

    expect(toggleSidebar).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("has no sidebar command where there's no sidebar", async () => {
    await openAndType("sidebar");

    expect(screen.queryByRole("option", { name: /sidebar/u })).toBeNull();
  });

  it("doesn't search for a single letter", async () => {
    await openAndType("r");

    expect(search).not.toHaveBeenCalled();
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
