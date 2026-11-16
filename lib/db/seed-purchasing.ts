/**
 * The demo's purchase orders and stock requests, as history events that the
 * seed runs in time order through the real domain functions and then
 * backdates, like everything else in the seed's month.
 *
 * Kept apart from seed.ts so that file stays readable; seed.ts imports this,
 * never the other way round.
 */

/* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- seeding is sequential: every draw and write in the same order each run */
import { eq } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import {
  goodsReceipt,
  purchaseOrder,
  purchaseOrderLine,
  stockMovement,
  stockRequest,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  draftPurchaseOrder,
} from "@/lib/stock/purchase-orders";
import { receiveGoods } from "@/lib/stock/receive";
import {
  cancelStockRequest,
  fulfilStockRequest,
  requestStock,
} from "@/lib/stock/requests";
import { DAY_MS } from "@/lib/time";

const HOUR_MS = 3_600_000;

/** Request transfers get their own key range, apart from the seed's transfers. */
const REQUEST_TRANSFER_KEYS = 1000;

/** The parts of the seed's random generator this needs. */
interface Random {
  readonly int: (min: number, max: number) => number;
  readonly between: (min: number, max: number) => number;
  readonly chance: (probability: number) => boolean;
  readonly pick: <T>(items: readonly T[]) => T;
}

interface Product {
  readonly id: number;
  readonly active: boolean;
  readonly cost: number;
  readonly reorder: number;
  readonly supplierId: number;
}

export type PurchasingEvent =
  | {
      readonly at: Date;
      readonly kind: "po_draft";
      readonly key: number;
      readonly branchId: string;
    }
  | { readonly at: Date; readonly kind: "po_approve"; readonly key: number }
  | {
      readonly at: Date;
      readonly kind: "po_deliver";
      readonly key: number;
      /** How much of what's still due arrives, from 0 to 1. */
      readonly share: number;
    }
  | {
      readonly at: Date;
      readonly kind: "po_cancel" | "po_close";
      readonly key: number;
    }
  | {
      readonly at: Date;
      readonly kind: "request";
      readonly key: number;
      readonly branchId: string;
    }
  | {
      readonly at: Date;
      readonly kind: "request_fulfil";
      readonly key: number;
      /** The arrival event that receives the transfer uses this key. */
      readonly transferKey: number;
    }
  | {
      readonly at: Date;
      readonly kind: "request_cancel";
      readonly key: number;
    };

/** A fulfilled request's transfer, to be received by a later arrival event. */
export interface PlannedArrival {
  readonly at: Date;
  readonly transferKey: number;
}

export interface PurchasingPlan {
  readonly events: PurchasingEvent[];
  readonly arrivals: PlannedArrival[];
}

const WAREHOUSE_ID = "TMA";
const STORES = ["AMS", "ASH", "KSI", "SPX", "WJA"] as const;
const SUPPLIER_LEAD_DAYS = 3;

/**
 * The month's buying:
 * - every branch has an order received in full and one part delivered
 *   (Spintex's closed short);
 * - the warehouse has one approved and still on order;
 * - Spintex has a draft waiting for head office, and Kumasi one cancelled.
 *
 * And requests: every store had one fulfilled and received; Weija has one
 * open now, and Amasaman one cancelled.
 */
export const planPurchasing = (
  random: Random,
  during: (day: number) => Date,
  now: Date
): PurchasingPlan => {
  const events: PurchasingEvent[] = [];
  const arrivals: PlannedArrival[] = [];
  let key = 0;

  const order = (
    branchId: string,
    at: Date,
    then: (key: number, approvedAt: Date) => void
  ) => {
    key += 1;
    const approvedAt = new Date(at.getTime() + random.int(2, 6) * HOUR_MS);
    events.push(
      { at, branchId, key, kind: "po_draft" },
      { at: approvedAt, key, kind: "po_approve" }
    );
    then(key, approvedAt);
  };

  const delivered = (approvedAt: Date, days: number): Date =>
    new Date(approvedAt.getTime() + days * DAY_MS + random.int(1, 5) * HOUR_MS);

  for (const branchId of [...STORES, WAREHOUSE_ID]) {
    order(branchId, during(random.int(1, 9)), (k, approvedAt) => {
      events.push({
        at: delivered(approvedAt, SUPPLIER_LEAD_DAYS),
        key: k,
        kind: "po_deliver",
        share: 1,
      });
    });

    order(branchId, during(random.int(12, 19)), (k, approvedAt) => {
      const first = delivered(approvedAt, SUPPLIER_LEAD_DAYS);
      events.push({ at: first, key: k, kind: "po_deliver", share: 0.6 });

      if (branchId === "SPX") {
        events.push({
          at: new Date(first.getTime() + 2 * DAY_MS),
          key: k,
          kind: "po_close",
        });
      }
    });
  }

  // Approved this week; the supplier hasn't delivered yet.
  order(WAREHOUSE_ID, during(random.int(25, 27)), () => {
    // Nothing more: it shows as "on order".
  });

  // Called off by head office after approval.
  order("KSI", during(random.int(10, 16)), (k, approvedAt) => {
    events.push({
      at: new Date(approvedAt.getTime() + DAY_MS),
      key: k,
      kind: "po_cancel",
    });
  });

  // Drafted this morning, waiting for head office.
  key += 1;
  events.push({
    at: new Date(now.getTime() - 3 * HOUR_MS),
    branchId: "SPX",
    key,
    kind: "po_draft",
  });

  let requestKey = 0;

  for (const branchId of STORES) {
    requestKey += 1;
    const at = during(random.int(4, 20));
    const sent = new Date(at.getTime() + random.int(3, 8) * HOUR_MS);
    const transferKey = REQUEST_TRANSFER_KEYS + requestKey;
    events.push(
      { at, branchId, key: requestKey, kind: "request" },
      { at: sent, key: requestKey, kind: "request_fulfil", transferKey }
    );
    arrivals.push({
      at: new Date(sent.getTime() + (branchId === "KSI" ? 40 : 20) * HOUR_MS),
      transferKey,
    });
  }

  requestKey += 1;
  events.push({
    at: new Date(now.getTime() - 2 * HOUR_MS),
    branchId: "WJA",
    key: requestKey,
    kind: "request",
  });

  requestKey += 1;
  const asked = during(random.int(8, 18));
  events.push(
    { at: asked, branchId: "AMS", key: requestKey, kind: "request" },
    {
      at: new Date(asked.getTime() + 5 * HOUR_MS),
      key: requestKey,
      kind: "request_cancel",
    }
  );

  return { arrivals, events };
};

