import { environmentManager, QueryClient } from "@tanstack/query-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTillCollections } from "@/lib/till/client/collections";
import { SAVED_AT_HEADER } from "@/lib/till/client/worker-contract";
import { MINUTE_MS } from "@/lib/time";

const PRODUCT = {
  barcode: null,
  id: 1,
  name: "Jasmine rice 10 kg",
  sellPrice: 30_500,
  sku: "RICE-10",
  unit: "each",
} as const;

const SAVED_AT = "2026-11-16T09:14:00.000Z";

type Reply =
  | { readonly products: readonly (typeof PRODUCT)[] }
  | { readonly levels: readonly never[] };

const reply = (body: Reply, saved: boolean): Response =>
  Response.json(body, {
    headers: saved ? { [SAVED_AT_HEADER]: SAVED_AT } : {},
  });

afterEach(() => {
  environmentManager.setIsServer(() => typeof window === "undefined");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the catalogue while it shows the saved copy", () => {
  it("asks Tally again every minute, so the status clears once Tally is back", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    // Query schedules no interval timers on a server; the till runs in a browser.
    environmentManager.setIsServer(() => false);
    let catalogueFromCopy = true;

    vi.stubGlobal("fetch", async (url: string) => {
      const isCatalogue = url === "/api/till/catalogue";

      const body: Reply = isCatalogue
        ? { products: [PRODUCT] }
        : { levels: [] };

      return await Promise.resolve(
        reply(body, isCatalogue && catalogueFromCopy)
      );
    });

    const queryClient = new QueryClient();

    const { products, savedCopies, stockLevels } =
      createTillCollections(queryClient);

    await Promise.all([products.preload(), stockLevels.preload()]);
    expect(savedCopies.isSaved("products")).toBe(true);
    expect(savedCopies.getSnapshot()?.savedAt.toISOString()).toBe(SAVED_AT);

    catalogueFromCopy = false;
    await vi.advanceTimersByTimeAsync(MINUTE_MS);

    expect(savedCopies.isSaved("products")).toBe(false);
    expect(savedCopies.getSnapshot()).toBeNull();

    queryClient.clear();
  });
});
