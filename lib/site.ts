/** The retailer's name, shown in the app. Set TALLY_COMPANY_NAME for a real deployment. */
export const COMPANY_NAME = process.env.TALLY_COMPANY_NAME ?? "Akwaaba Mall";

export const ROLE_LABELS = {
  admin: "Head office",
  manager: "Branch manager",
  storekeeper: "Storekeeper",
} as const;
