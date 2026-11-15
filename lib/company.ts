/**
 * Company-wide settings: the name in the app and on paperwork, where new
 * products' reorder points start, and the footer printed on receipts. One
 * row in `company_settings`; until head office saves, the defaults apply.
 */

import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import { companySettings, user } from "@/lib/db/schema";
import { canManageAskTally, canManageCompany } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";

/** Until head office names the company, the deployment's name, or the demo's. */
export const fallbackCompanyName = (
  env: Readonly<Record<string, string | undefined>> = process.env
): string => env.TALLY_COMPANY_NAME ?? "Akwaaba Mall";

/** The product schema's own default (`product.reorder_point`). */
export const DEFAULT_REORDER_POINT = 10;

export const RECEIPT_FOOTER_MAX = 160;

const MAX_REORDER_POINT = 100_000;

/** Who last did something, and when; null if nobody has. */
export interface Stamp {
  readonly at: Date;
  readonly by: string;
}

export interface CompanySettings {
  readonly companyName: string;
  readonly defaultReorderPoint: number;
  /** Null prints no footer. */
  readonly receiptFooter: string | null;
  readonly saved: Stamp | null;
  /** The company's opt-in only; the server also needs a key (`lib/ask/settings.ts`). */
  readonly askTally: {
    readonly on: boolean;
    readonly turnedOn: Stamp | null;
    readonly turnedOff: Stamp | null;
  };
}

/** Line breaks kept (a footer may be two lines), but no blank lines. */
const tidyFooter = (value: string): string =>
  value
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");

export const companyInput = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Enter the company's name.")
    .max(80, "Keep the name under 80 characters."),
  defaultReorderPoint: z
    // NaN (`formInt` on anything but digits) is "not a number" too.
    .number({ error: "Enter a whole number of units." })
    .int("Use a whole number of units.")
    .min(0, "A reorder point can't be negative.")
    .max(MAX_REORDER_POINT, "That's more than any shelf holds."),
  receiptFooter: z
    .string()
    .transform(tidyFooter)
    .pipe(
      z
        .string()
        .max(
          RECEIPT_FOOTER_MAX,
          `Keep the footer to ${RECEIPT_FOOTER_MAX} characters.`
        )
    ),
});

const stamp = (at: Date | null, by: string | null): Stamp | null =>
  at === null || by === null ? null : { at, by };

export const readCompanySettings = async (
  db: Db,
  env?: Readonly<Record<string, string | undefined>>
): Promise<CompanySettings> => {
  const savedBy = alias(user, "saved_by");
  const enabledBy = alias(user, "ask_enabled_by");
  const disabledBy = alias(user, "ask_disabled_by");

  const [row] = await db
    .select({
      askTallyDisabledAt: companySettings.askTallyDisabledAt,
      askTallyDisabledBy: disabledBy.name,
      askTallyEnabled: companySettings.askTallyEnabled,
      askTallyEnabledAt: companySettings.askTallyEnabledAt,
      askTallyEnabledBy: enabledBy.name,
      companyName: companySettings.companyName,
      defaultReorderPoint: companySettings.defaultReorderPoint,
      receiptFooter: companySettings.receiptFooter,
      savedBy: savedBy.name,
      updatedAt: companySettings.updatedAt,
    })
    .from(companySettings)
    .leftJoin(savedBy, eq(savedBy.id, companySettings.updatedById))
    .leftJoin(enabledBy, eq(enabledBy.id, companySettings.askTallyEnabledById))
    .leftJoin(
      disabledBy,
      eq(disabledBy.id, companySettings.askTallyDisabledById)
    );

  if (row === undefined) {
    return {
      askTally: { on: false, turnedOff: null, turnedOn: null },
      companyName: fallbackCompanyName(env),
      defaultReorderPoint: DEFAULT_REORDER_POINT,
      receiptFooter: null,
      saved: null,
    };
  }

  return {
    askTally: {
      on: row.askTallyEnabled,
      turnedOff: stamp(row.askTallyDisabledAt, row.askTallyDisabledBy),
      turnedOn: stamp(row.askTallyEnabledAt, row.askTallyEnabledBy),
    },
    companyName: row.companyName ?? fallbackCompanyName(env),
    defaultReorderPoint: row.defaultReorderPoint,
    receiptFooter: row.receiptFooter,
    saved: stamp(row.updatedAt, row.savedBy),
  };
};

/** Head office saves the company section; one row, written in place. */
export const saveCompany = async (
  db: Db,
  actor: Actor,
  raw: z.input<typeof companyInput>
): Promise<void> => {
  if (!canManageCompany(actor)) {
    throw new StockError(
      "forbidden",
      "Only head office can change company settings."
    );
  }

  const parsed = companyInput.safeParse(raw);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the company settings."
    );
  }

  const values = {
    companyName: parsed.data.companyName,
    defaultReorderPoint: parsed.data.defaultReorderPoint,
    receiptFooter:
      parsed.data.receiptFooter === "" ? null : parsed.data.receiptFooter,
    updatedAt: sql`now()`,
    updatedById: actor.id,
  };

  await db
    .insert(companySettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ set: values, target: companySettings.id });
};

/**
 * Head office turns Ask Tally on for the company (the settings page asks for
 * consent first) or off. The row keeps who did each, and when.
 */
export const setAskTally = async (
  db: Db,
  actor: Actor,
  on: boolean
): Promise<void> => {
  if (!canManageAskTally(actor)) {
    throw new StockError(
      "forbidden",
      "Only head office can turn Ask Tally on or off."
    );
  }

  const values = on
    ? {
        askTallyEnabled: true,
        askTallyEnabledAt: sql`now()`,
        askTallyEnabledById: actor.id,
      }
    : {
        askTallyDisabledAt: sql`now()`,
        askTallyDisabledById: actor.id,
        askTallyEnabled: false,
      };

  await db
    .insert(companySettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ set: values, target: companySettings.id });
};
