/**
 * Tally's database schema. Money is stored in pesewas (1/100 cedi) as integers
 * and quantities as whole units, so nothing ever rounds.
 *
 * The stock model is a ledger: every change is a row in `stock_movement`, and
 * `stock_level.on_hand` is the running balance that each movement updates in
 * the same transaction. The two must always agree; the tests check it.
 */

import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Auth (Better Auth's tables, plus the admin plugin's fields and our own).
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", [
  "admin",
  "manager",
  "storekeeper",
  "cashier",
]);

export const user = pgTable("user", {
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  banReason: text("ban_reason"),
  /** Deactivated staff are "banned" in Better Auth terms: they can't sign in. */
  banned: boolean("banned").notNull().default(false),
  /** Head office staff have no branch; everyone else works at one. */
  branchId: text("branch_id").references(() => branch.id),
  createdAt: createdAt(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("storekeeper"),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    impersonatedBy: text("impersonated_by"),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: updatedAt(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    accountId: text("account_id").notNull(),
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    updatedAt: updatedAt(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("account_user_idx").on(table.userId)]
);

export const verification = pgTable("verification", {
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  updatedAt: updatedAt(),
  value: text("value").notNull(),
});

// ---------------------------------------------------------------------------
// Places and parties.
// ---------------------------------------------------------------------------

export const branchKindEnum = pgEnum("branch_kind", ["store", "warehouse"]);

export const branch = pgTable("branch", {
  address: text("address").notNull(),
  city: text("city").notNull(),
  createdAt: createdAt(),
  /** Short code used in document numbers, e.g. "SPX" in GRN-SPX-000042. */
  id: text("id").primaryKey(),
  kind: branchKindEnum("kind").notNull().default("store"),
  name: text("name").notNull(),
  region: text("region").notNull(),
});

export const category = pgTable("category", {
  /** Store department, e.g. "Home & Kitchen", for grouping on reports. */
  department: text("department").notNull(),
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const supplier = pgTable("supplier", {
  contactName: text("contact_name"),
  /** ISO 3166-1 alpha-2: much of the range is imported. */
  country: text("country").notNull().default("GH"),
  createdAt: createdAt(),
  email: text("email"),
  id: serial("id").primaryKey(),
  /** Typical days from order to goods on the dock. */
  leadTimeDays: integer("lead_time_days").notNull().default(7),
  name: text("name").notNull().unique(),
  phone: text("phone"),
});

// ---------------------------------------------------------------------------
// Catalogue.
// ---------------------------------------------------------------------------

export const unitEnum = pgEnum("unit", ["each", "pack", "kg", "litre", "pair"]);

export const product = pgTable(
  "product",
  {
    active: boolean("active").notNull().default(true),
    /** EAN-13 / UPC; unique when present. Many local goods have none. */
    barcode: text("barcode").unique(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id),
    createdAt: createdAt(),
    /**
     * Moving weighted-average cost across every branch, in pesewas. Updated by
     * each goods receipt; used to value stock.
     */
    averageCost: integer("average_cost").notNull().default(0),
    defaultSupplierId: integer("default_supplier_id").references(
      () => supplier.id
    ),
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /** Default low-stock threshold; a branch can override it. */
    reorderPoint: integer("reorder_point").notNull().default(10),
    /** Shelf price including VAT, in pesewas. */
    sellPrice: integer("sell_price").notNull(),
    sku: text("sku").notNull().unique(),
    unit: unitEnum("unit").notNull().default("each"),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("product_category_idx").on(table.categoryId),
    index("product_name_search_idx").using(
      "gin",
      sql`to_tsvector('simple', ${table.name})`
    ),
    check("product_prices_non_negative", sql`${table.sellPrice} >= 0`),
    check("product_cost_non_negative", sql`${table.averageCost} >= 0`),
    check("product_reorder_non_negative", sql`${table.reorderPoint} >= 0`),
  ]
);

// ---------------------------------------------------------------------------
// Stock.
// ---------------------------------------------------------------------------

export const stockLevel = pgTable(
  "stock_level",
  {
    /** Aisle-bay-shelf, e.g. "B2-14-3". Free text: every store is laid out differently. */
    binLocation: text("bin_location"),
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    onHand: integer("on_hand").notNull().default(0),
    productId: integer("product_id")
      .notNull()
      .references(() => product.id),
    /** Overrides the product's reorder point at this branch when set. */
    reorderPoint: integer("reorder_point"),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.branchId, table.productId] }),
    index("stock_level_product_idx").on(table.productId),
  ]
);

export const movementKindEnum = pgEnum("movement_kind", [
  "opening",
  "receipt",
  "adjustment",
  "transfer_out",
  "transfer_in",
  "sale",
  "sale_return",
]);

export const adjustmentReasonEnum = pgEnum("adjustment_reason", [
  "damaged",
  "expired",
  "theft",
  "count_correction",
  "found",
  "internal_use",
]);

export const stockMovement = pgTable(
  "stock_movement",
  {
    /** Set for adjustments only. */
    adjustmentReason: adjustmentReasonEnum("adjustment_reason"),
    /** on_hand at this branch straight after this movement. */
    balanceAfter: integer("balance_after").notNull(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    createdAt: createdAt(),
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: movementKindEnum("kind").notNull(),
    note: text("note"),
    productId: integer("product_id")
      .notNull()
      .references(() => product.id),
    /** Signed change in units: positive in, negative out. Never zero. */
    quantity: integer("quantity").notNull(),
    receiptId: integer("receipt_id").references(() => goodsReceipt.id),
    /** Set for transfer movements only: the transfer this stock left or arrived on. */
    transferId: integer("transfer_id").references(() => stockTransfer.id),
    /** Set for sale movements only. */
    saleId: integer("sale_id").references(() => sale.id),
    /**
     * Set for returns: the sale_return movement that puts stock back, and the
     * damaged write-off that follows it when the item can't be resold.
     */
    saleReturnId: integer("sale_return_id").references(() => saleReturn.id),
    /** Cost per unit for receipts and transfers, in pesewas. */
    unitCost: integer("unit_cost"),
    userId: text("user_id").references(() => user.id),
  },
  (table) => [
    index("stock_movement_branch_product_idx").on(
      table.branchId,
      table.productId,
      table.id
    ),
    index("stock_movement_created_idx").on(table.createdAt),
    check("stock_movement_non_zero", sql`${table.quantity} <> 0`),
    check(
      "stock_movement_reason_matches_kind",
      sql`(${table.kind} = 'adjustment') = (${table.adjustmentReason} is not null)`
    ),
    // Compared as text: Postgres can't use an enum value in the transaction that adds it.
    check(
      "stock_movement_transfer_matches_kind",
      sql`(${table.kind}::text in ('transfer_out', 'transfer_in')) = (${table.transferId} is not null)`
    ),
    index("stock_movement_transfer_idx").on(table.transferId),
    check(
      "stock_movement_sale_matches_kind",
      sql`(${table.kind}::text = 'sale') = (${table.saleId} is not null)`
    ),
    check(
      "stock_movement_return_matches_kind",
      sql`(${table.kind}::text <> 'sale_return' or ${table.saleReturnId} is not null) and (${table.saleReturnId} is null or ${table.kind}::text in ('sale_return', 'adjustment'))`
    ),
    index("stock_movement_sale_idx").on(table.saleId),
    index("stock_movement_return_idx").on(table.saleReturnId),
  ]
);

export const goodsReceipt = pgTable(
  "goods_receipt",
  {
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    createdAt: createdAt(),
    id: serial("id").primaryKey(),
    note: text("note"),
    /** Human document number, e.g. GRN-SPX-000042. */
    number: text("number").notNull(),
    receivedById: text("received_by_id").references(() => user.id),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => supplier.id),
    /** The supplier's invoice or waybill number, for matching paperwork. */
    supplierReference: text("supplier_reference"),
    /** Sum of quantity × unit cost over the lines, in pesewas. */
    totalCost: integer("total_cost").notNull(),
  },
  (table) => [
    uniqueIndex("goods_receipt_number_idx").on(table.number),
    index("goods_receipt_branch_idx").on(table.branchId, table.createdAt),
  ]
);

export const transferStatusEnum = pgEnum("transfer_status", [
  "in_transit",
  "received",
  "cancelled",
]);

/**
 * Stock moving between two branches. Dispatch takes it out of the sending
 * branch; until it is received (or cancelled) it is "in transit" and belongs
 * to no branch's on_hand, so the lines below are the only record of it.
 */
export const stockTransfer = pgTable(
  "stock_transfer",
  {
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledById: text("cancelled_by_id").references(() => user.id),
    /** When the goods were dispatched. */
    createdAt: createdAt(),
    dispatchedById: text("dispatched_by_id").references(() => user.id),
    fromBranchId: text("from_branch_id")
      .notNull()
      .references(() => branch.id),
    id: serial("id").primaryKey(),
    /** Dispatch note; a cancellation's reason is kept in `receive_note`. */
    note: text("note"),
    /** Human document number, numbered by the sending branch: TRF-TMA-000042. */
    number: text("number").notNull(),
    /** What the receiving (or cancelling) person wrote, e.g. why units are short. */
    receiveNote: text("receive_note"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedById: text("received_by_id").references(() => user.id),
    status: transferStatusEnum("status").notNull().default("in_transit"),
    toBranchId: text("to_branch_id")
      .notNull()
      .references(() => branch.id),
    /** Sum of quantity sent × unit cost over the lines, in pesewas. */
    totalCost: integer("total_cost").notNull(),
  },
  (table) => [
    uniqueIndex("stock_transfer_number_idx").on(table.number),
    index("stock_transfer_from_idx").on(table.fromBranchId, table.createdAt),
    index("stock_transfer_to_idx").on(table.toBranchId, table.status),
    check(
      "stock_transfer_distinct_branches",
      sql`${table.fromBranchId} <> ${table.toBranchId}`
    ),
    check(
      "stock_transfer_received_matches_status",
      sql`(${table.status}::text = 'received') = (${table.receivedAt} is not null)`
    ),
    check(
      "stock_transfer_cancelled_matches_status",
      sql`(${table.status}::text = 'cancelled') = (${table.cancelledAt} is not null)`
    ),
  ]
);

export const stockTransferLine = pgTable(
  "stock_transfer_line",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => product.id),
    /** Null until received. Sent minus received is lost in transit. */
    quantityReceived: integer("quantity_received"),
    quantitySent: integer("quantity_sent").notNull(),
    transferId: integer("transfer_id")
      .notNull()
      .references(() => stockTransfer.id),
    /** The product's average cost at dispatch, in pesewas: values goods in transit. */
    unitCost: integer("unit_cost").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.transferId, table.productId] }),
    index("stock_transfer_line_product_idx").on(table.productId),
    check("stock_transfer_line_sent_positive", sql`${table.quantitySent} > 0`),
    check(
      "stock_transfer_line_received_in_range",
      sql`${table.quantityReceived} is null or (${table.quantityReceived} >= 0 and ${table.quantityReceived} <= ${table.quantitySent})`
    ),
    check("stock_transfer_line_cost_non_negative", sql`${table.unitCost} >= 0`),
  ]
);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "mobile_money",
  "card",
]);

