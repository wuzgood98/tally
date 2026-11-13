/**
 * Fills an empty database with Akwaaba Mall's demo data. Deterministic: the
 * same seed always produces the same catalogue, stock and history, so
 * screenshots and bug reports line up.
 *
 * Opening stock is written directly (one "opening" movement per shelf); the
 * last month's deliveries, adjustments and transfers go through the real
 * receiveGoods, adjustStock and transfer functions, then are backdated, so the
 * history obeys every business rule. A couple of transfers are left on the
 * road, so "on the way" has something to show.
 */

import { hashPassword } from "better-auth/crypto";
// Seeding is deliberately sequential: every draw from the one seeded generator,
// and every write, happens in the same order each run so the data repeats.
// mulberry32 itself is defined in 32-bit integer operations.
/* oxlint-disable no-bitwise, no-await-in-loop, react-doctor/async-await-in-loop -- see above */
import { and, eq, inArray, sql } from "drizzle-orm";

import { gtinCheckDigit } from "@/lib/barcode";
import type { Db } from "@/lib/db/client";
import {
  account,
  branch,
  category,
  goodsReceipt,
  product,
  sale,
  saleLine,
  saleReturn,
  stockLevel,
  stockMovement,
  stockTransfer,
  stockTransferLine,
  supplier,
  user,
} from "@/lib/db/schema";
import {
  BRANCHES,
  CATALOGUE,
  DEMO_PASSWORD,
  STAFF,
  SUPPLIERS,
} from "@/lib/db/seed-data";
import {
  isPurchasingEvent,
  planPurchasing,
  runPurchasingEvent,
} from "@/lib/db/seed-purchasing";
import type { PurchasingEvent } from "@/lib/db/seed-purchasing";
import type { Actor } from "@/lib/permissions";
import { adjustStock } from "@/lib/stock/adjust";
import { StockError } from "@/lib/stock/errors";
import { receiveGoods } from "@/lib/stock/receive";
import { returnSale } from "@/lib/stock/returns";
import { recordSale } from "@/lib/stock/sales";
import {
  cancelTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/lib/stock/transfer";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;
const OPENING_DAYS_AGO = 35;
const INSERT_CHUNK = 400;

/** mulberry32: small, fast and good enough for demo data. */
const createRandom = (seed: number) => {
  let state = seed;

  const draw = (): number => {
    state = Math.imul(state + 0x6d_2b_79_f5, 1);
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    between: (min: number, max: number): number => min + draw() * (max - min),
    chance: (probability: number): boolean => draw() < probability,
    int: (min: number, max: number): number =>
      Math.floor(min + draw() * (max - min + 1)),
    next: draw,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(draw() * items.length)];

      if (item === undefined) {
        throw new Error("Can't pick from an empty list.");
      }

      return item;
    },
  };
};

type Random = ReturnType<typeof createRandom>;

const makeBarcode = (
  random: Random,
  index: number,
  imported: boolean
): string => {
  const prefix = imported ? `69${random.int(0, 5)}` : "603";
  const body = `${prefix}${String(index).padStart(4, "0")}${String(random.int(0, 99_999)).padStart(5, "0")}`;

  return `${body}${gtinCheckDigit(body)}`;
};

/** Shelf prices end in .00 or .50 under GH₵100 and in whole fives above. */
const shelfPrice = (cedis: number): number => {
  if (cedis < 100) {
    return Math.round(cedis * 2) * 50;
  }

  return Math.round(cedis / 5) * 500;
};

/** Hand-made goods from these suppliers have no barcode. */
const UNBARCODED = new Set(["Adinkra Home & Linen", "Lagos Textile Mills"]);

const chunks = <T>(items: readonly T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }

  return result;
};

interface SeededProduct {
  readonly id: number;
  /** False for the discontinued lines, which can't be ordered or requested. */
  readonly active: boolean;
  readonly cost: number;
  readonly reorder: number;
  readonly supplierId: number;
  readonly categoryIndex: number;
}

