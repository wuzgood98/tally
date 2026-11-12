import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddTillForm } from "@/components/tills/add-till-form";
import { RevokeTillButton } from "@/components/tills/revoke-till-button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { canManageTills } from "@/lib/permissions";
import { listTills } from "@/lib/queries/tills";
import { listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Tills" };

const EXAMPLE = `curl -X POST https://<your Tally>/api/v1/sales \\
  -H "Authorization: Bearer tly_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientRef": "RCPT-2026-000123",
    "paymentMethod": "mobile_money",
    "lines": [
      { "sku": "PNT-0007", "quantity": 2 },
      { "barcode": "6030001000017", "quantity": 1, "unitPrice": 1450 }
    ]
  }'`;

const LastUsed = ({ at }: { readonly at: Date | null }) =>
  at === null ? (
    <span className="text-ink-3">Never</span>
  ) : (
    <time className="tabular" dateTime={isoString(at)}>
      {formatDateTime(at)}
    </time>
  );

const TillsPage = async () => {
  const viewer = await requireViewer();

  if (!canManageTills(viewer)) {
    notFound();
  }

  const [tills, branches] = await Promise.all([listTills(), listBranches()]);

  const stores = branches.flatMap((item) =>
    item.kind === "store" ? [{ id: item.id, name: item.name }] : []
  );

  return (
    <>
      <PageHeader
        description="POS tills that post sales to Tally through the sales API. Each has its own key; revoking one stops it at once."
        title="Tills"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="grid min-w-0 gap-6">
          <Panel flush id="tills" title="Tills">
            {tills.length === 0 ? (
              <p className="text-ink-2 p-8 text-center text-sm">
                No tills yet. The in-app till doesn&rsquo;t need one; add one
                for each POS machine that will post sales.
              </p>
            ) : (
              <Table>
                <caption className="sr-only">POS tills and their keys</caption>
                <thead>
                  <tr>
                    <Th>Till</Th>
                    <Th>Store</Th>
                    <Th>Key</Th>
                    <Th>Last sale</Th>
                    <Th numeric>Sales</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {tills.map((row) => (
                    <tr key={row.id}>
                      <Td className="min-w-40">
                        <span className="font-medium">{row.name}</span>
                        {row.revokedAt === null ? null : (
                          <span className="text-danger block text-xs">
                            Revoked {formatDateTime(row.revokedAt)}
                          </span>
                        )}
                      </Td>
                      <Td nowrap>{row.branchName}</Td>
                      <Td nowrap tone="muted">
                        <span className="font-mono text-xs">
                          {row.keyPrefix}…
                        </span>
                      </Td>
                      <Td nowrap tone="muted">
                        <LastUsed at={row.lastUsedAt} />
                      </Td>
                      <Td numeric>{formatCount(row.sales)}</Td>
                      <Td nowrap>
                        {row.revokedAt === null ? (
                          <RevokeTillButton name={row.name} tillId={row.id} />
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          <Panel id="api" title="How a till posts a sale">
            <div className="grid gap-3 text-sm">
              <p className="text-ink-2">
                <code className="font-mono">POST /api/v1/sales</code> with the
                till&rsquo;s key. Products go by SKU or barcode. Prices are in
                pesewas; leave <code className="font-mono">unitPrice</code> out
                to charge the shelf price.{" "}
                <code className="font-mono">clientRef</code> is the till&rsquo;s
                own receipt number: sending the same one again returns the first
                sale (200) instead of recording it twice (201).
              </p>
              <pre className="bg-surface-2 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
                {EXAMPLE}
              </pre>
              <p className="text-ink-2">
                To try it locally, run{" "}
                <code className="font-mono">
                  TALLY_TILL_KEY=tly_… pnpm till:simulate
                </code>
                .
              </p>
            </div>
          </Panel>
        </div>

        <Panel id="add" title="Add a till">
          <AddTillForm stores={stores} />
        </Panel>
      </div>
    </>
  );
};

export default TillsPage;
