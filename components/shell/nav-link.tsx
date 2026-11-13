"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={cn(
        "press flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm whitespace-nowrap lg:h-7.5",
        current
          ? "bg-surface-2 text-ink ring-line ring-1 lg:ring-0"
          : "text-ink-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface [@media(hover:hover)_and_(pointer:fine)]:hover:text-ink"
      )}
      href={href}
    >
      <span
        className={cn("[&_svg]:size-4", current ? "text-brand" : "text-ink-3")}
      >
        {icon}
      </span>
      <span className="grow">{children}</span>
      {badge !== undefined && badge > 0 ? (
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
};
