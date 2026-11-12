import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly eyebrow?: ReactNode;
}

export const PageHeader = ({
  title,
  description,
  actions,
  eyebrow,
}: PageHeaderProps) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div className="min-w-0">
      {eyebrow === undefined ? null : (
        <p className="text-ink-2 mb-1 text-sm">{eyebrow}</p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      {description === undefined ? null : (
        <p className="text-ink-2 mt-1 max-w-2xl text-sm text-pretty">
          {description}
        </p>
      )}
    </div>
    {actions === undefined ? null : (
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    )}
  </div>
);