const seedCatalogue = async (
  db: Db,
  random: Random
): Promise<SeededProduct[]> => {
  const suppliers = await db
    .insert(supplier)
    .values([...SUPPLIERS])
    .returning({ id: supplier.id, name: supplier.name });

  const supplierIds = new Map(suppliers.map((row) => [row.name, row.id]));

  const categories = await db
    .insert(category)
    .values(CATALOGUE.map(({ department, name }) => ({ department, name })))
    .returning({ id: category.id, name: category.name });

  const categoryIds = new Map(categories.map((row) => [row.name, row.id]));

  const rows: (typeof product.$inferInsert)[] = [];
  const meta: Omit<SeededProduct, "id" | "active">[] = [];

  for (const [categoryIndex, seedCategory] of CATALOGUE.entries()) {
    let sequence = 0;

    for (const line of seedCategory.lines) {
      const variants = line.variants ?? [""];

      for (const [variantIndex, variant] of variants.entries()) {
        sequence += 1;

        const sellPrice = shelfPrice(
          line.price * (line.step ?? 1.2) ** variantIndex
        );

        const cost = Math.round(sellPrice * random.between(0.6, 0.78));
        const supplierId = supplierIds.get(line.supplier);
        const categoryId = categoryIds.get(seedCategory.name);

        if (supplierId === undefined || categoryId === undefined) {
          throw new Error(
            `Seed data refers to an unknown supplier or category.`
          );
        }

        rows.push({
          barcode: UNBARCODED.has(line.supplier)
            ? null
            : makeBarcode(random, rows.length + 1, line.imported === true),
          categoryId,
          defaultSupplierId: supplierId,
          name: line.name.replace("{v}", variant).trim(),
          reorderPoint: line.reorder,
          sellPrice,
          sku: `${seedCategory.code}-${String(sequence).padStart(4, "0")}`,
          unit: line.unit ?? "each",
        });
        meta.push({ categoryIndex, cost, reorder: line.reorder, supplierId });
      }
    }
  }

  // A couple of discontinued lines, so the catalogue shows what that looks like.
  const discontinued = new Set([5, 61]);

  const inserted = await db
    .insert(product)
    .values(
      rows.map((row, index) => ({ ...row, active: !discontinued.has(index) }))
    )
    .returning({ id: product.id });

  return inserted.map((row, index) => {
    const info = meta[index];

    if (info === undefined) {
      throw new Error("Product metadata out of step with inserted rows.");
    }

    return { ...info, active: !discontinued.has(index), id: row.id };
  });
};

interface SeedStaff {
  readonly managers: ReadonlyMap<string, Actor>;
  readonly cashiers: ReadonlyMap<string, Actor>;
  /** Approves purchase orders. */
  readonly headOffice: Actor;
}

const seedStaff = async (db: Db): Promise<SeedStaff> => {
  const managers = new Map<string, Actor>();
  const cashiers = new Map<string, Actor>();
  let headOffice: Actor | null = null;

  for (const [index, person] of STAFF.entries()) {
    const id = `seed-user-${String(index + 1).padStart(2, "0")}`;
    const password = await hashPassword(DEMO_PASSWORD);
    await db.insert(user).values({ ...person, emailVerified: true, id });
    await db.insert(account).values({
      accountId: id,
      id: `seed-account-${index + 1}`,
      password,
      providerId: "credential",
      userId: id,
    });

    if (person.role === "manager" && person.branchId) {
      managers.set(person.branchId, {
        branchId: person.branchId,
        id,
        role: "manager",
      });
    }

    if (person.role === "admin" && headOffice === null) {
      headOffice = { branchId: null, id, role: "admin" };
    }

    if (person.role === "cashier" && person.branchId) {
      cashiers.set(person.branchId, {
        branchId: person.branchId,
        id,
        role: "cashier",
      });
    }
  }

  if (headOffice === null) {
    throw new Error("The demo staff need someone at head office.");
  }

  return { cashiers, headOffice, managers };
};

/** How many of a product a shelf starts with: mostly healthy, some low, a few empty. */
const openingQuantity = (
  random: Random,
  reorder: number,
  isWarehouse: boolean
): number => {
  if (isWarehouse) {
    return Math.round(reorder * random.between(6, 12));
  }

  if (random.chance(0.04)) {
    return 0;
  }

  if (random.chance(0.12)) {
    return Math.max(1, Math.round(reorder * random.between(0.2, 0.95)));
  }

  return Math.round(reorder * random.between(1.4, 3.2));
};

