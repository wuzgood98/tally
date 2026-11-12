"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ReactNode } from "react";

import { saveProduct } from "@/app/(app)/products/actions";
import type {
  ProductFormState,
  ProductFormValues,
} from "@/app/(app)/products/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { submitWithoutReset } from "@/lib/submit-without-reset";

interface Option {
  readonly id: number;
  readonly name: string;
  readonly group?: string;
}

interface ProductFormProps {
  readonly productId: number | null;
  readonly initial: ProductFormValues;
  readonly categories: readonly Option[];
  readonly suppliers: readonly Option[];
  readonly cancelHref: string;
}

const UNITS = [
  ["each", "Each"],
  ["pack", "Pack"],
  ["pair", "Pair"],
  ["kg", "Kilogram"],
  ["litre", "Litre"],
] as const;

const Field = ({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) => (
  <label className="grid content-start gap-1.5 text-sm font-medium">
    {label}
    {children}
    {hint !== null && hint !== undefined ? (
      <span className="text-ink-2 text-xs font-normal">{hint}</span>
    ) : null}
  </label>
);

export const ProductForm = ({
  productId,
  initial,
  categories,
  suppliers,
  cancelHref,
}: ProductFormProps) => {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(
    saveProduct.bind(null, productId),
    { error: null, values: initial }
  );

  const { values } = state;
  let submitLabel = productId === null ? "Add product" : "Save changes";

  if (pending) {
    submitLabel = "Saving…";
  }

  const departments = Map.groupBy(categories, (item) => item.group ?? "");

  return (
    <form
      action={action}
      className="grid max-w-3xl gap-6"
      // A failed save must keep every choice; React's reset would revert the selects.
      onSubmit={submitWithoutReset(action)}
    >
      <div className="border-line bg-surface grid gap-5 rounded-xl border p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name">
            <input
              className="field"
              defaultValue={values.name}
              maxLength={120}
              name="name"
              required
            />
          </Field>
        </div>
        <Field hint="Letters, numbers and dashes." label="SKU">
          <input
            autoCapitalize="characters"
            className="field font-mono uppercase"
            defaultValue={values.sku}
            maxLength={24}
            name="sku"
            required
            spellCheck={false}
          />
        </Field>
        <Field
          hint="Scan it in. Leave blank for goods without one."
          label="Barcode"
        >
          <input
            autoComplete="off"
            className="field font-mono"
            defaultValue={values.barcode}
            inputMode="numeric"
            maxLength={14}
            name="barcode"
            spellCheck={false}
          />
        </Field>
        <Field label="Category">
          <select
            className="field"
            defaultValue={values.categoryId}
            name="categoryId"
            required
          >
            <option disabled value="">
              Choose a category
            </option>
            {[...departments].map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Usual supplier">
          <select
            className="field"
            defaultValue={values.defaultSupplierId}
            name="defaultSupplierId"
          >
            <option value="">None</option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="border-line bg-surface grid gap-5 rounded-xl border p-5 sm:grid-cols-3">
        <Field hint="Including VAT and levies." label="Shelf price (GH₵)">
          <input
            className="field tabular"
            defaultValue={values.sellPrice}
            inputMode="decimal"
            name="sellPrice"
            required
          />
        </Field>
        <Field label="Sold by">
          <select className="field" defaultValue={values.unit} name="unit">
            {UNITS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          hint="Default for every branch; managers can override."
          label="Reorder at"
        >
          <input
            className="field tabular"
            defaultValue={values.reorderPoint}
            inputMode="numeric"
            name="reorderPoint"
            required
          />
        </Field>
      </div>

      {productId === null ? (
        <input name="active" type="hidden" value="on" />
      ) : (
        <label className="border-line bg-surface flex items-start gap-3 rounded-xl border p-4">
          <input
            className="accent-brand mt-1 size-4"
            defaultChecked={values.active}
            name="active"
            type="checkbox"
          />
          <span>
            <span className="text-sm font-medium">Active</span>
            <span className="text-ink-2 block text-xs">
              Untick to discontinue it: it can no longer be received, and stock
              already on the shelf stays until it&rsquo;s sold or written off.
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" disabled={pending} type="submit">
          {submitLabel}
        </Button>
        <Link
          className={buttonVariants({ size: "md", variant: "ghost" })}
          href={cancelHref}
        >
          Cancel
        </Link>
        <output aria-live="polite" className="text-danger block text-sm">
          {state.error}
        </output>
      </div>
    </form>
  );
};
