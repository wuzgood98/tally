"use client";

import { ScanBarcode } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";

import type { LookupResult, PickedProduct } from "@/app/(app)/lookup-action";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PendingLabel } from "@/components/ui/spinner";
import { isScanEnter } from "@/lib/scan-key";

/** Finds what was typed or scanned: an exact product, or name matches. */
export type ProductLookup = (
  text: string
) => LookupResult | Promise<LookupResult>;

interface ProductPickerProps {
  readonly onPick: (product: PickedProduct) => void;
  readonly label: string;
  readonly hint?: string;
  readonly autoFocus?: boolean;
  /**
   * How to find what was typed or scanned: `lookupProducts` asks the server;
   * the till passes its own, which searches the products already in the
   * browser. Passed in, so the picker never imports a server action itself.
   */
  readonly lookup: ProductLookup;
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
  lookup,
}: ProductPickerProps) => {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
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
      const result = await lookup(query);

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

  const matchButtons = () => [
    ...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ];

  // Marked handled: ui-sdk skips prevented keys, so nothing else acts on it.
  const closeMatches = (event: KeyboardEvent) => {
    event.preventDefault();
    setMatches([]);
  };

  /** Up from the first match goes back to the box; down stops at the last. */
  const focusMatch = (buttons: readonly HTMLButtonElement[], index: number) => {
    if (index < 0) {
      input.current?.focus();

      return;
    }

    buttons[Math.min(index, buttons.length - 1)]?.focus();
  };

  /**
   * Arrow keys, Home and End move through the matches and back up into the
   * box; Escape closes them. Each match is a real button, so Enter or Space
   * picks it.
   */
  const onMatchKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = matchButtons();
    const index = buttons.indexOf(event.currentTarget);

    const moves = new Map([
      ["ArrowDown", index + 1],
      ["ArrowUp", index - 1],
      ["End", buttons.length - 1],
      ["Home", 0],
    ]);

    const target = moves.get(event.key);

    if (target !== undefined) {
      event.preventDefault();
      focusMatch(buttons, target);

      return;
    }

    if (event.key === "Escape") {
      // Back in the box first, so focus isn't lost when the list goes.
      input.current?.focus();
      closeMatches(event);
    }
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

    if (matches.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      matchButtons()[0]?.focus();
    }

    if (event.key === "Escape") {
      closeMatches(event);
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
            // Matches belong to the last search; don't offer them for new text.
            setMatches([]);
            setMessage(null);
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
          <PendingLabel label="Finding…" pending={pending}>
            Find
          </PendingLabel>
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
          ref={list}
        >
          {matches.map((match) => (
            <li key={match.id}>
              <button
                className="hover:bg-surface-2 focus-visible:bg-surface-2 flex w-full items-baseline justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm"
                onClick={() => {
                  pick(match);
                }}
                onKeyDown={onMatchKeyDown}
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
