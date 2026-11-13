"use server";

import { z } from "zod";

import { getDb } from "@/lib/db";
import {
  documentAccessFor,
  searchPaletteDocuments,
} from "@/lib/palette-documents";
import type { PaletteResults } from "@/lib/palette-results";
import { searchPaletteProducts } from "@/lib/palette-search";
import { getScope, listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";

/**
 * The palette's results for whoever is signed in: products with stock in
 * their scope, and documents by number that they could open by link
 * (any branch for back-office staff; a cashier's own store's sales).
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

  const [scope, branches] = await Promise.all([
    getScope(viewer),
    listBranches(),
  ]);

  const access = documentAccessFor(
    viewer,
    branches.map((item) => item.id)
  );

  const [products, found] = await Promise.all([
    searchPaletteProducts(db, scope, parsed.data),
    searchPaletteDocuments(db, parsed.data, access),
  ]);

  return { documents: found.documents, products };
};
