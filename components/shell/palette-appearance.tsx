"use client";

import { CommandGroup, CommandGroupLabel } from "@ui-sdk/react/command";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { memo } from "react";

import { SIDEBAR_COMMAND, SIDEBAR_KEYWORDS } from "@/lib/palette-sidebar";
import { SIDEBAR_SHORTCUT, sidebarActionLabel } from "@/lib/sidebar";
import type { SidebarState } from "@/lib/sidebar";
import type { Theme } from "@/lib/theme";

import { paletteGroupLabelClass, ShortcutPaletteRow } from "./palette-row";
import { ThemeRow } from "./palette-theme";

interface AppearanceGroupProps {
  readonly theme: Theme;
  /** The desktop sidebar; absent where there's none (phones). */
  readonly sidebar?: SidebarState;
}

/** "Theme…", which opens the theme page, and the sidebar toggle. */
const AppearanceGroupRows = ({ theme, sidebar }: AppearanceGroupProps) => (
  <CommandGroup className="pb-1">
    <CommandGroupLabel className={paletteGroupLabelClass}>
      Appearance
    </CommandGroupLabel>
    <ThemeRow theme={theme} />
    {sidebar === undefined ? null : (
      <ShortcutPaletteRow
        icon={sidebar.collapsed ? PanelLeftOpen : PanelLeftClose}
        keywords={SIDEBAR_KEYWORDS}
        label={sidebarActionLabel(sidebar.collapsed)}
        shortcut={SIDEBAR_SHORTCUT}
        value={SIDEBAR_COMMAND}
      />
    )}
  </CommandGroup>
);

export const AppearanceGroup = memo(AppearanceGroupRows);
