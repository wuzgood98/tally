// @vitest-environment jsdom
import "@/test/dom";
import { setTimeout as sleep } from "node:timers/promises";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  FilterSummary,
  ListFilters,
  ListResults,
  SEARCH_DEBOUNCE_MS,
  UrlChip,
  UrlSearch,
  UrlTabs,
} from "./list-filters";

const STATUSES = [
  { label: "All active", value: "all" },
  { label: "Running low", value: "low" },
  { label: "Out of stock", value: "out" },
];

const valueOf = (element: HTMLElement): string => {
  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError("Expected a text box");
  }

  return element.value;
};

/** Renders inside a URL that starts as `search`, recording every update. */
const renderAt = (search: string, ui: ReactNode) => {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();

  render(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={onUrlUpdate}
      // Real rate limits, so the debounce is what's tested.
      rateLimitFactor={1}
      searchParams={search}
    >
      <ListFilters>
        {ui}
        <ListResults announce="3 products">
          <p>Results</p>
        </ListResults>
      </ListFilters>
    </NuqsTestingAdapter>
  );

  const queries = () =>
    onUrlUpdate.mock.calls.map(([event]) => event.queryString);

  return { onUrlUpdate, queries };
};

const searchBox = (
  <UrlSearch
    icon={null}
    label="Search products"
    param="q"
    placeholder="Name, SKU or scan a barcode"
    resets={["page"]}
  />
);

const statusTabs = (
  <UrlTabs
    filter={{ defaultValue: "all", param: "status" }}
    label="Stock status"
    options={STATUSES.map((status) => ({
      ...status,
      href: `/products?status=${status.value}`,
    }))}
    resets={["page"]}
  />
);

const categoryChip = (
  <UrlChip
    filter={{ defaultValue: "", param: "category" }}
    label="Category"
    options={[
      {
        label: "Grains",
        options: [
          { label: "Rice", value: "3" },
          { label: "Beans", value: "4" },
        ],
      },
    ]}
    resets={["page"]}
  />
);

const currentTab = (): string | null =>
  screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("aria-current") === "true")
    ?.textContent ?? null;

/** Long enough for any debounced write to have landed. */
const PAST_DEBOUNCE_MS = SEARCH_DEBOUNCE_MS * 2;

const pastDebounce = async (): Promise<void> => {
  await sleep(PAST_DEBOUNCE_MS);
};

describe("UrlSearch", () => {
  it("searches once typing pauses, not on every key, back on page one", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?page=3&status=low", searchBox);
    const box = screen.getByRole("searchbox", { name: "Search products" });

    await user.type(box, "rice");

    expect(valueOf(box)).toBe("rice");
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(onUrlUpdate).toHaveBeenCalledOnce();
      },
      {
        timeout: SEARCH_DEBOUNCE_MS * 3,
      }
    );
    expect(queries()).toEqual(["?status=low&q=rice"]);
    expect(onUrlUpdate.mock.calls[0]?.[0].options).toMatchObject({
      history: "replace",
      shallow: false,
    });
    expect(document.activeElement).toBe(box);
  });

  it("searches at once on Enter, back on page one, with no late write", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?page=2", searchBox);

    await user.type(
      screen.getByRole("searchbox", { name: "Search products" }),
      "GRN-0005{Enter}"
    );

    await waitFor(
      () => {
        expect(onUrlUpdate).toHaveBeenCalled();
      },
      {
        timeout: SEARCH_DEBOUNCE_MS / 2,
      }
    );
    await pastDebounce();

    // The typing's pending write was dropped, not sent after Enter's.
    expect(queries()).toEqual(["?q=GRN-0005"]);
  });

  it("treats a box of only spaces as empty", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?q=rice&page=2", searchBox);
    const box = screen.getByRole("searchbox", { name: "Search products" });

    await user.clear(box);
    await user.type(box, "   ");
    await pastDebounce();

    expect(onUrlUpdate).toHaveBeenCalled();
    expect(queries().every((query) => query === "")).toBe(true);
  });

  it("shows everything again as soon as the box is emptied", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?q=rice&page=2", searchBox);
    const box = screen.getByRole("searchbox", { name: "Search products" });

    expect(valueOf(box)).toBe("rice");

    await user.clear(box);

    await waitFor(
      () => {
        expect(onUrlUpdate).toHaveBeenCalled();
      },
      {
        timeout: SEARCH_DEBOUNCE_MS / 2,
      }
    );
    expect(queries().at(-1)).toBe("");
  });
});

describe("UrlTabs", () => {
  it("filters in place on a click and goes back to page one", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?q=rice&page=4", statusTabs);

    expect(currentTab()).toBe("All active");

    await user.click(screen.getByRole("link", { name: "Running low" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual(["?q=rice&status=low"]);
    expect(currentTab()).toBe("Running low");
  });

  it("drops the param when the default tab is chosen again", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?status=out", statusTabs);

    expect(currentTab()).toBe("Out of stock");

    await user.click(screen.getByRole("link", { name: "All active" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual([""]);
  });

  it("links each tab to its list, for a new tab or without JavaScript", () => {
    renderAt("", statusTabs);

    expect(
      screen.getByRole("link", { name: "Out of stock" }).getAttribute("href")
    ).toBe("/products?status=out");
  });

  it("marks the default for a value the list doesn't offer", () => {
    renderAt("?status=bogus", statusTabs);

    expect(currentTab()).toBe("All active");
  });
});

describe("UrlChip", () => {
  it("applies a choice at once and goes back to page one", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?q=rice&page=4", categoryChip);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Rice" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual(["?q=rice&category=3"]);
  });

  it("names the choice and clears it with its ×", async () => {
    const user = userEvent.setup();

    const { onUrlUpdate, queries } = renderAt(
      "?category=4&page=2",
      categoryChip
    );

    expect(
      screen.getByRole("combobox", { name: "Category" }).textContent
    ).toContain("Category:Beans");

    await user.click(screen.getByRole("button", { name: "Clear category" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual([""]);
    expect(screen.queryByRole("button", { name: "Clear category" })).toBeNull();
  });

  it("keeps its name, so a form without JavaScript still submits it", () => {
    renderAt("?category=3", <form aria-label="Filters">{categoryChip}</form>);

    const form = screen.getByRole("form", { name: "Filters" });

    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("Expected a form");
    }

    expect(new FormData(form).get("category")).toBe("3");
  });

  it("shows nothing chosen for a value the list doesn't offer", () => {
    renderAt("?category=99", categoryChip);

    expect(screen.queryByRole("button", { name: "Clear category" })).toBeNull();
  });
});

describe("FilterSummary", () => {
  it("clears every filter it's given at once, and only those", async () => {
    const user = userEvent.setup();

    const { onUrlUpdate, queries } = renderAt(
      "?q=rice&status=low&page=2&variant=x",
      <FilterSummary clear={["q", "status", "page"]}>3 products</FilterSummary>
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual(["?variant=x"]);
  });

  it("offers no clearing while nothing is filtered", () => {
    renderAt("", <FilterSummary>3 products</FilterSummary>);

    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });
});

describe("ListResults", () => {
  it("announces the results through a live region", () => {
    renderAt("", statusTabs);

    expect(screen.getByRole("status").textContent).toBe("3 products");
  });

  it("reads the count out again when a change lands on the same count", async () => {
    const user = userEvent.setup();
    renderAt("", statusTabs);

    await user.click(screen.getByRole("link", { name: "Running low" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("3 products ");
    });
  });
});
