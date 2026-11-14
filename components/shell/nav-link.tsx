"use client";

import { Tooltip, TooltipTrigger } from "@ui-sdk/react/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useSidebarRail } from "@/components/shell/sidebar";
import { TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  readonly href: string;
  readonly icon: ReactNode;
  readonly children: ReactNode;
  readonly badge?: number;
  /** The badge is a problem to deal with, not just a count. */
  readonly urgent?: boolean;
}

const isCurrent = (pathname: string, href: string): boolean =>
  href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);

export const NavLink = ({
  href,
  icon,
  children,
  badge,
  urgent = false,
}: NavLinkProps) => {
  const pathname = usePathname();
  const current = isCurrent(pathname, href);
  const rail = useSidebarRail();
  const hasBadge = badge !== undefined && badge > 0;

  // bg-transparent beats ui-sdk's default tooltip-trigger look in the rail.
  const className = cn(
    "press flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm whitespace-nowrap lg:h-7.5",
    rail && "relative justify-center px-0",
    current
      ? "bg-surface-2 text-ink ring-line ring-1 lg:ring-0"
      : "text-ink-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface [@media(hover:hover)_and_(pointer:fine)]:hover:text-ink bg-transparent"
  );

  const iconSpan = (
    <span
      className={cn("[&_svg]:size-4", current ? "text-brand" : "text-ink-3")}
    >
      {icon}
    </span>
  );

  if (!rail) {
    return (
      <Link
        aria-current={current ? "page" : undefined}
        className={className}
        href={href}
      >
        {iconSpan}
        <span className="grow">{children}</span>
        {hasBadge ? (
          <span
            className={cn(
              "figures text-2xs",
              urgent ? "text-warn" : "text-ink-3"
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  // Only the icon shows, so the tooltip names the link (count included).
  return (
    <Tooltip>
      <TooltipTrigger
        aria-current={current ? "page" : undefined}
        className={className}
        render={<Link href={href} />}
      >
        {iconSpan}
        {hasBadge && urgent ? (
          <span
            aria-hidden="true"
            className="bg-warn absolute top-1 right-1 size-1.5 rounded-full"
          />
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {children}
        {hasBadge ? ` · ${badge}` : ""}
      </TooltipContent>
    </Tooltip>
  );
};
