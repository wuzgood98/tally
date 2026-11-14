"use client";

import {
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandItemIcon,
  CommandPage,
} from "@ui-sdk/react/command";
import { useShortcutHint } from "@ui-sdk/react/shortcuts";
import {
  Check,
  ChevronRight,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { memo } from "react";

import { Kbd } from "@/components/ui/kbd";
import { THEME_PAGE, themeValue } from "@/lib/palette-theme";
import {
  SIDEBAR_COMMAND,
  SIDEBAR_SHORTCUT,
  sidebarActionLabel,
} from "@/lib/sidebar";
import { THEME_LABELS, THEMES } from "@/lib/theme";
import type { Theme } from "@/lib/theme";

const itemClass =
  "text-ink-2 data-highlighted:bg-ink/6 data-highlighted:text-ink flex min-h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none data-pending:cursor-progress data-pending:opacity-60";

const iconClass = "text-ink-3 [&_svg]:size-4";

const labelClass = "text-ink-3 px-2.5 pt-2 pb-1 text-xs";

const ICONS: Record<Theme, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

interface ThemeGroupProps {
  readonly theme: Theme;
  /** Whether the sidebar is collapsed; undefined where there's none (phones). */
  readonly sidebarCollapsed?: boolean;
}

/** "Theme…", which opens the theme page, and the sidebar toggle. */
const ThemeGroupRows = ({ theme, sidebarCollapsed }: ThemeGroupProps) => {
  const Icon = ICONS[theme];

  const SidebarIcon =
    sidebarCollapsed === true ? PanelLeftOpen : PanelLeftClose;

  const sidebarHint = useShortcutHint(SIDEBAR_SHORTCUT);

  return (
    <CommandGroup className="pb-1">
      <CommandGroupLabel className={labelClass}>Appearance</CommandGroupLabel>
      <CommandItem
        className={itemClass}
        keywords={["dark", "light", "mode", "appearance", "colour", "color"]}
        label="Theme"
        page={THEME_PAGE}
        value="theme:page"
      >
        <CommandItemIcon className={iconClass}>
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
      {sidebarCollapsed === undefined ? null : (
        <CommandItem
          aria-keyshortcuts={sidebarHint.ariaKeyshortcuts}
          className={itemClass}
          keywords={["sidebar", "menu", "navigation", "collapse", "expand"]}
          label={sidebarActionLabel(sidebarCollapsed)}
          value={SIDEBAR_COMMAND}
        >
          <CommandItemIcon className={iconClass}>
            <SidebarIcon aria-hidden="true" />
          </CommandItemIcon>
          <span className="grow truncate">
            {sidebarActionLabel(sidebarCollapsed)}
          </span>
          {/* Keys only help where there's a keyboard. */}
          <Kbd aria-hidden="true" className="pointer-coarse:hidden">
            {sidebarHint.text}
          </Kbd>
        </CommandItem>
      )}
    </CommandGroup>
  );
};

export const ThemeGroup = memo(ThemeGroupRows);

/** System, light and dark, the one in use ticked. */
const ThemePageRows = ({ theme }: { readonly theme: Theme }) => (
  <CommandPage value={THEME_PAGE}>
    <CommandGroup className="pb-1">
      <CommandGroupLabel className={labelClass}>Theme</CommandGroupLabel>
      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const current = option === theme;

        return (
          <CommandItem
            className={itemClass}
            key={option}
            label={THEME_LABELS[option]}
            value={themeValue(option)}
          >
            <CommandItemIcon className={iconClass}>
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
