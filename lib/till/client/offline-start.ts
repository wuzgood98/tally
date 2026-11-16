/**
 * Opening `/till` with no connection: registers the till's service worker
 * (`public/till-sw.js`, scope `/till`) and hands it what the page loaded
 * before it was in charge, and forgets the saved till at sign-out.
 *
 * Production only. In development the worker would serve stale scripts
 * between hot reloads, so `startTillOffline` takes out any worker and copy
 * left by a production run on the same port instead.
 */

const WORKER_URL = "/till-sw.js";
const WORKER_SCOPE = "/till";

/** Every cache the worker writes is named `tally-till-…`. */
export const TILL_CACHE_PREFIX = "tally-till-";

/** The till's data endpoints, warmed on the first visit. */
const TILL_DATA_URLS = [
  "/api/till/catalogue",
  "/api/till/stock-levels",
  "/api/till/sales",
] as const;

const STATIC_PREFIX = "/_next/static/";

/**
 * What the worker should save on this visit: this page, the till's data, and
 * every script, style and font this page has loaded from `/_next/static/`.
 * `origin` and `resources` are passed in so the test needs no browser.
 */
export const warmUrls = (
  pathname: string,
  origin: string,
  resources: readonly string[]
): string[] => {
  const statics = resources.filter((name) => {
    try {
      const url = new URL(name);

      return url.origin === origin && url.pathname.startsWith(STATIC_PREFIX);
    } catch {
      return false;
    }
  });

  return [...new Set([pathname, ...TILL_DATA_URLS, ...statics])];
};

/** Deletes every saved copy of the till on this device. */
export const forgetOfflineTill = async (): Promise<void> => {
  if (!("caches" in globalThis)) {
    return;
  }

  const deleting: Promise<boolean>[] = [];

  for (const name of await caches.keys()) {
    if (name.startsWith(TILL_CACHE_PREFIX)) {
      deleting.push(caches.delete(name));
    }
  }

  await Promise.all(deleting);
};

const removeWorker = async (): Promise<void> => {
  const removing: Promise<boolean>[] = [];

  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    if (registration.active?.scriptURL.endsWith(WORKER_URL) === true) {
      removing.push(registration.unregister());
    }
  }

  await Promise.all(removing);
  await forgetOfflineTill();
};

/**
 * The registration's worker once it's active. Not `navigator.serviceWorker.ready`:
 * that matches the URL the tab was first loaded at, so after signing in
 * (`/login`, then an in-app navigation to `/till`) it never resolves.
 */
const activeWorker = async (
  registration: ServiceWorkerRegistration
): Promise<ServiceWorker | null> => {
  const pending = registration.installing ?? registration.waiting;

  if (pending === null) {
    return registration.active;
  }

  const { promise, resolve } = Promise.withResolvers<ServiceWorker | null>();

  const onChange = () => {
    if (pending.state === "activated") {
      resolve(pending);
    } else if (pending.state === "redundant") {
      resolve(registration.active);
    }
  };

  pending.addEventListener("statechange", onChange);
  onChange();

  try {
    return await promise;
  } finally {
    pending.removeEventListener("statechange", onChange);
  }
};

/**
 * Called by the till's pages once they're on screen. Failing is harmless: the
 * till still works online and through a dropped connection, it just won't
 * open from cold without one.
 */
export const startTillOffline = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    await removeWorker();

    return;
  }

  const registration = await navigator.serviceWorker.register(WORKER_URL, {
    scope: WORKER_SCOPE,
  });

  const tillWorker = await activeWorker(registration);

  const resources = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name);

  const warm = {
    type: "tally-till-warm",
    urls: warmUrls(location.pathname, location.origin, resources),
  };

  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a service worker's postMessage takes no target origin
  tillWorker?.postMessage(warm);
};
