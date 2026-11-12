import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DemoAccounts } from "@/components/auth/demo-accounts";
import { SignInForm } from "@/components/auth/sign-in-form";
import { TallyMark } from "@/components/brand/tally-mark";
import { isDemo } from "@/lib/demo";
import { param } from "@/lib/search-params";
import { getViewer } from "@/lib/session";
import { COMPANY_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in" };

const LoginPage = async ({ searchParams }: PageProps<"/login">) => {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);

  if (viewer !== null) {
    redirect("/");
  }

  const nextPath = param(params, "next") || undefined;

  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <TallyMark className="text-brand size-8" />
          <div>
            <p className="text-lg leading-tight font-semibold">Tally</p>
            <p className="text-ink-2 text-xs">{COMPANY_NAME} stock control</p>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-ink-2 mt-1 mb-6 text-sm">
          Use the account head office set up for you.
        </p>
        <SignInForm next={nextPath} />
        {isDemo() ? <DemoAccounts next={nextPath} /> : null}
      </div>
    </main>
  );
};

export default LoginPage;
