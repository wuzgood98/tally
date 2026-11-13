/* oxlint-disable shadcn/no-inline-styles -- Satori (next/og) renders inline styles only; there is no stylesheet. */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { BRAND_COLORS, logoMarkDataUri } from "@/lib/brand";
import { SITE_NAME } from "@/lib/seo";

export const OG_SIZE = { height: 630, width: 1200 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FONT_DIR = path.join(process.cwd(), "assets/fonts");

/** Loaded once per server process. IBM Plex Sans, as in the app. */
const fontsPromise = Promise.all([
  readFile(path.join(FONT_DIR, "ibm-plex-sans-latin-400-normal.woff")),
  readFile(path.join(FONT_DIR, "ibm-plex-sans-latin-600-normal.woff")),
]);

interface LedgerLine {
  readonly product: string;
  readonly branch: string;
  readonly change: string;
  readonly kind: "in" | "out";
}

/** A few ledger lines, the way the movements page shows them. */
const LEDGER: readonly LedgerLine[] = [
  {
    branch: "Transfer from Tema",
    change: "+240",
    kind: "in",
    product: "Evaporated milk 160 g",
  },
  {
    branch: "Spintex till",
    change: "−12",
    kind: "out",
    product: "Iodised salt 500 g",
  },
  {
    branch: "Weija delivery",
    change: "+96",
    kind: "in",
    product: "Tomato paste 400 g",
  },
  {
    branch: "Ashaiman count",
    change: "−3",
    kind: "out",
    product: "Laundry powder 5 kg",
  },
];

const LedgerRow = ({ line }: { readonly line: LedgerLine }) => (
  <div
    style={{
      alignItems: "center",
      borderTop: "1px solid rgba(235, 234, 228, 0.12)",
      display: "flex",
      justifyContent: "space-between",
      padding: "18px 0",
    }}
  >
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 24, fontWeight: 600 }}>{line.product}</span>
      <span
        style={{ color: BRAND_COLORS.nightInkSoft, fontSize: 19, marginTop: 4 }}
      >
        {line.branch}
      </span>
    </div>
    <span
      style={{
        color:
          line.kind === "in" ? BRAND_COLORS.greenLight : BRAND_COLORS.nightInk,
        fontSize: 28,
        fontWeight: 600,
      }}
    >
      {line.change}
    </span>
  </div>
);

interface OgImageProps {
  /** Small caps line above the title. */
  readonly eyebrow: string;
  /** Two short lines; the second in green. */
  readonly title: readonly [string, string];
  readonly subtitle: string;
}

/** The 1200 × 630 social card. Satori supports flexbox only. */
export const renderOgImage = async ({
  eyebrow,
  title,
  subtitle,
}: OgImageProps): Promise<ImageResponse> => {
  const [regular, semibold] = await fontsPromise;
  const { greenLight, night, nightInk, nightInkSoft } = BRAND_COLORS;

  return new ImageResponse(
    <div
      style={{
        background: night,
        color: nightInk,
        display: "flex",
        fontFamily: "IBM Plex Sans",
        height: "100%",
        padding: "64px 72px",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          paddingRight: 56,
          width: 620,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 34,
            fontWeight: 600,
            gap: 18,
          }}
        >
          {/* oxlint-disable-next-line nextjs/no-img-element -- Satori renders plain <img> only */}
          <img alt="" height={56} src={logoMarkDataUri("badge")} width={56} />
          <span>{SITE_NAME}</span>
        </div>
        <div
          style={{
            color: greenLight,
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 4,
            marginTop: 64,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: -1.5,
            lineHeight: 1.08,
            marginTop: 18,
          }}
        >
          <span>{title[0]}</span>
          <span style={{ color: greenLight }}>{title[1]}</span>
        </div>
        <div
          style={{
            color: nightInkSoft,
            display: "flex",
            fontSize: 26,
            lineHeight: 1.45,
            marginTop: 28,
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        style={{
          background: "rgba(235, 234, 228, 0.04)",
          border: "1px solid rgba(235, 234, 228, 0.12)",
          borderRadius: 24,
          display: "flex",
          flexDirection: "column",
          marginTop: 8,
          padding: "26px 32px 8px",
          width: 452,
        }}
      >
        <span
          style={{
            color: nightInkSoft,
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 3,
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Stock movements
        </span>
        {LEDGER.map((line) => (
          <LedgerRow key={line.product} line={line} />
        ))}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { data: regular, name: "IBM Plex Sans", style: "normal", weight: 400 },
        { data: semibold, name: "IBM Plex Sans", style: "normal", weight: 600 },
      ],
    }
  );
};
