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
}

const isCurrent = (pathname: string, href: string): boolean =>
  href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);

export const NavLink = ({ href, icon, children, badge }: NavLinkProps) => {
  const pathname = usePathname();
  const current = isCurrent(pathname, href);

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={cn(
        "press flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
        current
          ? "bg-surface text-ink ring-line font-medium ring-1"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
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
        <span className="bg-warn-soft text-warn tabular rounded-full px-1.5 text-xs font-medium">
          {badge}
        </span>
      ) : null}
    </Link>
  );
};
