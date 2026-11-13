"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { formText } from "@/lib/form";
import { visibleBranchIds } from "@/lib/permissions";
import { listBranches, SCOPE_COOKIE } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

const ONE_YEAR = 60 * 60 * 24 * 365;

export const setScope = async (formData: FormData): Promise<void> => {
  const viewer = await requireViewer();
  const value = formText(formData, "scope");
  const branches = await listBranches();

  const visible = visibleBranchIds(
    viewer,
    branches.map((item) => item.id)
  );

  // Only someone who sees every branch has anything to switch between.
  if (visible.length < branches.length) {
    return;
  }

  if (value !== "all" && !visible.includes(value)) {
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
