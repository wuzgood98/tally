"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { passwordInput, renameSelf } from "@/lib/account";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { formSecret, formText } from "@/lib/form";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";

export interface SettingsFormState {
  readonly error: string | null;
  /** Bumped on each success, so the form can toast once per save. */
  readonly saved: number;
}

export const saveName = async (
  previous: SettingsFormState,
  form: FormData
): Promise<SettingsFormState> => {
  const viewer = await requireViewer();

  try {
    await renameSelf(getDb(), viewer, { name: formText(form, "name") });
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message, saved: previous.saved };
    }

    throw error;
  }

  // The sidebar shows the name on every page.
  revalidatePath("/", "layout");

  return { error: null, saved: previous.saved + 1 };
};

/** Better Auth's messages, in Tally's words. */
const passwordError = (error: APIError): string => {
  if (error.message.toLowerCase().includes("invalid password")) {
    return "That isn't your current password.";
  }

  return error.message === ""
    ? "Couldn't change your password. Try again."
    : error.message;
};

export const changePassword = async (
  previous: SettingsFormState,
  form: FormData
): Promise<SettingsFormState> => {
  await requireViewer();

  // Every demo account shares one password; changing it locks others out.
  if (isDemo()) {
    return {
      error: "Passwords can't be changed in the demo.",
      saved: previous.saved,
    };
  }

  const parsed = passwordInput.safeParse({
    currentPassword: formSecret(form, "currentPassword"),
    newPassword: formSecret(form, "newPassword"),
    signOutOthers: form.get("signOutOthers") === "on",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the passwords.",
      saved: previous.saved,
    };
  }

  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: parsed.data.signOutOthers,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: passwordError(error), saved: previous.saved };
    }

    throw error;
  }

  return { error: null, saved: previous.saved + 1 };
};
