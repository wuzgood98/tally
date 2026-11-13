"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireViewer } from "@/lib/session";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Saves the colour theme for this browser and redraws with it. */
export const setTheme = async (theme: string): Promise<void> => {
  await requireViewer();

  if (!isTheme(theme)) {
    return;
  }

  const jar = await cookies();

  if (theme === "system") {
    jar.delete(THEME_COOKIE);
  } else {
    jar.set(THEME_COOKIE, theme, {
      httpOnly: true,
      maxAge: ONE_YEAR,
      path: "/",
      sameSite: "lax",
    });
  }

  revalidatePath("/", "layout");
};