const seedOpeningStock = async (
  db: Db,
  random: Random,
  products: readonly SeededProduct[],
  openedAt: Date
): Promise<void> => {
  const levels: (typeof stockLevel.$inferInsert)[] = [];
  const movements: (typeof stockMovement.$inferInsert)[] = [];

  for (const seedBranch of BRANCHES) {
    const isWarehouse = seedBranch.kind === "warehouse";

    for (const item of products) {
      // Stores don't carry every line; the warehouse does.
      if (!isWarehouse && random.chance(0.06)) {
        continue;
      }

      const onHand = openingQuantity(random, item.reorder, isWarehouse);
      levels.push({
        binLocation: `${isWarehouse ? "R" : "A"}${item.categoryIndex + 1}-${random.int(1, 24)}-${random.int(1, 5)}`,
        branchId: seedBranch.id,
        onHand,
        productId: item.id,
        // The warehouse holds buffer stock, so its threshold is higher.
        reorderPoint: isWarehouse ? item.reorder * 5 : null,
      });

      if (onHand > 0) {
        movements.push({
          balanceAfter: onHand,
          branchId: seedBranch.id,
          createdAt: openedAt,
          kind: "opening",
          note: "Opening balance from stock take",
          productId: item.id,
          quantity: onHand,
          unitCost: item.cost,
        });
      }
    }
  }

  for (const chunk of chunks(levels, INSERT_CHUNK)) {
    await db.insert(stockLevel).values(chunk);
  }

  for (const chunk of chunks(movements, INSERT_CHUNK)) {
    await db.insert(stockMovement).values(chunk);
  }

  for (const item of products) {
    await db
      .update(product)
      .set({ averageCost: item.cost })
      .where(eq(product.id, item.id));
  }
};

type HistoryEvent =
  | {
      readonly at: Date;
      readonly kind: "receipt";
      readonly branchId: string;
      readonly supplierId: number;
    }
  | {
      readonly at: Date;
      readonly kind: "adjustment";
      readonly branchId: string;
    }
  | {
      readonly at: Date;
      readonly kind: "dispatch";
      /** Links the later arrival or cancellation to this transfer. */
      readonly key: number;
      readonly branchId: string;
      readonly toBranchId: string;
    }
  | {
      readonly at: Date;
      readonly kind: "arrival";
      readonly key: number;
      /** A carton goes missing on the way. */
      readonly short: boolean;
    }
  | { readonly at: Date; readonly kind: "cancel"; readonly key: number }
  | {
      readonly at: Date;
      readonly kind: "sale";
      readonly branchId: string;
      /** Sell more than the record holds, so "Needs a count" has an example. */
      readonly oversell: boolean;
    }
  | { readonly at: Date; readonly kind: "return"; readonly branchId: string }
  | PurchasingEvent;

const WAREHOUSE_ID = "TMA";

/** Sales per store per day, inclusive range: scaled down so PGlite seeds quickly. */
const SALES_PER_DAY = [6, 10] as const;

/**
 * How products sell, from the few best sellers to the long tail. A tier's
 * `boost` is how much more often its lines land in a basket than the long
 * tail's; `pack` is a basket line as a share of the reorder point (traders
 * buy best sellers by the carton); `share` is the chance a line falls in it.
 */
const DEMAND_TIERS = [
  { boost: 5, pack: [0.05, 0.15], share: 0.15 },
  { boost: 2.5, pack: [0.04, 0.14], share: 0.25 },
  { boost: 1, pack: [0.01, 0.05], share: 1 },
] as const;

type DemandTier = (typeof DEMAND_TIERS)[number];

const RETURNS_PER_STORE = 4;

/** Mobile money is as common as cash in Ghana; cards much less so. */
const PAYMENT_MIX = [
  "mobile_money",
  "mobile_money",
  "mobile_money",
  "cash",
  "cash",
  "cash",
  "card",
] as const;

const RETURN_REASONS = [
  "Wrong size; customer exchanged it",
  "Bought two by mistake",
  "Faulty out of the box",
  "Customer changed their mind, unopened",
] as const;

