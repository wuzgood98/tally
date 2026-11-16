import "server-only";
import { cookies } from "next/headers";

import { FLASH_COOKIE } from "@/lib/flash";
import type { FlashMessage } from "@/lib/flash";

/** Long enough to survive a slow redirect, short enough not to linger. */
const FLASH_SECONDS = 60;

/**
 * Saves a confirmation for the next page to show as a toast. Call it in a
 * Server Action just before `redirect()`.
 */
export const flash = async (message: FlashMessage): Promise<void> => {
  const jar = await cookies();

  jar.set(
    FLASH_COOKIE,
    JSON.stringify({ ...message, id: crypto.randomUUID() }),
    {
      httpOnly: true,
      maxAge: FLASH_SECONDS,
      path: "/",
      sameSite: "lax",
    }
  );
};

/**
 * Drops any confirmation still waiting. Signing in or out calls it too: a
 * toast left by one person's action must never greet the next person.
 */
export const forgetFlash = async (): Promise<void> => {
  const jar = await cookies();

  jar.delete(FLASH_COOKIE);
};
