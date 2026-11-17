"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {
  /* Nothing changes after hydration. */
};

const inBrowser = () => true;

const onServer = () => false;

/**
 * False on the server and during hydration, true after. For values only the
 * browser knows (a theme kept in localStorage), so the first render in the
 * browser matches the server's HTML.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(subscribeNever, inBrowser, onServer);
