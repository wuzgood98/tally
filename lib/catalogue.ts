/**
 * Changing the catalogue (head office) and per-branch stock settings
 * (managers). Stock quantities never change here: only the ledger does that.
 */

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { isValidGtin } from "@/lib/barcode";
import type { Db } from "@/lib/db/client";
import {
  branch,
  category,
  product,
  stockLevel,
  supplier,
  unitEnum,
} from "@/lib/db/schema";
import { canManageCatalogue, canSetReorderPoint } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";

/** About GH₵10 million: catches a price typed into the wrong box. */
const MAX_PRICE = 1_000_000_000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const productInput = z.object({
  active: z.boolean(),
  barcode: optionalText(14).refine(
    (value) => value === null || value === undefined || isValidGtin(value),
    "That barcode's check digit doesn't match: check it was typed or scanned correctly."
  ),
  categoryId: z.int().positive("Choose a category."),
  defaultSupplierId: z.int().positive().nullable(),
  name: z.string().trim().min(3, "Give the product a name.").max(120),
  reorderPoint: z
    .int("Reorder points are whole units.")
    .nonnegative()
    .max(100_000),
  sellPrice: z.int().nonnegative().max(MAX_PRICE, "That price looks wrong."),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9][A-Z0-9-]{1,23}$/u,
      "SKUs use letters, numbers and dashes, e.g. HK-0042."
    ),
  unit: z.enum(unitEnum.enumValues),
});

export type ProductInput = z.infer<typeof productInput>;

export type ProductRawInput = z.input<typeof productInput>;

/** Validates again inside the domain, whatever the caller already checked. */
const parse = <S extends z.ZodType>(
  schema: S,
  input: z.input<S>,
  fallback: string
): z.output<S> => {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? fallback
    );
  }

  return parsed.data;
};

const assertUnique = async (
  db: Db,
  input: ProductInput,
  exceptId: number | null
) => {
  const notSelf = exceptId === null ? undefined : ne(product.id, exceptId);

  const [skuTaken] = await db
    .select({ name: product.name })
    .from(product)
    .where(and(eq(product.sku, input.sku), notSelf));

  if (skuTaken !== undefined) {
    throw new StockError(
      "invalid_input",
      `SKU ${input.sku} is already used by ${skuTaken.name}.`
    );
  }

  if (input.barcode !== null && input.barcode !== undefined) {
    const [barcodeTaken] = await db
      .select({ name: product.name })
      .from(product)
      .where(and(eq(product.barcode, input.barcode), notSelf));

    if (barcodeTaken !== undefined) {
      throw new StockError(
        "invalid_input",
        `That barcode already belongs to ${barcodeTaken.name}.`
      );
    }
  }
};

const assertReferences = async (db: Db, input: ProductInput) => {
  const [cat] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, input.categoryId));

  if (cat === undefined) {
    throw new StockError("not_found", "That category doesn't exist.");
  }

  if (input.defaultSupplierId !== null) {
    const [sup] = await db
      .select({ id: supplier.id })
      .from(supplier)
      .where(eq(supplier.id, input.defaultSupplierId));

    if (sup === undefined) {
      throw new StockError("not_found", "That supplier doesn't exist.");
    }
  }
};

export const createProduct = async (
  db: Db,
  actor: Actor,
  raw: ProductRawInput
): Promise<number> => {
  if (!canManageCatalogue(actor)) {
    throw new StockError("forbidden", "Only head office can add products.");
  }

  const input = parse(productInput, raw, "Check the product details.");
  await assertReferences(db, input);
  await assertUnique(db, input, null);

  const [row] = await db
    .insert(product)
    .values({ ...input, barcode: input.barcode ?? null })
    .returning({ id: product.id });

  if (row === undefined) {
    throw new Error("Inserting a product returned no row.");
  }

  return row.id;
};

export const updateProduct = async (
  db: Db,
  actor: Actor,
  productId: number,
  raw: ProductRawInput
): Promise<void> => {
  if (!canManageCatalogue(actor)) {
    throw new StockError("forbidden", "Only head office can change products.");
  }

  const input = parse(productInput, raw, "Check the product details.");
  await assertReferences(db, input);
  await assertUnique(db, input, productId);

  const updated = await db
    .update(product)
    .set({ ...input, barcode: input.barcode ?? null })
    .where(eq(product.id, productId))
    .returning({ id: product.id });

  if (updated.length === 0) {
    throw new StockError("not_found", "That product doesn't exist.");
  }
};

export const stockSettingsInput = z.object({
  binLocation: optionalText(20),
  branchId: z.string().min(1),
  productId: z.int().positive(),
  /** Null goes back to the product's default. */
  reorderPoint: z
    .int("Reorder points are whole units.")
    .nonnegative()
    .max(100_000)
    .nullable(),
});

/** A branch's reorder point and shelf location for one product. */
export const setStockSettings = async (
  db: Db,
  actor: Actor,
  raw: z.input<typeof stockSettingsInput>
): Promise<void> => {
  const input = parse(stockSettingsInput, raw, "Check the settings.");

  if (!canSetReorderPoint(actor, input.branchId)) {
    throw new StockError(
      "forbidden",
      "Only this branch's manager or head office can change these settings."
    );
  }

  const [[item], [place]] = await Promise.all([
    db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.id, input.productId)),
    db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.id, input.branchId)),
  ]);

  if (item === undefined || place === undefined) {
    throw new StockError("not_found", "That product or branch doesn't exist.");
  }

  const values = {
    binLocation: input.binLocation ?? null,
    reorderPoint: input.reorderPoint,
  };

  await db
    .insert(stockLevel)
    .values({
      ...values,
      branchId: input.branchId,
      onHand: 0,
      productId: input.productId,
    })
    .onConflictDoUpdate({
      set: values,
      target: [stockLevel.branchId, stockLevel.productId],
    });
};
