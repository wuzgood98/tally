/**
 * Staff accounts. Head office adds people with a temporary password and can
 * deactivate them; deactivating ends every session at once. Accounts are
 * written in Better Auth's own format (a "credential" account holding a
 * scrypt hash), so Better Auth signs them in like any other.
 */

import { randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { personName } from "@/lib/account";
import type { Db } from "@/lib/db/client";
import { account, branch, roleEnum, session, user } from "@/lib/db/schema";
import { canManageStaff } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";

export const staffInput = z
  .object({
    branchId: z.string().trim().nullable(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address.")),
    name: personName("Enter their full name."),
    role: z.enum(roleEnum.enumValues),
  })
  .refine((input) => input.role === "admin" || Boolean(input.branchId), {
    message: "Branch staff need a branch.",
    path: ["branchId"],
  });

/** Readable over the phone: no 0/O or 1/l/I. */
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_LENGTH = 12;

export const temporaryPassword = (): string =>
  [...randomBytes(PASSWORD_LENGTH)]
    .map((byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length])
    .join("")
    .replaceAll(/(?<group>.{4})(?!$)/gu, "$<group>-");

const requireStaffManager = (actor: Actor) => {
  if (!canManageStaff(actor)) {
    throw new StockError("forbidden", "Only head office can manage staff.");
  }
};

export interface CreatedStaff {
  readonly id: string;
  /** Shown once to head office, to pass on; never stored in plain text. */
  readonly temporaryPassword: string;
}

export const createStaff = async (
  db: Db,
  actor: Actor,
  raw: z.input<typeof staffInput>
): Promise<CreatedStaff> => {
  requireStaffManager(actor);
  const parsed = staffInput.safeParse(raw);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the details."
    );
  }

  const input = parsed.data;
  const branchId = input.role === "admin" ? null : input.branchId;

  if (branchId !== null) {
    const [place] = await db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.id, branchId));

    if (place === undefined) {
      throw new StockError("not_found", "That branch doesn't exist.");
    }
  }

  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email));

  if (taken !== undefined) {
    throw new StockError(
      "invalid_input",
      "Someone already has an account with that email."
    );
  }

  const password = temporaryPassword();
  const hash = await hashPassword(password);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      branchId,
      email: input.email,
      id,
      name: input.name,
      role: input.role,
    });
    await tx.insert(account).values({
      accountId: id,
      id: randomUUID(),
      password: hash,
      providerId: "credential",
      userId: id,
    });
  });

  return { id, temporaryPassword: password };
};

const activeAdmins = async (db: Db): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(and(eq(user.role, "admin"), eq(user.banned, false)));

  return row?.value ?? 0;
};

export const setStaffActive = async (
  db: Db,
  actor: Actor,
  userId: string,
  active: boolean
): Promise<void> => {
  requireStaffManager(actor);

  if (userId === actor.id && !active) {
    throw new StockError(
      "invalid_input",
      "You can't deactivate your own account."
    );
  }

  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId));

  if (target === undefined) {
    throw new StockError("not_found", "That person doesn't exist.");
  }

  if (!active && target.role === "admin" && (await activeAdmins(db)) <= 1) {
    throw new StockError(
      "invalid_input",
      "Head office needs at least one active account."
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        banReason: active ? null : "Deactivated by head office",
        banned: !active,
      })
      .where(eq(user.id, userId));

    if (!active) {
      // Signed in elsewhere? Not any more.
      await tx.delete(session).where(eq(session.userId, userId));
    }
  });
};

export const listStaff = async (db: Db) =>
  await db
    .select({
      active: sql<boolean>`not ${user.banned}`,
      branchId: user.branchId,
      branchName: branch.name,
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
    })
    .from(user)
    .leftJoin(branch, eq(branch.id, user.branchId))
    .orderBy(
      user.banned,
      sql`${user.branchId} nulls first`,
      user.role,
      user.name
    );
