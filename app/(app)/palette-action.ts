"use server";

import { z } from "zod";

import { getDb } from "@/lib/db";
import { searchPaletteDocuments } from "@/lib/palette-documents";
import type { PaletteResults } from "@/lib/palette-results";
import { searchPaletteProducts } from "@/lib/palette-search";
import { getScope } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

/**
 * The palette's results for whoever is signed in: products with stock in
 * their scope, and documents by number (every document page is open to
 * every signed-in person, so documents ignore the scope).
 */
export const findPaletteResults = async (
  text: string
): Promise<PaletteResults> => {
  const viewer = await requireViewer();
  const parsed = z.string().max(200).safeParse(text);

  if (!parsed.success) {
    return { documents: [], products: [] };
  }

  const db = getDb();
  const scope = await getScope(viewer);

  const [products, found] = await Promise.all([
    searchPaletteProducts(db, scope, parsed.data),
    searchPaletteDocuments(db, parsed.data),
  ]);

  return { documents: found.documents, products };
};
