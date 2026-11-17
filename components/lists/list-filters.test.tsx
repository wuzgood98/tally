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
  ListFilters,
  ListResults,
  SEARCH_DEBOUNCE_MS,
  UrlSearch,
  UrlSelect,
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

const statusSelect = (
  <UrlSelect
    filter={{ defaultValue: "all", param: "status" }}
    label="Stock status"
    options={STATUSES}
    resets={["page"]}
  />
);

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

describe("UrlSelect", () => {
  it("applies a choice at once and goes back to page one", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?q=rice&page=4", statusSelect);

    await user.click(screen.getByRole("combobox", { name: "Stock status" }));
    await user.click(screen.getByRole("option", { name: "Running low" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual(["?q=rice&status=low"]);
  });

  it("drops the param when the default is chosen again", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate, queries } = renderAt("?status=out", statusSelect);
    const trigger = screen.getByRole("combobox", { name: "Stock status" });

    expect(trigger.textContent).toContain("Out of stock");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "All active" }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledOnce();
    });
    expect(queries()).toEqual([""]);
  });

  it("keeps its name, so a form without JavaScript still submits it", () => {
    renderAt("?status=low", <form aria-label="Filters">{statusSelect}</form>);

    const form = screen.getByRole("form", { name: "Filters" });

    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("Expected a form");
    }

    expect(new FormData(form).get("status")).toBe("low");
  });

  it("shows the default for a value the list doesn't offer", () => {
    renderAt("?status=bogus", statusSelect);

    expect(
      screen.getByRole("combobox", { name: "Stock status" }).textContent
    ).toContain("All active");
  });
});

describe("ListResults", () => {
  it("announces the results through a live region", () => {
    renderAt("", statusSelect);

    expect(screen.getByRole("status").textContent).toBe("3 products");
  });

  it("reads the count out again when a change lands on the same count", async () => {
    const user = userEvent.setup();
    renderAt("", statusSelect);

    await user.click(screen.getByRole("combobox", { name: "Stock status" }));
    await user.click(screen.getByRole("option", { name: "Running low" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("3 products ");
    });
  });
});
