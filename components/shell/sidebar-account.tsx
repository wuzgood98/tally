import { LogOut } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/shell/sign-out-guard";
import { initialsOf } from "@/lib/badge";

interface SidebarAccountProps {
  readonly name: string;
  /** "Branch manager · Spintex" */
  readonly detail: string;
}

/**
 * The foot of the sidebar: who's signed in, as a link to their settings
 * (badge, password, theme; every role has them), and sign out.
 */
export const SidebarAccount = ({ name, detail }: SidebarAccountProps) => (
  <div className="rail:flex-col-reverse rail:px-0 mt-auto flex items-center gap-1 px-0.5 pb-2">
    <Link
      className="press hover:bg-surface rail:grow-0 rail:p-0 flex min-w-0 grow items-center gap-2.5 rounded-lg p-1"
      href="/settings"
      title="Your settings"
    >
      <span
        aria-hidden="true"
        className="from-brand/90 to-brand/40 text-primary-foreground text-2xs grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br font-semibold"
      >
        {initialsOf(name)}
      </span>
      <span className="rail:sr-only min-w-0 grow leading-tight">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="text-ink-3 block truncate text-xs">{detail}</span>
        <span className="sr-only">, settings</span>
      </span>
    </Link>
    <SignOutButton
      className="press text-ink-3 hover:text-ink hover:bg-surface rounded-control grid size-7 place-items-center"
      label={`Sign out ${name}`}
    >
      <LogOut aria-hidden="true" className="size-3.5" />
    </SignOutButton>
  </div>
);
