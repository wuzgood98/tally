import Link from "next/link";

import { cn } from "@/lib/utils";

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: "warn" | "danger";
  readonly href?: string;
}

const TONES = { danger: "text-danger", warn: "text-warn" } as const;

export const Stat = ({ label, value, detail, tone, href }: StatProps) => {
  const body = (
    <>
      <p className="text-ink-2 text-sm">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-2xl font-semibold tracking-tight",
          tone ? TONES[tone] : undefined
        )}
      >
        {value}
      </p>
      <p className="text-ink-2 mt-0.5 text-xs">{detail}</p>
    </>
  );

  const className = "border-line bg-surface rounded-xl border p-4";

  return href === undefined ? (
    <div className={className}>{body}</div>
  ) : (
    <Link
      className={cn(className, "press hover:border-line-strong block")}
      href={href}
    >
      {body}
    </Link>
  );
};
