/**
 * Fetching the till endpoints from the browser. Every failure becomes a
 * `TillHttpError` carrying the status, so the caller and the offline queue
 * can tell a refusal for good (`refused`: one of `REFUSED_STATUSES`, in
 * Tally's own JSON) from one worth retrying (401, 5xx, an answer from
 * something other than Tally, no connection at all: status 0).
 */

import { z } from "zod";

import { REFUSED_STATUSES } from "@/lib/http";

/** The `{ error: { code, message } }` every till endpoint answers a failure with. */
const failureBody = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

/** The code for a failure that wasn't Tally's JSON: a proxy's or a host's error page. */
const NOT_FROM_TALLY = "http_error";

export class TillHttpError extends Error {
  /** HTTP status; 0 when the request never got an answer (offline, DNS, CORS). */
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TillHttpError";
    this.status = status;
    this.code = code;
  }

  /**
   * True when Tally itself will never accept the request as it stands. A 4xx
   * page from something in between (a proxy, the host) isn't Tally's answer,
   * so it's worth trying again.
   */
  get refused(): boolean {
    return REFUSED_STATUSES.has(this.status) && this.code !== NOT_FROM_TALLY;
  }
}

const OFFLINE_MESSAGE =
  "Couldn't reach Tally. Check the connection and try again.";

/** The JSON body parsed with `schema`; no body (an HTML error page, an empty reply) fails the parse. */
const parseJson = async <T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<z.ZodSafeParseResult<T>> => {
  const isJson =
    response.headers.get("content-type")?.includes("application/json") === true;

  return schema.safeParse(isJson ? await response.json() : null);
};

const failureFrom = async (response: Response): Promise<TillHttpError> => {
  const failure = await parseJson(response, failureBody);

  return failure.success
    ? new TillHttpError(
        response.status,
        failure.data.error.code,
        failure.data.error.message
      )
    : new TillHttpError(
        response.status,
        NOT_FROM_TALLY,
        `Tally answered ${String(response.status)}.`
      );
};

/**
 * Sends a request and parses the JSON answer with `schema`. Redirects are
 * errors: the endpoints never redirect, so one means something in between
 * (a sign-in page, a captive portal) answered instead, and that must never
 * look like success.
 */
export const requestJson = async <T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {}
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers,
      redirect: "error",
    });
  } catch (error) {
    if (init.signal?.aborted === true) {
      throw error;
    }

    throw new TillHttpError(0, "offline", OFFLINE_MESSAGE);
  }

  if (!response.ok) {
    throw await failureFrom(response);
  }

  const parsed = await parseJson(response, schema);

  if (!parsed.success) {
    throw new TillHttpError(
      response.status,
      "bad_response",
      "Tally sent an answer the till doesn't understand. Reload the page."
    );
  }

  return parsed.data;
};