/** Hours from dispatch to the receiving branch counting it in. */
const TRANSIT_HOURS = new Map([
  ["AMS", 20],
  ["ASH", 18],
  ["KSI", 44],
  ["SPX", 20],
  ["WJA", 22],
]);

const HOUR_MS = 3_600_000;

/**
 * The month's transfers: two top-ups from the warehouse to every store, one
 * store helping another, one called back the same day, and two still on the
 * road. Kumasi's first top-up arrives a carton short.
 */
const planTransfers = (
  random: Random,
  during: (day: number) => Date,
  now: Date
): HistoryEvent[] => {
  const events: HistoryEvent[] = [];
  let key = 0;

  const send = (
    from: string,
    to: string,
    at: Date,
    then: "arrival" | "cancel" | null,
    afterHours: number,
    short = false
  ): void => {
    key += 1;
    events.push({ at, branchId: from, key, kind: "dispatch", toBranchId: to });

    const later = new Date(at.getTime() + afterHours * HOUR_MS);

    if (then === "arrival") {
      events.push({ at: later, key, kind: "arrival", short });
    }

    if (then === "cancel") {
      events.push({ at: later, key, kind: "cancel" });
    }
  };

  for (const seedBranch of BRANCHES) {
    if (seedBranch.kind === "warehouse") {
      continue;
    }

    const hours = TRANSIT_HOURS.get(seedBranch.id) ?? 20;

    for (const [round, days] of [
      [0, [2, 12]],
      [1, [14, 24]],
    ] as const) {
      send(
        WAREHOUSE_ID,
        seedBranch.id,
        during(random.int(days[0], days[1])),
        "arrival",
        hours,
        seedBranch.id === "KSI" && round === 0
      );
    }
  }

  send("WJA", "ASH", during(random.int(8, 20)), "arrival", 6);
  send("AMS", "WJA", during(random.int(8, 20)), "cancel", 3);

  // Still on the road: dispatched this morning and yesterday.
  send(WAREHOUSE_ID, "SPX", new Date(now.getTime() - 5 * HOUR_MS), null, 0);
  send(WAREHOUSE_ID, "KSI", new Date(now.getTime() - 26 * HOUR_MS), null, 0);

  return events;
};

/** A few sales per store per day, today included, and a handful of returns. */
const planSales = (
  random: Random,
  during: (day: number) => Date
): HistoryEvent[] => {
  const events: HistoryEvent[] = [];

  for (const seedBranch of BRANCHES) {
    if (seedBranch.kind === "warehouse") {
      continue;
    }

    for (let day = 0; day <= HISTORY_DAYS; day += 1) {
      const sales = random.int(SALES_PER_DAY[0], SALES_PER_DAY[1]);

      for (let i = 0; i < sales; i += 1) {
        events.push({
          at: during(day),
          branchId: seedBranch.id,
          kind: "sale",
          oversell:
            seedBranch.id === "SPX" && day === HISTORY_DAYS - 1 && i === 0,
        });
      }
    }

    for (let i = 0; i < RETURNS_PER_STORE; i += 1) {
      events.push({
        at: during(random.int(3, HISTORY_DAYS)),
        branchId: seedBranch.id,
        kind: "return",
      });
    }
  }

  return events;
};

const planHistory = (
  random: Random,
  supplierIds: readonly number[],
  now: Date
): HistoryEvent[] => {
  const events: HistoryEvent[] = [];
  const startOfHistory = now.getTime() - HISTORY_DAYS * DAY_MS;

  // Opening hours are roughly 08:00–20:00 Accra time (GMT, no daylight saving).
  const during = (day: number): Date => {
    const midnight =
      Math.floor((startOfHistory + day * DAY_MS) / DAY_MS) * DAY_MS;

    return new Date(midnight + random.int(8 * 60, 19 * 60) * 60_000);
  };

  for (const seedBranch of BRANCHES) {
    const deliveries = seedBranch.kind === "warehouse" ? 10 : 7;

    for (let i = 0; i < deliveries; i += 1) {
      events.push({
        at: during(random.int(0, HISTORY_DAYS - 1)),
        branchId: seedBranch.id,
        kind: "receipt",
        supplierId: random.pick(supplierIds),
      });
    }

    for (let i = 0; i < 6; i += 1) {
      events.push({
        at: during(random.int(0, HISTORY_DAYS - 1)),
        branchId: seedBranch.id,
        kind: "adjustment",
      });
    }
  }

  const purchasing = planPurchasing(random, during, now);

  events.push(
    ...planTransfers(random, during, now),
    ...planSales(random, during),
    ...purchasing.events,
    ...purchasing.arrivals.map(({ at, transferKey }): HistoryEvent => ({
      at,
      key: transferKey,
      kind: "arrival",
      short: false,
    }))
  );

  return events
    .filter((event) => event.at.getTime() < now.getTime())
    .toSorted((a, b) => a.at.getTime() - b.at.getTime());
};

