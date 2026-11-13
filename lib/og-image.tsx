/* oxlint-disable shadcn/no-inline-styles -- Satori (next/og) renders inline styles only; there is no stylesheet. */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

import { BRAND_COLORS, logoMarkDataUri } from "@/lib/brand";
import { SITE_NAME } from "@/lib/seo";

export const OG_SIZE = { height: 630, width: 1200 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FONT_DIR = path.join(process.cwd(), "assets/fonts");

/**
 * Loaded once per server process: Geist and Geist Mono, as in the app. The
 * latin subsets have no cedi sign, so the card shows units and counts, never
 * money.
 */
const fontsPromise = Promise.all([
  readFile(path.join(FONT_DIR, "geist-sans-latin-400-normal.woff")),
  readFile(path.join(FONT_DIR, "geist-sans-latin-600-normal.woff")),
  readFile(path.join(FONT_DIR, "geist-mono-latin-500-normal.woff")),
]);

const {
  accent,
  canvas,
  line,
  night,
  nightInk,
  nightInkFaint,
  nightInkSoft,
  surface,
  warn,
} = BRAND_COLORS;

const MONO = "Geist Mono";

/** An illustration, not data: sales per day for a fortnight, today last. */
const SALES_BARS = [9, 12, 10, 15, 11, 13, 12, 16, 14, 13, 17, 15, 12, 16];

/** Lines needing a reorder over the same fortnight, drifting up. */
const REORDER_LINE = [14, 15, 15, 16, 15, 17, 18, 17, 19, 20, 19, 21, 22, 23];

interface LedgerLine {
  readonly product: string;
  readonly where: string;
  readonly change: string;
  readonly kind: "in" | "out";
}

/** A few ledger lines, the way the movements page shows them. */
const LEDGER: readonly LedgerLine[] = [
  {
    change: "+240",
    kind: "in",
    product: "Evaporated milk 160 g",
    where: "Transfer from Tema",
  },
  {
    change: "−12",
    kind: "out",
    product: "Iodised salt 500 g",
    where: "Spintex till",
  },
  {
    change: "+96",
    kind: "in",
    product: "Tomato paste 400 g",
    where: "Weija delivery",
  },
];

const BAR_AREA_HEIGHT = 40;

/** Older bars fade back so today reads first, as in the app. */
const Bars = ({ values }: { readonly values: readonly number[] }) => {
  const max = Math.max(...values);

  return (
    <div
      style={{
        alignItems: "flex-end",
        display: "flex",
        gap: 4,
        height: BAR_AREA_HEIGHT,
        marginTop: 18,
      }}
    >
      {values.map((value, index) => (
        <div
          // The days never reorder, so the position is the identity.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          style={{
            background: accent,
            borderRadius: 2,
            flexGrow: 1,
            height: Math.round((value / max) * BAR_AREA_HEIGHT),
            opacity: 0.35 + (index / (values.length - 1)) * 0.65,
          }}
        />
      ))}
    </div>
  );
};

const LINE_WIDTH = 220;

