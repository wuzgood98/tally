/**
 * Tally's till service worker: lets `/till` open with no connection.
 *
 * Registered from the till with scope `/till`, so it only ever controls the
 * till's pages (and passes everything else through untouched, `/tills`
 * included). For those pages it keeps:
 *
 * - the till's HTML (`/till`, `/till/history`): network first, the last good
 *   copy when the network fails or hangs;
 * - the till's data (catalogue, stock levels, today's sales): the same, each
 *   copy stamped with when it was saved (`X-Tally-Saved-At`) so the till can
 *   say how old it is. A copy of "today's sales" from another day answers an
 *   empty list rather than yesterday's sales;
 * - the scripts, styles and fonts under `/_next/static/`: cache first, since
 *   their names change whenever their contents do. Each carries when a till
 *   page last used it (`X-Tally-Used-At`), and goes after a month unused.
 *
 * Only good answers are kept: a redirect (to sign-in) or an error never
 * replaces a saved copy, and is passed on as it came. Sign-out and the
 * sign-in page tell the worker to forget (`lib/till/client/offline-start.ts`):
 * nothing a request already under way brings back is saved after that, and
 * every cache named `tally-till-…` goes.
 *
 * Plain JavaScript with no build step, typed with JSDoc;
 * `lib/till/client/till-sw.test.ts` runs it against fakes. The names and
 * paths it shares with the page are repeated from
 * `lib/till/client/worker-contract.ts`, and the test drives it with those.
 */

/**
 * The parts of a service worker's events this file uses.
 * @typedef {{ waitUntil: (work: Promise<unknown>) => void }} WorkerEvent
 * @typedef {WorkerEvent & { request: Request, respondWith: (answer: Promise<Response>) => void }} WorkerFetchEvent
 * @typedef {{ type?: string, urls?: string[] } | null} WorkerMessage
 * @typedef {WorkerEvent & { data: WorkerMessage, ports: readonly MessagePort[] }} WorkerMessageEvent
 * @typedef {{
 *   location: { origin: string },
 *   clients: { claim: () => Promise<void> },
 *   skipWaiting: () => Promise<void>,
 *   addEventListener: {
 *     (type: "install", listener: () => void): void,
 *     (type: "activate", listener: (event: WorkerEvent) => void): void,
 *     (type: "fetch", listener: (event: WorkerFetchEvent) => void): void,
 *     (type: "message", listener: (event: WorkerMessageEvent) => void): void,
 *   },
 * }} WorkerScope
 * @typedef {"page" | "data" | "static"} Kind
 */

/**
 * This file only ever runs as a service worker, where `self` is the worker.
 * @type {WorkerScope}
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unsafe-assignment -- `self` can't be narrowed at runtime
const worker = self;

// Shared with the page (lib/till/client/worker-contract.ts).
const PREFIX = "tally-till-";
const SAVED_AT = "X-Tally-Saved-At";
const WARM_MESSAGE = "tally-till-warm";
const FORGET_MESSAGE = "tally-till-forget";

const TILL_DATA = new Set([
  "/api/till/catalogue",
  "/api/till/stock-levels",
  "/api/till/sales",
]);

const PAGES = `${PREFIX}pages-v1`;
const DATA = `${PREFIX}data-v1`;
const STATIC = `${PREFIX}static-v1`;
const CURRENT = new Set([PAGES, DATA, STATIC]);

/** On static files only: when a till page last used the file. */
const USED_AT = "X-Tally-Used-At";

const TILL_PAGES = new Set(["/till", "/till/history"]);
const TODAYS_SALES = "/api/till/sales";
const STATIC_PREFIX = "/_next/static/";

/** How long a page or data request may hang before a saved copy answers. */
const NETWORK_WAIT_MS = 4000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Static files no till page has used in this long are dropped. */
const STATIC_KEEP_MS = 30 * DAY_MS;

/** A static file's use is written down at most this often. */
const USE_NOTE_MS = DAY_MS;

/**
 * Goes up each time the page asks the worker to forget. A request remembers
 * the generation it started in and saves nothing once it has moved on, so an
 * answer that lands after sign-out can't put the last person's till back.
 */
