import "server-only";
import { cache } from "react";

import { readCompanySettings } from "@/lib/company";
import type { CompanySettings } from "@/lib/company";
import { databaseReady, getDb } from "@/lib/db";

/** The company's settings, read once per request. */
export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
  await databaseReady();

  return await readCompanySettings(getDb());
});

/** What the app calls the company: saved by head office, or the default. */
export const getCompanyName = async (): Promise<string> => {
  const settings = await getCompanySettings();

  return settings.companyName;
};
