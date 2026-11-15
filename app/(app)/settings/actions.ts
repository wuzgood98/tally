"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { nameInput, passwordInput, renameSelf } from "@/lib/account";
import { askTallyConfigured } from "@/lib/ask/settings";
import {
  askTallyInput,
  assertCanSwitchAskTally,
  companyInput,
  saveCompany,
  setAskTally,
} from "@/lib/company";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { formInt, formSecret, formText } from "@/lib/form";
import { changeOwnPassword } from "@/lib/password";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";

export interface SettingsFormState {
  readonly error: string | null;
}

const firstIssue = (
  issues: readonly { readonly message: string }[],
  fallback: string
): SettingsFormState => ({ error: issues[0]?.message ?? fallback });

export const saveName = async (
  _previous: SettingsFormState,
  form: FormData
): Promise<SettingsFormState> => {
  const viewer = await requireViewer();

  const parsed = nameInput.safeParse({ name: formText(form, "name") });

  if (!parsed.success) {
    return firstIssue(parsed.error.issues, "Check your name.");
  }

  try {
    // renameSelf parses the name again.
    await renameSelf(getDb(), viewer, parsed.data);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }

    throw error;
  }

  // The sidebar shows the name on every page.
  revalidatePath("/", "layout");

  return { error: null };
};

export const changePassword = async (
  _previous: SettingsFormState,
  form: FormData
): Promise<SettingsFormState> => {
  await requireViewer();

  // Every demo account shares one password; changing it locks others out.
  if (isDemo()) {
    return { error: "Passwords can't be changed in the demo." };
  }

  const parsed = passwordInput.safeParse({
    currentPassword: formSecret(form, "currentPassword"),
    newPassword: formSecret(form, "newPassword"),
    signOutOthers: form.get("signOutOthers") === "on",
  });

  if (!parsed.success) {
    return firstIssue(parsed.error.issues, "Check the passwords.");
  }

  try {
    // changeOwnPassword parses the passwords again.
    await changeOwnPassword(await headers(), parsed.data);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }

    throw error;
  }

  return { error: null };
};

export const saveCompanySettings = async (
  _previous: SettingsFormState,
  form: FormData
): Promise<SettingsFormState> => {
  const viewer = await requireViewer();

  const parsed = companyInput.safeParse({
    companyName: formText(form, "companyName"),
    defaultReorderPoint: formInt(form, "defaultReorderPoint"),
    receiptFooter: formText(form, "receiptFooter"),
  });

  if (!parsed.success) {
    return firstIssue(parsed.error.issues, "Check the company settings.");
  }

  try {
    // saveCompany checks it's head office and parses the fields again.
    await saveCompany(getDb(), viewer, parsed.data);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }

    throw error;
  }

  // The name is in the sidebar, on the sign-in label and on paperwork.
  revalidatePath("/", "layout");

  return { error: null };
};

/**
 * Turns Ask Tally on (the page shows the consent screen first) or off for
 * the whole company. Off applies on the next request.
 */
export const switchAskTally = async (
  on: boolean
): Promise<SettingsFormState> => {
  const viewer = await requireViewer();

  // Typed, but a Server Action's argument comes off the wire.
  const parsed = askTallyInput.safeParse(on);

  if (!parsed.success) {
    return { error: "Choose on or off." };
  }

  try {
    // Who may switch it comes first, so nobody else learns about the key.
    assertCanSwitchAskTally(viewer);

    // Don't let anyone opt in to something the server can't run.
    if (parsed.data && !askTallyConfigured()) {
      return {
        error:
          "The server has no OPENROUTER_API_KEY, so Ask Tally can't run yet.",
      };
    }

    // setAskTally checks the role and the value again.
    await setAskTally(getDb(), viewer, parsed.data);
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