/**
 * A sale at a till. Its lines keep the price and the average cost at the
 * moment of sale, so margins can be reported later without guessing.
 */
export const sale = pgTable(
  "sale",
  {
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    /** Who rang it up on the in-app till; null for sales from a POS system. */
    cashierId: text("cashier_id").references(() => user.id),
    /** The POS till that sent it through the sales API, if any. */
    tillId: integer("till_id").references(() => till.id),
    /**
     * The till's own id for this sale. A till that retries after a dropped
     * connection sends the same one, and gets the first sale back.
     */
    clientRef: text("client_ref").notNull(),
    createdAt: createdAt(),
    id: serial("id").primaryKey(),
    /** Human document number, e.g. SAL-SPX-000123. */
    number: text("number").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    /** Sum of quantity × unit price over the lines, in pesewas. */
    total: integer("total").notNull(),
  },
  (table) => [
    uniqueIndex("sale_number_idx").on(table.number),
    uniqueIndex("sale_client_ref_idx").on(table.branchId, table.clientRef),
    index("sale_branch_idx").on(table.branchId, table.createdAt),
    check("sale_total_non_negative", sql`${table.total} >= 0`),
  ]
);

export const saleLine = pgTable(
  "sale_line",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sale.id),
    /** Average cost at the moment of sale, in pesewas. */
    unitCost: integer("unit_cost").notNull(),
    /** Price charged per unit, including VAT, in pesewas. */
    unitPrice: integer("unit_price").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.saleId, table.productId] }),
    index("sale_line_product_idx").on(table.productId),
    check("sale_line_quantity_positive", sql`${table.quantity} > 0`),
    check("sale_line_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("sale_line_cost_non_negative", sql`${table.unitCost} >= 0`),
  ]
);

