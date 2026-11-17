import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { requestJson, TillHttpError } from "@/lib/till/client/http";

const failure = async (response: Response): Promise<TillHttpError> => {
  vi.stubGlobal("fetch", async () => await Promise.resolve(response));

  try {
    await requestJson("/api/till/sales", z.object({}));
  } catch (error) {
    if (error instanceof TillHttpError) {
      return error;
    }

    throw error;
  }

  throw new Error("The request should have failed.");
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("telling a refusal from a failure worth retrying", () => {
  it("takes Tally's own 403 as a refusal for good", async () => {
    const error = await failure(
      Response.json(
        { error: { code: "forbidden", message: "You can't sell here." } },
        { status: 403 }
      )
    );

    expect(error.refused).toBe(true);
    expect(error.message).toBe("You can't sell here.");
  });

  it("retries a 404 page from something other than Tally", async () => {
    const error = await failure(
      new Response("<h1>Not found</h1>", {
        headers: { "Content-Type": "text/html" },
        status: 404,
      })
    );

    expect(error.status).toBe(404);
    expect(error.refused).toBe(false);
  });

  it("retries an expired session", async () => {
    const error = await failure(
      Response.json(
        { error: { code: "unauthorized", message: "Sign in again." } },
        { status: 401 }
      )
    );

    expect(error.refused).toBe(false);
  });
});

describe("seeing the answer", () => {
  it("shows a good answer to onAnswer before handing back the data", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        await Promise.resolve(
          Response.json(
            { sales: [] },
            { headers: { "X-Tally-Saved-At": "2026-11-16T09:14:00.000Z" } }
          )
        )
    );
    const stamps: (string | null)[] = [];

    const data = await requestJson(
      "/api/till/sales",
      z.object({ sales: z.array(z.never()) }),
      {
        onAnswer: (response) => {
          stamps.push(response.headers.get("X-Tally-Saved-At"));
        },
      }
    );

    expect(data).toEqual({ sales: [] });
    expect(stamps).toEqual(["2026-11-16T09:14:00.000Z"]);
  });

  it("doesn't show it a failure", async () => {
    const onAnswer = vi.fn<(response: Response) => void>();
    vi.stubGlobal(
      "fetch",
      async () => await Promise.resolve(new Response("down", { status: 503 }))
    );

    await expect(
      requestJson("/api/till/sales", z.object({}), { onAnswer })
    ).rejects.toThrow(TillHttpError);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
