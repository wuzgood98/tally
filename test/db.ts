/**
 * A fresh in-memory Postgres (PGlite) per test file, migrated with the real
 * migrations and given a small, known world: two stores, one supplier, three
 * products, head office, and a manager and storekeeper at each store.
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { connectPglite } from "@/lib/db/client";
import type { Connection, Db } from "@/lib/db/client";
import {
  branch,
  category,
  goodsReceipt,
  product,
  purchaseOrder,
  purchaseOrderLine,
  stockLevel,
  stockMovement,
  sale,
  saleLine,
  saleReturn,
  saleReturnLine,
  stockTransfer,
  stockTransferLine,
  supplier,
  user,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";

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
  readonly kumasiManager: Actor;
  readonly kumasiStorekeeper: Actor;
  readonly spintexCashier: Actor;
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
    {
      branchId: SPINTEX,
      email: "till@tally.test",
      id: "u-till",
      name: "Esi Quaye",
      role: "cashier",
    },
    {
      branchId: KUMASI,
      email: "kmgr@tally.test",
      id: "u-kmgr",
      name: "Yaw Owusu",
      role: "manager",
    },
    {
      branchId: KUMASI,
      email: "ksk@tally.test",
      id: "u-ksk",
      name: "Abena Darko",
      role: "storekeeper",
    },
  ] as const;

  await db.insert(user).values([...people]);

  const [
    admin,
    spintexManager,
    spintexStorekeeper,
    spintexCashier,
    kumasiManager,
    kumasiStorekeeper,
  ] = people.map(({ id, role, branchId }): Actor => ({ branchId, id, role }));

  if (
    admin === undefined ||
    spintexManager === undefined ||
    spintexStorekeeper === undefined ||
    kumasiManager === undefined ||
    kumasiStorekeeper === undefined ||
    spintexCashier === undefined
  ) {
    throw new Error("Fixture insert failed.");
  }

  return {
    admin,
    connection,
    db,
    kumasiManager,
    kumasiStorekeeper,
    products: { kettle: kettle.id, old: old.id, rice: rice.id },
    spintexCashier,
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

/**
 * Every transfer whose movements disagree with its lines. Dispatch must take
 * out exactly what was sent; receiving must add exactly what was counted at
 * the receiving branch; cancelling must return everything to the sender; and
 * nothing may arrive while a transfer is still in transit.
 */
export const transferMismatches = async (db: Db): Promise<unknown[]> => {
  const result = await db.execute(sql`
    with lines as (
      select transfer_id,
        sum(quantity_sent)::int as sent,
        sum(coalesce(quantity_received, 0))::int as received,
        count(*) filter (where quantity_received is null)::int as uncounted,
        count(*)::int as line_count
      from ${stockTransferLine} group by transfer_id
    ), moves as (
      select transfer_id,
        coalesce(sum(quantity) filter (where kind = 'transfer_out'), 0)::int as moved_out,
        coalesce(sum(quantity) filter (where kind = 'transfer_in'), 0)::int as moved_in,
        bool_and(kind <> 'transfer_out' or quantity < 0) as outs_negative,
        array_agg(distinct branch_id) filter (where kind = 'transfer_in') as in_branches
      from ${stockMovement} where transfer_id is not null group by transfer_id
    )
    select t.number, t.status, l.sent, l.received, l.uncounted, m.moved_out, m.moved_in, m.in_branches
    from ${stockTransfer} t
    join lines l on l.transfer_id = t.id
    left join moves m on m.transfer_id = t.id
    where coalesce(m.moved_out, 0) <> -l.sent
      or not coalesce(m.outs_negative, true)
      or case t.status
        when 'in_transit' then coalesce(m.moved_in, 0) <> 0 or l.uncounted <> l.line_count
        when 'received' then coalesce(m.moved_in, 0) <> l.received or l.uncounted <> 0
          or (l.received > 0 and m.in_branches <> array[t.to_branch_id])
        else coalesce(m.moved_in, 0) <> l.sent or m.in_branches <> array[t.from_branch_id]
      end
  `);

  return queryRows.parse(result).rows;
};

/**
 * Every sale or return whose movements disagree with its lines. A sale takes
 * out exactly what it sold; a return puts back exactly what came back, and
 * writes off exactly the damaged part again.
 */
