/**
 * POS tills and their API keys. A key is shown once, when the till is
 * created; only its SHA-256 hash is kept. Keys are 32 random bytes, so a
 * plain hash is enough: there's nothing to guess, unlike a password.
 */

import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import { branch, till } from "@/lib/db/schema";
import { canManageTills } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import type { TillIdentity } from "@/lib/stock/sales";

const KEY_PREFIX = "tly_";
const KEY_BYTES = 32;

/** Enough of the key to tell tills apart on screen, nowhere near enough to use. */
const SHOWN_CHARACTERS = 12;

const hashKey = (key: string): string =>
  createHash("sha256").update(key).digest("hex");

export const tillInput = z.object({
  branchId: z.string().min(1, "Choose the store this till is in."),
  name: z
    .string()
    .trim()
    .min(1, "Give the till a name the shop will recognise.")
    .max(60),
});

export type TillRawInput = z.input<typeof tillInput>;

export interface CreatedTill {
  readonly id: number;
  /** The only time the full key exists outside the till itself. */
  readonly key: string;
}

export const createTill = async (
  db: Db,
  actor: Actor,
  rawInput: TillRawInput
): Promise<CreatedTill> => {
  if (!canManageTills(actor)) {
    throw new StockError("forbidden", "Only head office can add tills.");
  }

  const parsed = tillInput.safeParse(rawInput);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the till."
    );
  }

  const [store] = await db
    .select({ kind: branch.kind })
    .from(branch)
    .where(eq(branch.id, parsed.data.branchId));

  if (store === undefined) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (store.kind !== "store") {
    throw new StockError(
      "invalid_input",
      "Tills are for stores; the warehouse doesn't sell."
    );
  }

  const key = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString("base64url")}`;

  const [row] = await db
    .insert(till)
    .values({
      branchId: parsed.data.branchId,
      createdById: actor.id,
      keyHash: hashKey(key),
      keyPrefix: key.slice(0, SHOWN_CHARACTERS),
      name: parsed.data.name,
    })
    .returning({ id: till.id });

  if (row === undefined) {
    throw new Error("Inserting a till returned no row.");
  }

  return { id: row.id, key };
};

export const revokeTill = async (
  db: Db,
  actor: Actor,
  tillId: number
): Promise<void> => {
  if (!canManageTills(actor)) {
    throw new StockError("forbidden", "Only head office can revoke tills.");
  }

  const revoked = await db
    .update(till)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(till.id, tillId), isNull(till.revokedAt)))
    .returning({ id: till.id });

  if (revoked.length === 0) {
    throw new StockError(
      "conflict",
      "That till doesn't exist or is already revoked."
    );
  }
};

const BEARER = /^Bearer\s+(?<key>\S+)$/u;

/**
 * The till behind an `Authorization: Bearer tly_…` header, or null for a
 * missing, unknown or revoked key. Notes when the till was last heard from.
 */
export const authenticateTill = async (
  db: Db,
  authorization: string | null
): Promise<TillIdentity | null> => {
  const key = BEARER.exec(authorization ?? "")?.groups?.key;

  if (key === undefined || !key.startsWith(KEY_PREFIX)) {
    return null;
  }

  const [row] = await db
    .update(till)
    .set({ lastUsedAt: sql`now()` })
    .where(and(eq(till.keyHash, hashKey(key)), isNull(till.revokedAt)))
    .returning({ branchId: till.branchId, tillId: till.id });

  return row ?? null;
};
