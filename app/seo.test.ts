import { describe, expect, it } from "vitest";

import { GET as securityTxt } from "@/app/.well-known/security.txt/route";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { logoMarkSvg } from "@/lib/brand";
import { resolveSiteUrl, SECURITY_EMAIL } from "@/lib/seo";
import { appJsonLd } from "@/lib/structured-data";
import { config as proxyConfig } from "@/proxy";

const MS_PER_DAY = 86_400_000;

describe("security.txt", () => {
  it("has the RFC 9116 required fields and expires within a year", async () => {
    const response = securityTxt();
    const body = await response.text();
    const expires = /^Expires: (?<date>.+)$/mu.exec(body)?.groups?.date ?? "";
    const daysLeft = (Date.parse(expires) - Date.now()) / MS_PER_DAY;

    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(body).toContain(`Contact: mailto:${SECURITY_EMAIL}`);
    expect(daysLeft).toBeGreaterThan(0);
    expect(daysLeft).toBeLessThan(365);
  });
});

describe("crawling", () => {
  it("lists only the sign-in page", () => {
    expect(sitemap().map(({ url }) => new URL(url).pathname)).toEqual([
      "/login",
    ]);
  });

  it("keeps crawlers out of the staff screens but lets them see the card", () => {
    expect(robots().rules).toMatchObject({
      allow: ["/login", "/opengraph-image"],
      disallow: "/",
    });
  });
});

describe("site URL", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, then the sign-in URL, then Vercel's domain", () => {
    expect(
      resolveSiteUrl({
        BETTER_AUTH_URL: "https://auth.example",
        NEXT_PUBLIC_SITE_URL: "https://site.example",
      }).origin
    ).toBe("https://site.example");
    expect(
      resolveSiteUrl({
        BETTER_AUTH_URL: "https://tally.example",
        VERCEL_PROJECT_PRODUCTION_URL: "tally.vercel.app",
      }).origin
    ).toBe("https://tally.example");
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "tally.vercel.app" })
        .origin
    ).toBe("https://tally.vercel.app");
  });

  it("falls back to localhost when a value is malformed", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "not a url" }).origin).toBe(
      "http://localhost:3000"
    );
  });
});

describe("proxy", () => {
  const [matcher = ""] = proxyConfig.matcher;
  const pattern = new RegExp(`^${matcher}$`, "u");

  it("lets crawlers and browsers fetch the public files without a session", () => {
    for (const path of [
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.webmanifest",
      "/opengraph-image",
      "/icons/icon-512.png",
      "/.well-known/security.txt",
      "/login",
    ]) {
      expect(pattern.test(path), path).toBe(false);
    }
  });

  it("still guards the staff screens", () => {
    for (const path of ["/", "/reports", "/products/12"]) {
      expect(pattern.test(path), path).toBe(true);
    }
  });
});

describe("manifest", () => {
  it("offers a maskable icon for Android home screens", () => {
    expect(manifest().icons?.some((icon) => icon.purpose === "maskable")).toBe(
      true
    );
  });
});

describe("structured data", () => {
  it("describes Tally as a business web application", () => {
    expect(appJsonLd()).toMatchObject({
      "@type": "WebApplication",
      applicationCategory: "BusinessApplication",
      name: "Tally",
    });
  });
});

describe("logo", () => {
  it("is a self-contained SVG with an accessible name", () => {
    for (const variant of ["badge", "tile"] as const) {
      const svg = logoMarkSvg(variant);

      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u);
      expect(svg).toContain('aria-label="Tally"');
      expect(svg).not.toMatch(/href=|<script/u);
    }
  });
});
