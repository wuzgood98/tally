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
 *   their names change whenever their contents do.
 *
 * Only good answers are kept: a redirect (to sign-in) or an error never
 * replaces a saved copy, and is passed on as it came. Sign-out and the
 * sign-in page delete every cache named `tally-till-…`
 * (`lib/till/client/offline-start.ts`).
 *
 * Plain JavaScript with no build step, typed with JSDoc;
 * `lib/till/client/till-sw.test.ts` runs it against fakes.
 */

/**
 * The parts of a service worker's events this file uses.
 * @typedef {{ waitUntil: (work: Promise<unknown>) => void }} WorkerEvent
 * @typedef {WorkerEvent & { request: Request, respondWith: (answer: Promise<Response>) => void }} WorkerFetchEvent
 * @typedef {{ type?: string, urls?: string[] } | null} WarmMessage
 * @typedef {WorkerEvent & { data: WarmMessage }} WorkerMessageEvent
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

const PREFIX = "tally-till-";
const PAGES = `${PREFIX}pages-v1`;
const DATA = `${PREFIX}data-v1`;
const STATIC = `${PREFIX}static-v1`;
const CURRENT = new Set([PAGES, DATA, STATIC]);

const SAVED_AT = "X-Tally-Saved-At";
const WARM_MESSAGE = "tally-till-warm";
const TILL_PAGES = new Set(["/till", "/till/history"]);

const TILL_DATA = new Set([
  "/api/till/catalogue",
  "/api/till/stock-levels",
  "/api/till/sales",
]);

const TODAYS_SALES = "/api/till/sales";
const STATIC_PREFIX = "/_next/static/";

/** How long a page or data request may hang before a saved copy answers. */
const NETWORK_WAIT_MS = 4000;

/** Static files the till hasn't asked for in this long are dropped. */
const STATIC_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

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
 * A copy of `response` stamped with now, for the cache.
 * @param {Response} response an answer nobody else will read
 * @returns {Promise<Response>} the same answer with `X-Tally-Saved-At`
 */
const stamped = async (response) => {
  const headers = new Headers(response.headers);
  headers.set(SAVED_AT, new Date().toISOString());

  return new Response(await response.blob(), {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

/**
 * Saves `response` if it's worth keeping. It is checked first and cloned
 * only to be stored, so the caller can still read it.
 * @param {Kind} kind the kind of request
 * @param {URL} url what was asked for
 * @param {Response} response the network's answer
 * @returns {Promise<void>} once it's saved, or turned down
 */
const keep = async (kind, url, response) => {
  if (!isKeepable(kind, response)) {
    return;
  }

  const cache = await caches.open(cacheFor(kind));
  await cache.put(keyFor(url), await stamped(response.clone()));
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
  const fromNetwork = fetch(event.request).then(async (response) => {
    await keep(kind, url, response);

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
 * Cache first, for files whose names change with their contents.
 * @param {URL} url what is asked for
 * @param {Request} request the page's request
 * @returns {Promise<Response>} the saved copy, or the network's answer
 */
const cacheFirst = async (url, request) => {
  const cache = await caches.open(STATIC);
  const copy = await cache.match(keyFor(url));

  if (copy !== undefined) {
    return copy;
  }

  const response = await fetch(request);
  await keep("static", url, response);

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
 * Saves `url` unless a copy exists already.
 * @param {URL} url what to save
 * @param {Kind} kind the kind of request
 * @returns {Promise<void>} once it's saved, or skipped
 */
const saveIfMissing = async (url, kind) => {
  const cache = await caches.open(cacheFor(kind));

  if ((await cache.match(keyFor(url))) !== undefined) {
    return;
  }

  try {
    await keep(kind, url, await fetch(keyFor(url)));
  } catch {
    // Offline already: the next visit tries again.
  }
};

/**
 * Drops one static file if the page didn't ask for it and it's over a month old.
 * @param {Cache} statics the static cache
 * @param {Request} request the saved file's key
 * @returns {Promise<void>} once it's dropped, or kept
 */
const pruneStatic = async (statics, request) => {
  const copy = await statics.match(request);
  const savedAt = Date.parse(copy?.headers.get(SAVED_AT) ?? "");

  if (Number.isNaN(savedAt) || Date.now() - savedAt > STATIC_KEEP_MS) {
    await statics.delete(request);
  }
};

/**
 * The page asks for what it loaded before this worker was in charge (its
 * HTML, its data, its scripts), so the first visit is enough to open the
 * till offline next time. Only what isn't saved yet is fetched; static files
 * the page no longer uses go once they're a month old.
 * @param {string[]} urls what the page loaded
 * @returns {Promise<void>} once everything is saved
 */
const warm = async (urls) => {
  /** @type {Set<string>} */
  const wanted = new Set();
  /** @type {Promise<void>[]} */
  const saving = [];

  for (const raw of urls) {
    const url = parseUrl(raw);
    const kind = url === null ? null : kindOf(url, undefined);

    if (url !== null && kind !== null) {
      wanted.add(keyFor(url));
      saving.push(saveIfMissing(url, kind));
    }
  }

  await Promise.all(saving);

  const statics = await caches.open(STATIC);
  /** @type {Promise<void>[]} */
  const pruning = [];

  for (const request of await statics.keys()) {
    if (!wanted.has(request.url)) {
      pruning.push(pruneStatic(statics, request));
    }
  }

  await Promise.all(pruning);
};

/**
 * Deletes the caches an older version of this worker wrote.
 * @returns {Promise<void>} once they're gone
 */
const dropOldCaches = async () => {
  /** @type {Promise<boolean>[]} */
  const deleting = [];

  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX) && !CURRENT.has(name)) {
      deleting.push(caches.delete(name));
    }
  }

  await Promise.all(deleting);
};

worker.addEventListener("install", () => {
  worker.skipWaiting().catch(() => null);
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await dropOldCaches();
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
    kind === "static"
      ? cacheFirst(url, event.request)
      : networkFirst(event, kind, url)
  );
});

worker.addEventListener("message", (event) => {
  const message = event.data;

  if (message?.type === WARM_MESSAGE && Array.isArray(message.urls)) {
    event.waitUntil(warm(message.urls));
  }
});
