"use server";

import { forgetFlash } from "@/lib/flash-server";

/** Forgets the confirmation once its toast is showing. */
export const clearFlash = async (): Promise<void> => {
  await forgetFlash();
};
