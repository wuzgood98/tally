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

/**
 * Output tokens per model call. Answers are meant to be short; this caps a
 * runaway one. It's per call, not per answer, because free models count
 * their reasoning as output, and a tool step that ran out would leave the
 * answer with nothing to go on.
 */
export const ASK_MAX_OUTPUT_TOKENS = 1200;

/** Questions per person per hour. */
export const ASK_HOURLY_LIMIT = 20;

/** Earlier messages sent back with each question. */
export const ASK_HISTORY_LIMIT = 12;

/** The longest question someone may type. */
export const ASK_QUESTION_MAX_LENGTH = 500;

type Env = Readonly<Record<string, string | undefined>>;

/** Whether the server could run Ask Tally: it has an OpenRouter key. */
export const askTallyConfigured = (env: Env = process.env): boolean =>
  (env.OPENROUTER_API_KEY ?? "").trim() !== "";

/**
 * The one place that decides whether Ask Tally is on: the server has a key
 * **and** head office has opted the company in, behind the consent screen
 * on the settings page. With either missing it appears nowhere. The opt-in
 * is read from the database by `askTallyOn()` (`lib/ask/switch.ts`).
 */
export const isAskTallyOn = (
  optedIn: boolean,
  env: Env = process.env
): boolean => optedIn && askTallyConfigured(env);

/** Where the switch stands, for the settings page. */
export type AskTallyState =
  /** No key on the server: the switch can't be turned on. */
  | "no_key"
  | "off"
  | "on"
  /** Opted in, but the key has gone: hidden until it's back. */
  | "on_no_key";

export const askTallyState = (
  optedIn: boolean,
  env: Env = process.env
): AskTallyState => {
  const configured = askTallyConfigured(env);

  if (optedIn) {
    return configured ? "on" : "on_no_key";
  }

  return configured ? "off" : "no_key";
};

/**
 * The OpenRouter models to try, first choice first: `ASK_TALLY_MODEL` (one
 * id, or several separated by commas), or the defaults. Free models come
 * and go, so this swaps them without a release.
 */
export const askModelIds = (
  env: Env = process.env
): readonly [string, ...string[]] => {
  const [first, ...rest] = (env.ASK_TALLY_MODEL ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");

  return first === undefined ? ASK_DEFAULT_MODELS : [first, ...rest];
};
