import type {
  LeaderElection,
  OnlineDetector,
  StorageAdapter,
} from "@tanstack/offline-transactions";
import { QueryClient } from "@tanstack/query-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAttentionCollection } from "@/lib/till/client/attention";
import type { AttentionCollection } from "@/lib/till/client/attention";
import { createTillCollections } from "@/lib/till/client/collections";
import type { TillCollections } from "@/lib/till/client/collections";
import { createTillSync, RefusedSaleError } from "@/lib/till/client/sync";
import type { TillSync } from "@/lib/till/client/sync";
import type { TillCharge, TillSaleReply } from "@/lib/till/schema";

/** The outbox, in memory: kept across a "reload" by building a new till on the same one. */
const memoryStorage = (): StorageAdapter => {
  const items = new Map<string, string>();

  return {
    clear: async () => {
      items.clear();
      await Promise.resolve();
    },
    delete: async (key) => {
      items.delete(key);
      await Promise.resolve();
    },
    get: async (key) => await Promise.resolve(items.get(key) ?? null),
    keys: async () => await Promise.resolve([...items.keys()]),
    set: async (key, value) => {
      items.set(key, value);
      await Promise.resolve();
    },
  };
};

/** This tab always holds the outbox's lock. */
const onlyTab = (): LeaderElection => ({
  isLeader: () => true,
  onLeadershipChange: () => () => {
    // Leadership never changes here.
  },
  releaseLeadership: () => {
    // Nothing to release.
  },
  requestLeadership: async () => await Promise.resolve(true),
});

/** A connection the test switches on and off. */
const connection = () => {
  const listeners = new Set<() => void>();
  let online = true;

  const detector: OnlineDetector = {
    dispose: () => {
      listeners.clear();
    },
    isOnline: () => online,
    notifyOnline: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  const set = (next: boolean): void => {
    online = next;

    if (next) {
      detector.notifyOnline();
    }
  };

  return { detector, set };
};

/** localStorage, in memory, for the needs-attention list. */
const memoryLocalStorage = () => {
  const items = new Map<string, string>();

  return {
    storage: {
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => {
        items.delete(key);
      },
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    },
    storageEventApi: {
      addEventListener: () => null,
      removeEventListener: () => null,
    },
  };
};

const LEVEL = { branchId: "SPX", key: "SPX:1", onHand: 10, productId: 1 };

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

/** What the till's GET endpoints answer. */
const serverAnswer = (url: string): Response => {
  switch (url) {
    case "/api/till/catalogue": {
      return Response.json(CATALOGUE);
    }

    case "/api/till/stock-levels": {
      return Response.json({ levels: [LEVEL] });
    }

    case "/api/till/sales": {
      return Response.json({ sales: [] });
    }

    default: {
      throw new Error(`No fake answer for ${url}.`);
    }
  }
};

const CHARGE: TillCharge = {
  branchId: "SPX",
  cashierId: "u-till",
  clientRef: "till-ref-0001",
  expectedTotal: 30_000,
  lines: [{ productId: 1, quantity: 2 }],
  paymentMethod: "cash",
};

const REPLY: TillSaleReply = {
  duplicate: false,
  levels: [{ ...LEVEL, onHand: 8 }],
  sale: {
    branchId: "SPX",
    clientRef: CHARGE.clientRef,
    createdAt: "2026-11-16T10:00:00.000Z",
    expectedTotal: 30_000,
    id: 42,
    number: "SAL-SPX-000042",
    paymentMethod: "cash",
    total: 30_000,
    units: 2,
  },
};

const failure = (status: number, message: string): Response =>
  Response.json({ error: { code: "x", message } }, { status });

/** How the server answers the next POST; tests change it. */
let answer: () => Response = () => Response.json(REPLY, { status: 201 });
let posts: string[] = [];

interface Till {
  readonly collections: TillCollections;
  readonly attention: AttentionCollection;
  readonly sync: TillSync;
  readonly queryClient: QueryClient;
  readonly unsubscribe: () => void;
}

let storage: StorageAdapter;
let local: ReturnType<typeof memoryLocalStorage>;
let link: ReturnType<typeof connection>;
const tills: Till[] = [];

const openTill = async (): Promise<Till> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const collections = createTillCollections(queryClient);
  const attention = createAttentionCollection("u-till", local);

  const sync = createTillSync({
    attention,
    collections,
    graceMs: 50,
    plumbing: async () =>
      await Promise.resolve({
        leaderElection: onlyTab(),
        onlineDetector: link.detector,
        storage,
      }),
  });

  await sync.start();

  // As the till's status line does: subscribing keeps the status polled.
  const unsubscribe = sync.subscribe(() => {
    // Nothing to redraw in a test.
  });

  const till = { attention, collections, queryClient, sync, unsubscribe };
  tills.push(till);

  return till;
};

