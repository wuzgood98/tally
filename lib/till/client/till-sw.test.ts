import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { warmUrls } from "@/lib/till/client/offline-start";

/**
 * Runs `public/till-sw.js` as it is, against an in-memory Cache Storage, a
 * stubbed `fetch` and fake events.
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

interface FetchEvent {
  readonly request: Request;
  respondWith: (answer: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}

interface MessageEvent {
  readonly data: { readonly type: string; readonly urls: readonly string[] };
  waitUntil: (work: Promise<unknown>) => void;
}

interface Listeners {
  install?: () => void;
  activate?: (event: Pick<FetchEvent, "waitUntil">) => void;
  fetch?: (event: FetchEvent) => void;
  message?: (event: MessageEvent) => void;
}

type FetchStub = ReturnType<
  typeof vi.fn<(input: RequestInfo) => Promise<Response>>
>;

/** Where the fake fetch event puts what the worker answered. */
interface Answered {
  response: Promise<Response> | null;
}

interface Worker {
  readonly caches: FakeCacheStorage;
  readonly fetch: FetchStub;
  /** What the worker answered, or null when it left the request alone. */
  request: (url: string, init?: RequestInit) => Promise<Response | null>;
  /** Everything the worker started in the background, settled. */
  settle: () => Promise<void>;
  warm: (urls: readonly string[]) => Promise<void>;
  activate: () => Promise<void>;
}

const startWorker = (): Worker => {
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
        data: { type: "tally-till-warm", urls },
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

describe("the till's service worker", () => {
  let worker: Worker;

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
    expect(catalogue?.headers.get("X-Tally-Saved-At")).not.toBeNull();
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
    expect(nextDay?.headers.get("X-Tally-Saved-At")).toBe(
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

    const statics = worker.caches.stores.get("tally-till-static-v1");
    expect([...(statics?.entries.keys() ?? [])].toSorted()).toEqual([
      `${ORIGIN}/_next/static/chunks/kept.js`,
      `${ORIGIN}/_next/static/chunks/recent.js`,
    ]);
  });

  it("clears out caches from older versions when it takes over", async () => {
    await worker.caches.open("tally-till-pages-v0");
    await worker.caches.open("tally-till-data-v1");
    await worker.caches.open("something-else");

    await worker.activate();

    expect([...worker.caches.stores.keys()].toSorted()).toEqual([
      "something-else",
      "tally-till-data-v1",
    ]);
  });
});

describe("warmUrls", () => {
  it("lists the page, the till's data and this site's static files, once each", () => {
    expect(
      warmUrls("/till", ORIGIN, [
        `${ORIGIN}/_next/static/chunks/a.js`,
        `${ORIGIN}/_next/static/chunks/a.js`,
        `${ORIGIN}/api/till/catalogue`,
        "https://elsewhere.test/_next/static/b.js",
        "not a url",
      ])
    ).toEqual([
      "/till",
      "/api/till/catalogue",
      "/api/till/stock-levels",
      "/api/till/sales",
      `${ORIGIN}/_next/static/chunks/a.js`,
    ]);
  });
});
