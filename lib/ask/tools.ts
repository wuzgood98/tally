/**
 * Every tool Ask Tally may use for this person. Cashiers get none; the report
 * tools are only offered to people who can see reports, so the model never
 * learns they exist for anyone else.
 */

import type { ToolDeps } from "@/lib/ask/tool-kit";
import { documentTools } from "@/lib/ask/tools-documents";
import { reportTools } from "@/lib/ask/tools-reports";
import { salesTools } from "@/lib/ask/tools-sales";
import { stockTools } from "@/lib/ask/tools-stock";
import { canAskTally, canViewReports } from "@/lib/permissions";

type BaseTools = ReturnType<typeof stockTools> &
  ReturnType<typeof documentTools> &
  ReturnType<typeof salesTools>;

export type AskTools = BaseTools & Partial<ReturnType<typeof reportTools>>;

export const askTools = (deps: ToolDeps): AskTools | null => {
  const { viewer } = deps.context;

  if (!canAskTally(viewer)) {
    return null;
  }

  const base: BaseTools = {
    ...stockTools(deps),
    ...documentTools(deps),
    ...salesTools(deps),
  };

  return canViewReports(viewer) ? { ...base, ...reportTools(deps) } : base;
};
