import type { Metadata } from "next";
import Link from "next/link";

import { TillDataProvider } from "@/components/till/till-data-provider";
import { TillHistory } from "@/components/till/till-history";
import { PageHeader } from "@/components/ui/page-header";
import { sellableBranchIds } from "@/lib/permissions";
import { getScope, listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Earlier sales" };

const eyebrow = (
  <Link className="hover:text-ink hover:underline" href="/till">
    Till
  </Link>
);

/**
 * A store's recorded sales, a day at a time, for the people who use its
 * till. It reads from the till's on-demand history collection, so only the
 * page being looked at is fetched.
 */
const TillHistoryPage = async () => {
  const [viewer, branches] = await Promise.all([
    requireViewer(),
    listBranches(),
  ]);

  const scope = await getScope(viewer);

  const allowed = new Set(
    sellableBranchIds(
      viewer,
      branches.map((item) => item.id)
    )
  );

  const stores = branches.filter(
    (item) => item.kind === "store" && allowed.has(item.id)
  );

  if (stores.length === 0) {
    return (
      <PageHeader
        description="Earlier sales are for cashiers and managers at a store."
        eyebrow={eyebrow}
        title="Earlier sales"
      />
    );
  }

  const scoped = scope.kind === "branch" ? scope.branchId : "";

  const defaultStoreId =
    [scoped, viewer.branchId ?? ""].find((id) =>
      stores.some((store) => store.id === id)
    ) ??
    stores[0]?.id ??
    "";

  return (
    <>
      <PageHeader
        description="Every sale recorded at the store, a day at a time."
        eyebrow={eyebrow}
        title="Earlier sales"
      />
      <TillDataProvider userId={viewer.id}>
        <TillHistory
          defaultStoreId={defaultStoreId}
          stores={stores.map(({ id, name }) => ({ id, name }))}
        />
      </TillDataProvider>
    </>
  );
};

export default TillHistoryPage;
