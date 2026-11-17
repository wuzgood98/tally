"use client";

import { useEffect } from "react";

import {
  forgetOfflineTill,
  startTillOffline,
} from "@/lib/till/client/offline-start";

/**
 * Runs `task` once the page is on screen, without holding anything up.
 * Both tasks here are best-effort by design (their docs say why a failure is
 * harmless), so a failure is dropped rather than shown.
 */
const RunOnMount = ({ task }: { readonly task: () => Promise<void> }) => {
  useEffect(() => {
    task().catch(() => null);
  }, [task]);

  return null;
};

/**
 * Once the till is on screen, with every script it needs loaded, hands them
 * to the service worker so the till opens next time without a connection.
 * Without it the till still works; it just won't open from cold offline.
 */
export const StartOfflineTill = () => <RunOnMount task={startTillOffline} />;

/**
 * The sign-in page clears the till saved for offline use. Sign-out already
 * does, but a session can also end on its own (it expires, or is revoked),
 * and whoever signs in next mustn't open the last person's till offline.
 */
export const ForgetOfflineTill = () => <RunOnMount task={forgetOfflineTill} />;
