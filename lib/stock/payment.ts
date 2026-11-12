/**
 * How a customer pays. Kept free of the database schema so the till screen
 * can import it without bundling Drizzle; the type ties it to the pg enum.
 */

import type { PaymentMethod } from "@/lib/db/schema";

export const PAYMENT_METHODS = [
  "cash",
  "mobile_money",
  "card",
] as const satisfies readonly PaymentMethod[];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card: "Card",
  cash: "Cash",
  mobile_money: "Mobile money",
};