export interface PurchasingContext {
  readonly db: Db;
  readonly random: Random;
  readonly products: readonly Product[];
  readonly managers: ReadonlyMap<string, Actor>;
  readonly headOffice: Actor;
  /**
   * Hands a fulfilled request's transfer to the seed, which backdates its
   * dispatch and receives it at the planned arrival.
   */
  readonly registerTransfer: (
    key: number,
    transfer: { id: number; fromBranchId: string; toBranchId: string },
    at: Date
  ) => Promise<void>;
  readonly orders: Map<
    number,
    { id: number; branchId: string; supplierId: number }
  >;
  readonly requests: Map<number, { id: number; branchId: string }>;
}

/** A handful of active lines from one supplier, in quantities worth ordering. */
const orderLines = (context: PurchasingContext, supplierId: number) => {
  const range = context.products.filter(
    (item) => item.active && item.supplierId === supplierId
  );

  const picked = [
    ...new Set(
      Array.from({ length: context.random.int(3, 6) }, () =>
        context.random.pick(range)
      )
    ),
  ];

  return picked.map((item) => ({
    productId: item.id,
    quantity: Math.max(
      2,
      Math.round(item.reorder * context.random.between(2, 4))
    ),
    unitCost: Math.round(item.cost * context.random.between(0.95, 1.04)),
  }));
};

const runOrderEvent = async (
  context: PurchasingContext,
  event: OrderEvent
): Promise<void> => {
  const { db, managers, headOffice } = context;

  if (event.kind === "po_draft") {
    const manager = managers.get(event.branchId);

    const suppliers = [
      ...new Set(
        context.products.flatMap((item) =>
          item.active ? [item.supplierId] : []
        )
      ),
    ];

    const supplierId = context.random.pick(suppliers);

    if (manager === undefined) {
      return;
    }

    const drafted = await draftPurchaseOrder(db, manager, {
      branchId: event.branchId,
      lines: orderLines(context, supplierId),
      supplierId,
    });

    await db
      .update(purchaseOrder)
      .set({ createdAt: event.at })
      .where(eq(purchaseOrder.id, drafted.id));
    context.orders.set(event.key, {
      branchId: event.branchId,
      id: drafted.id,
      supplierId,
    });

    return;
  }

  const order = context.orders.get(event.key);

  if (order === undefined) {
    return;
  }

  if (event.kind === "po_approve") {
    await approvePurchaseOrder(db, headOffice, order.id, event.at);

    return;
  }

  if (event.kind !== "po_deliver") {
    const step =
      event.kind === "po_cancel" ? cancelPurchaseOrder : closePurchaseOrder;

    await step(db, headOffice, {
      note:
        event.kind === "po_cancel"
          ? "Supplier couldn't deliver before the promo"
          : "Supplier has discontinued the rest",
      purchaseOrderId: order.id,
    });
    await db
      .update(purchaseOrder)
      .set({ closedAt: event.at })
      .where(eq(purchaseOrder.id, order.id));

    return;
  }

  await deliver(context, order, event);
};

