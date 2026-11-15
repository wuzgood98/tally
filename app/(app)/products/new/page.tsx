import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/catalogue/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { canManageCatalogue } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/queries/company";
import { listCategories, listSuppliers } from "@/lib/queries/products";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "New product" };

const NewProductPage = async () => {
  const viewer = await requireViewer();

  if (!canManageCatalogue(viewer)) {
    notFound();
  }

  const [categories, suppliers, company] = await Promise.all([
    listCategories(),
    listSuppliers(),
    getCompanySettings(),
  ]);

  return (
    <>
      <PageHeader
        description="It starts with no stock anywhere. Stock arrives through Receive goods."
        eyebrow={
          <Link className="hover:text-ink hover:underline" href="/products">
            Products
          </Link>
        }
        title="New product"
      />
      <ProductForm
        cancelHref="/products"
        categories={categories.map(({ department, id, name }) => ({
          group: department,
          id,
          name,
        }))}
        initial={{
          active: true,
          barcode: "",
          categoryId: "",
          defaultSupplierId: "",
          name: "",
          // Head office's default, from the settings page.
          reorderPoint: String(company.defaultReorderPoint),
          sellPrice: "",
          sku: "",
          unit: "each",
        }}
        productId={null}
        suppliers={suppliers}
      />
    </>
  );
};

export default NewProductPage;
