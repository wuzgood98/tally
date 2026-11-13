"use server";

import { z } from "zod";

import { getDb } from "@/lib/db";
import { searchPaletteProducts } from "@/lib/palette-search";
import type { PaletteProduct } from "@/lib/palette-search";
import { getScope } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

/** The palette's product results, for whoever is signed in, in their scope. */
export const findPaletteProducts = async (
  text: string
): Promise<PaletteProduct[]> => {
  const viewer = await requireViewer();
  const parsed = z.string().max(200).safeParse(text);

  if (!parsed.success) {
    return [];
  }

  const scope = await getScope(viewer);

  return await searchPaletteProducts(getDb(), scope, parsed.data);
};
