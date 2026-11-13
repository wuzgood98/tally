/**
 * Which Postgres server to use. DATABASE_URL wins; otherwise POSTGRES_URL,
 * which Vercel's database integrations (Supabase, Neon) set for you. Neither
 * means the built-in PGlite database.
 *
 * Plain module with no "@/" imports: next.config.ts and the scripts load it
 * directly.
 */

type Env = Readonly<Record<string, string | undefined>>;

const present = (value: string | undefined): string | null => {
  const trimmed = (value ?? "").trim();

  return trimmed === "" ? null : trimmed;
};

/** The connection string, or null for PGlite. */
export const databaseUrl = (env: Env): string | null =>
  present(env.DATABASE_URL) ?? present(env.POSTGRES_URL);
