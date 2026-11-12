"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { formOptional, formText } from "@/lib/form";
import { requireViewer } from "@/lib/session";
import { createStaff, setStaffActive, staffInput } from "@/lib/staff";
import { StockError } from "@/lib/stock/errors";

export interface AddStaffState {
  readonly error: string | null;
  /** Shown once, so head office can pass the password on. */
  readonly created: {
    readonly name: string;
    readonly email: string;
    readonly password: string;
  } | null;
}

export const addStaff = async (
  _previous: AddStaffState,
  form: FormData
): Promise<AddStaffState> => {
  const viewer = await requireViewer();

  const parsed = staffInput.safeParse({
    branchId: formOptional(form, "branchId"),
    email: formText(form, "email"),
    name: formText(form, "name"),
    role: formText(form, "role"),
  });

  if (!parsed.success) {
    return {
      created: null,
      error: parsed.error.issues[0]?.message ?? "Check the details.",
    };
  }

  try {
    const created = await createStaff(getDb(), viewer, parsed.data);
    revalidatePath("/staff");

    return {
      created: {
        email: parsed.data.email,
        name: parsed.data.name,
        password: created.temporaryPassword,
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof StockError) {
      return { created: null, error: error.message };
    }

    throw error;
  }
};

export const toggleStaff = async (
  userId: string,
  active: boolean
): Promise<{ error: string | null }> => {
  const viewer = await requireViewer();

  try {
    await setStaffActive(getDb(), viewer, userId, active);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/staff");

  return { error: null };
};
