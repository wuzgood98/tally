import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { getDb } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";

const EIGHT_HOURS = 60 * 60 * 8;
const ONE_HOUR = 60 * 60;

/**
 * Staff sign in with email and password. There is no public sign-up: head
 * office creates accounts. Deactivating someone (the admin plugin's "ban")
 * ends their sessions and stops them signing in.
 */
const createAuth = () =>
  betterAuth({
    appName: "Tally",
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { account, session, user, verification },
    }),
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    plugins: [
      admin({
        adminRoles: ["admin"],
        bannedUserMessage:
          "This account has been deactivated. Ask head office if you need access.",
        defaultRole: "storekeeper",
      }),
      // Lets Server Actions set the session cookie. Must be last.
      nextCookies(),
    ],
    // No cookie cache: every request checks the session in the database, so a
    // deactivation or role change takes effect on the very next click.
    session: {
      // Long enough for a shift; short enough that a shared PC logs out.
      expiresIn: EIGHT_HOURS,
      updateAge: ONE_HOUR,
    },
    user: {
      additionalFields: {
        branchId: { input: false, required: false, type: "string" },
      },
    },
  });

type Auth = ReturnType<typeof createAuth>;

// SAFETY: the slot is only ever written below, with this type.
const globalForAuth = globalThis as typeof globalThis & { tallyAuth?: Auth };

/** Created on first use, like the database connection it sits on. */
export const getAuth = (): Auth => {
  globalForAuth.tallyAuth ??= createAuth();

  return globalForAuth.tallyAuth;
};
