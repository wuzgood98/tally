"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { findPaletteProducts } from "@/app/(app)/palette-action";
import { signOut } from "@/app/login/actions";
import { CommandPalette } from "@/components/shell/command-palette";
import type { PaletteGroup } from "@/lib/palette";

interface CommandPaletteProviderProps {
  readonly groups: readonly PaletteGroup[];
  readonly children: ReactNode;
}

/** The palette wired to the app: Next's router and the sign-out action. */
export const CommandPaletteProvider = ({
  groups,
  children,
}: CommandPaletteProviderProps) => {
  const router = useRouter();

  return (
    <CommandPalette
      groups={groups}
      onNavigate={(href) => {
        router.push(href);
      }}
      onSignOut={signOut}
      searchProducts={findPaletteProducts}
    >
      {children}
    </CommandPalette>
  );
};
