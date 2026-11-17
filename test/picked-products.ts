import type { LookupResult, PickedProduct } from "@/app/(app)/lookup-action";

/** Products as the product picker hands them over, for component tests. */
export const pickedProduct = (id: number, name: string): PickedProduct => ({
  averageCost: null,
  barcode: null,
  id,
  name,
  onHand: {},
  sellPrice: 1000,
  sku: `GRN-000${id}`,
  unit: "each",
});

export const RICE: readonly PickedProduct[] = [
  pickedProduct(1, "Jasmine rice 5 kg"),
  pickedProduct(2, "Jasmine rice 10 kg"),
  pickedProduct(3, "Rice cooker 1.8 L"),
];

/** A lookup that answers any text with the rice matches, never exactly. */
export const lookupRice = (): LookupResult => ({ exact: null, matches: RICE });
