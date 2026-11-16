"use client";

import { useEffect } from "react";

import { forgetOfflineTill } from "@/lib/till/client/offline-start";

/**
 * The sign-in page clears the till saved for offline use. Sign-out already
 * does, but a session can also end on its own (it expires, or is revoked),
 * and whoever signs in next mustn't open the last person's till offline.
 */
export const ForgetOfflineTill = () => {
  useEffect(() => {
    forgetOfflineTill().catch(() => null);
  }, []);

  return null;
};
