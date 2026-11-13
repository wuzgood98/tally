import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DemoAccounts } from "@/components/auth/demo-accounts";
import { SignInForm } from "@/components/auth/sign-in-form";
import { TallyMark } from "@/components/brand/tally-mark";
import { JsonLd } from "@/components/seo/json-ld";
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

const LoginPage = async ({ searchParams }: PageProps<"/login">) => {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);

  if (viewer !== null) {
    redirect("/");
  }

  const nextPath = param(params, "next") || undefined;

  return (
    <main className="canvas-glow grid min-h-svh place-items-center px-4 py-12">
      <JsonLd data={appJsonLd()} />
      <div className="w-full max-w-sm">
        <div className="border-line bg-surface shadow-float rounded-2xl border p-6">
          <div className="flex items-center gap-2.5">
            <TallyMark className="text-brand size-7" />
            <div>
              <p className="text-md leading-tight font-semibold">Tally</p>
              <p className="text-ink-3 text-xs">{COMPANY_NAME} stock control</p>
            </div>
          </div>
          <h1 className="mt-7 text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-ink-3 mt-1 mb-5 text-sm">
            Use the account head office set up for you.
          </p>
          <SignInForm next={nextPath} />
        </div>
        {isDemo() ? <DemoAccounts next={nextPath} /> : null}
      </div>
    </main>
  );
};

export default LoginPage;
