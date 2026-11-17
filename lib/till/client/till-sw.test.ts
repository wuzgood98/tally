import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FORGET_MESSAGE,
  SAVED_AT_HEADER,
  TILL_CACHE_PREFIX,
  TILL_DATA_URLS,
  WARM_MESSAGE,
} from "@/lib/till/client/worker-contract";

/**
 * Runs `public/till-sw.js` as it is, against an in-memory Cache Storage, a
 * stubbed `fetch` and fake events. The worker can't import
 * `worker-contract.ts`, so the test drives it with those values: a copy in
 * the worker that drifts from them fails here.
 */

const ORIGIN = "https://tally.test";

const SOURCE = readFileSync(
  path.join(import.meta.dirname, "../../../public/till-sw.js"),
  "utf-8"
);

type Catalogue = Record<string, readonly { readonly id: number }[]>;

type Sales = Record<"sales", readonly { readonly clientRef: string }[]>;

const json = (body: Catalogue | Sales, status = 200): Response =>
  Response.json(body, { status });

const html = (body: string): Response =>
  new Response(body, { headers: { "content-type": "text/html" } });

/** An answer that arrived after a redirect (to sign-in), as browsers report it. */
const redirected = (body: string): Response => {
  const response = html(body);
  Object.defineProperty(response, "redirected", { value: true });

  return response;
};

const urlOf = (input: RequestInfo): string => new Request(input).url;

interface FakeCache {
  readonly entries: Map<string, Response>;
  match: (key: RequestInfo) => Promise<Response | undefined>;
  put: (key: string, response: Response) => Promise<void>;
  keys: () => Promise<Request[]>;
  delete: (key: Request) => Promise<boolean>;
}

const fakeCache = (): FakeCache => {
  const entries = new Map<string, Response>();

  return {
    delete: async (key) => await Promise.resolve(entries.delete(key.url)),
    entries,
    keys: async () =>
      await Promise.resolve([...entries.keys()].map((url) => new Request(url))),
    match: async (key) =>
      await Promise.resolve(entries.get(urlOf(key))?.clone()),
    put: async (key, response) => {
      entries.set(key, response);
      await Promise.resolve();
    },
  };
};

interface FakeCacheStorage {
  readonly stores: Map<string, FakeCache>;
  open: (name: string) => Promise<FakeCache>;
  keys: () => Promise<string[]>;
  delete: (name: string) => Promise<boolean>;
}

const fakeCacheStorage = (): FakeCacheStorage => {
  const stores = new Map<string, FakeCache>();

  return {
    delete: async (name) => await Promise.resolve(stores.delete(name)),
    keys: async () => await Promise.resolve([...stores.keys()]),
    open: async (name) => {
      const cache = stores.get(name) ?? fakeCache();
      stores.set(name, cache);

      return await Promise.resolve(cache);
    },
    stores,
  };
};

