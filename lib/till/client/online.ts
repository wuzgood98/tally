/**
 * How the till's queue watches the connection. The library's
 * `WebOnlineDetector` counts a visible tab as online whatever the browser
 * says, and doesn't listen for "offline", so the till would keep saying
 * "Online" with the network cable out. This one trusts `navigator.onLine`
 * and both events. A browser that says online may still not reach Tally (a
 * captive portal, a dead router); the queue then fails to send, retries, and
 * the till shows why.
 */

import type { OnlineDetector } from "@tanstack/offline-transactions";

export const createBrowserOnlineDetector = (): OnlineDetector => {
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  // Coming back to the till is a good moment to try the queue again.
  const onVisible = (): void => {
    if (document.visibilityState === "visible") {
      notify();
    }
  };

  globalThis.addEventListener("online", notify);
  globalThis.addEventListener("offline", notify);
  document.addEventListener("visibilitychange", onVisible);

  return {
    dispose: () => {
      globalThis.removeEventListener("online", notify);
      globalThis.removeEventListener("offline", notify);
      document.removeEventListener("visibilitychange", onVisible);
      listeners.clear();
    },
    isOnline: () => navigator.onLine,
    notifyOnline: notify,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