export const saleMismatches = async (db: Db): Promise<unknown[]> => {
  const result = await db.execute(sql`
    select 'sale' as document, s.number
    from ${sale} s
    where (select coalesce(sum(quantity), 0) from ${saleLine} where sale_id = s.id)
       <> -(select coalesce(sum(quantity), 0) from ${stockMovement} where sale_id = s.id and kind = 'sale')
    union all
    select 'return', r.number
    from ${saleReturn} r
    where (select coalesce(sum(quantity), 0) from ${saleReturnLine} where return_id = r.id)
        <> (select coalesce(sum(quantity), 0) from ${stockMovement} where sale_return_id = r.id and kind = 'sale_return')
       or (select coalesce(sum(quantity), 0) from ${saleReturnLine} where return_id = r.id and disposition = 'damaged')
        <> -(select coalesce(sum(quantity), 0) from ${stockMovement} where sale_return_id = r.id and kind = 'adjustment')
  `);

  return queryRows.parse(result).rows;
};

/**
 * Purchase order lines whose received quantity disagrees with the receipts
 * against the order, and orders whose status disagrees with their lines.
 */
export const purchaseOrderMismatches = async (db: Db): Promise<unknown[]> => {
  const result = await db.execute(sql`
    with delivered as (
      select r.purchase_order_id, m.product_id, sum(m.quantity)::int as quantity
      from ${goodsReceipt} r
      join ${stockMovement} m on m.receipt_id = r.id
      where r.purchase_order_id is not null
      group by 1, 2
    ), lines as (
      select l.purchase_order_id, l.product_id, l.quantity, l.quantity_received,
        coalesce(d.quantity, 0) as delivered
      from ${purchaseOrderLine} l
      left join delivered d
        on d.purchase_order_id = l.purchase_order_id and d.product_id = l.product_id
    )
    select o.number, o.status, 'line out of step' as problem
    from ${purchaseOrder} o join lines l on l.purchase_order_id = o.id
    where l.quantity_received <> l.delivered
    union all
    select o.number, o.status, 'status out of step'
    from ${purchaseOrder} o
    join (
      select purchase_order_id,
        bool_and(quantity_received >= quantity) as complete,
        bool_or(quantity_received > 0) as started
      from lines group by 1
    ) t on t.purchase_order_id = o.id
    where case o.status
      when 'received' then not t.complete
      when 'partly_received' then t.complete or not t.started
      when 'closed' then not t.started
      else t.started
    end
  `);

  return queryRows.parse(result).rows;
};

/**
 * Movements whose timestamp is earlier than the movement before them by id.
 * The ledger lists newest first by id, so ids must follow time.
 */
export const movementsOutOfOrder = async (db: Db): Promise<unknown[]> => {
  const result = await db.execute(sql`
    select id, created_at, previous
    from (
      select id, created_at, lag(created_at) over (order by id) as previous
      from ${stockMovement}
    ) ordered
    where previous > created_at
  `);

  return queryRows.parse(result).rows;
};

/** Awaits a promise expected to fail with a StockError, and returns that error. */
export const rejection = async (
  promise: Promise<unknown>
): Promise<StockError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof StockError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected the promise to reject with a StockError.");
};

/**
 * The company's book value (the ledger's running quantity × cost, plus goods
 * in transit at their cost at dispatch) beside units held × average cost.
 * They differ only by rounding, and by deliveries that moved the average
 * while goods were on the road.
 */
export const bookValueTotals = async (
  db: Db
): Promise<{ book: number; atAverage: number }> => {
  const result = await db.execute(sql`
    with ledger as (
      select product_id, sum(quantity::bigint * unit_cost) as value
      from ${stockMovement} group by 1
    ), transit as (
      select l.product_id, sum(l.quantity_sent::bigint * l.unit_cost) as value,
        sum(l.quantity_sent) as units
      from ${stockTransferLine} l
      join ${stockTransfer} t on t.id = l.transfer_id
      where t.status = 'in_transit'
      group by 1
    ), held as (
      select product_id, sum(on_hand) as units from ${stockLevel} group by 1
    )
    select
      coalesce(sum(coalesce(l.value, 0) + coalesce(t.value, 0)), 0)::float8 as book,
      coalesce(sum((coalesce(h.units, 0) + coalesce(t.units, 0))::bigint * p.average_cost), 0)::float8 as at_average
    from ${product} p
    left join ledger l on l.product_id = p.id
    left join transit t on t.product_id = p.id
    left join held h on h.product_id = p.id
  `);

  const [row] = z
    .object({
      rows: z.array(
        z.object({ at_average: z.coerce.number(), book: z.coerce.number() })
      ),
    })
    .parse(result).rows;

  return { atAverage: row?.at_average ?? 0, book: row?.book ?? 0 };
};
