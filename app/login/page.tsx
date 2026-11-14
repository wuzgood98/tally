import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DemoAccounts } from "@/components/auth/demo-accounts";
import { LabelBarcode } from "@/components/auth/label-barcode";
import { SignInForm } from "@/components/auth/sign-in-form";
import { StockBins } from "@/components/auth/stock-bins";
import { TallyMark } from "@/components/brand/tally-mark";
import { JsonLd } from "@/components/seo/json-ld";
import { BRANCHES } from "@/lib/db/seed-data";
import { isDemo } from "@/lib/demo";
import { param } from "@/lib/search-params";
import { PUBLIC_PAGE_METADATA } from "@/lib/seo";
import { getViewer } from "@/lib/session";
import { COMPANY_NAME } from "@/lib/site";
import { appJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  ...PUBLIC_PAGE_METADATA,
  title: "Sign in",
};

/** The demo's sites head the bins; a real deployment's stay unnamed. */
const DEMO_SITE_NAMES = BRANCHES.map((branch) => branch.name);

const LoginPage = async ({ searchParams }: PageProps<"/login">) => {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);

  if (viewer !== null) {
    redirect("/");
  }

  const nextPath = param(params, "next") || undefined;
  const demo = isDemo();

  return (
    <main className="bg-canvas relative isolate grid min-h-svh place-items-center overflow-hidden px-4 py-12">
      <JsonLd data={appJsonLd()} />
      <StockBins names={demo ? DEMO_SITE_NAMES : []} />
      {/* The drop shadow sits outside the clipped label, so the torn edge casts it too. */}
      <div className="print-in drop-shadow-label relative w-full max-w-84">
        <article className="label-paper label-tear px-5 pt-6 pb-5">
          <div className="text-ink-2 text-2xs flex items-center justify-between gap-3 font-mono tracking-widest uppercase">
            <span className="flex min-w-0 items-center gap-2">
              <TallyMark className="text-ink size-4 shrink-0" />
              <span className="truncate">Tally · {COMPANY_NAME}</span>
            </span>
            <span className="shrink-0">No. 0001</span>
          </div>
          <h1 className="mt-4 text-4xl leading-none font-bold tracking-tighter">
            Staff
            <br />
            sign-in
          </h1>
          <div className="border-ink mt-3 border-t-2">
            <div className="border-ink-2 flex items-center justify-between border-b border-dashed py-2 font-mono text-xs">
              <span>
                SKU <span className="font-semibold">STAFF-ACCESS</span>
              </span>
              <span>
                Qty <span className="font-semibold">1 seat</span>
              </span>
            </div>
          </div>
          <SignInForm next={nextPath} />
          {demo ? <DemoAccounts next={nextPath} /> : null}
          <LabelBarcode />
        </article>
      </div>
    </main>
  );
};

export default LoginPage;