/** A line with a faint area under it, drawn as an SVG for Satori's <img>. */
const lineChartUri = (values: readonly number[], color: string): string => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = LINE_WIDTH / (values.length - 1);
  const inset = 3;

  const points = values.map((value, index) => {
    const y =
      BAR_AREA_HEIGHT -
      inset -
      ((value - min) / (max - min || 1)) * (BAR_AREA_HEIGHT - inset * 2);

    return `${(index * step).toFixed(1)} ${y.toFixed(1)}`;
  });

  const path_ = `M${points.join("L")}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LINE_WIDTH}" height="${BAR_AREA_HEIGHT}" viewBox="0 0 ${LINE_WIDTH} ${BAR_AREA_HEIGHT}"><path d="${path_}L${LINE_WIDTH} ${BAR_AREA_HEIGHT}L0 ${BAR_AREA_HEIGHT}Z" fill="${color}" fill-opacity="0.12"/><path d="${path_}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const StatCell = ({
  label,
  value,
  detail,
  tone,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: string;
  readonly children: ReactNode;
}) => (
  <div
    style={{
      background: surface,
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      padding: "22px 24px",
      width: 0,
    }}
  >
    <span style={{ color: nightInkSoft, fontSize: 19 }}>{label}</span>
    <span
      style={{
        color: tone ?? nightInk,
        fontSize: 46,
        fontWeight: 600,
        letterSpacing: -1.5,
        lineHeight: 1,
        marginTop: 14,
      }}
    >
      {value}
    </span>
    <span style={{ color: nightInkFaint, fontSize: 16, marginTop: 8 }}>
      {detail}
    </span>
    {children}
  </div>
);

const LedgerRow = ({ entry }: { readonly entry: LedgerLine }) => (
  <div
    style={{
      alignItems: "center",
      borderTop: `1px solid ${line}`,
      display: "flex",
      justifyContent: "space-between",
      padding: "14px 24px",
    }}
  >
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 19, fontWeight: 600 }}>{entry.product}</span>
      <span style={{ color: nightInkFaint, fontSize: 15, marginTop: 3 }}>
        {entry.where}
      </span>
    </div>
    <span
      style={{
        color: entry.kind === "in" ? accent : nightInk,
        fontFamily: MONO,
        fontSize: 22,
      }}
    >
      {entry.change}
    </span>
  </div>
);

/** The instrument panel on the right: two stats over the latest movements. */
const Instrument = () => (
  <div
    style={{
      background: surface,
      border: `1px solid ${line}`,
      borderRadius: 18,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      width: 486,
    }}
  >
    <div style={{ background: line, display: "flex", gap: 1 }}>
      <StatCell detail="Last 14 days" label="Sales today" value="16">
        <Bars values={SALES_BARS} />
      </StatCell>
      <StatCell
        detail="6 of them out"
        label="Need reordering"
        tone={warn}
        value="23"
      >
        {/* oxlint-disable-next-line nextjs/no-img-element -- Satori renders plain <img> only */}
        <img
          alt=""
          height={BAR_AREA_HEIGHT}
          src={lineChartUri(REORDER_LINE, warn)}
          style={{ marginTop: 18 }}
          width={LINE_WIDTH - 30}
        />
      </StatCell>
    </div>
    <span
      style={{
        borderTop: `1px solid ${line}`,
        color: nightInkSoft,
        display: "flex",
        fontSize: 16,
        padding: "14px 24px 4px",
      }}
    >
      Latest stock movements
    </span>
    {LEDGER.map((entry) => (
      <LedgerRow entry={entry} key={entry.product} />
    ))}
  </div>
);

interface OgImageProps {
  /** A short line above the title, in the accent. */
  readonly eyebrow: string;
  /** Two short lines; the second in the accent. */
  readonly title: readonly [string, string];
  readonly subtitle: string;
}

/**
 * The 1200 × 630 social card, in the app's own frame: graphite around an
 * inset canvas with the faint glow at its top. Satori supports flexbox only.
 */
export const renderOgImage = async ({
  eyebrow,
  title,
  subtitle,
}: OgImageProps): Promise<ImageResponse> => {
  const [regular, semibold, mono] = await fontsPromise;

  return new ImageResponse(
    <div
      style={{
        background: night,
        color: nightInk,
        display: "flex",
        fontFamily: "Geist",
        height: "100%",
        padding: 18,
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundColor: canvas,
          backgroundImage:
            "radial-gradient(circle at 18% 0%, rgba(138, 180, 255, 0.12), rgba(138, 180, 255, 0) 55%)",
          border: `1px solid ${line}`,
          borderRadius: 24,
          display: "flex",
          justifyContent: "space-between",
          padding: "52px 52px 52px 60px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 540,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 30,
              fontWeight: 600,
              gap: 14,
              letterSpacing: -0.5,
            }}
          >
            {/* oxlint-disable-next-line nextjs/no-img-element -- Satori renders plain <img> only */}
            <img alt="" height={44} src={logoMarkDataUri("badge")} width={44} />
            <span>{SITE_NAME}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: accent, display: "flex", fontSize: 22 }}>
              {eyebrow}
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 60,
                fontWeight: 600,
                letterSpacing: -2,
                lineHeight: 1.05,
                marginTop: 16,
              }}
            >
              <span>{title[0]}</span>
              <span style={{ color: accent }}>{title[1]}</span>
            </div>
            <span
              style={{
                color: nightInkSoft,
                display: "flex",
                fontSize: 24,
                lineHeight: 1.45,
                marginTop: 22,
              }}
            >
              {subtitle}
            </span>
          </div>
        </div>

        <div style={{ alignItems: "center", display: "flex" }}>
          <Instrument />
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { data: regular, name: "Geist", style: "normal", weight: 400 },
        { data: semibold, name: "Geist", style: "normal", weight: 600 },
        { data: mono, name: MONO, style: "normal", weight: 500 },
      ],
    }
  );
};
