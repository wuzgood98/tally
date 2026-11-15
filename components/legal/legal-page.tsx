import { ArrowLeft, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { TallyMark } from "@/components/brand/tally-mark";
import { Frame, FramePanel } from "@/components/ui/frame";
import { PRIVACY_PATH, TERMS_PATH } from "@/lib/legal";

/** "15 November 2026": a legal page's date needs its year, not its weekday. */
const updatedDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Africa/Accra",
});

const OTHER_PAGE = {
  privacy: { href: TERMS_PATH, label: "Terms of use" },
  terms: { href: PRIVACY_PATH, label: "Privacy notice" },
} as const;

const DemoNotice = () => (
  <Frame className="mt-8">
    <FramePanel>
      <div className="flex gap-3">
        <FlaskConical
          aria-hidden="true"
          className="text-brand mt-0.5 size-4 shrink-0"
        />
        <p className="text-ink-2 text-sm text-pretty">
          <strong className="text-ink font-medium">This is a demo.</strong>{" "}
          Akwaaba Mall and everyone in it are made up. The demo accounts and
          their password are public, and the data may be reset at any time, so
          don&rsquo;t enter anything real.
        </p>
      </div>
    </FramePanel>
  </Frame>
);

/**
 * The shell of the Terms and Privacy pages: a printed-label strip like the
 * sign-in page's, the title and date, the demo notice, then the sections.
 */
export const LegalPage = ({
  page,
  title,
  companyName,
  updated,
  demo,
  children,
}: {
  readonly page: keyof typeof OTHER_PAGE;
  readonly title: string;
  readonly companyName: string;
  /** `YYYY-MM-DD`, from `lib/legal.ts`. */
  readonly updated: string;
  readonly demo: boolean;
  readonly children: ReactNode;
}) => {
  const other = OTHER_PAGE[page];

  return (
    <main className="bg-canvas min-h-svh px-4 pt-8 pb-16 sm:pt-14">
      <div className="mx-auto max-w-[68ch]">
        <Link
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1.5 text-sm transition-colors"
          href="/"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to Tally
        </Link>
        <header className="mt-8">
          <div className="text-ink-2 text-2xs flex items-center gap-2 font-mono tracking-widest uppercase">
            <TallyMark className="text-ink size-4 shrink-0" />
            <span className="truncate">Tally · {companyName}</span>
          </div>
          <h1 className="mt-4 text-4xl leading-none font-bold tracking-tighter text-balance">
            {title}
          </h1>
          <p className="border-ink text-ink-3 mt-4 border-t-2 pt-2 font-mono text-xs">
            Last updated{" "}
            <time dateTime={updated}>
              {updatedDate.format(new Date(`${updated}T12:00:00Z`))}
            </time>
          </p>
        </header>
        {demo ? <DemoNotice /> : null}
        <div className="mt-10 grid gap-10">{children}</div>
        <footer className="border-line text-ink-3 mt-14 flex flex-wrap justify-between gap-3 border-t pt-4 text-sm">
          <span>{companyName}</span>
          <Link className="hover:text-ink underline" href={other.href}>
            {other.label}
          </Link>
        </footer>
      </div>
    </main>
  );
};

/** "01 What we collect", then the section's prose. */
export const LegalSection = ({
  number,
  id,
  title,
  children,
}: {
  readonly number: number;
  /** For the heading's anchor and `aria-labelledby`. */
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <section aria-labelledby={id} className="scroll-mt-8">
    <div className="flex items-baseline gap-2.5">
      <span className="text-ink-3 font-mono text-xs font-medium tracking-wider">
        {String(number).padStart(2, "0")}
      </span>
      <h2 className="text-lg font-semibold tracking-tight" id={id}>
        {title}
      </h2>
    </div>
    <div className="text-md text-ink-2 [&_a]:text-ink [&_strong]:text-ink mt-3 grid gap-3 text-pretty [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-medium [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
      {children}
    </div>
  </section>
);
