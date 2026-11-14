import { z } from "zod";

/**
 * A confirmation that outlives a redirect: an action saves it in a cookie,
 * the next page shows it as a toast, and the toast clears it. Kept free of
 * `next/headers` so the client component can share the type.
 */
export const FLASH_COOKIE = "tally-flash";

/** A path in this app: one slash, so "//elsewhere.com" doesn't count. */
const IN_APP_PATH = /^\/(?![/\\])/u;

const flashLink = z.object({
  href: z.string().regex(IN_APP_PATH),
  label: z.string().min(1).max(40),
});

const flashSchema = z.object({
  /** A link to what comes next, such as "Receive another". */
  action: flashLink.optional(),
  description: z.string().max(200).optional(),
  /** Tells one flash from the next, so each shows exactly once. */
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
});

export type Flash = z.infer<typeof flashSchema>;

export type FlashMessage = Omit<Flash, "id">;

/** The flash in a cookie's value; anything missing or malformed is none. */
export const parseFlash = (raw: string | undefined): Flash | null => {
  if (raw === undefined) {
    return null;
  }

  try {
    const parsed = flashSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
