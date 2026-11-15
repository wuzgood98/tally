/**
 * Changing your own password through Better Auth, with its failures turned
 * into `StockError`s in Tally's words, so the action catches only those.
 */

import "server-only";
import { APIError } from "better-auth/api";
import type { z } from "zod";

import { passwordInput } from "@/lib/account";
import { getAuth } from "@/lib/auth";
import { StockError } from "@/lib/stock/errors";

/** Better Auth's message for a wrong current password. */
const WRONG_PASSWORD = "invalid password";

const passwordFailure = (error: APIError): StockError =>
  error.message.toLowerCase().includes(WRONG_PASSWORD)
    ? new StockError("invalid_input", "That isn't your current password.")
    : new StockError("conflict", "Couldn't change your password. Try again.");

export const changeOwnPassword = async (
  requestHeaders: Headers,
  raw: z.input<typeof passwordInput>
): Promise<void> => {
  const parsed = passwordInput.safeParse(raw);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the passwords."
    );
  }

  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: parsed.data.signOutOthers,
      },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      throw passwordFailure(error);
    }

    throw error;
  }
};