const closeTill = async (till: Till): Promise<void> => {
  till.unsubscribe();
  till.sync.dispose();
  till.queryClient.clear();
  await Promise.all([
    till.collections.products.cleanup(),
    till.collections.stockLevels.cleanup(),
    till.collections.sales.cleanup(),
    till.attention.cleanup(),
  ]);
};

beforeEach(() => {
  storage = memoryStorage();
  local = memoryLocalStorage();
  link = connection();
  posts = [];
  answer = () => Response.json(REPLY, { status: 201 });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      await Promise.resolve();

      if (init?.method === "POST") {
        if (!link.detector.isOnline()) {
          throw new TypeError("Failed to fetch");
        }

        posts.push(await new Request(`http://till.test${url}`, init).text());

        return answer();
      }

      return serverAnswer(url);
    })
  );
});

afterEach(async () => {
  await Promise.all(tills.splice(0).map(closeTill));
  vi.unstubAllGlobals();
});

const shelf = (till: Till) => till.collections.stockLevels.get("SPX:1")?.onHand;

const sale = (till: Till) => till.collections.sales.get(CHARGE.clientRef);

describe("charging through the offline queue", () => {
  it("records the sale when Tally answers in time", async () => {
    const till = await openTill();

    const outcome = await till.sync.charge(CHARGE);

    expect(outcome).toEqual({ kind: "recorded", reply: REPLY });
    expect(sale(till)?.number).toBe("SAL-SPX-000042");
    expect(shelf(till)).toBe(8);
    await vi.waitFor(() => {
      expect(till.sync.getStatus().queued).toBe(0);
    });
  });

  it("saves the sale on the till without a connection, and sends it when it's back", async () => {
    const till = await openTill();
    link.set(false);

    const outcome = await till.sync.charge(CHARGE);

    expect(outcome).toEqual({ kind: "queued" });
    expect(sale(till)).toMatchObject({ id: null, number: null });
    expect(shelf(till)).toBe(8);
    expect(posts).toEqual([]);
    await vi.waitFor(() => {
      expect(till.sync.getStatus()).toMatchObject({ online: false, queued: 1 });
    });

    link.set(true);

    await vi.waitFor(() => {
      expect(sale(till)?.number).toBe("SAL-SPX-000042");
    });
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0] ?? "{}")).toMatchObject({
      cashierId: "u-till",
      clientRef: CHARGE.clientRef,
      expectedTotal: 30_000,
    });
    await vi.waitFor(() => {
      expect(till.sync.getStatus().queued).toBe(0);
    });
  });

  it("puts a queued sale back on screen after a reload, then sends it once", async () => {
    link.set(false);
    const before = await openTill();
    await before.sync.charge(CHARGE);
    await closeTill(before);
    tills.splice(tills.indexOf(before), 1);

    const after = await openTill();

    // Restored from the outbox before anything was sent.
    expect(sale(after)).toMatchObject({ number: null });
    expect(shelf(after)).toBe(8);

    link.set(true);

    await vi.waitFor(() => {
      expect(sale(after)?.number).toBe("SAL-SPX-000042");
    });
    expect(posts).toHaveLength(1);
  });

  it("keeps the sale while the session has ended, and says why", async () => {
    const till = await openTill();
    answer = () => failure(401, "Sign in again.");

    expect(await till.sync.charge(CHARGE)).toEqual({ kind: "queued" });
    await vi.waitFor(() => {
      expect(till.sync.getStatus()).toMatchObject({
        lastError: "Sign in again.",
        queued: 1,
      });
    });
    expect(sale(till)).toMatchObject({ number: null });

    answer = () => Response.json(REPLY, { status: 201 });
    link.set(true);

    await vi.waitFor(() => {
      expect(sale(till)?.number).toBe("SAL-SPX-000042");
    });
  });

  it("refuses on screen while the customer waits, and keeps nothing", async () => {
    const till = await openTill();
    answer = () => failure(403, "You can't sell at this branch.");

    await expect(till.sync.charge(CHARGE)).rejects.toBeInstanceOf(
      RefusedSaleError
    );
    expect(sale(till)).toBeUndefined();
    expect(shelf(till)).toBe(10);
    expect(till.attention.size).toBe(0);
  });

  it("keeps a sale refused after the customer left, for a manager", async () => {
    const till = await openTill();
    link.set(false);
    await till.sync.charge(CHARGE);
    answer = () => failure(403, "You can't sell at this branch.");

    link.set(true);

    await vi.waitFor(() => {
      expect(till.attention.get(CHARGE.clientRef)).toMatchObject({
        expectedTotal: 30_000,
        lines: [{ name: "Jasmine rice 5 kg", productId: 1, quantity: 2 }],
        reason: "You can't sell at this branch.",
      });
    });
    // The queue let it go: rolled back on screen, nothing left to send.
    await vi.waitFor(() => {
      expect(sale(till)).toBeUndefined();
    });
    expect(shelf(till)).toBe(10);
    await vi.waitFor(() => {
      expect(till.sync.getStatus().queued).toBe(0);
    });
  });
});