interface FakeFetchEvent {
  readonly request: Request;
  respondWith: (answer: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}

interface FakeMessageEvent {
  readonly data: { readonly type: string; readonly urls?: readonly string[] };
  readonly ports: readonly Pick<MessagePort, "postMessage">[];
  waitUntil: (work: Promise<unknown>) => void;
}

interface Listeners {
  install?: () => void;
  activate?: (event: Pick<FakeFetchEvent, "waitUntil">) => void;
  fetch?: (event: FakeFetchEvent) => void;
  message?: (event: FakeMessageEvent) => void;
}

type FetchStub = ReturnType<
  typeof vi.fn<(input: RequestInfo) => Promise<Response>>
>;

/** Where the fake fetch event puts what the worker answered. */
interface Answered {
  response: Promise<Response> | null;
}

interface FakeWorker {
  readonly caches: FakeCacheStorage;
  readonly fetch: FetchStub;
  /** What the worker answered, or null when it left the request alone. */
  request: (url: string, init?: RequestInit) => Promise<Response | null>;
  /** Everything the worker started in the background, settled. */
  settle: () => Promise<void>;
  warm: (urls: readonly string[]) => Promise<void>;
  /** Sends the sign-out message; resolves with what the worker replied. */
  forget: () => Promise<string>;
  activate: () => Promise<void>;
}

const startWorker = (): FakeWorker => {
  const listeners: Listeners = {};
  const background: Promise<unknown>[] = [];
  const caches = fakeCacheStorage();
  const fetchStub: FetchStub = vi.fn();

  const waitUntil = (work: Promise<unknown>) => {
    background.push(work);
  };

  const self = {
    addEventListener: <K extends keyof Listeners>(
      type: K,
      listener: Listeners[K]
    ) => {
      listeners[type] = listener;
    },
    clients: {
      claim: async () => {
        await Promise.resolve();
      },
    },
    location: { origin: ORIGIN },
    skipWaiting: async () => {
      await Promise.resolve();
    },
  };

  // The worker sees the test's timers and clock, so fake timers reach it.
  const scope = {
    Headers,
    Promise,
    Request,
    Response,
    URL,
    caches,
    fetch: fetchStub,
    self,
    setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
  };

  Object.defineProperty(scope, "Date", { get: () => Date });
  runInNewContext(SOURCE, scope);

  const settle = async () => {
    await Promise.allSettled(background);
  };

  return {
    activate: async () => {
      listeners.activate?.({ waitUntil });
      await settle();
    },
    caches,
    fetch: fetchStub,
    forget: async () => {
      const reply = Promise.withResolvers<string>();

      listeners.message?.({
        data: { type: FORGET_MESSAGE },
        ports: [
          {
            postMessage: (message: string) => {
              reply.resolve(message);
            },
          },
        ],
        waitUntil,
      });

      return await reply.promise;
    },
    request: async (url, init) => {
      const answered: Answered = { response: null };

      listeners.fetch?.({
        request: new Request(`${ORIGIN}${url}`, init),
        respondWith: (response) => {
          answered.response = response;
        },
        waitUntil,
      });

      return await answered.response;
    },
    settle,
    warm: async (urls) => {
      listeners.message?.({
        data: { type: WARM_MESSAGE, urls },
        ports: [],
        waitUntil,
      });
      await settle();
    },
  };
};

const offline = async (): Promise<Response> =>
  await Promise.reject(new TypeError("Failed to fetch"));

const bodyOf = async (response: Response | null): Promise<string> =>
  (await response?.text()) ?? "no answer";

/** The static files the worker holds, sorted. */
const staticKeys = (worker: FakeWorker): string[] =>
  [
    ...(worker.caches.stores
      .get(`${TILL_CACHE_PREFIX}static-v1`)
      ?.entries.keys() ?? []),
  ].toSorted();

describe("the till's service worker", () => {
  let worker: FakeWorker;

  beforeEach(() => {
    worker = startWorker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the till from its saved page and data when there's no connection", async () => {
    worker.fetch
      .mockResolvedValueOnce(html("<p>Till</p>"))
      .mockResolvedValueOnce(json({ products: [{ id: 1 }] }));
    await worker.request("/till");
    await worker.request("/api/till/catalogue");
    await worker.settle();

    worker.fetch.mockImplementation(offline);
    const page = await worker.request("/till");
    const catalogue = await worker.request("/api/till/catalogue");

    expect(await bodyOf(page)).toBe("<p>Till</p>");
    expect(await bodyOf(catalogue)).toBe('{"products":[{"id":1}]}');
    expect(catalogue?.headers.get(SAVED_AT_HEADER)).not.toBeNull();
  });

  it("fails as the browser would when nothing was saved", async () => {
    worker.fetch.mockImplementation(offline);

    await expect(worker.request("/api/till/catalogue")).rejects.toThrow(
      "Failed to fetch"
    );
  });

  it("passes a 401 or a redirect on, and never saves it over a good copy", async () => {
    worker.fetch.mockResolvedValueOnce(json({ levels: [] }));
    await worker.request("/api/till/stock-levels");
    await worker.settle();

    worker.fetch.mockResolvedValueOnce(
      Response.json({ error: { code: "signed_out" } }, { status: 401 })
    );
    const refused = await worker.request("/api/till/stock-levels");
    await worker.settle();
    expect(refused?.status).toBe(401);

    worker.fetch.mockResolvedValueOnce(redirected("<p>Sign in</p>"));
    await worker.request("/till");
    await worker.settle();

    worker.fetch.mockImplementation(offline);
    const levels = await worker.request("/api/till/stock-levels");
    expect(await bodyOf(levels)).toBe('{"levels":[]}');
    await expect(worker.request("/till")).rejects.toThrow();
  });

  it("answers an empty list for today's sales saved on an earlier day", async () => {
    vi.useFakeTimers({
      now: new Date("2026-11-15T20:00:00Z"),
      toFake: ["Date"],
    });
    worker.fetch.mockResolvedValueOnce(json({ sales: [{ clientRef: "a" }] }));
    await worker.request("/api/till/sales");
    await worker.settle();

    worker.fetch.mockImplementation(offline);
    const sameDay = await worker.request("/api/till/sales");
    expect(await bodyOf(sameDay)).toBe('{"sales":[{"clientRef":"a"}]}');

    vi.setSystemTime(new Date("2026-11-16T08:00:00Z"));
    const nextDay = await worker.request("/api/till/sales");
    expect(await bodyOf(nextDay)).toBe('{"sales":[]}');
    expect(nextDay?.headers.get(SAVED_AT_HEADER)).toBe(
      "2026-11-15T20:00:00.000Z"
    );
  });

  it("answers from the saved copy when the network hangs, and refreshes it when it lands", async () => {
    worker.fetch.mockResolvedValueOnce(json({ products: [{ id: 1 }] }));
    await worker.request("/api/till/catalogue");
    await worker.settle();

    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const hanging = Promise.withResolvers<Response>();
    worker.fetch.mockReturnValueOnce(hanging.promise);

    const pending = worker.request("/api/till/catalogue");
    await vi.advanceTimersByTimeAsync(4000);
    const saved = await pending;
    expect(await bodyOf(saved)).toBe('{"products":[{"id":1}]}');

    hanging.resolve(json({ products: [{ id: 2 }] }));
    await worker.settle();
    worker.fetch.mockImplementation(offline);
    const fresh = await worker.request("/api/till/catalogue");
    expect(await bodyOf(fresh)).toBe('{"products":[{"id":2}]}');
  });

  it("serves scripts from the cache once it has them", async () => {
    worker.fetch.mockResolvedValueOnce(new Response("code"));
    await worker.request("/_next/static/chunks/till-abc.js");
    const again = await worker.request("/_next/static/chunks/till-abc.js");

    expect(await bodyOf(again)).toBe("code");
    expect(worker.fetch).toHaveBeenCalledTimes(1);
  });

  it("leaves everything else alone: other pages, RSC payloads, writes, history queries", async () => {
    const untouched = await Promise.all([
      worker.request("/tills"),
      worker.request("/products"),
      worker.request("/till", { headers: { RSC: "1" } }),
      worker.request("/till/history?_rsc=x1"),
      worker.request("/api/till/sales", { body: "{}", method: "POST" }),
      worker.request("/api/till/sales/history?limit=20"),
      worker.request("/api/till/catalogue?fresh=1"),
    ]);

    expect(untouched).toEqual(Array.from({ length: 7 }, () => null));
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("saves what the page loaded before it was in charge, skipping what it has", async () => {
    worker.fetch.mockImplementation(
      async (input) =>
        await Promise.resolve(
          urlOf(input).includes("/api/") ? json({ products: [] }) : html("x")
        )
    );
    await worker.request("/_next/static/chunks/already.js");
    worker.fetch.mockClear();

    await worker.warm([
      "/till",
      "/api/till/catalogue",
      `${ORIGIN}/_next/static/chunks/already.js`,
      `${ORIGIN}/_next/static/chunks/new.js`,
      "https://elsewhere.test/_next/static/x.js",
      "/products",
    ]);

    expect(worker.fetch.mock.calls.map(([input]) => urlOf(input))).toEqual([
      `${ORIGIN}/till`,
      `${ORIGIN}/api/till/catalogue`,
      `${ORIGIN}/_next/static/chunks/new.js`,
    ]);
  });

  it("drops scripts the till stopped using once they're a month old", async () => {
    vi.useFakeTimers({
      now: new Date("2026-10-01T00:00:00Z"),
      toFake: ["Date"],
    });
    worker.fetch.mockImplementation(
      async () => await Promise.resolve(html("x"))
    );
    await worker.request("/_next/static/chunks/old.js");
    await worker.request("/_next/static/chunks/kept.js");

    vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
    await worker.request("/_next/static/chunks/recent.js");
    await worker.warm([`${ORIGIN}/_next/static/chunks/kept.js`]);

    expect(staticKeys(worker)).toEqual([
      `${ORIGIN}/_next/static/chunks/kept.js`,
      `${ORIGIN}/_next/static/chunks/recent.js`,
    ]);
  });

  it("keeps a script /till still uses when /till/history warms with its own list", async () => {
    vi.useFakeTimers({
      now: new Date("2026-10-01T00:00:00Z"),
      toFake: ["Date"],
    });
    worker.fetch.mockImplementation(
      async () => await Promise.resolve(html("x"))
    );
    await worker.request("/_next/static/chunks/till.js");

    // /till loads it from the copy a few days before the history page warms.
    vi.setSystemTime(new Date("2026-11-10T00:00:00Z"));
    await worker.request("/_next/static/chunks/till.js");
    await worker.settle();

    vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
    await worker.warm([`${ORIGIN}/_next/static/chunks/history.js`]);

    expect(staticKeys(worker)).toEqual([
      `${ORIGIN}/_next/static/chunks/history.js`,
      `${ORIGIN}/_next/static/chunks/till.js`,
    ]);
    expect(worker.fetch).toHaveBeenCalledTimes(2);
  });

  it("saves the copy of every data endpoint the page names", async () => {
    worker.fetch.mockImplementation(
      async () => await Promise.resolve(json({ products: [] }))
    );

    await Promise.all(
      TILL_DATA_URLS.map(async (url) => await worker.request(url))
    );

    await worker.settle();

    const data = worker.caches.stores.get(`${TILL_CACHE_PREFIX}data-v1`);
    expect([...(data?.entries.keys() ?? [])].toSorted()).toEqual(
      TILL_DATA_URLS.map((url) => `${ORIGIN}${url}`).toSorted()
    );
  });

  it("forgets at sign-out: deletes every copy and answers when it's done", async () => {
    worker.fetch.mockResolvedValueOnce(json({ products: [{ id: 1 }] }));
    await worker.request("/api/till/catalogue");
    await worker.settle();
    await worker.caches.open("something-else");

    expect(await worker.forget()).toBe("forgotten");
    expect([...worker.caches.stores.keys()]).toEqual(["something-else"]);
  });

  it("doesn't save the last person's answer when it lands after sign-out", async () => {
    const late = Promise.withResolvers<Response>();
    worker.fetch.mockReturnValueOnce(late.promise);
    const pending = worker.request("/api/till/catalogue");

    await worker.forget();
    late.resolve(json({ products: [{ id: 1 }] }));
    await pending;
    await worker.settle();

    expect([...worker.caches.stores.keys()]).toEqual([]);

    // What the next person's till asks for is saved as usual.
    worker.fetch.mockResolvedValueOnce(json({ products: [{ id: 2 }] }));
    await worker.request("/api/till/catalogue");
    await worker.settle();
    expect([...worker.caches.stores.keys()]).toEqual([
      `${TILL_CACHE_PREFIX}data-v1`,
    ]);
  });

  it("clears out caches from older versions when it takes over", async () => {
    await worker.caches.open(`${TILL_CACHE_PREFIX}pages-v0`);
    await worker.caches.open(`${TILL_CACHE_PREFIX}data-v1`);
    await worker.caches.open("something-else");

    await worker.activate();

    expect([...worker.caches.stores.keys()].toSorted()).toEqual([
      "something-else",
      `${TILL_CACHE_PREFIX}data-v1`,
    ]);
  });
});
