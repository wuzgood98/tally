"use client";

import { toast } from "@ui-sdk/react/toast";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { findPaletteResults } from "@/app/(app)/palette-action";
import { setScope } from "@/app/(app)/scope-action";
import { signOut } from "@/app/login/actions";
import { setTheme } from "@/app/theme-action";
import { CommandPalette } from "@/components/shell/command-palette";
import { useSidebar } from "@/components/shell/sidebar";
import type { PaletteGroup } from "@/lib/palette";
import type { PaletteBranch } from "@/lib/palette-branches";
import { SIDEBAR_MEDIA } from "@/lib/sidebar";
import type { Theme } from "@/lib/theme";

interface CommandPaletteProviderProps {
  readonly groups: readonly PaletteGroup[];
  readonly children: ReactNode;
  readonly branches: readonly PaletteBranch[];
  readonly scope: string;
  readonly theme: Theme;
}

const subscribeToDesktop = (onChange: () => void) => {
  const query = window.matchMedia(SIDEBAR_MEDIA);
  query.addEventListener("change", onChange);

  return () => {
    query.removeEventListener("change", onChange);
  };
};

const isDesktop = () => window.matchMedia(SIDEBAR_MEDIA).matches;

const notOnServer = () => false;

/** The palette wired to the app: Next's router and the sign-out action. */
export const CommandPaletteProvider = ({
  groups,
  children,
  branches,
  scope,
  theme,
}: CommandPaletteProviderProps) => {
  const router = useRouter();
  const sidebar = useSidebar();

  const desktop = useSyncExternalStore(
    subscribeToDesktop,
    isDesktop,
    notOnServer
  );

  return (
    <CommandPalette
      branches={branches}
      groups={groups}
      onNavigate={(href) => {
        router.push(href);
      }}
      onSetTheme={setTheme}
      onSignOut={signOut}
      onSwitchScope={async (next) => {
        const formData = new FormData();
        formData.set("scope", next);
        await setScope(formData);

        // The palette closes, so say where they are now.
        const name =
          next === "all"
            ? "All branches"
            : branches.find((item) => item.id === next)?.name;

        if (name !== undefined) {
          toast.success(`Showing ${name}`, { id: "scope" });
        }
      }}
      scope={scope}
      sidebar={
        desktop
          ? { collapsed: sidebar.collapsed, onToggle: sidebar.toggle }
          : undefined
      }
      theme={theme}
      search={findPaletteResults}
    >
      {children}
    </CommandPalette>
  );
};
