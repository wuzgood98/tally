"use client";

import { CommandItem, CommandItemIcon } from "@ui-sdk/react/command";
import { useShortcutHint } from "@ui-sdk/react/shortcuts";
import type { LucideIcon } from "lucide-react";

import { Kbd } from "@/components/ui/kbd";

export const paletteItemClass =
  "text-ink-2 data-highlighted:bg-ink/6 data-highlighted:text-ink flex min-h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none data-pending:cursor-progress data-pending:opacity-60";

export const paletteIconClass = "text-ink-3 [&_svg]:size-4";

export const paletteGroupLabelClass = "text-ink-3 px-2.5 pt-2 pb-1 text-xs";

interface ShortcutHint {
  readonly text: string;
  readonly ariaKeyshortcuts: string;
}

interface PaletteRowProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
  readonly keywords?: readonly string[];
  readonly hint?: ShortcutHint;
}

/** One command: its icon, its label and, where it has one, its keys. */
export const PaletteRow = ({
  icon: Icon,
  label,
  value,
  keywords,
  hint,
}: PaletteRowProps) => (
  <CommandItem
    aria-keyshortcuts={hint?.ariaKeyshortcuts}
    className={paletteItemClass}
    keywords={keywords === undefined ? undefined : [...keywords]}
    label={label}
    value={value}
  >
    <CommandItemIcon className={paletteIconClass}>
      <Icon aria-hidden="true" />
    </CommandItemIcon>
    <span className="grow truncate">{label}</span>
    {hint === undefined ? null : (
      // Keys only help where there's a keyboard.
      <Kbd aria-hidden="true" className="pointer-coarse:hidden">
        {hint.text}
      </Kbd>
    )}
  </CommandItem>
);

type ShortcutPaletteRowProps = Omit<PaletteRowProps, "hint"> & {
  readonly shortcut: string;
};

/** A row that shows its shortcut, written for this platform (⌘B or Ctrl+B). */
export const ShortcutPaletteRow = ({
  shortcut,
  ...row
}: ShortcutPaletteRowProps) => (
  <PaletteRow {...row} hint={useShortcutHint(shortcut)} />
);
