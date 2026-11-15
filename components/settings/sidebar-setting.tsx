"use client";

import { useShortcutHint } from "@ui-sdk/react/shortcuts";

import { useIsDesktop, useSidebar } from "@/components/shell/sidebar";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { SIDEBAR_SHORTCUT } from "@/lib/sidebar";

/**
 * The sidebar's icon rail as a setting. It's the same state Ctrl+B and the
 * toggle in the header change, kept in this browser, so flipping it here
 * collapses the sidebar beside you straight away.
 */
export const SidebarSetting = () => {
  const { collapsed, toggle } = useSidebar();
  const desktop = useIsDesktop();
  const shortcut = useShortcutHint(SIDEBAR_SHORTCUT);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium" id="sidebar-setting-label">
          Sidebar as icons
        </p>
        <p className="text-ink-3 text-xs" id="sidebar-setting-hint">
          {desktop ? (
            <>
              Start with the narrow icon rail. <Kbd>{shortcut.text}</Kbd> still
              switches it anywhere.
            </>
          ) : (
            "Only on wider screens. On a phone the menu sits under the header."
          )}
        </p>
      </div>
      <Switch
        aria-describedby="sidebar-setting-hint"
        aria-labelledby="sidebar-setting-label"
        checked={collapsed}
        disabled={!desktop}
        onCheckedChange={(next) => {
          if (next !== collapsed) {
            toggle();
          }
        }}
      />
    </div>
  );
};
