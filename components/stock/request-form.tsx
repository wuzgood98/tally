"use client";

import { ScanBarcode, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { lookupProducts } from "@/app/(app)/lookup-action";
import type { PickedProduct } from "@/app/(app)/lookup-action";
import { requestStockAction } from "@/app/(app)/requests/actions";
import { ProductPicker } from "@/components/stock/product-picker";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import { PendingLabel } from "@/components/ui/spinner";
import { formatCount } from "@/lib/format";
import { wholeNumber } from "@/lib/numbers";

/** A requested line as typed: the quantity stays text until submitted. */
export interface RequestDraftLine {
  readonly product: PickedProduct;
  readonly quantity: string;
}

interface Option {
  readonly id: string;
  readonly name: string;
}

interface RequestFormProps {
  /** Stores this person may request for. */
  readonly stores: readonly Option[];
  readonly defaultStoreId: string;
  readonly warehouse: Option;
  readonly initialLines: readonly RequestDraftLine[];
}

const RequestLineRow = ({
  line,
  storeId,
  warehouseId,
  onChange,
  onRemove,
}: {
  readonly line: RequestDraftLine;
  readonly storeId: string;
  readonly warehouseId: string;
  readonly onChange: (productId: number, quantity: string) => void;
  readonly onRemove: (productId: number) => void;
}) => {
  const { product } = line;
  const quantity = wholeNumber(line.quantity);
  const atWarehouse = product.onHand[warehouseId] ?? 0;

  return (
    <tr className="border-line border-b last:border-0">
      <td className="min-w-52 px-4 py-2">
        <span className="font-medium">{product.name}</span>
        <span className="text-ink-3 block font-mono text-xs">
          {product.sku}
        </span>
      </td>
      <td className="text-ink-2 tabular px-2 py-2 text-right">
        {formatCount(product.onHand[storeId] ?? 0)}
      </td>
      <td
        className={
          atWarehouse > 0
            ? "text-ink-2 tabular px-2 py-2 text-right"
            : "text-danger tabular px-2 py-2 text-right"
        }
      >
        {formatCount(atWarehouse)}
      </td>
      <td className="px-2 py-2">
        <Input
          aria-invalid={quantity !== null && quantity > 0 ? undefined : true}
          aria-label={`Quantity of ${product.name} to request`}
          className="min-w-20"
          format="amount"
          inputMode="numeric"
          size="sm"
          onChange={(event) => {
            onChange(product.id, event.target.value);
          }}
          onFocus={(event) => {
            event.target.select();
          }}
          placeholder="0"
          value={line.quantity}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <button
          aria-label={`Remove ${product.name}`}
          className="press text-ink-3 hover:text-danger hover:bg-danger-soft grid size-8 place-items-center rounded-md"
          onClick={() => {
            onRemove(product.id);
          }}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </td>
    </tr>
  );
};

/**
 * A store asking the warehouse for stock. The warehouse may send less than
 * asked if it's short; it sees what it holds when it fulfils the request.
 */
export const RequestForm = ({
  stores,
  defaultStoreId,
  warehouse,
  initialLines,
}: RequestFormProps) => {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [lines, setLines] = useState(initialLines);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Scanning the same product again adds one more. */
  const addProduct = (product: PickedProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (existing === undefined) {
        return [...current, { product, quantity: "1" }];
      }

      return current.map((line) =>
        line === existing
          ? { ...line, quantity: String((wholeNumber(line.quantity) ?? 0) + 1) }
          : line
      );
    });
    setError(null);
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const invalid = lines.find((line) => {
      const quantity = wholeNumber(line.quantity);

      return quantity === null || quantity === 0;
    });

    if (lines.length === 0) {
      setError("Scan or find at least one product.");

      return;
    }

    if (invalid !== undefined) {
      setError(`Check the quantity for ${invalid.product.name}.`);

      return;
    }

    startTransition(async () => {
      const result = await requestStockAction({
        branchId: storeId,
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: wholeNumber(line.quantity) ?? 0,
        })),
        note,
      });

      setError(result.error);
    });
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={onSubmit}>
      {stores.length > 1 ? (
        <Field className="max-w-sm">
          <FieldLabel>Request for</FieldLabel>
          <Select
            onValueChange={(value) => {
              setStoreId(value ?? "");
            }}
            options={namedOptions(stores)}
            placeholder="Choose a store"
            value={storeId}
          />
        </Field>
      ) : null}

      <Frame>
        <FramePanel flush>
          <div className="border-line border-b p-4">
            <ProductPicker
              autoFocus={initialLines.length === 0}
              label="Add products"
              lookup={lookupProducts}
              onPick={addProduct}
            />
          </div>
          {lines.length === 0 ? (
            <EmptyNote icon={ScanBarcode} title="Nothing requested yet">
              Scan or find the first product.
            </EmptyNote>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Products requested</caption>
                <thead>
                  <tr className="text-ink-2 border-line border-b text-left text-xs">
                    <th className="px-4 py-2 font-medium" scope="col">
                      Product
                    </th>
                    <th
                      className="px-2 py-2 text-right font-medium"
                      scope="col"
                    >
                      Here
                    </th>
                    <th
                      className="px-2 py-2 text-right font-medium"
                      scope="col"
                    >
                      At {warehouse.name}
                    </th>
                    <th
                      className="w-28 px-2 py-2 text-right font-medium"
                      scope="col"
                    >
                      Request
                    </th>
                    <th className="w-12 px-2 py-2" scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <RequestLineRow
                      key={line.product.id}
                      line={line}
                      onChange={(productId, quantity) => {
                        setLines((current) =>
                          current.map((item) =>
                            item.product.id === productId
                              ? { ...item, quantity }
                              : item
                          )
                        );
                      }}
                      onRemove={(productId) => {
                        setLines((current) =>
                          current.filter(
                            (item) => item.product.id !== productId
                          )
                        );
                      }}
                      storeId={storeId}
                      warehouseId={warehouse.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FramePanel>
      </Frame>

      <Field>
        <FieldLabel>
          <span>
            Note <span className="text-ink-3 font-normal">(optional)</span>
          </span>
        </FieldLabel>
        <Textarea
          maxLength={500}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder="Why it's needed, or by when: e.g. promo starts Saturday"
          value={note}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <output aria-live="polite" className="text-danger mr-auto text-sm">
          {error}
        </output>
        <Button disabled={pending} size="md" type="submit">
          <PendingLabel label="Sending…" pending={pending}>
            Send request
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
};
