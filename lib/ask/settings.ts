/**
 * Whether Ask Tally is on, and the limits it runs within. Kept free of
 * server-only imports so it can be tested.
 */

/**
 * The OpenRouter models used when `ASK_TALLY_MODEL` isn't set, in order:
 * OpenRouter tries the next when one is busy or gone. These are the free
 * models that did best on Tally's questions (`pnpm eval:ask`, November
 * 2026): Nemotron passed every question; Ling answered well but its one
 * upstream was often rate limited.
 */
export const ASK_DEFAULT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "inclusionai/ling-3.2-flash:free",
] as const;

/** Model calls per answer, tool calls included. */
export const ASK_MAX_STEPS = 5;

/** Answers are meant to be short; this caps a runaway one. */
export const ASK_MAX_OUTPUT_TOKENS = 1200;

/** Questions per person per hour. */
export const ASK_HOURLY_LIMIT = 20;

/** Earlier messages sent back with each question. */
export const ASK_HISTORY_LIMIT = 12;

/** The longest question someone may type. */
export const ASK_QUESTION_MAX_LENGTH = 500;

type Env = Readonly<Record<string, string | undefined>>;

/**
 * On when the server has an OpenRouter key. When the settings page exists,
 * this is also where the company's opt-in (head office, behind a consent
 * screen) gets checked; nothing else should decide.
 */
export const askTallyEnabled = (env: Env = process.env): boolean =>
  (env.OPENROUTER_API_KEY ?? "").trim() !== "";

/**
 * The OpenRouter models to try, first choice first: `ASK_TALLY_MODEL` (one
 * id, or several separated by commas), or the defaults. Free models come
 * and go, so this swaps them without a release.
 */
export const askModelIds = (env: Env = process.env): string[] => {
  const chosen = (env.ASK_TALLY_MODEL ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");

  return chosen.length > 0 ? chosen : [...ASK_DEFAULT_MODELS];
};
