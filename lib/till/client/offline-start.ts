/**
 * Opening `/till` with no connection: registers the till's service worker
 * (`public/till-sw.js`, scope `/till`) and hands it what the page loaded
 * before it was in charge, and forgets the saved till at sign-out.
 *
 * Production only. In development the worker would serve stale scripts
 * between hot reloads, so `startTillOffline` takes out any worker and copy
 * left by a production run on the same port instead.
 */

import {
  FORGET_MESSAGE,
  TILL_CACHE_PREFIX,
  TILL_DATA_URLS,
  WARM_MESSAGE,
} from "@/lib/till/client/worker-contract";

const WORKER_URL = "/till-sw.js";
const WORKER_SCOPE = "/till";

/** How long sign-out waits for the worker to say it has forgotten. */
const FORGET_WAIT_MS = 2000;

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

/**
 * Tells the till's worker, if this browser has one, to stop saving and delete
 * its copies, and waits (briefly) for it to say it has. Only the worker can
 * stop a request it is still answering from saving the last person's data
 * after the caches are gone.
 */
const askWorkerToForget = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration =
    await navigator.serviceWorker.getRegistration(WORKER_SCOPE);

  const tillWorker = registration?.active;

  if (tillWorker === undefined || tillWorker === null) {
    return;
  }

  const { port1, port2 } = new MessageChannel();
  // True once the worker answers, false if it doesn't in time; either way
  // the page goes on to delete the caches itself.
  const { promise, resolve } = Promise.withResolvers<boolean>();

  const timer = setTimeout(() => {
    resolve(false);
  }, FORGET_WAIT_MS);

  port1.addEventListener("message", () => {
    resolve(true);
  });
  port1.start();

  try {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a service worker's postMessage takes no target origin
    tillWorker.postMessage({ type: FORGET_MESSAGE }, [port2]);
    await promise;
  } finally {
    clearTimeout(timer);
    port1.close();
  }
};

/** Deletes every `tally-till-…` cache from the page's side. */
const deleteTillCaches = async (): Promise<void> => {
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

/**
 * Deletes every saved copy of the till on this device, by two routes that
 * back each other up: the worker forgets (and stops saving answers still on
 * their way), and the page deletes the caches itself, which also covers a
 * browser where the worker isn't running. One route failing doesn't stop the
 * other, and this never rejects, so signing out never stalls on it; if both
 * fail, the sign-in page runs it again before anyone else signs in.
 */
export const forgetOfflineTill = async (): Promise<void> => {
  await Promise.allSettled([askWorkerToForget(), deleteTillCaches()]);
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
    type: WARM_MESSAGE,
    urls: warmUrls(location.pathname, location.origin, resources),
  };

  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a service worker's postMessage takes no target origin
  tillWorker?.postMessage(warm);
};
