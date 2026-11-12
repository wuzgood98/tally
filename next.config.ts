import type { NextConfig } from "next";

import { securityHeaders } from "./lib/security-headers";

const isDev = process.env.NODE_ENV === "development";
const isHttps = (process.env.BETTER_AUTH_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  // Next.js requires headers() to be async; there is simply nothing to await.
  // oxlint-disable-next-line require-await
  headers: async () => [
    {
      headers: securityHeaders({ isDev, isHttps }).map(({ key, value }) => ({
        key,
        value,
      })),
      source: "/(.*)",
    },
  ],
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  // PGlite loads its WebAssembly and data files from its own package folder.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
