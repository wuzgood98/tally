"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createProduct,
  productInput,
  setStockSettings,
  stockSettingsInput,
  updateProduct,
} from "@/lib/catalogue";
import { getDb } from "@/lib/db";
import { flash } from "@/lib/flash-server";
import { formInt, formOptional, formText } from "@/lib/form";
import { parseCedis } from "@/lib/money";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";

export interface ProductFormValues {
  readonly name: string;
  readonly sku: string;
  readonly barcode: string;
  readonly categoryId: string;
  readonly defaultSupplierId: string;
  readonly unit: string;
  readonly sellPrice: string;
  readonly reorderPoint: string;
  readonly active: boolean;
}

export interface ProductFormState {
  readonly values: ProductFormValues;
  readonly error: string | null;
}

/** What was typed, kept so the form can show it again after an error. */
const readValues = (form: FormData): ProductFormValues => ({
  active: formText(form, "active") === "on",
  barcode: formText(form, "barcode"),
  categoryId: formText(form, "categoryId"),
  defaultSupplierId: formText(form, "defaultSupplierId"),
  name: formText(form, "name"),
  reorderPoint: formText(form, "reorderPoint"),
  sellPrice: formText(form, "sellPrice"),
  sku: formText(form, "sku"),
  unit: formText(form, "unit"),
});

type SaveResult =
  | { readonly ok: true; readonly id: number }
  | { readonly ok: false; readonly error: string };

const failed = (error: string): SaveResult => ({ error, ok: false });

const save = async (
  productId: number | null,
  form: FormData
): Promise<SaveResult> => {
  const viewer = await requireViewer();
  const sellPrice = parseCedis(formText(form, "sellPrice"));

  if (sellPrice === null) {
    return failed("Enter the shelf price in cedis, e.g. 24.50.");
  }

  const parsed = productInput.safeParse({
    active: formText(form, "active") === "on",
    barcode: formOptional(form, "barcode"),
    categoryId: formInt(form, "categoryId"),
    defaultSupplierId:
      formOptional(form, "defaultSupplierId") === null
        ? null
        : formInt(form, "defaultSupplierId"),
    name: formText(form, "name"),
    reorderPoint: formInt(form, "reorderPoint"),
    sellPrice,
    sku: formText(form, "sku"),
    unit: formText(form, "unit"),
  });

  if (!parsed.success) {
    return failed(
      parsed.error.issues[0]?.message ?? "Check the product details."
    );
  }

  try {
    if (productId === null) {
      return {
        id: await createProduct(getDb(), viewer, parsed.data),
        ok: true,
      };
    }

    await updateProduct(getDb(), viewer, productId, parsed.data);

    return { id: productId, ok: true };
  } catch (error) {
    if (error instanceof StockError) {
      return failed(error.message);
    }

    throw error;
  }
};

/** Creates or updates a product; on success, opens it. */
export const saveProduct = async (
  productId: number | null,
  _previous: ProductFormState,
  form: FormData
): Promise<ProductFormState> => {
  const result = await save(productId, form);

  if (result.ok) {
    await flash({
      title: productId === null ? "Product added" : "Product saved",
    });
    revalidatePath("/", "layout");
    redirect(`/products/${result.id}`);
  }

  return { error: result.error, values: readValues(form) };
};

export interface SettingsState {
  readonly error: string | null;
  readonly saved: boolean;
}

export const saveStockSettings = async (
  productId: number,
  branchId: string,
  _previous: SettingsState,
  form: FormData
): Promise<SettingsState> => {
  const viewer = await requireViewer();

  const parsed = stockSettingsInput.safeParse({
    binLocation: formOptional(form, "binLocation"),
    branchId,
    productId,
    reorderPoint:
      formOptional(form, "reorderPoint") === null
        ? null
        : formInt(form, "reorderPoint"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the settings.",
      saved: false,
    };
  }

  try {
    await setStockSettings(getDb(), viewer, parsed.data);
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message, saved: false };
    }

    throw error;
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/", "layout");

  return { error: null, saved: true };
};
