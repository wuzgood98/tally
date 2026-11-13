"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { findPaletteResults } from "@/app/(app)/palette-action";
import { setScope } from "@/app/(app)/scope-action";
import { signOut } from "@/app/login/actions";
import { CommandPalette } from "@/components/shell/command-palette";
import type { PaletteGroup } from "@/lib/palette";
import type { PaletteBranch } from "@/lib/palette-branches";

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

  return (
    <CommandPalette
      branches={branches}
      groups={groups}
      onNavigate={(href) => {
        router.push(href);
      }}
      onSignOut={signOut}
      onSwitchScope={async (next) => {
        const formData = new FormData();
        formData.set("scope", next);
        await setScope(formData);
      }}
      scope={scope}
      search={findPaletteResults}
    >
      {children}
    </CommandPalette>
  );
};
