"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { formText } from "@/lib/form";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import { createTill, revokeTill } from "@/lib/tills";

export interface AddTillState {
  readonly error: string | null;
  /** Shown once, so head office can put the key into the POS. */
  readonly created: { readonly name: string; readonly key: string } | null;
}

export const addTill = async (
  _previous: AddTillState,
  form: FormData
): Promise<AddTillState> => {
  const viewer = await requireViewer();
  const name = formText(form, "name");

  try {
    const created = await createTill(getDb(), viewer, {
      branchId: formText(form, "branchId"),
      name,
    });

    revalidatePath("/tills");

    return { created: { key: created.key, name }, error: null };
  } catch (error) {
    if (error instanceof StockError) {
      return { created: null, error: error.message };
    }

    throw error;
  }
};

export const revokeTillAction = async (
  tillId: number
): Promise<{ readonly error: string | null }> => {
  const viewer = await requireViewer();

  try {
    await revokeTill(getDb(), viewer, tillId);
    revalidatePath("/tills");

    return { error: null };
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }

    throw error;
  }
};