/** A delivery against an order: some or all of what's still due. */
const deliver = async (
  context: PurchasingContext,
  order: { id: number; branchId: string; supplierId: number },
  event: Extract<PurchasingEvent, { kind: "po_deliver" }>
): Promise<void> => {
  const { db, managers } = context;
  const receiver = managers.get(order.branchId);

  const due = await db
    .select({
      productId: purchaseOrderLine.productId,
      quantity: purchaseOrderLine.quantity,
      quantityReceived: purchaseOrderLine.quantityReceived,
      unitCost: purchaseOrderLine.unitCost,
    })
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, order.id))
    .orderBy(purchaseOrderLine.productId);

  const lines = due.flatMap((line) => {
    const quantity = Math.ceil(
      (line.quantity - line.quantityReceived) * event.share
    );

    return quantity > 0
      ? [{ productId: line.productId, quantity, unitCost: line.unitCost }]
      : [];
  });

  if (receiver === undefined || lines.length === 0) {
    return;
  }

  const receipt = await receiveGoods(db, receiver, {
    branchId: order.branchId,
    lines,
    purchaseOrderId: order.id,
    supplierId: order.supplierId,
    supplierReference: `INV-${context.random.int(10_000, 99_999)}`,
  });

  await db
    .update(goodsReceipt)
    .set({ createdAt: event.at })
    .where(eq(goodsReceipt.id, receipt.id));
  await db
    .update(stockMovement)
    .set({ createdAt: event.at })
    .where(eq(stockMovement.receiptId, receipt.id));

  // A delivery that completes the order closes it now, not at seeding time.
  const [after] = await db
    .select({ status: purchaseOrder.status })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.id, order.id));

  if (after?.status === "received") {
    await db
      .update(purchaseOrder)
      .set({ closedAt: event.at })
      .where(eq(purchaseOrder.id, order.id));
  }
};

const runRequestEvent = async (
  context: PurchasingContext,
  event: RequestEvent
): Promise<void> => {
  const { db, managers } = context;

  if (event.kind === "request") {
    const manager = managers.get(event.branchId);

    const wanted = [
      ...new Set(
        Array.from({ length: context.random.int(3, 6) }, () =>
          context.random.pick(context.products.filter((item) => item.active))
        )
      ),
    ];

    if (manager === undefined) {
      return;
    }

    const requested = await requestStock(db, manager, {
      branchId: event.branchId,
      lines: wanted.map((item) => ({
        productId: item.id,
        quantity: Math.max(
          1,
          Math.round(item.reorder * context.random.between(1, 2))
        ),
      })),
      note: context.random.pick([
        "Weekend promo shelf",
        "Running out before the next delivery",
        "Customer asked for these",
      ]),
    });

    await db
      .update(stockRequest)
      .set({ createdAt: event.at })
      .where(eq(stockRequest.id, requested.id));
    context.requests.set(event.key, {
      branchId: event.branchId,
      id: requested.id,
    });

    return;
  }

  const request = context.requests.get(event.key);
  const warehouseManager = managers.get(WAREHOUSE_ID);

  if (request === undefined || warehouseManager === undefined) {
    return;
  }

  if (event.kind === "request_cancel") {
    await cancelStockRequest(
      db,
      managers.get(request.branchId) ?? warehouseManager,
      {
        note: "Found enough in the back store",
        requestId: request.id,
      }
    );
    await db
      .update(stockRequest)
      .set({ cancelledAt: event.at })
      .where(eq(stockRequest.id, request.id));

    return;
  }

  const asked = await db.query.stockRequestLine.findMany({
    where: (line, { eq: equals }) => equals(line.requestId, request.id),
  });

  const sent = await fulfilStockRequest(db, warehouseManager, {
    // Everything asked for: the warehouse holds plenty at the start of the month.
    lines: asked.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
    requestId: request.id,
  });

  if (sent.transferId === null) {
    return;
  }

  await db
    .update(stockRequest)
    .set({ fulfilledAt: event.at })
    .where(eq(stockRequest.id, request.id));
  await context.registerTransfer(
    event.transferKey,
    {
      fromBranchId: WAREHOUSE_ID,
      id: sent.transferId,
      toBranchId: request.branchId,
    },
    event.at
  );
};

type OrderEvent = Extract<PurchasingEvent, { kind: `po_${string}` }>;

type RequestEvent = Extract<PurchasingEvent, { kind: `request${string}` }>;

const ORDER_KINDS = new Set<string>([
  "po_draft",
  "po_approve",
  "po_deliver",
  "po_cancel",
  "po_close",
]);

const REQUEST_KINDS = new Set<string>([
  "request",
  "request_fulfil",
  "request_cancel",
]);

const isOrderEvent = (event: PurchasingEvent): event is OrderEvent =>
  ORDER_KINDS.has(event.kind);

/** Tells the seed's own events apart from these. */
export const isPurchasingEvent = (event: {
  readonly kind: string;
}): event is PurchasingEvent =>
  ORDER_KINDS.has(event.kind) || REQUEST_KINDS.has(event.kind);

/** Runs one purchasing event; a refusal (e.g. stock ran short) just skips it. */
export const runPurchasingEvent = async (
  context: PurchasingContext,
  event: PurchasingEvent
): Promise<void> => {
  try {
    await (isOrderEvent(event)
      ? runOrderEvent(context, event)
      : runRequestEvent(context, event));
  } catch (error) {
    if (!(error instanceof StockError)) {
      throw error;
    }
  }
};
