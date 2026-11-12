import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { getAuth } from "@/lib/auth";
import { databaseReady } from "@/lib/db";
import { roleEnum } from "@/lib/db/schema";
import type { Role } from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";

export interface Viewer extends Actor {
  readonly name: string;
  readonly email: string;
}

const isRole = (value: unknown): value is Role =>
  roleEnum.enumValues.some((role) => role === value);

/** The signed-in staff member, or null. Once per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Signed-in pages are per request: never prerender them at build time.
  await connection();
  await databaseReady();
  const result = await getAuth().api.getSession({ headers: await headers() });

  if (!result || result.user.banned === true) {
    return null;
  }

  const { branchId, email, id, name, role } = result.user;

  if (!isRole(role)) {
    return null;
  }

  return { branchId: branchId ?? null, email, id, name, role };
});

/** For pages and actions that need someone signed in. */
export const requireViewer = async (): Promise<Viewer> => {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/login");
  }

  return viewer;
};
