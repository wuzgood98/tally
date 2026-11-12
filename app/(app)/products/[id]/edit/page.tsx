import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/catalogue/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { pesewasToInput } from "@/lib/money";
import { canManageCatalogue } from "@/lib/permissions";
import {
  getProduct,
  listCategories,
  listSuppliers,
} from "@/lib/queries/products";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Edit product" };

const EditProductPage = async ({
  params,
}: PageProps<"/products/[id]/edit">) => {
  const [viewer, route] = await Promise.all([requireViewer(), params]);
  const id = Number(route.id);

  if (!canManageCatalogue(viewer) || !Number.isSafeInteger(id) || id <= 0) {
    notFound();
  }

  const [item, categories, suppliers] = await Promise.all([
    getProduct(id),
    listCategories(),
    listSuppliers(),
  ]);

  if (item === null) {
    notFound();
  }

  return (
    <>
      <PageHeader
        description="Price changes apply from now on; stock already received keeps the cost it came in at."
        eyebrow={
          <Link
            className="hover:text-ink hover:underline"
            href={`/products/${item.id}`}
          >
            {item.name}
          </Link>
        }
        title="Edit product"
      />
      <ProductForm
        cancelHref={`/products/${item.id}`}
        categories={categories.map(({ department, id: categoryId, name }) => ({
          group: department,
          id: categoryId,
          name,
        }))}
        initial={{
          active: item.active,
          barcode: item.barcode ?? "",
          categoryId: String(item.categoryId),
          defaultSupplierId:
            item.defaultSupplierId === null
              ? ""
              : String(item.defaultSupplierId),
          name: item.name,
          reorderPoint: String(item.reorderPoint),
          sellPrice: pesewasToInput(item.sellPrice),
          sku: item.sku,
          unit: item.unit,
        }}
        productId={item.id}
        suppliers={suppliers}
      />
    </>
  );
};

export default EditProductPage;
