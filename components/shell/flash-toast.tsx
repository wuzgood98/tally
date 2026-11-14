"use client";

import { toast } from "@ui-sdk/react/toast";
import { useEffect, useRef } from "react";

import { clearFlash } from "@/app/flash-action";
import type { Flash } from "@/lib/flash";

/**
 * Shows the confirmation an action left before redirecting here, then clears
 * it so a refresh or the back button doesn't show it again.
 */
export const FlashToast = ({ flash }: { readonly flash: Flash | null }) => {
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (flash === null || shown.current === flash.id) {
      return;
    }

    shown.current = flash.id;
    toast.success(flash.title, {
      action: flash.action,
      description: flash.description,
      id: flash.id,
    });
    void clearFlash();
  }, [flash]);

  return null;
};
