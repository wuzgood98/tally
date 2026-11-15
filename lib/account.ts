/**
 * What a signed-in person changes about their own account on the settings
 * page: the name on their badge and their password. Email, role and branch
 * are head office's to change, on the Staff page.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { MIN_PASSWORD_LENGTH, NAME_MAX_LENGTH } from "@/lib/limits";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";

/**
 * A person's name, by one rule wherever it's written: here for your own, and
 * on the Staff page (`lib/staff.ts`) for someone head office adds.
 */
export const personName = (missing: string) =>
  z
    .string()
    .trim()
    .min(2, missing)
    .max(NAME_MAX_LENGTH, `Keep the name under ${NAME_MAX_LENGTH} characters.`);

export const nameInput = z.object({
  name: personName("Enter your full name."),
});

const MAX_PASSWORD_LENGTH = 128;

export const passwordInput = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      )
      .max(MAX_PASSWORD_LENGTH, "That password is too long."),
    signOutOthers: z.boolean(),
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    message: "Choose a password you aren't using now.",
    path: ["newPassword"],
  });

/** Writes the actor's own name; nobody renames anyone else from here. */
export const renameSelf = async (
  db: Db,
  actor: Actor,
  raw: z.input<typeof nameInput>
): Promise<string> => {
  const parsed = nameInput.safeParse(raw);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check your name."
    );
  }

  const { name } = parsed.data;
  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, actor.id));

  return name;
};
