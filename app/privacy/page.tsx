import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { StorageTable } from "@/components/legal/storage-table";
import { isDemo } from "@/lib/demo";
import {
  PRIVACY_EMAIL,
  PRIVACY_PATH,
  PRIVACY_UPDATED,
  TERMS_PATH,
} from "@/lib/legal";
import { getCompanyName } from "@/lib/queries/company";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...publicPageMetadata(PRIVACY_PATH),
  description:
    "What Tally keeps about the staff who use it, why, who else sees it and how long it stays.",
  title: "Privacy",
};

/*
 * Written for whoever deploys Tally; not legal advice. Keep it true to the
 * code: if Tally starts storing or sending something new, say so here and
 * move PRIVACY_UPDATED.
 */
const PrivacyPage = async () => {
  // Per request, so a new company name in Settings shows at once.
  await connection();
  const companyName = await getCompanyName();

  return (
    <LegalPage
      companyName={companyName}
      demo={isDemo()}
      page="privacy"
      title="Privacy notice"
      updated={PRIVACY_UPDATED}
    >
      <LegalSection id="who" number={1} title="Who looks after your data">
        <p>
          {companyName} runs this copy of Tally for its staff and decides how
          the data in it is used. Under Ghana&rsquo;s Data Protection Act, 2012
          (Act 843), {companyName} is the data controller. This notice covers
          the people who sign in to Tally: head office, branch managers,
          storekeepers and cashiers.
        </p>
      </LegalSection>

      <LegalSection id="collect" number={2} title="What Tally keeps">
        <ul>
          <li>
            <strong>Your account:</strong> your name, work email, role and
            branch, set up by head office, and your password, stored only as a
            one-way hash that nobody can read back.
          </li>
          <li>
            <strong>Your sign-ins:</strong> for each device you sign in on, the
            time, its IP address and the browser it reports.
          </li>
          <li>
            <strong>Your work:</strong> every delivery, count, write-off,
            transfer, order, request, sale and approval records who did it and
            when.
          </li>
        </ul>
        <p>
          Tally keeps <strong>nothing about customers</strong>. A sale records
          what was sold, the price and how it was paid, never who bought it.
        </p>
      </LegalSection>

      <LegalSection id="why" number={3} title="Why">
        <ul>
          <li>To let you sign in and to show you what your role allows.</li>
          <li>
            To keep stock records the company can trust: when stock goes missing
            or a figure looks wrong, the record of who did what is how it gets
            found and fixed.
          </li>
          <li>
            To keep accounts safe, for example by signing you out after a shift
            and letting you sign out your other devices.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" number={4} title="How long it stays">
        <p>A sign-in lasts for at most eight hours, or until you sign out.</p>
        <p>
          When someone leaves, head office deactivates their account. They can
          no longer sign in, but{" "}
          <strong>their name stays on the records they made</strong>.
          Tally&rsquo;s stock records can&rsquo;t be edited or deleted, by
          design: a mistake is corrected with a new entry, so the history always
          shows who did what. These records are kept for as long as{" "}
          {companyName} keeps its stock and sales records.
        </p>
      </LegalSection>

      <LegalSection id="sharing" number={5} title="Where data goes">
        <p>
          Tally runs on {companyName}&rsquo;s hosting and database providers,
          who store it on the company&rsquo;s behalf. It isn&rsquo;t sold or
          shared for advertising.
        </p>
        <p>
          <strong>Ask Tally</strong>, the assistant in the command palette, is
          off unless head office switches it on. While it&rsquo;s on, each
          question, with the figures needed to answer it (product names, stock
          levels, costs, branch names and staff names on documents), is sent to
          OpenRouter and the company that hosts the AI model. Some free
          models&rsquo; hosts may keep or learn from what they&rsquo;re sent.
          Cashiers don&rsquo;t have Ask Tally.
        </p>
      </LegalSection>

      <LegalSection id="cookies" number={6} title="Cookies and storage">
        <p>
          Tally stores only what it needs to work. There&rsquo;s no analytics
          and no advertising tracking.
        </p>
        <StorageTable />
      </LegalSection>

      <LegalSection id="rights" number={7} title="Your rights">
        <p>
          You can ask {companyName} to see the personal data Tally holds about
          you, and to correct anything that&rsquo;s wrong. You can change your
          own name and password on the Settings page. Write to{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
        <p>
          If you&rsquo;re not happy with the answer, you can complain to
          Ghana&rsquo;s Data Protection Commission.
        </p>
        <p>
          How you may use Tally is set out in the{" "}
          <Link href={TERMS_PATH}>terms of use</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
};

export default PrivacyPage;
