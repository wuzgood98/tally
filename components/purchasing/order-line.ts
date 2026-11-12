import type { PickedProduct } from "@/app/(app)/lookup-action";
import type { DraftLine } from "@/components/stock/receipt-line-row";
import { pesewasToInput } from "@/lib/money";

/**
 * A purchase order line as the form edits it, starting at the product's
 * average cost as the price to agree on. Shared by the form and the pages
 * that pre-fill it, so it lives outside the client component.
 */
export const orderLine = (product: PickedProduct, quantity = 1): DraftLine => ({
  cost: pesewasToInput(product.averageCost),
  product,
  quantity: String(quantity),
});