const backdateReceipt = async (db: Db, receiptId: number, at: Date) => {
  await db
    .update(goodsReceipt)
    .set({ createdAt: at })
    .where(eq(goodsReceipt.id, receiptId));
  await db
    .update(stockMovement)
    .set({ createdAt: at })
    .where(eq(stockMovement.receiptId, receiptId));
};

const ADJUSTMENT_NOTES = {
  damaged: [
    "Carton crushed in delivery",
    "Dropped on shop floor",
    "Water damage after rain",
  ],
  expired: ["Past best-before date", "Expired on shelf check"],
  internal_use: ["Used for shop-floor display", "Staff canteen"],
  theft: [
    "Missing after weekend stock check",
    "Shoplifting incident, reported to security",
  ],
} as const;

type TransferEvent = Extract<
  HistoryEvent,
  { readonly kind: "dispatch" | "arrival" | "cancel" }
>;

interface SeededTransfer {
  readonly id: number;
  readonly fromBranchId: string;
  readonly toBranchId: string;
}

const PLATES = ["GT", "GW", "GR", "AS"] as const;

/** Moves a transfer step's timestamps back to when it "happened". */
const backdateTransfer = async (
  db: Db,
  transferId: number,
  step: TransferEvent["kind"],
  at: Date
): Promise<void> => {
  const stamp = {
    arrival: { receivedAt: at },
    cancel: { cancelledAt: at },
    dispatch: { createdAt: at },
  }[step];

  await db
    .update(stockTransfer)
    .set(stamp)
    .where(eq(stockTransfer.id, transferId));
  await db
    .update(stockMovement)
    .set({ createdAt: at })
    .where(
      and(
        eq(stockMovement.transferId, transferId),
        eq(
          stockMovement.kind,
          step === "dispatch" ? "transfer_out" : "transfer_in"
        )
      )
    );
};

/**
 * What to send: a handful of active lines the sender actually holds. A store
 * helping another parts with at most a third of its shelf.
 */
const pickTransferLines = async (
  db: Db,
  random: Random,
  products: readonly SeededProduct[],
  fromBranchId: string
): Promise<{ productId: number; quantity: number }[]> => {
  const wanted = [
    ...new Set(
      Array.from({ length: random.int(4, 8) }, () => random.pick(products))
    ),
  ];

  const held = await db
    .select({ onHand: stockLevel.onHand, productId: stockLevel.productId })
    .from(stockLevel)
    .innerJoin(product, eq(product.id, stockLevel.productId))
    .where(
      and(
        eq(stockLevel.branchId, fromBranchId),
        eq(product.active, true),
        inArray(
          stockLevel.productId,
          wanted.map((item) => item.id)
        )
      )
    );

  const onHand = new Map(held.map((row) => [row.productId, row.onHand]));
  const share = fromBranchId === WAREHOUSE_ID ? 1 : 1 / 3;

  return wanted.flatMap((item) => {
    const available = Math.floor((onHand.get(item.id) ?? 0) * share);

    const quantity = Math.min(
      available,
      Math.max(1, Math.round(item.reorder * random.between(1, 2.5)))
    );

    return quantity > 0 ? [{ productId: item.id, quantity }] : [];
  });
};

