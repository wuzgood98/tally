/**
 * Pretends to be a POS till: posts a few sales to the sales API, then sends
 * the first one again to show it isn't recorded twice.
 *
 *   TALLY_TILL_KEY=tly_… pnpm till:simulate
 *
 * Optional: TALLY_URL (default http://localhost:3500), TALLY_SALES (default 5).
 * Create the key on the Tills page as head office. Uses SKUs from the demo seed.
 */

import { randomInt, randomUUID } from "node:crypto";

const url = process.env.TALLY_URL ?? "http://localhost:3500";
const key = process.env.TALLY_TILL_KEY ?? "";
const count = Number(process.env.TALLY_SALES ?? "5");

/** Everyday lines from the demo catalogue. */
const SKUS = [
  "GRN-0001",
  "GRN-0002",
  "PNT-0003",
  "PNT-0007",
  "BEV-0001",
  "BEV-0002",
  "BEV-0005",
  "CLN-0005",
  "BTY-0009",
  "STN-0001",
] as const;

const PAYMENTS = ["cash", "mobile_money", "card"] as const;

const pick = <T>(items: readonly T[]): T => {
  const item = items[randomInt(items.length)];

  if (item === undefined) {
    throw new Error("Can't pick from an empty list.");
  }

  return item;
};

const basket = () => {
  const skus = new Set(
    Array.from({ length: randomInt(1, 5) }, () => pick(SKUS))
  );

  return {
    clientRef: `SIM-${randomUUID()}`,
    lines: [...skus].map((sku) => ({ quantity: randomInt(1, 4), sku })),
    paymentMethod: pick(PAYMENTS),
  };
};

const post = async (body: ReturnType<typeof basket>): Promise<string> => {
  const response = await fetch(`${url}/api/v1/sales`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return `${response.status} ${await response.text()}`;
};

if (key === "") {
  console.error(
    "Set TALLY_TILL_KEY to a till key from the Tills page (head office)."
  );
  process.exit(1);
}

const first = basket();

console.info(`→ ${first.clientRef}: ${await post(first)}`);

for (let i = 1; i < count; i += 1) {
  const next = basket();
  // Sequential on purpose: a real till sends one sale at a time.
  // oxlint-disable-next-line no-await-in-loop -- see above
  console.info(`→ ${next.clientRef}: ${await post(next)}`);
}

console.info(`↻ resend ${first.clientRef}: ${await post(first)}`);
