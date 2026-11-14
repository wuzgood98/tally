"use server";

import { cookies } from "next/headers";

import { FLASH_COOKIE } from "@/lib/flash";

/** Forgets the confirmation once its toast is showing. */
export const clearFlash = async (): Promise<void> => {
  const jar = await cookies();

  jar.delete(FLASH_COOKIE);
};