let generation = 0;

/**
 * What kind of request this is.
 * @param {URL} url what is asked for
 * @param {Request | undefined} request the request, or undefined for a URL the page asked to warm
 * @returns {Kind | null} null for anything this worker leaves alone
 */
const kindOf = (url, request) => {
  if (url.origin !== worker.location.origin) {
    return null;
  }

  if (request !== undefined && request.method !== "GET") {
    return null;
  }

  if (TILL_PAGES.has(url.pathname)) {
    // Next's in-app navigations fetch the page's RSC payload from the same
    // path; those need the server, so only whole documents are kept.
    const isPayload =
      request !== undefined &&
      (request.headers.get("RSC") !== null || url.searchParams.has("_rsc"));

    return isPayload ? null : "page";
  }

  if (TILL_DATA.has(url.pathname) && url.search === "") {
    return "data";
  }

  if (url.pathname.startsWith(STATIC_PREFIX)) {
    return "static";
  }

  return null;
};

/**
 * Which cache a kind of request is kept in.
 * @param {Kind} kind the kind of request
 * @returns {string} the cache's name
 */
const cacheFor = (kind) => {
  if (kind === "page") {
    return PAGES;
  }

  return kind === "data" ? DATA : STATIC;
};

/**
 * The key a copy is kept under: the path, so a query string or fragment doesn't split it.
 * @param {URL} url what is asked for
 * @returns {string} the origin and path
 */
const keyFor = (url) => `${url.origin}${url.pathname}`;

/**
 * Whether an answer is worth keeping.
 * @param {Kind} kind the kind of request
 * @param {Response} response the network's answer
 * @returns {boolean} true for a good answer that wasn't redirected
 */
const isKeepable = (kind, response) => {
  // Opaque answers and opaque redirects (to sign-in) are never `ok`.
  if (!response.ok || response.redirected) {
    return false;
  }

  if (kind === "data") {
    return (
      response.headers.get("content-type")?.includes("application/json") ===
      true
    );
  }

  return true;
};

/**
 * A copy of `response` stamped with now, for the cache: when it was last
 * used for a static file, when it was saved for anything else.
 * @param {Kind} kind the kind of request
 * @param {Response} response an answer nobody else will read
 * @returns {Promise<Response>} the same answer with the stamp
 */
