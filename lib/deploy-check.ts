/**
 * Stops a hosted build that would deploy without a database. Without
 * DATABASE_URL, Tally falls back to PGlite in `.data/pglite`, which a
 * serverless host can't run: the filesystem is read-only, the first-run seed
 * outlasts a function's time limit, and nothing would persist between
 * instances. The build passed and every page failed, so fail the build.
 *
 * Only hosted builds are checked (Vercel sets VERCEL=1 while building), so
 * a local `pnpm build` still works with the built-in PGlite database.
 *
 * Plain module with no "@/" imports: next.config.ts loads it directly.
 */

type Env = Readonly<Record<string, string | undefined>>;

const isSet = (value: string | undefined): boolean =>
  (value ?? "").trim() !== "";

/** Why this build can't be deployed, or null if it can. */
export const deployProblem = (env: Env): string | null => {
  if (env.VERCEL !== "1" || isSet(env.DATABASE_URL)) {
    return null;
  }

  return [
    "DATABASE_URL is not set for this Vercel build.",
    "Tally's built-in PGlite database can't run on Vercel, so every page would fail.",
    "Connect a Postgres database (Vercel Storage, e.g. Neon) for this environment,",
    "run `pnpm db:migrate` and `pnpm db:seed` against it, then redeploy.",
  ].join("\n");
};
