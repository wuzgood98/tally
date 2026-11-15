import type { Metadata } from "next";

import { AskTallySwitch } from "@/components/settings/ask-tally-switch";
import { CompanyForm } from "@/components/settings/company-form";
import { OfficeLinks } from "@/components/settings/office-links";
import { SectionHeading } from "@/components/settings/section-heading";
import { SettingsNav } from "@/components/settings/settings-nav";
import type { SettingsSection } from "@/components/settings/settings-nav";
import { SidebarSetting } from "@/components/settings/sidebar-setting";
import { StaffBadge } from "@/components/settings/staff-badge";
import { ThemePicker } from "@/components/settings/theme-picker";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
} from "@/components/ui/frame";
import { PageHeader } from "@/components/ui/page-header";
import { ASK_HOURLY_LIMIT, askTallyState } from "@/lib/ask/settings";
import { badgeBarcode } from "@/lib/badge";
import type { Stamp } from "@/lib/company";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { formatDate } from "@/lib/format";
import {
  canManageAskTally,
  canManageCompany,
  canManageStaff,
  canManageTills,
} from "@/lib/permissions";
import { getCompanySettings } from "@/lib/queries/company";
import { listTills } from "@/lib/queries/tills";
import { listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/site";
import { listStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Settings" };

const YOU: SettingsSection = { id: "you", label: "You" };
const COMPANY: SettingsSection = { id: "company", label: "Company" };
const ASK: SettingsSection = { id: "ask-tally", label: "Ask Tally" };
const OFFICE: SettingsSection = { id: "staff-tills", label: "Staff & Tills" };

/** "Efua Asante on 15 Nov 2026", or null if nobody has. */
const stampLabel = (stamp: Stamp | null): string | null =>
  stamp === null ? null : `${stamp.by} on ${formatDate(stamp.at)}`;

const SettingsPage = async () => {
  const [viewer, branches, company] = await Promise.all([
    requireViewer(),
    listBranches(),
    getCompanySettings(),
  ]);

  const home = branches.find((item) => item.id === viewer.branchId);
  const role = ROLE_LABELS[viewer.role];

  // Everyone has You; each other section is shown to whoever may change it.
  const show = {
    ask: canManageAskTally(viewer),
    company: canManageCompany(viewer),
    staff: canManageStaff(viewer),
    tills: canManageTills(viewer),
  };

  // Its cards link to both pages, so it needs both.
  const office = show.staff && show.tills;

  const sections: readonly SettingsSection[] = [
    YOU,
    ...(show.company ? [COMPANY] : []),
    ...(show.ask ? [ASK] : []),
    ...(office ? [OFFICE] : []),
  ];

  /** Numbered in the order shown, so nobody sees a gap. */
  const numberOf = (section: SettingsSection): number =>
    sections.indexOf(section) + 1;

  // Only those who see the Staff & Tills cards pay for them.
  const [people, tills] = office
    ? await Promise.all([listStaff(getDb()), listTills()])
    : [[], []];

  const activeStaff = people.filter((person) => person.active).length;
  const liveTills = tills.filter((item) => item.revokedAt === null).length;

  const previewStore =
    home?.name ?? branches.find((item) => item.kind === "store")?.name ?? "";

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav sections={sections} />

      <section
        aria-labelledby="settings-you"
        className="grid scroll-mt-40 items-start gap-x-9 gap-y-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]"
        id="you"
      >
        <div className="lg:col-start-2 lg:row-start-1">
          <SectionHeading id="settings-you" number={numberOf(YOU)} title="You">
            Your badge is how Tally knows you. Write your name on it, or turn it
            over to change your password.
          </SectionHeading>
        </div>
        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <StaffBadge
            barcode={badgeBarcode(viewer.id)}
            branch={home?.name ?? "All branches"}
            company={company.companyName}
            demo={isDemo()}
            email={viewer.email}
            name={viewer.name}
            role={role}
            staffCode={`${home?.id ?? "HQ"} · ${role.toUpperCase()}`}
          />
        </div>
        <Frame className="lg:col-start-2">
          <FrameHeader>
            <h3 className="text-sm font-medium">How Tally looks</h3>
            <FrameDescription>
              Only on this device. Changes apply as you pick them.
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            <ThemePicker />
          </FramePanel>
          <FramePanel>
            <SidebarSetting />
          </FramePanel>
        </Frame>
      </section>

      {show.company ? (
        <section
          aria-labelledby="settings-company"
          className="mt-14 scroll-mt-40"
          id="company"
        >
          <SectionHeading
            headOfficeOnly
            id="settings-company"
            number={numberOf(COMPANY)}
            title="Company"
          >
            What prints on every receipt, and where new products start.
          </SectionHeading>
          <CompanyForm
            companyName={company.companyName}
            defaultReorderPoint={company.defaultReorderPoint}
            lastSaved={stampLabel(company.saved)}
            receiptFooter={company.receiptFooter}
            storeName={previewStore}
          />
        </section>
      ) : null}

      {show.ask ? (
        <section
          aria-labelledby="settings-ask"
          className="mt-14 scroll-mt-40 lg:max-w-[calc(100%-22.25rem)]"
          id="ask-tally"
        >
          <SectionHeading
            headOfficeOnly
            id="settings-ask"
            number={numberOf(ASK)}
            title="Ask Tally"
          >
            Questions about stock in plain words, from the command palette.
          </SectionHeading>
          <AskTallySwitch
            hourlyLimit={ASK_HOURLY_LIMIT}
            state={askTallyState(company.askTally.on)}
            turnedOn={stampLabel(company.askTally.turnedOn)}
          />
        </section>
      ) : null}

      {office ? (
        <section
          aria-labelledby="settings-office"
          className="mt-14 scroll-mt-40 lg:max-w-[calc(100%-22.25rem)]"
          id="staff-tills"
        >
          <SectionHeading
            headOfficeOnly
            id="settings-office"
            number={numberOf(OFFICE)}
            title="Staff & Tills"
          >
            Who has a badge, and which counters can sell. Each has its own page.
          </SectionHeading>
          <OfficeLinks
            staff={{
              active: activeStaff,
              deactivated: people.length - activeStaff,
            }}
            tills={{ active: liveTills, revoked: tills.length - liveTills }}
          />
        </section>
      ) : null}
    </>
  );
};

export default SettingsPage;
