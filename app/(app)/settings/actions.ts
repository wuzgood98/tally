"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { passwordInput, renameSelf } from "@/lib/account";
import { askTallyConfigured } from "@/lib/ask/settings";
import { getAuth } from "@/lib/auth";
import { companyInput, saveCompany, setAskTally } from "@/lib/company";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { formInt, formSecret, formText } from "@/lib/form";
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

export const saveCompanySettings = async (
  previous: SettingsFormState,
  form: FormData
): Promise<SettingsFormState> => {
  const viewer = await requireViewer();

  const parsed = companyInput.safeParse({
    companyName: formText(form, "companyName"),
    defaultReorderPoint: formInt(form, "defaultReorderPoint"),
    receiptFooter: formText(form, "receiptFooter"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the company settings.",
      saved: previous.saved,
    };
  }

  try {
    // saveCompany checks it's head office and parses the fields again.
    await saveCompany(getDb(), viewer, parsed.data);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message, saved: previous.saved };
    }

    throw error;
  }

  // The name is in the sidebar, on the sign-in label and on paperwork.
  revalidatePath("/", "layout");

  return { error: null, saved: previous.saved + 1 };
};

/**
 * Turns Ask Tally on (the page shows the consent screen first) or off for
 * the whole company. Off applies on the next request.
 */
export const switchAskTally = async (
  on: boolean
): Promise<{ error: string | null }> => {
  const viewer = await requireViewer();

  // Don't let anyone opt in to something the server can't run.
  if (on && !askTallyConfigured()) {
    return {
      error:
        "The server has no OPENROUTER_API_KEY, so Ask Tally can't run yet.",
    };
  }

  try {
    await setAskTally(getDb(), viewer, on);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }

    throw error;
  }

  // The palette's Ask row is drawn by the layout on every page.
  revalidatePath("/", "layout");

  return { error: null };
};
