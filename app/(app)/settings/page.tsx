import type { Metadata } from "next";

import { CompanyForm } from "@/components/settings/company-form";
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
import { badgeBarcode } from "@/lib/badge";
import { isDemo } from "@/lib/demo";
import { formatDate } from "@/lib/format";
import { canManageCompany } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/queries/company";
import { listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };

const YOU: SettingsSection = { id: "you", label: "You" };
const COMPANY: SettingsSection = { id: "company", label: "Company" };

/** Head office sees every section; everyone else only their own. */
const EVERYONE: readonly SettingsSection[] = [YOU];
const HEAD_OFFICE: readonly SettingsSection[] = [YOU, COMPANY];

const SettingsPage = async () => {
  const viewer = await requireViewer();

  const [branches, company] = await Promise.all([
    listBranches(),
    getCompanySettings(),
  ]);

  const home = branches.find((item) => item.id === viewer.branchId);
  const role = ROLE_LABELS[viewer.role];
  const headOffice = canManageCompany(viewer);

  const previewStore =
    home?.name ?? branches.find((item) => item.kind === "store")?.name ?? "";

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav sections={headOffice ? HEAD_OFFICE : EVERYONE} />

      <section
        aria-labelledby="settings-you"
        className="grid scroll-mt-40 items-start gap-x-9 gap-y-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]"
        id="you"
      >
        <div className="lg:col-start-2 lg:row-start-1">
          <SectionHeading id="settings-you" number={1} title="You">
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

      {headOffice ? (
        <section
          aria-labelledby="settings-company"
          className="mt-14 scroll-mt-40"
          id="company"
        >
          <SectionHeading
            headOfficeOnly
            id="settings-company"
            number={2}
            title="Company"
          >
            What prints on every receipt, and where new products start.
          </SectionHeading>
          <CompanyForm
            companyName={company.companyName}
            defaultReorderPoint={company.defaultReorderPoint}
            lastSaved={
              company.saved === null
                ? null
                : `${company.saved.by} · ${formatDate(company.saved.at)}`
            }
            receiptFooter={company.receiptFooter}
            storeName={previewStore}
          />
        </section>
      ) : null}
    </>
  );
};

export default SettingsPage;
