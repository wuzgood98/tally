import { absoluteUrl, SECURITY_EMAIL } from "@/lib/seo";

/** Generated once at build time; redeploy at least this often to keep it valid. */
export const dynamic = "force-static";

/** RFC 9116 recommends an expiry under a year. */
const VALID_FOR_DAYS = 180;
const MS_PER_DAY = 86_400_000;

/** RFC 9116 security.txt: tells researchers how to report a vulnerability. */
export const GET = (): Response => {
  const expires = new Date(
    Date.now() + VALID_FOR_DAYS * MS_PER_DAY
  ).toISOString();

  const body = [
    `Contact: mailto:${SECURITY_EMAIL}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${absoluteUrl("/.well-known/security.txt")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
