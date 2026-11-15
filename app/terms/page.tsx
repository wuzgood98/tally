import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { isDemo } from "@/lib/demo";
import { PRIVACY_PATH, TERMS_PATH, TERMS_UPDATED } from "@/lib/legal";
import { getCompanyName } from "@/lib/queries/company";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...publicPageMetadata(TERMS_PATH),
  description:
    "The rules for using Tally: who it's for, keeping your account to yourself, and the records your work leaves.",
  title: "Terms",
};

/* Written for whoever deploys Tally; not legal advice. Move TERMS_UPDATED with any change. */
const TermsPage = async () => {
  // Per request, so a new company name in Settings shows at once.
  await connection();
  const companyName = await getCompanyName();

  return (
    <LegalPage
      companyName={companyName}
      demo={isDemo()}
      page="terms"
      title="Terms of use"
      updated={TERMS_UPDATED}
    >
      <LegalSection id="who" number={1} title="Who Tally is for">
        <p>
          Tally is {companyName}&rsquo;s stock control system, for its staff
          only. There&rsquo;s no public sign-up: head office creates every
          account, decides its role and branch, and can change or deactivate it
          at any time. By signing in you agree to these terms.
        </p>
      </LegalSection>

      <LegalSection id="account" number={2} title="Your account">
        <ul>
          <li>
            Keep your password to yourself, and don&rsquo;t share your account.
          </li>
          <li>
            Sign out on a shared computer when you&rsquo;re done. Tally signs
            you out after eight hours anyway.
          </li>
          <li>
            Tell head office straight away if you think someone else has used
            your account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" number={3} title="Using Tally">
        <ul>
          <li>Use it only for {companyName}&rsquo;s work.</li>
          <li>
            Record what really happened: the count you made, the goods that
            arrived, the sale you rang up.
          </li>
          <li>
            Don&rsquo;t try to get round what your role allows, reach other
            people&rsquo;s accounts, or disrupt the service.
          </li>
          <li>
            Keep the company&rsquo;s figures, such as costs, suppliers and
            sales, inside the company.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="records" number={4} title="Records are kept">
        <p>
          Everything you record in Tally carries your name and the time, and
          stays. Stock records can&rsquo;t be edited or deleted: a mistake is
          put right with a new entry, which records who made it too.
        </p>
      </LegalSection>

      <LegalSection id="service" number={5} title="The service">
        <p>
          {companyName} provides Tally as it is. It may change features, take
          Tally offline for maintenance, or suspend an account to protect the
          company&rsquo;s records. Figures in Tally are only as good as what is
          recorded in it, so check anything important against the shelf.
        </p>
      </LegalSection>

      <LegalSection id="changes" number={6} title="Changes to these terms">
        <p>
          These terms may change. The date at the top shows when they last did,
          and carrying on using Tally after a change means you accept it. What
          Tally keeps about you is set out in the{" "}
          <Link href={PRIVACY_PATH}>privacy notice</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
};

export default TermsPage;
