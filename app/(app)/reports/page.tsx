import { ChartLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { loadReportContext } from "@/lib/reports/context";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

const ReportCard = ({
  href,
  icon,
  title,
  children,
}: {
  readonly href: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <Link
    className="press border-line bg-surface hover:border-line-strong grid gap-2 rounded-xl border p-4"
    href={href}
  >
    <span className="text-brand [&_svg]:size-5" aria-hidden="true">
      {icon}
    </span>
    <span className="font-semibold">{title}</span>
    <span className="text-ink-2 text-sm">{children}</span>
  </Link>
);

const ReportsPage = async () => {
  const viewer = await requireViewer();
  const context = await loadReportContext(viewer, null);

  if (context === null) {
    notFound();
  }

  return (
    <>
      <PageHeader
        description={`Figures at cost, from the stock ledger. Each report covers the last 7, 30 or 90 days and downloads as CSV. · ${context.label}`}
        title="Reports"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportCard
          href="/reports/stock-value"
          icon={<ChartLine />}
          title="Stock value over time"
        >
          What the stock was worth at the end of each day, by branch, with goods
          in transit.
        </ReportCard>
      </div>
    </>
  );
};

export default ReportsPage;
