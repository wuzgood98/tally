import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { passwordInput, renameSelf } from "@/lib/account";
import { badgeBarcode, initialsOf } from "@/lib/badge";
import { isValidGtin } from "@/lib/barcode";
import { user } from "@/lib/db/schema";
import { createTestWorld, rejection } from "@/test/db";
import type { TestWorld } from "@/test/db";

let world: TestWorld;

beforeAll(async () => {
  world = await createTestWorld();
});

afterAll(async () => {
  await world.connection.close();
});

const nameOf = async (id: string): Promise<string | undefined> => {
  const [row] = await world.db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, id));

  return row?.name;
};

describe("renameSelf", () => {
  it("changes only the actor's own name, trimmed", async () => {
    const before = await nameOf(world.spintexManager.id);

    await renameSelf(world.db, world.spintexCashier, {
      name: "  Abena Owusu-Ansah ",
    });

    expect(await nameOf(world.spintexCashier.id)).toBe("Abena Owusu-Ansah");
    expect(await nameOf(world.spintexManager.id)).toBe(before);
  });

  it("refuses a name too short to be a name", async () => {
    const error = await rejection(
      renameSelf(world.db, world.spintexCashier, { name: " A " })
    );

    expect(error.message).toBe("Enter your full name.");
  });
});

describe("passwordInput", () => {
  it("needs ten characters and a change", () => {
    const short = passwordInput.safeParse({
      currentPassword: "akwaaba-demo",
      newPassword: "short",
      signOutOthers: true,
    });

    const same = passwordInput.safeParse({
      currentPassword: "akwaaba-demo",
      newPassword: "akwaaba-demo",
      signOutOthers: true,
    });

    const fine = passwordInput.safeParse({
      currentPassword: "akwaaba-demo",
      newPassword: "kente-cloth-42",
      signOutOthers: false,
    });

    expect(short.error?.issues[0]?.message).toBe("Use at least 10 characters.");
    expect(same.error?.issues[0]?.message).toBe(
      "Choose a password you aren't using now."
    );
    expect(fine.success).toBe(true);
  });
});

describe("initialsOf", () => {
  it("takes the first two words", () => {
    expect(initialsOf("efua  asante")).toBe("EA");
    expect(initialsOf("Kofi")).toBe("K");
    expect(initialsOf("Ama Serwaa Mensah")).toBe("AS");
  });
});

describe("badgeBarcode", () => {
  it("is a valid Ghana EAN-13, the same each time", () => {
    const code = badgeBarcode("user_8f3k2m");

    expect(code).toMatch(/^603\d{10}$/u);
    expect(isValidGtin(code)).toBe(true);
    expect(badgeBarcode("user_8f3k2m")).toBe(code);
    expect(badgeBarcode("user_other")).not.toBe(code);
  });
});
