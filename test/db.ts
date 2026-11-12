/**
 * A fresh in-memory Postgres (PGlite) per test file, migrated with the real
 * migrations and given a small, known world: two stores, one supplier, three
 * products and one person in each role.
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { connectPglite } from "@/lib/db/client";
import type { Connection, Db } from "@/lib/db/client";
import {
  branch,
  category,
  product,
  stockLevel,
  stockMovement,
  supplier,
  user,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";

export interface TestWorld {
  readonly connection: Connection;
  readonly db: Db;
  readonly supplierId: number;
  readonly products: {
    readonly rice: number;
    readonly kettle: number;
    readonly old: number;
  };
  readonly admin: Actor;
  readonly spintexManager: Actor;
  readonly spintexStorekeeper: Actor;
}

export const SPINTEX = "SPX";
export const KUMASI = "KSI";

export const createTestWorld = async (): Promise<TestWorld> => {
  const connection = connectPglite();
  await connection.migrate();
  const { db } = connection;

  await db.insert(branch).values([
    {
      address: "Spintex Road",
      city: "Accra",
      id: SPINTEX,
      name: "Spintex",
      region: "Greater Accra",
    },
    {
      address: "Ahinsan",
      city: "Kumasi",
      id: KUMASI,
      name: "Kumasi",
      region: "Ashanti",
    },
  ]);

  const [cat] = await db
    .insert(category)
    .values({ department: "Groceries", name: "Rice & grains" })
    .returning();

  const [sup] = await db
    .insert(supplier)
    .values({ country: "GH", name: "Tema Foods Ltd" })
    .returning();

  if (cat === undefined || sup === undefined) {
    throw new Error("Fixture insert failed.");
  }

  const [rice, kettle, old] = await db
    .insert(product)
    .values([
      {
        categoryId: cat.id,
        name: "Jasmine rice 5 kg",
        sellPrice: 15_000,
        sku: "GR-0001",
      },
      {
        categoryId: cat.id,
        name: "Electric kettle 1.7 L",
        sellPrice: 25_000,
        sku: "HK-0001",
      },
      {
        active: false,
        categoryId: cat.id,
        name: "Old stock line",
        sellPrice: 100,
        sku: "XX-0001",
      },
    ])
    .returning({ id: product.id });

  if (rice === undefined || kettle === undefined || old === undefined) {
    throw new Error("Fixture insert failed.");
  }

  const people = [
    {
      branchId: null,
      email: "ho@tally.test",
      id: "u-admin",
      name: "Head Office",
      role: "admin",
    },
    {
      branchId: SPINTEX,
      email: "mgr@tally.test",
      id: "u-mgr",
      name: "Ama Mensah",
      role: "manager",
    },
    {
      branchId: SPINTEX,
      email: "sk@tally.test",
      id: "u-sk",
      name: "Kofi Boateng",
      role: "storekeeper",
    },
  ] as const;

  await db.insert(user).values([...people]);

  const [admin, spintexManager, spintexStorekeeper] = people.map(
    ({ id, role, branchId }): Actor => ({ branchId, id, role })
  );

  if (
    admin === undefined ||
    spintexManager === undefined ||
    spintexStorekeeper === undefined
  ) {
    throw new Error("Fixture insert failed.");
  }

  return {
    admin,
    connection,
    db,
    products: { kettle: kettle.id, old: old.id, rice: rice.id },
    spintexManager,
    spintexStorekeeper,
    supplierId: sup.id,
  };
};

export const onHand = async (
  db: Db,
  branchId: string,
  productId: number
): Promise<number> => {
  const rows = await db
    .select({ onHand: stockLevel.onHand })
    .from(stockLevel)
    .where(
      sql`${stockLevel.branchId} = ${branchId} and ${stockLevel.productId} = ${productId}`
    );

  return rows[0]?.onHand ?? 0;
};

/** Both drivers return { rows }; the shared PgDatabase type can't say so. */
const queryRows = z.object({ rows: z.array(z.unknown()) });

/** Every (branch, product) whose balance differs from the sum of its movements. */
export const ledgerMismatches = async (db: Db): Promise<unknown[]> => {
  const result = await db.execute(sql`
    select l.branch_id, l.product_id, l.on_hand, coalesce(sum(m.quantity), 0)::int as ledger
    from ${stockLevel} l
    left join ${stockMovement} m
      on m.branch_id = l.branch_id and m.product_id = l.product_id
    group by l.branch_id, l.product_id, l.on_hand
    having l.on_hand <> coalesce(sum(m.quantity), 0)
  `);

  return queryRows.parse(result).rows;
};

export const averageCostOf = async (
  db: Db,
  productId: number
): Promise<number> => {
  const [row] = await db
    .select({ averageCost: product.averageCost })
    .from(product)
    .where(eq(product.id, productId));

  return row?.averageCost ?? Number.NaN;
};