const runTransferEvent = async (
  db: Db,
  random: Random,
  products: readonly SeededProduct[],
  managers: ReadonlyMap<string, Actor>,
  transfers: Map<number, SeededTransfer>,
  event: TransferEvent
): Promise<void> => {
  if (event.kind === "dispatch") {
    const actor = managers.get(event.branchId);
    const lines = await pickTransferLines(db, random, products, event.branchId);

    if (actor === undefined || lines.length === 0) {
      return;
    }

    const sent = await dispatchTransfer(db, actor, {
      fromBranchId: event.branchId,
      lines,
      note: `Truck ${random.pick(PLATES)}-${random.int(1000, 9999)}-${random.int(19, 24)}`,
      toBranchId: event.toBranchId,
    });

    await backdateTransfer(db, sent.id, "dispatch", event.at);
    transfers.set(event.key, {
      fromBranchId: event.branchId,
      id: sent.id,
      toBranchId: event.toBranchId,
    });

    return;
  }

  const transfer = transfers.get(event.key);

  if (transfer === undefined) {
    return;
  }

  if (event.kind === "cancel") {
    const actor = managers.get(transfer.fromBranchId);

    if (actor !== undefined) {
      await cancelTransfer(db, actor, {
        note: "Weija restocked itself the same morning; van called back",
        transferId: transfer.id,
      });
      await backdateTransfer(db, transfer.id, "cancel", event.at);
    }

    return;
  }

  const actor = managers.get(transfer.toBranchId);

  if (actor === undefined) {
    return;
  }

  const sentLines = await db
    .select({
      productId: stockTransferLine.productId,
      quantitySent: stockTransferLine.quantitySent,
    })
    .from(stockTransferLine)
    .where(eq(stockTransferLine.transferId, transfer.id))
    .orderBy(stockTransferLine.productId);

  await receiveTransfer(db, actor, {
    lines: sentLines.map((line, index) => ({
      productId: line.productId,
      quantityReceived:
        event.short && index === 0
          ? Math.max(0, line.quantitySent - random.int(1, 3))
          : line.quantitySent,
    })),
    note: event.short
      ? "One carton crushed on the Accra–Kumasi road; written off by the driver"
      : undefined,
    transferId: transfer.id,
  });
  await backdateTransfer(db, transfer.id, "arrival", event.at);
};

type SaleEvent = Extract<HistoryEvent, { readonly kind: "sale" | "return" }>;

interface Shopper {
  /** A product for a basket, busier lines more often. */
  readonly pick: () => SeededProduct;
  /** How many of it the customer wants; none means they leave it. */
  readonly quantity: (productId: number) => number;
}

const LONG_TAIL: DemandTier = DEMAND_TIERS[2];

/** A product's tier: discontinued lines are always in the long tail. */
const demandTier = (random: Random, item: SeededProduct): DemandTier => {
  const draw = random.next();
  let floor = 0;

  for (const tier of DEMAND_TIERS) {
    floor += tier.share;

    if (draw < floor) {
      return item.active ? tier : LONG_TAIL;
    }
  }

  return LONG_TAIL;
};

/**
 * Demand for the demo: how often a product lands in a basket depends on its
 * tier, and how many go in on its reorder point, so sales keep pace with the
 * stock each line carries. The sellers report gets fast lines, a middle band
 * and a long tail of slow ones.
 */
const createShopper = (
  random: Random,
  products: readonly SeededProduct[]
): Shopper => {
  const lines = new Map<number, { reorder: number; tier: DemandTier }>();
  const cumulative: number[] = [];
  let total = 0;

  for (const item of products) {
    const tier = demandTier(random, item);

    lines.set(item.id, { reorder: item.reorder, tier });
    total += tier.boost;
    cumulative.push(total);
  }

  return {
    pick: () => {
      const target = random.next() * total;
      const index = cumulative.findIndex((value) => value > target);

      return products[index] ?? random.pick(products);
    },
    quantity: (productId) => {
      const line = lines.get(productId);

      if (line === undefined) {
        return 0;
      }

      const share = random.between(line.tier.pack[0], line.tier.pack[1]);

      // Rounded at random, so a line that sells by the one (a television)
      // only sometimes makes it into the basket.
      return Math.floor(line.reorder * share + random.next());
    },
  };
};

/**
 * A basket from what the store actually holds, so the demo isn't full of
 * negative lines. An oversell sells two more than the record shows instead.
 */
