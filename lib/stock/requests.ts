/**
 * Stock requests: a store asking the warehouse for stock. The store's manager
 * (or head office) raises one; warehouse staff fulfil it by sending a
 * transfer, which closes it. Either side can cancel one still open.
 *
 * Fulfilling claims the request and sends the transfer in one transaction, so
 * two people at the warehouse can't both send stock for the same request.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import {
  branch,
  product,
  stockRequest,
  stockRequestLine,
} from "@/lib/db/schema";
import type { StockRequestStatus } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/notify";
import { canDispatchTransfer, canRequestStock } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { nextDocumentNumber } from "@/lib/stock/ledger";
import { dispatchTransfer, MAX_TRANSFER_QUANTITY } from "@/lib/stock/transfer";

export const MAX_REQUEST_LINES = 200;

const requestLines = z
  .array(
    z.object({
      productId: z.int().positive(),
      quantity: z
        .int("Quantities are whole units.")
        .positive("Quantities must be at least 1.")
        .max(MAX_TRANSFER_QUANTITY, "That quantity looks wrong: check it."),
    })
  )
  .min(1, "Add at least one product.")
  .max(MAX_REQUEST_LINES)
  .refine(
    (lines) =>
      new Set(lines.map((line) => line.productId)).size === lines.length,
    "Each product can appear only once."
  );

const note = z.string().trim().max(500).optional();

export const stockRequestInput = z.object({
  branchId: z.string().min(1),
  lines: requestLines,
  note,
});

export type StockRequestRawInput = z.input<typeof stockRequestInput>;

export const fulfilInput = z.object({
  /** What is actually being sent: the requested products, up to what was asked. */
  lines: requestLines,
  note,
  requestId: z.int().positive(),
});

export type FulfilRawInput = z.input<typeof fulfilInput>;

export const cancelRequestInput = z.object({
  note,
  requestId: z.int().positive(),
});

export type CancelRequestRawInput = z.input<typeof cancelRequestInput>;

export interface StockRequestResult {
  readonly id: number;
  readonly number: string;
  readonly status: StockRequestStatus;
  /** Set once fulfilled. */
  readonly transferId: number | null;
}

const parse = <S extends z.ZodType>(
  schema: S,
  raw: z.input<S>,
  fallback: string
): z.output<S> => {
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? fallback
    );
  }

  return parsed.data;
};

const textOrNull = (value: string | undefined): string | null =>
  (value ?? "") === "" ? null : (value ?? null);

/** The store asking, and the warehouse it asks. */
const loadBranches = async (db: Db, storeId: string) => {
  const branches = await db
    .select({ id: branch.id, kind: branch.kind })
    .from(branch)
    .orderBy(branch.id);

  const store = branches.find((item) => item.id === storeId);
  const warehouse = branches.find((item) => item.kind === "warehouse");

  if (store === undefined) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (store.kind !== "store") {
    throw new StockError(
      "invalid_input",
      "Only stores request stock from the warehouse."
    );
  }

  if (warehouse === undefined) {
    throw new StockError("not_found", "There's no warehouse to ask.");
  }

  return { warehouseId: warehouse.id };
};

export const requestStock = async (
  db: Db,
  actor: Actor,
  rawInput: StockRequestRawInput
): Promise<StockRequestResult> => {
  const input = parse(stockRequestInput, rawInput, "Check the request.");

  if (!canRequestStock(actor, input.branchId)) {
    throw new StockError(
      "forbidden",
      "Only this store's manager, or head office, can request stock for it."
    );
  }

  const [{ warehouseId }, products] = await Promise.all([
    loadBranches(db, input.branchId),
    db
      .select({ active: product.active, name: product.name })
      .from(product)
      .where(
        inArray(
          product.id,
          input.lines.map((line) => line.productId)
        )
      ),
  ]);

  if (products.length !== input.lines.length) {
    throw new StockError(
      "not_found",
      "A product on this request doesn't exist."
    );
  }

  const inactive = products.find((row) => !row.active);

  if (inactive !== undefined) {
    throw new StockError(
      "invalid_input",
      `${inactive.name} is discontinued and can't be requested.`
    );
  }

  return await db.transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "REQ", input.branchId);

    const [request] = await tx
      .insert(stockRequest)
      .values({
        branchId: input.branchId,
        createdById: actor.id,
        fromBranchId: warehouseId,
        note: textOrNull(input.note),
        number,
      })
      .returning({ id: stockRequest.id });

    if (request === undefined) {
      throw new Error("Inserting a stock request returned no row.");
    }

    await tx
      .insert(stockRequestLine)
      .values(input.lines.map((line) => ({ ...line, requestId: request.id })));

    await notify(tx, actor, {
      branchId: input.branchId,
      fromBranchId: warehouseId,
      kind: "request_raised",
      requestId: request.id,
    });

    return { id: request.id, number, status: "requested", transferId: null };
  });
};

