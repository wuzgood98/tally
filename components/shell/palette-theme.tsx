"use client";

import {
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandItemIcon,
  CommandPage,
} from "@ui-sdk/react/command";
import { Check, ChevronRight, Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { memo } from "react";

import { THEME_PAGE, themeValue } from "@/lib/palette-theme";
import { THEME_LABELS, THEMES } from "@/lib/theme";
import type { Theme } from "@/lib/theme";

import {
  paletteGroupLabelClass,
  paletteIconClass,
  paletteItemClass,
} from "./palette-row";

const ICONS: Record<Theme, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

/** "Theme…", which opens the theme page; it sits in the Appearance group. */
export const ThemeRow = ({ theme }: { readonly theme: Theme }) => {
  const Icon = ICONS[theme];

  return (
    <CommandItem
      className={paletteItemClass}
      keywords={["dark", "light", "mode", "appearance", "colour", "color"]}
      label="Theme"
      page={THEME_PAGE}
      value="theme:page"
    >
      <CommandItemIcon className={paletteIconClass}>
        <Icon aria-hidden="true" />
      </CommandItemIcon>
      <span className="grow truncate">Theme…</span>
      <span className="text-ink-3 shrink-0 truncate text-xs">
        {THEME_LABELS[theme]}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="text-ink-3 size-4 shrink-0 rtl:-scale-x-100"
      />
    </CommandItem>
  );
};

/** System, light and dark, the one in use ticked. */
const ThemePageRows = ({ theme }: { readonly theme: Theme }) => (
  <CommandPage value={THEME_PAGE}>
    <CommandGroup className="pb-1">
      <CommandGroupLabel className={paletteGroupLabelClass}>
        Theme
      </CommandGroupLabel>
      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const current = option === theme;

        return (
          <CommandItem
            className={paletteItemClass}
            key={option}
            label={THEME_LABELS[option]}
            value={themeValue(option)}
          >
            <CommandItemIcon className={paletteIconClass}>
              <Icon aria-hidden="true" />
            </CommandItemIcon>
            <span className="grow truncate">
              {THEME_LABELS[option]}
              {current ? <span className="sr-only"> (in use)</span> : null}
            </span>
            <Check
              aria-hidden="true"
              className={
                current
                  ? "text-brand size-4 shrink-0"
                  : "invisible size-4 shrink-0"
              }
            />
          </CommandItem>
        );
      })}
    </CommandGroup>
  </CommandPage>
);

export const ThemePage = memo(ThemePageRows);
