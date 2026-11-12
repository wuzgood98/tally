"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { formText } from "@/lib/form";
import { listBranches, SCOPE_COOKIE } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

const ONE_YEAR = 60 * 60 * 24 * 365;

export const setScope = async (formData: FormData): Promise<void> => {
  await requireViewer();
  const value = formText(formData, "scope");
  const branches = await listBranches();

  if (value !== "all" && !branches.some((item) => item.id === value)) {
    return;
  }

  const jar = await cookies();
  jar.set(SCOPE_COOKIE, value, {
    httpOnly: true,
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
};
