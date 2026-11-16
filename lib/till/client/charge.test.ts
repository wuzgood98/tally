import { QueryClient } from "@tanstack/query-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChargeAction } from "@/lib/till/client/charge";
import { createTillCollections } from "@/lib/till/client/collections";
import type { TillCollections } from "@/lib/till/client/collections";
import { TillHttpError } from "@/lib/till/client/http";
import type { ChargeInput } from "@/lib/till/draft";
import type { TillSaleReply } from "@/lib/till/schema";

interface Failure {
  readonly error: { readonly code: string; readonly message: string };
}

const CATALOGUE = {
  products: [
    {
      barcode: null,
      id: 1,
      name: "Jasmine rice 5 kg",
      sellPrice: 15_000,
      sku: "GR-0001",
      unit: "each",
    },
  ],
};

const LEVELS = {
  levels: [{ branchId: "SPX", key: "SPX:1", onHand: 10, productId: 1 }],
};

const json = (
  body:
    | TillSaleReply
    | Failure
    | typeof CATALOGUE
    | typeof LEVELS
    | { readonly sales: readonly [] },
  status = 200
): Response => Response.json(body, { status });

/** What the till's GET endpoints answer. */
const serverAnswer = (url: string): Response => {
  switch (url) {
    case "/api/till/catalogue": {
      return json(CATALOGUE);
    }

    case "/api/till/stock-levels": {
      return json(LEVELS);
    }

    case "/api/till/sales": {
      return json({ sales: [] });
    }

    default: {
      throw new Error(`No fake answer for ${url}.`);
    }
  }
};

const INPUT: ChargeInput = {
  branchId: "SPX",
  cashierId: "u-till",
  clientRef: "till-ref-0001",
  expectedTotal: 30_000,
  lines: [{ productId: 1, quantity: 2 }],
  paymentMethod: "cash",
};

const REPLY: TillSaleReply = {
  duplicate: false,
  levels: [{ branchId: "SPX", key: "SPX:1", onHand: 7, productId: 1 }],
  sale: {
    branchId: "SPX",
    clientRef: "till-ref-0001",
    createdAt: "2026-11-16T10:00:00.000Z",
    expectedTotal: 30_000,
    id: 42,
    number: "SAL-SPX-000042",
    paymentMethod: "cash",
    total: 30_000,
    units: 2,
  },
};

/** The POST's answer, held back until the test lets it go. */
let post = Promise.withResolvers<Response>();

const answerPost = (answer: Response | Error): void => {
  if (answer instanceof Error) {
    post.reject(answer);
  } else {
    post.resolve(answer);
  }
};

let collections: TillCollections;
let queryClient: QueryClient;

beforeEach(async () => {
  post = Promise.withResolvers<Response>();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return await post.promise;
      }

      await Promise.resolve();

      return serverAnswer(url);
    })
  );

  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  collections = createTillCollections(queryClient);
  await Promise.all([
    collections.products.preload(),
    collections.stockLevels.preload(),
    collections.sales.preload(),
  ]);
});

afterEach(async () => {
  queryClient.clear();
  await Promise.all([
    collections.products.cleanup(),
    collections.stockLevels.cleanup(),
    collections.sales.cleanup(),
  ]);
  vi.unstubAllGlobals();
});

const pendingSale = () => collections.sales.get(INPUT.clientRef);
const spintexRice = () => collections.stockLevels.get("SPX:1")?.onHand;

describe("charging a sale", () => {
  it("shows the sale and the lower count at once, then what the server recorded", async () => {
    const charge = createChargeAction(collections);
    const settled = charge(INPUT);

    expect(pendingSale()).toMatchObject({ id: null, number: null });
    expect(spintexRice()).toBe(8);

    answerPost(json(REPLY, 201));

    await expect(settled).resolves.toEqual(REPLY);
    expect(pendingSale()).toMatchObject({ id: 42, number: "SAL-SPX-000042" });
    // The server's count, which saw another till's sale too.
    expect(spintexRice()).toBe(7);
  });

  it("rolls both back when the server refuses the sale", async () => {
    const charge = createChargeAction(collections);
    const settled = charge(INPUT);
    expect(spintexRice()).toBe(8);

    answerPost(
      json(
        { error: { code: "forbidden", message: "You can't sell here." } },
        403
      )
    );

    await expect(settled).rejects.toBeInstanceOf(TillHttpError);
    await expect(settled).rejects.toMatchObject({
      message: "You can't sell here.",
      status: 403,
    });
    expect(pendingSale()).toBeUndefined();
    expect(spintexRice()).toBe(10);
  });

  it("rolls back and says so when Tally can't be reached", async () => {
    const charge = createChargeAction(collections);
    const settled = charge(INPUT);

    answerPost(new TypeError("Failed to fetch"));

    await expect(settled).rejects.toMatchObject({ status: 0 });
    expect(pendingSale()).toBeUndefined();
    expect(spintexRice()).toBe(10);
  });
});
