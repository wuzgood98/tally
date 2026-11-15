import type { Metadata } from "next";

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
import { listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { COMPANY_NAME, ROLE_LABELS } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS: readonly SettingsSection[] = [{ id: "you", label: "You" }];

const SettingsPage = async () => {
  const viewer = await requireViewer();
  const branches = await listBranches();
  const home = branches.find((item) => item.id === viewer.branchId);
  const role = ROLE_LABELS[viewer.role];

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav sections={SECTIONS} />

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
            company={COMPANY_NAME}
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
    </>
  );
};

export default SettingsPage;