/**
 * A POS till allowed to post sales through the API. Head office creates one
 * per physical till and gets its key once; only a SHA-256 hash is stored, so
 * a database leak doesn't leak working keys. Revoking stops it at once.
 */
export const till = pgTable(
  "till",
  {
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    createdAt: createdAt(),
    createdById: text("created_by_id").references(() => user.id),
    id: serial("id").primaryKey(),
    /** SHA-256 of the key, hex. */
    keyHash: text("key_hash").notNull(),
    /** The key's first characters, so people can tell keys apart. */
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /** What the shop calls it, e.g. "Till 3, ground floor". */
    name: text("name").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("till_key_hash_idx").on(table.keyHash),
    index("till_branch_idx").on(table.branchId),
  ]
);

export const returnDispositionEnum = pgEnum("return_disposition", [
  "restock",
  "damaged",
]);

/** A customer return against an earlier sale, approved by a manager. */
export const saleReturn = pgTable(
  "sale_return",
  {
    /** The manager who approved and recorded it. */
    approvedById: text("approved_by_id").references(() => user.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    createdAt: createdAt(),
    id: serial("id").primaryKey(),
    /** Human document number, e.g. RET-SPX-000007. */
    number: text("number").notNull(),
    reason: text("reason").notNull(),
    /** Sum of quantity × the original unit price, in pesewas. */
    refund: integer("refund").notNull(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sale.id),
  },
  (table) => [
    uniqueIndex("sale_return_number_idx").on(table.number),
    index("sale_return_sale_idx").on(table.saleId),
    index("sale_return_branch_idx").on(table.branchId, table.createdAt),
  ]
);

export const saleReturnLine = pgTable(
  "sale_return_line",
  {
    disposition: returnDispositionEnum("disposition").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    returnId: integer("return_id")
      .notNull()
      .references(() => saleReturn.id),
  },
  (table) => [
    primaryKey({ columns: [table.returnId, table.productId] }),
    check("sale_return_line_quantity_positive", sql`${table.quantity} > 0`),
  ]
);

/** Per-branch counters for document numbers, claimed inside the transaction. */
export const documentCounter = pgTable(
  "document_counter",
  {
    branchId: text("branch_id")
      .notNull()
      .references(() => branch.id),
    kind: text("kind").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.kind, table.branchId] })]
);

export type Role = (typeof roleEnum.enumValues)[number];

export type AdjustmentReason = (typeof adjustmentReasonEnum.enumValues)[number];

export type MovementKind = (typeof movementKindEnum.enumValues)[number];

export type TransferStatus = (typeof transferStatusEnum.enumValues)[number];

export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];

export type ReturnDisposition =
  (typeof returnDispositionEnum.enumValues)[number];

export type Unit = (typeof unitEnum.enumValues)[number];