const pickBasket = async (
  db: Db,
  random: Random,
  shopper: Shopper,
  branchId: string,
  oversell: boolean
): Promise<{ productId: number; quantity: number }[]> => {
  const wanted = [
    ...new Set(Array.from({ length: 8 }, () => shopper.pick().id)),
  ];

  const held = await db
    .select({ onHand: stockLevel.onHand, productId: stockLevel.productId })
    .from(stockLevel)
    .where(
      and(
        eq(stockLevel.branchId, branchId),
        inArray(stockLevel.productId, wanted)
      )
    )
    .orderBy(stockLevel.productId);

  if (oversell) {
    const [smallest] = held
      .filter((row) => row.onHand > 0)
      .toSorted((a, b) => a.onHand - b.onHand);

    return smallest === undefined
      ? []
      : [{ productId: smallest.productId, quantity: smallest.onHand + 2 }];
  }

  // A customer takes what's left when the shelf is short.
  return held.slice(0, random.int(2, 5)).flatMap((row) => {
    const quantity = Math.min(shopper.quantity(row.productId), row.onHand);

    return quantity > 0 ? [{ productId: row.productId, quantity }] : [];
  });
};

const runSaleEvent = async (
  db: Db,
  random: Random,
  shopper: Shopper,
  staff: SeedStaff,
  salesByBranch: Map<string, number[]>,
  event: SaleEvent
): Promise<void> => {
  const sold = salesByBranch.get(event.branchId) ?? [];

  if (event.kind === "sale") {
    const cashier =
      staff.cashiers.get(event.branchId) ?? staff.managers.get(event.branchId);

    const lines = await pickBasket(
      db,
      random,
      shopper,
      event.branchId,
      event.oversell
    );

    if (cashier === undefined || lines.length === 0) {
      return;
    }

    const recorded = await recordSale(db, cashier, {
      branchId: event.branchId,
      clientRef: `SEED-${event.branchId}-${String(sold.length + 1).padStart(5, "0")}`,
      lines,
      paymentMethod: random.pick(PAYMENT_MIX),
    });

    await db
      .update(sale)
      .set({ createdAt: event.at })
      .where(eq(sale.id, recorded.id));
    await db
      .update(stockMovement)
      .set({ createdAt: event.at })
      .where(eq(stockMovement.saleId, recorded.id));
    salesByBranch.set(event.branchId, [...sold, recorded.id]);

    return;
  }

  const manager = staff.managers.get(event.branchId);

  if (manager === undefined || sold.length === 0) {
    return;
  }

  const saleId = random.pick(sold);

  const [line] = await db
    .select({ productId: saleLine.productId })
    .from(saleLine)
    .where(eq(saleLine.saleId, saleId))
    .orderBy(saleLine.productId)
    .limit(1);

  if (line === undefined) {
    return;
  }

  try {
    const recorded = await returnSale(db, manager, {
      lines: [
        {
          disposition: random.chance(0.3) ? "damaged" : "restock",
          productId: line.productId,
          quantity: 1,
        },
      ],
      reason: random.pick(RETURN_REASONS),
      saleId,
    });

    await db
      .update(saleReturn)
      .set({ createdAt: event.at })
      .where(eq(saleReturn.id, recorded.id));
    await db
      .update(stockMovement)
      .set({ createdAt: event.at })
      .where(eq(stockMovement.saleReturnId, recorded.id));
  } catch (error) {
    // Already returned in full: skip it, as a real customer couldn't do it twice.
    if (!(error instanceof StockError)) {
      throw error;
    }
  }
};

