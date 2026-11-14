"use client";

import { toast } from "@ui-sdk/react/toast";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { findPaletteResults } from "@/app/(app)/palette-action";
import { setScope } from "@/app/(app)/scope-action";
import { signOut } from "@/app/login/actions";
import { CommandPalette } from "@/components/shell/command-palette";
import { useIsDesktop, useSidebar } from "@/components/shell/sidebar";
import type { PaletteGroup } from "@/lib/palette";
import type { PaletteBranch } from "@/lib/palette-branches";
import { parseTheme } from "@/lib/theme";

interface CommandPaletteProviderProps {
  readonly groups: readonly PaletteGroup[];
  readonly children: ReactNode;
  readonly branches: readonly PaletteBranch[];
  readonly scope: string;
}

/** The palette wired to the app: Next's router and the sign-out action. */
export const CommandPaletteProvider = ({
  groups,
  children,
  branches,
  scope,
}: CommandPaletteProviderProps) => {
  const router = useRouter();
  const sidebar = useSidebar();
  const { theme, setTheme } = useTheme();

  const desktop = useIsDesktop();

  return (
    <CommandPalette
      branches={branches}
      groups={groups}
      onNavigate={(href) => {
        router.push(href);
      }}
      onSetTheme={(next) => {
        setTheme(next);
      }}
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
      sidebar={desktop ? sidebar : undefined}
      theme={parseTheme(theme)}
      search={findPaletteResults}
    >
      {children}
    </CommandPalette>
  );
};
