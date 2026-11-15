/**
 * POST /api/ask: a question for Ask Tally, answered as a streamed UI message.
 * The body is the AI SDK chat request (`{ messages }`); the session decides
 * who is asking and which branches they may see, never the body.
 *
 * 404 when Ask Tally is off or isn't for this person (as a page that isn't
 * theirs would), 401 signed out, 403 from another site, 400 for a bad body,
 * 429 over the hourly limit; errors are `{ error: { code, message } }`.
 */

import { openrouter } from "@openrouter/ai-sdk-provider";
import { createAgentUIStreamResponse, safeValidateUIMessages } from "ai";
import { z } from "zod";

import { createAskAgent } from "@/lib/ask/agent";
import { serverAskData } from "@/lib/ask/data-server";
import { trimHistory } from "@/lib/ask/history";
import { createRateLimiter } from "@/lib/ask/rate-limit";
import {
  ASK_HOURLY_LIMIT,
  askModelIds,
  askTallyEnabled,
} from "@/lib/ask/settings";
import { formatDateTime } from "@/lib/format";
import { canAskTally } from "@/lib/permissions";
import { getCompanyName } from "@/lib/queries/company";
import { getScope, listBranches } from "@/lib/scope";
import { getViewer } from "@/lib/session";

/** Seconds: a few tool calls and a short answer, with room to spare. */
export const maxDuration = 60;

const HOUR_MS = 3_600_000;

const limiter = createRateLimiter({
  limit: ASK_HOURLY_LIMIT,
  windowMs: HOUR_MS,
});

const askBody = z.object({ messages: z.array(z.unknown()).max(200) });

const failure = (
  status: number,
  code: string,
  message: string,
  extra: Record<string, string> = {}
): Response =>
  Response.json({ error: { code, message, ...extra } }, { status });

/** The body as JSON, or null when it isn't JSON at all. */
const readJson = async (request: Request) => {
  try {
    return askBody.safeParse(await request.json());
  } catch {
    return null;
  }
};

/**
 * Only this site may ask. Browsers say where a request came from in
 * `Sec-Fetch-Site`; an older one that doesn't still sends `Origin` with a
 * POST, which must be this site's. A request with neither isn't from a
 * browser, so it can't be a forged one, and the session still decides.
 */
const fromThisSite = (request: Request): boolean => {
  const site = request.headers.get("sec-fetch-site");

  if (site !== null) {
    return site === "same-origin";
  }

  const origin = request.headers.get("origin");

  return origin === null || origin === new URL(request.url).origin;
};

export const POST = async (request: Request): Promise<Response> => {
  if (!askTallyEnabled()) {
    return failure(404, "not_found", "Ask Tally isn't turned on.");
  }

  if (!fromThisSite(request)) {
    return failure(403, "forbidden", "Ask Tally only answers Tally itself.");
  }

  const viewer = await getViewer();

  if (viewer === null) {
    return failure(401, "unauthorized", "Sign in to ask Tally.");
  }

  if (!canAskTally(viewer)) {
    return failure(404, "not_found", "Ask Tally isn't turned on.");
  }

  const body = await readJson(request);

  const validated =
    body !== null && body.success
      ? await safeValidateUIMessages({ messages: body.data.messages })
      : null;

  if (validated === null || !validated.success) {
    return failure(
      400,
      "invalid_input",
      "That isn't a question Tally can read."
    );
  }

  const history = trimHistory(validated.data);

  if (!history.ok) {
    return failure(400, "invalid_input", history.error);
  }

  const decision = limiter.take(viewer.id);

  if (!decision.allowed) {
    return failure(
      429,
      "rate_limited",
      `You've asked ${ASK_HOURLY_LIMIT} questions this hour. Try again at ${formatDateTime(decision.retryAt)}.`,
      { retryAt: decision.retryAt.toISOString() }
    );
  }

  const [scope, branches, companyName] = await Promise.all([
    getScope(viewer),
    listBranches(),
    getCompanyName(),
  ]);

  // OpenRouter tries these in order when the first is busy or gone.
  const models = askModelIds();

  const agent = createAskAgent({
    companyName,
    context: { branches, now: new Date(), scope, viewer },
    data: serverAskData,
    model: openrouter(models[0], { models: [...models] }),
    viewerName: viewer.name,
  });

  return await createAgentUIStreamResponse({
    abortSignal: request.signal,
    agent,
    onError: () => "Ask Tally couldn't answer just now. Try again.",
    uiMessages: history.messages,
  });
};