const runHistory = async (
  db: Db,
  random: Random,
  products: readonly SeededProduct[],
  staff: SeedStaff,
  events: readonly HistoryEvent[]
): Promise<void> => {
  const { managers } = staff;
  const bySupplier = Map.groupBy(products, (item) => item.supplierId);
  const transfers = new Map<number, SeededTransfer>();
  const salesByBranch = new Map<string, number[]>();
  const shopper = createShopper(random, products);

  const purchasing = {
    db,
    headOffice: staff.headOffice,
    managers,
    orders: new Map(),
    products,
    random,
    registerTransfer: async (
      key: number,
      transfer: SeededTransfer,
      at: Date
    ): Promise<void> => {
      await backdateTransfer(db, transfer.id, "dispatch", at);
      transfers.set(key, transfer);
    },
    requests: new Map(),
  };

  for (const event of events) {
    if (isPurchasingEvent(event)) {
      await runPurchasingEvent(purchasing, event);

      continue;
    }

    if (event.kind === "sale" || event.kind === "return") {
      await runSaleEvent(db, random, shopper, staff, salesByBranch, event);

      continue;
    }

    if (
      event.kind === "dispatch" ||
      event.kind === "arrival" ||
      event.kind === "cancel"
    ) {
      await runTransferEvent(db, random, products, managers, transfers, event);

      continue;
    }

    const actor = managers.get(event.branchId);

    if (!actor) {
      continue;
    }

    if (event.kind === "receipt") {
      const range = bySupplier.get(event.supplierId) ?? [];

      const lines = [
        ...new Set(
          Array.from({ length: random.int(3, 9) }, () => random.pick(range))
        ),
      ].map((item) => ({
        productId: item.id,
        quantity: Math.max(1, Math.round(item.reorder * random.between(1, 3))),
        unitCost: Math.round(item.cost * random.between(0.97, 1.06)),
      }));

      try {
        const receipt = await receiveGoods(db, actor, {
          branchId: event.branchId,
          lines,
          supplierId: event.supplierId,
          supplierReference: `INV-${random.int(10_000, 99_999)}`,
        });

        await backdateReceipt(db, receipt.id, event.at);
      } catch (error) {
        // Discontinued lines can't be received; skip that delivery.
        if (!(error instanceof StockError)) {
          throw error;
        }
      }

      continue;
    }

    const item = random.pick(products);

    const [shelf] = await db
      .select({ onHand: stockLevel.onHand })
      .from(stockLevel)
      .where(
        and(
          eq(stockLevel.branchId, event.branchId),
          eq(stockLevel.productId, item.id)
        )
      );

    const reason = random.pick([
      "damaged",
      "damaged",
      "expired",
      "theft",
      "internal_use",
      "count",
    ] as const);

    try {
      const result =
        reason === "count"
          ? await adjustStock(db, actor, {
              branchId: event.branchId,
              // Counts turn up a few short, now and then a few over.
              counted: Math.max(0, (shelf?.onHand ?? 0) + random.int(-3, 2)),
              mode: "count",
              note: "Cycle count",
              productId: item.id,
            })
          : await adjustStock(db, actor, {
              branchId: event.branchId,
              mode: "change",
              note: random.pick(ADJUSTMENT_NOTES[reason]),
              productId: item.id,
              quantity: random.int(1, 3),
              reason,
            });

      await db
        .update(stockMovement)
        .set({ createdAt: event.at })
        .where(eq(stockMovement.id, result.movementId));
    } catch (error) {
      // Not enough stock, or a count that matched: just skip it.
      if (!(error instanceof StockError)) {
        throw error;
      }
    }
  }
};

export const isSeeded = async (db: Db): Promise<boolean> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(branch);

  return (row?.count ?? 0) > 0;
};

export interface SeedSummary {
  readonly products: number;
  readonly staff: number;
  readonly movements: number;
}

export const seed = async (db: Db, now = new Date()): Promise<SeedSummary> => {
  if (await isSeeded(db)) {
    throw new Error("The database already has data; reset it before seeding.");
  }

  const random = createRandom(20_261_112);

  // Products don't reference branches, so these two can overlap.
  const [, products] = await Promise.all([
    db.insert(branch).values([...BRANCHES]),
    seedCatalogue(db, random),
  ]);

  const staff = await seedStaff(db);
  await seedOpeningStock(
    db,
    random,
    products,
    new Date(now.getTime() - OPENING_DAYS_AGO * DAY_MS)
  );

  const supplierIds = [...new Set(products.map((item) => item.supplierId))];
  await runHistory(
    db,
    random,
    products,
    staff,
    planHistory(random, supplierIds, now)
  );

  const [[movements], staffIds] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(stockMovement),
    db
      .select({ id: user.id })
      .from(user)
      .where(
        inArray(
          user.email,
          STAFF.map((person) => person.email)
        )
      ),
  ]);

  return {
    movements: movements?.count ?? 0,
    products: products.length,
    staff: staffIds.length,
  };
};