interface LoadedRequest {
  readonly id: number;
  readonly number: string;
  readonly branchId: string;
  readonly fromBranchId: string;
  readonly status: StockRequestStatus;
}

const loadRequest = async (db: Db, id: number): Promise<LoadedRequest> => {
  const [row] = await db
    .select({
      branchId: stockRequest.branchId,
      fromBranchId: stockRequest.fromBranchId,
      id: stockRequest.id,
      number: stockRequest.number,
      status: stockRequest.status,
    })
    .from(stockRequest)
    .where(eq(stockRequest.id, id));

  if (row === undefined) {
    throw new StockError("not_found", "That stock request doesn't exist.");
  }

  return row;
};

const SETTLED: Record<Exclude<StockRequestStatus, "requested">, string> = {
  cancelled: "was cancelled",
  fulfilled: "has already been fulfilled",
};

const assertOpen = (request: LoadedRequest): void => {
  if (request.status !== "requested") {
    throw new StockError(
      "conflict",
      `${request.number} ${SETTLED[request.status]}.`
    );
  }
};

export const fulfilStockRequest = async (
  db: Db,
  actor: Actor,
  rawInput: FulfilRawInput
): Promise<StockRequestResult> => {
  const input = parse(fulfilInput, rawInput, "Check what's being sent.");
  const request = await loadRequest(db, input.requestId);

  if (!canDispatchTransfer(actor, request.fromBranchId)) {
    throw new StockError(
      "forbidden",
      "Only warehouse staff, or head office, can fulfil a request."
    );
  }

  assertOpen(request);

  const asked = await db
    .select({
      productId: stockRequestLine.productId,
      quantity: stockRequestLine.quantity,
    })
    .from(stockRequestLine)
    .where(eq(stockRequestLine.requestId, request.id));

  const askedFor = new Map(
    asked.map((line) => [line.productId, line.quantity])
  );

  for (const line of input.lines) {
    const wanted = askedFor.get(line.productId);

    if (wanted === undefined) {
      throw new StockError(
        "invalid_input",
        `A product being sent wasn't on ${request.number}.`
      );
    }

    if (line.quantity > wanted) {
      throw new StockError(
        "invalid_input",
        `${request.number} asked for ${wanted} of a product; send at most that.`
      );
    }
  }

  return await db.transaction(async (tx) => {
    // Claim the request first: a second fulfilment waits here, then finds it closed.
    const [locked] = await tx
      .select({ status: stockRequest.status })
      .from(stockRequest)
      .where(eq(stockRequest.id, request.id))
      .for("update");

    assertOpen({ ...request, status: locked?.status ?? "cancelled" });

    // Runs inside this transaction (as a savepoint): if the transfer fails,
    // the request stays open.
    const transfer = await dispatchTransfer(tx, actor, {
      fromBranchId: request.fromBranchId,
      lines: input.lines,
      note: input.note ?? `For ${request.number}`,
      toBranchId: request.branchId,
    });

    await tx
      .update(stockRequest)
      .set({
        fulfilledAt: new Date(),
        status: "fulfilled",
        transferId: transfer.id,
      })
      .where(eq(stockRequest.id, request.id));

    return {
      id: request.id,
      number: request.number,
      status: "fulfilled",
      transferId: transfer.id,
    };
  });
};

/** The store that asked, or the warehouse that can't supply, can call it off. */
export const cancelStockRequest = async (
  db: Db,
  actor: Actor,
  rawInput: CancelRequestRawInput
): Promise<StockRequestResult> => {
  const input = parse(cancelRequestInput, rawInput, "Check the cancellation.");
  const request = await loadRequest(db, input.requestId);

  if (
    !canRequestStock(actor, request.branchId) &&
    !canDispatchTransfer(actor, request.fromBranchId)
  ) {
    throw new StockError("forbidden", "You can't cancel this request.");
  }

  assertOpen(request);

  await db.transaction(async (tx) => {
    const cancelled = await tx
      .update(stockRequest)
      .set({
        cancelledAt: new Date(),
        cancelledById: actor.id,
        // Keep what the store wrote; add why it was called off.
        note:
          textOrNull(input.note) === null
            ? undefined
            : sql`concat_ws(' · ', ${stockRequest.note}, ${`Cancelled: ${input.note ?? ""}`}::text)`,
        status: "cancelled",
      })
      .where(
        and(
          eq(stockRequest.id, request.id),
          eq(stockRequest.status, "requested")
        )
      )
      .returning({ id: stockRequest.id });

    if (cancelled.length === 0) {
      assertOpen(await loadRequest(tx, request.id));
      throw new Error("An open stock request could not be cancelled.");
    }

    await notify(tx, actor, {
      branchId: request.branchId,
      fromBranchId: request.fromBranchId,
      kind: "request_cancelled",
      requestId: request.id,
    });
  });

  return {
    id: request.id,
    number: request.number,
    status: "cancelled",
    transferId: null,
  };
};
