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
import { Checkbox } from "@/components/ui/choice";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOptions } from "@/components/ui/select";
import { PendingLabel } from "@/components/ui/spinner";
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

const UNIT_OPTIONS = [
  { label: "Each", value: "each" },
  { label: "Pack", value: "pack" },
  { label: "Pair", value: "pair" },
  { label: "Kilogram", value: "kg" },
  { label: "Litre", value: "litre" },
] as const satisfies SelectOptions;

const LabelledField = ({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) => (
  <Field>
    <FieldLabel>{label}</FieldLabel>
    {children}
    {hint === undefined ? null : <FieldDescription>{hint}</FieldDescription>}
  </Field>
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
  const submitLabel = productId === null ? "Add product" : "Save changes";

  const categoryOptions: SelectOptions = [
    ...Map.groupBy(categories, (item) => item.group ?? ""),
  ].map(([group, items]) => ({
    label: group,
    options: items.map((item) => ({
      label: item.name,
      value: String(item.id),
    })),
  }));

  const supplierOptions: SelectOptions = [
    { label: "None", value: "" },
    ...suppliers.map((item) => ({ label: item.name, value: String(item.id) })),
  ];

  return (
    <form
      action={action}
      className="grid max-w-3xl gap-6"
      // A failed save must keep every choice; React's reset would revert the selects.
      onSubmit={submitWithoutReset(action)}
    >
      <Frame>
        <FramePanel>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabelledField label="Name">
                <Input
                  defaultValue={values.name}
                  maxLength={120}
                  name="name"
                  required
                />
              </LabelledField>
            </div>
            <LabelledField hint="Letters, numbers and dashes." label="SKU">
              <Input
                autoCapitalize="characters"
                format="sku"
                defaultValue={values.sku}
                maxLength={24}
                name="sku"
                required
                spellCheck={false}
              />
            </LabelledField>
            <LabelledField
              hint="Scan it in. Leave blank for goods without one."
              label="Barcode"
            >
              <Input
                autoComplete="off"
                format="code"
                defaultValue={values.barcode}
                inputMode="numeric"
                maxLength={14}
                name="barcode"
                spellCheck={false}
              />
            </LabelledField>
            <LabelledField label="Category">
              <Select
                defaultValue={values.categoryId}
                name="categoryId"
                options={categoryOptions}
                placeholder="Choose a category"
                required
              />
            </LabelledField>
            <LabelledField label="Usual supplier">
              <Select
                defaultValue={values.defaultSupplierId}
                name="defaultSupplierId"
                options={supplierOptions}
              />
            </LabelledField>
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FramePanel>
          <div className="grid gap-5 sm:grid-cols-3">
            <LabelledField
              hint="Including VAT and levies."
              label="Shelf price (GH₵)"
            >
              <Input
                format="number"
                defaultValue={values.sellPrice}
                inputMode="decimal"
                name="sellPrice"
                required
              />
            </LabelledField>
            <LabelledField label="Sold by">
              <Select
                defaultValue={values.unit}
                name="unit"
                options={UNIT_OPTIONS}
              />
            </LabelledField>
            <LabelledField
              hint="Default for every branch; managers can override."
              label="Reorder at"
            >
              <Input
                format="number"
                defaultValue={values.reorderPoint}
                inputMode="numeric"
                name="reorderPoint"
                required
              />
            </LabelledField>
          </div>
        </FramePanel>
      </Frame>

      {productId === null ? (
        <input name="active" type="hidden" value="on" />
      ) : (
        <Frame>
          <FramePanel flush>
            <label className="flex items-start gap-3 p-4">
              <Checkbox
                className="mt-0.5"
                defaultChecked={values.active}
                name="active"
                value="on"
              />
              <span>
                <span className="text-sm font-medium">Active</span>
                <span className="text-ink-2 block text-xs">
                  Untick to discontinue it: it can no longer be received, and
                  stock already on the shelf stays until it&rsquo;s sold or
                  written off.
                </span>
              </span>
            </label>
          </FramePanel>
        </Frame>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" disabled={pending} type="submit">
          <PendingLabel label="Saving…" pending={pending}>
            {submitLabel}
          </PendingLabel>
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
