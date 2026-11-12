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

export const roleEnum = pgEnum("role", ["admin", "manager", "storekeeper"]);

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
    check("stock_level_on_hand_non_negative", sql`${table.onHand} >= 0`),
  ]
);

export const movementKindEnum = pgEnum("movement_kind", [
  "opening",
  "receipt",
  "adjustment",
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
    /** Cost per unit for receipts, in pesewas. */
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

export type Unit = (typeof unitEnum.enumValues)[number];