const stamped = async (kind, response) => {
  const headers = new Headers(response.headers);
  headers.set(kind === "static" ? USED_AT : SAVED_AT, new Date().toISOString());

  return new Response(await response.blob(), {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

/**
 * Stores a stamped copy of `response` unless the page asked to forget since
 * `startedIn`. Checked before opening the cache (so a forgotten one isn't
 * opened again) and right before the write, after every wait, so nothing
 * lands in a cache sign-out has just deleted.
 * @param {Kind} kind the kind of request
 * @param {URL} url what was asked for
 * @param {Response} response an answer nobody else will read
 * @param {number} startedIn the generation the request started in
 * @returns {Promise<void>} once it's stored, or dropped
 */
const store = async (kind, url, response, startedIn) => {
  if (startedIn !== generation) {
    return;
  }

  const [cache, copy] = await Promise.all([
    caches.open(cacheFor(kind)),
    stamped(kind, response),
  ]);

  if (startedIn !== generation) {
    return;
  }

  await cache.put(keyFor(url), copy);
};

/**
 * Saves `response` if it's worth keeping. It is checked first and cloned
 * only to be stored, so the caller can still read it.
 * @param {Kind} kind the kind of request
 * @param {URL} url what was asked for
 * @param {Response} response the network's answer
 * @param {number} startedIn the generation the request started in
 * @returns {Promise<void>} once it's saved, or turned down
 */
const keep = async (kind, url, response, startedIn) => {
  if (isKeepable(kind, response)) {
    await store(kind, url, response.clone(), startedIn);
  }
};

/**
 * Whether two times fall on the same day in Ghana, which keeps GMT all year.
 * @param {Date} a one time
 * @param {Date} b the other
 * @returns {boolean} true on the same UTC day
 */
const isSameUtcDay = (a, b) =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/**
 * The saved copy, if any. Today's sales saved on another day are no use, so
 * they come back as an empty list, still stamped with when they were saved.
 * @param {Kind} kind the kind of request
 * @param {URL} url what is asked for
 * @returns {Promise<Response | undefined>} undefined when nothing was saved
 */
const savedCopy = async (kind, url) => {
  const cache = await caches.open(cacheFor(kind));
  const copy = await cache.match(keyFor(url));

  if (copy === undefined || url.pathname !== TODAYS_SALES) {
    return copy;
  }

  const savedAt = new Date(copy.headers.get(SAVED_AT) ?? 0);

  if (isSameUtcDay(savedAt, new Date())) {
    return copy;
  }

  return Response.json(
    { sales: [] },
    { headers: { [SAVED_AT]: savedAt.toISOString() } }
  );
};

/**
 * Resolves after `ms`.
 * @param {number} ms how long to wait
 * @returns {Promise<void>} resolves once the time is up
 */
const wait = async (ms) => {
  // oxlint-disable-next-line promise/avoid-new -- a worker has no promise form of setTimeout
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/**
 * Network first. The network's answer wins whatever it is (a 401 must reach
 * the till as a 401); a saved copy answers only when there's no answer at
 * all, or none within `NETWORK_WAIT_MS` and a copy exists. The request keeps
 * going in the background and refreshes the copy when it lands.
 * @param {WorkerFetchEvent} event the page's request
 * @param {Kind} kind "page" or "data"
 * @param {URL} url what is asked for
 * @returns {Promise<Response>} the answer for the page
 */
const networkFirst = async (event, kind, url) => {
  const startedIn = generation;

  const fromNetwork = fetch(event.request).then(async (response) => {
    await keep(kind, url, response, startedIn);

    return response;
  });

  event.waitUntil(fromNetwork.catch(() => null));

  const slow = wait(NETWORK_WAIT_MS).then(async () => {
    const copy = await savedCopy(kind, url);

    // No copy: keep waiting for the network, however long it takes.
    return copy ?? (await fromNetwork);
  });

  try {
    return await Promise.race([fromNetwork, slow]);
  } catch (error) {
    const copy = await savedCopy(kind, url);

    if (copy === undefined) {
      throw error;
    }

    return copy;
  }
};

/**
 * When a saved static file was last used, or NaN for one with no stamp.
 * @param {Response} copy the saved file
 * @returns {number} milliseconds since the epoch
 */
const usedAtOf = (copy) => Date.parse(copy.headers.get(USED_AT) ?? "");

/**
 * Writes down that a saved static file was used, at most once a day, so
 * pruning goes by use and not by when the file was first saved.
 * @param {URL} url the file
 * @param {Response} copy its saved copy, which nobody else will read
 * @param {number} startedIn the generation the use happened in
 * @returns {Promise<void>} once it's noted, or skipped
 */
const noteUse = async (url, copy, startedIn) => {
  if (Date.now() - usedAtOf(copy) < USE_NOTE_MS) {
    return;
  }

  await store("static", url, copy, startedIn);
};

/**
 * Cache first, for files whose names change with their contents.
 * @param {WorkerFetchEvent} event the page's request
 * @param {URL} url what is asked for
 * @returns {Promise<Response>} the saved copy, or the network's answer
 */
const cacheFirst = async (event, url) => {
  const startedIn = generation;
  const cache = await caches.open(STATIC);
  const copy = await cache.match(keyFor(url));

  if (copy !== undefined) {
    event.waitUntil(noteUse(url, copy.clone(), startedIn).catch(() => null));

    return copy;
  }

  const response = await fetch(event.request);
  await keep("static", url, response, startedIn);

  return response;
};

/**
 * A URL the page sent, read against this site.
 * @param {string} raw an absolute URL or a path
 * @returns {URL | null} null when it isn't a URL
 */
const parseUrl = (raw) => {
  try {
    return new URL(raw, worker.location.origin);
  } catch {
    return null;
  }
};

/**
 * Saves `url` unless a copy exists already; a static file the page loaded
 * from its copy counts as used.
 * @param {URL} url what to save
 * @param {Kind} kind the kind of request
 * @param {number} startedIn the generation the warming started in
 * @returns {Promise<void>} once it's saved, or skipped
 */
const saveIfMissing = async (url, kind, startedIn) => {
  const cache = await caches.open(cacheFor(kind));
  const copy = await cache.match(keyFor(url));

  if (copy !== undefined) {
    if (kind === "static") {
      await noteUse(url, copy, startedIn);
    }

    return;
  }

  try {
    await keep(kind, url, await fetch(keyFor(url)), startedIn);
  } catch {
    // Offline already: the next visit tries again.
  }
};

/**
 * Drops one static file if no till page has used it for a month. Use is
 * written down whichever page loads the file (`/till` or `/till/history`),
 * so one page's warming never drops a file the other still needs.
 * @param {Cache} statics the static cache
 * @param {Request} request the saved file's key
 * @returns {Promise<void>} once it's dropped, or kept
 */
const pruneStatic = async (statics, request) => {
  const copy = await statics.match(request);
  const usedAt = copy === undefined ? Number.NaN : usedAtOf(copy);

  if (Number.isNaN(usedAt) || Date.now() - usedAt > STATIC_KEEP_MS) {
    await statics.delete(request);
  }
};

/**
 * The page asks for what it loaded before this worker was in charge (its
 * HTML, its data, its scripts), so the first visit is enough to open the
 * till offline next time. Only what isn't saved yet is fetched; static files
 * no till page has used for a month go.
 * @param {string[]} urls what the page loaded
 * @returns {Promise<void>} once everything is saved
 */
const warm = async (urls) => {
  const startedIn = generation;
  /** @type {Promise<void>[]} */
  const saving = [];

  for (const raw of urls) {
    const url = parseUrl(raw);
    const kind = url === null ? null : kindOf(url, undefined);

    if (url !== null && kind !== null) {
      saving.push(saveIfMissing(url, kind, startedIn));
    }
  }

  await Promise.all(saving);

  const statics = await caches.open(STATIC);
  /** @type {Promise<void>[]} */
  const pruning = [];

  for (const request of await statics.keys()) {
    pruning.push(pruneStatic(statics, request));
  }

  await Promise.all(pruning);
};

/**
 * Deletes the caches whose names `doomed` picks.
 * @param {(name: string) => boolean} doomed true for a cache to delete
 * @returns {Promise<void>} once they're gone
 */
const deleteCaches = async (doomed) => {
  /** @type {Promise<boolean>[]} */
  const deleting = [];

  for (const name of await caches.keys()) {
    if (doomed(name)) {
      deleting.push(caches.delete(name));
    }
  }

  await Promise.all(deleting);
};

/**
 * Forgets the saved till: nothing a request already under way brings back
 * is saved, and every `tally-till-…` cache goes. Answers on `reply` once done.
 * @param {MessagePort | undefined} reply where the page waits for the answer
 * @returns {Promise<void>} once the caches are gone
 */
const forget = async (reply) => {
  generation += 1;
  await deleteCaches((name) => name.startsWith(PREFIX));
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a MessagePort's postMessage takes no target origin
  reply?.postMessage("forgotten");
};

worker.addEventListener("install", () => {
  worker.skipWaiting().catch(() => null);
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Caches an older version of this worker wrote.
      await deleteCaches(
        (name) => name.startsWith(PREFIX) && !CURRENT.has(name)
      );
      await worker.clients.claim();
    })()
  );
});

worker.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const kind = kindOf(url, event.request);

  if (kind === null) {
    return;
  }

  event.respondWith(
    kind === "static" ? cacheFirst(event, url) : networkFirst(event, kind, url)
  );
});

worker.addEventListener("message", (event) => {
  const message = event.data;

  if (message?.type === FORGET_MESSAGE) {
    event.waitUntil(forget(event.ports[0]));
  } else if (message?.type === WARM_MESSAGE && Array.isArray(message.urls)) {
    event.waitUntil(warm(message.urls));
  }
});
