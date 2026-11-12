import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";
import { databaseReady } from "@/lib/db";

/** Builds the handlers on the first request, not when the route is imported. */
const handle = (method: "GET" | "POST") => async (request: Request) =>
  await toNextJsHandler(getAuth())[method](request);

/** The local database migrates and seeds itself on first use. */
const ready =
  (handler: (request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    await databaseReady();

    return await handler(request);
  };

export const GET = ready(handle("GET"));
export const POST = ready(handle("POST"));
