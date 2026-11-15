"use client";

import { ScanBarcode } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";

import { lookupProducts } from "@/app/(app)/lookup-action";
import type { PickedProduct } from "@/app/(app)/lookup-action";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isScanEnter } from "@/lib/scan-key";

interface ProductPickerProps {
  readonly onPick: (product: PickedProduct) => void;
  readonly label: string;
  readonly hint?: string;
  readonly autoFocus?: boolean;
}

/**
 * Built for barcode scanners, which type the code and press Enter: an exact
 * barcode or SKU is picked at once and the box clears, ready for the next
 * scan. Typing part of a name lists matches to choose from instead.
 */
export const ProductPicker = ({
  onPick,
  label,
  hint,
  autoFocus = false,
}: ProductPickerProps) => {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<readonly PickedProduct[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (product: PickedProduct) => {
    onPick(product);
    setText("");
    setMatches([]);
    setMessage(null);
    input.current?.focus();
  };

  const find = () => {
    const query = text.trim();

    if (!query) {
      return;
    }

    startTransition(async () => {
      const result = await lookupProducts(query);

      if (result.exact) {
        pick(result.exact);

        return;
      }

      setMatches(result.matches);
      setMessage(
        result.matches.length === 0
          ? `No active product matches “${query}”.`
          : null
      );
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter that confirms an input-method candidate (e.g. Chinese) isn't a search.
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (isScanEnter(event)) {
      // Scanners end with Enter; don't let it submit the surrounding form.
      event.preventDefault();
      find();
    }

    if (event.key === "Escape") {
      setMatches([]);
    }
  };

  return (
    <Field className="relative">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          aria-controls={matches.length > 0 ? `${id}-matches` : undefined}
          autoComplete="off"
          // Scanner workflows start here, so focusing it is the point.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          className="grow"
          enterKeyHint="search"
          format="code"
          icon={<ScanBarcode aria-hidden="true" />}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder="Scan, or type a SKU or name"
          ref={input}
          spellCheck={false}
          value={text}
        />
        <Button
          size="md"
          disabled={pending}
          onClick={find}
          type="button"
          variant="outline"
        >
          {pending ? "Finding…" : "Find"}
        </Button>
      </div>
      <FieldDescription>
        {hint ?? "Press Enter after typing. A scanner does this for you."}
      </FieldDescription>
      <p aria-live="polite" className="text-danger text-sm empty:hidden">
        {message}
      </p>
      {matches.length > 0 ? (
        <ul
          aria-label="Matching products"
          className="border-line bg-surface absolute inset-x-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border p-1 shadow-lg"
          id={`${id}-matches`}
        >
          {matches.map((match) => (
            <li key={match.id}>
              <button
                className="hover:bg-surface-2 focus-visible:bg-surface-2 flex w-full items-baseline justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm"
                onClick={() => {
                  pick(match);
                }}
                type="button"
              >
                <span>{match.name}</span>
                <span className="text-ink-3 shrink-0 font-mono text-xs">
                  {match.sku}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
};
