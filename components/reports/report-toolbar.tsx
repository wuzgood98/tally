import { Download } from "lucide-react";
import Link from "next/link";

import { PeriodLabel } from "@/components/reports/period-label";
import { buttonVariants } from "@/components/ui/button";
import { REPORT_RANGES } from "@/lib/reports/period";
import type { ReportRange } from "@/lib/reports/period";
import { cn } from "@/lib/utils";

/**
 * The period picker (7 / 30 / 90 days) and the CSV download for a report.
 * Plain links, so the page stays a server component and the URL says what
 * you're looking at.
 */
export const ReportToolbar = ({
  path,
  range,
  csvHref,
}: {
  /** The report's own path, e.g. "/reports/stock-value". */
  readonly path: string;
  readonly range: ReportRange;
  readonly csvHref: string;
}) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
    <nav
      aria-label="Period"
      className="border-line bg-surface rounded-control inline-flex border p-0.5"
    >
      {REPORT_RANGES.map((days) => (
        <Link
          aria-current={days === range ? "page" : undefined}
          className={cn(
            "press rounded-control-inset px-3 py-1.5 text-sm",
            days === range
              ? "bg-brand-soft text-brand font-medium"
              : "text-ink-2 hover:text-ink"
          )}
          href={`${path}?days=${days}`}
          key={days}
        >
          <PeriodLabel>{days} days</PeriodLabel>
        </Link>
      ))}
    </nav>
    <a
      className={buttonVariants({ size: "md", variant: "outline" })}
      download
      href={csvHref}
    >
      <Download aria-hidden="true" />
      Download CSV
    </a>
  </div>
);
