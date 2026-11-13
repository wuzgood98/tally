"use client";

import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { Search } from "lucide-react";
import { useRef } from "react";

const SHORTCUT = "mod+k";

/**
 * Finds a product from any page: name, SKU or barcode, answered by the
 * product list. Cmd/Ctrl+K jumps here with no animation, since people do it
 * all day.
 */
export const ProductSearch = () => {
  const input = useRef<HTMLInputElement>(null);
  const hint = useShortcutHint(SHORTCUT);

  useShortcut(
    SHORTCUT,
    () => {
      input.current?.focus();
      input.current?.select();
    },
    { allowInInput: true, description: "Find a product" }
  );

  return (
    <search>
      <form action="/products" className="relative">
        <Search
          aria-hidden="true"
          className="text-ink-3 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        />
        <input
          aria-keyshortcuts={hint.ariaKeyshortcuts}
          aria-label="Find a product by name, SKU or barcode"
          autoComplete="off"
          className="field peer h-8 rounded-lg ps-8 pe-12 text-xs"
          name="q"
          placeholder="Find a product…"
          ref={input}
          type="search"
        />
        <kbd
          aria-hidden="true"
          className="border-line-strong text-ink-3 figures text-2xs pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border px-1 leading-4 peer-focus-visible:opacity-0"
        >
          {hint.text}
        </kbd>
      </form>
    </search>
  );
};
