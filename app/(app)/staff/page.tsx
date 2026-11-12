import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddStaffForm } from "@/components/staff/add-staff-form";
import { ToggleStaffButton } from "@/components/staff/toggle-staff-button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { canManageStaff } from "@/lib/permissions";
import { listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/site";
import { listStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Staff" };

const StaffPage = async () => {
  const viewer = await requireViewer();

  if (!canManageStaff(viewer)) {
    notFound();
  }

  const [people, branches] = await Promise.all([
    listStaff(getDb()),
    listBranches(),
  ]);

  const active = people.filter((person) => person.active).length;

  return (
    <>
      <PageHeader
        description={`${active} active accounts. Deactivating someone signs them out everywhere at once; their history stays.`}
        title="Staff"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Panel flush id="people" title="People">
          <Table>
            <caption className="sr-only">Staff accounts</caption>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Branch</Th>
                <Th numeric>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr
                  className={person.active ? undefined : "opacity-60"}
                  key={person.id}
                >
                  <Td className="min-w-56">
                    <span className="font-medium">{person.name}</span>
                    {person.id === viewer.id ? (
                      <span className="text-ink-2 text-xs"> (you)</span>
                    ) : null}
                    <span className="text-ink-2 block text-xs">
                      {person.email}
                    </span>
                  </Td>
                  <Td nowrap>
                    {ROLE_LABELS[person.role]}
                    {person.active ? null : (
                      <span className="text-ink-2 block text-xs">
                        Deactivated
                      </span>
                    )}
                  </Td>
                  <Td tone="muted" nowrap>
                    {person.branchName ?? "All branches"}
                  </Td>
                  <Td numeric>
                    {person.id === viewer.id ? null : (
                      <ToggleStaffButton
                        active={person.active}
                        name={person.name}
                        userId={person.id}
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel id="add" title="Add someone">
          <AddStaffForm
            branches={branches.map(({ id, name }) => ({ id, name }))}
          />
        </Panel>
      </div>
    </>
  );
};

export default StaffPage;
