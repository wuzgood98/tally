import type { Metadata } from "next";
import Link from "next/link";

import { TillForm, TillSample } from "@/components/sales/till-form";
import { TillDataProvider } from "@/components/till/till-data-provider";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/lib/db";
import { sellableBranchIds } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/queries/company";
import { getScope, listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { getTillSales } from "@/lib/till/api";

export const metadata: Metadata = { title: "Till" };

const TillPage = async () => {
  const viewer = await requireViewer();

  // Today's sales only shape the loading skeleton: the till fetches its own.
  const [branches, scope, company, salesToday] = await Promise.all([
    listBranches(),
    getScope(viewer),
    getCompanySettings(),
    getTillSales(getDb(), viewer),
  ]);

  const allowed = new Set(
    sellableBranchIds(
      viewer,
      branches.map((item) => item.id)
    )
  );

  // Only stores have tills; the warehouse doesn't sell to customers.
  const stores = branches.filter(
    (item) => item.kind === "store" && allowed.has(item.id)
  );

  if (stores.length === 0) {
    return (
      <PageHeader
        description="The till is for cashiers and managers at a store."
        title="Till"
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

  const tillStores = stores.map(({ id, name }) => ({ id, name }));

  return (
    <>
      <PageHeader
        description="Stock comes off the shelf record the moment a sale is charged."
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/sales">
            Sales
          </Link>
        }
        title="Till"
      />
      <TillDataProvider
        id="till"
        label="Loading the till"
        sample={
          <TillSample
            defaultStoreId={defaultStoreId}
            receiptFooter={company.receiptFooter}
            salesToday={salesToday.filter(
              (sale) => sale.branchId === defaultStoreId
            )}
            stores={tillStores}
          />
        }
        userId={viewer.id}
      >
        <TillForm
          cashierId={viewer.id}
          defaultStoreId={defaultStoreId}
          receiptFooter={company.receiptFooter}
          stores={tillStores}
        />
      </TillDataProvider>
    </>
  );
};

export default TillPage;
