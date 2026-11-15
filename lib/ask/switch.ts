import "server-only";
import { isAskTallyOn } from "@/lib/ask/settings";
import { getCompanySettings } from "@/lib/queries/company";

/** Ask Tally is on: a key on the server and the company's opt-in. */
export const askTallyOn = async (): Promise<boolean> => {
  const settings = await getCompanySettings();

  return isAskTallyOn(settings.askTally.on);
};
