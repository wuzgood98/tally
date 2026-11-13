/**
 * The Tally mark: four strokes and a gate on a rounded ice-blue tile. The
 * single source for the in-app mark (components/brand/tally-mark.tsx), every
 * favicon and app icon (scripts/generate-icons.ts) and the social card. Plain
 * strings and no "@/" imports, so Node can run it directly.
 *
 * These mirror the "Night shift" tokens in app/globals.css: keep them in step.
 */

export const BRAND_COLORS = {
  /** The dark theme's accent: the tile, and highlights on the social card. */
  accent: "#8ab4ff",
  /** The light theme's accent: the tile on light browser tabs. */
  accentDeep: "#2f5bd8",
  /** Strokes on the ice-blue tile. */
  accentInk: "#0a1530",
  /** The inset canvas pages sit on. */
  canvas: "#0f1012",
  /** Hairlines between rows and around panels. */
  line: "#222328",
  /** The dark theme's page colour: the social card, splash and title bar. */
  night: "#08090a",
  nightInk: "#ededef",
  nightInkFaint: "#6b6c74",
  nightInkSoft: "#9a9ba3",
  /** Cards and panels on the canvas. */
  surface: "#141518",
  /** "Running low", and the reorder trend. */
  warn: "#f5b041",
  white: "#ffffff",
} as const;

/** Geometry in a 24 × 24 box, shared with the React mark. */
export const MARK_GEOMETRY = {
  gate: "M5 15.5 19 8.5",
  radius: 6,
  strokeWidth: 1.9,
  strokes: "M7 6.5v11M10.3 6.5v11M13.6 6.5v11M16.9 6.5v11",
  viewBox: "0 0 24 24",
} as const;

export type LogoVariant =
  /** The rounded tile on transparent: tabs, manifest "any" icons, the card. */
  | "badge"
  /** Full-bleed tile with the strokes inside the safe zone: Apple and maskable icons. */
  | "tile"
  /**
   * The badge for `app/icon.svg`: deep blue with white strokes on light tabs,
   * ice blue with navy strokes on dark ones, as the app does. Browsers read
   * the media query inside an SVG favicon; PNG and ICO fallbacks can't.
   */
  | "adaptive";

const strokes = (color: string): string => {
  const { gate, strokeWidth } = MARK_GEOMETRY;

  return `<g class="strokes" fill="none" stroke="${color}" stroke-linecap="round" stroke-width="${strokeWidth}"><path d="${MARK_GEOMETRY.strokes}"/><path d="${gate}"/></g>`;
};

const ADAPTIVE_STYLE = `<style>.tile{fill:${BRAND_COLORS.accentDeep}}.strokes{stroke:${BRAND_COLORS.white}}@media (prefers-color-scheme:dark){.tile{fill:${BRAND_COLORS.accent}}.strokes{stroke:${BRAND_COLORS.accentInk}}}</style>`;

const { accent, accentInk } = BRAND_COLORS;
const { radius } = MARK_GEOMETRY;

const MARK_BODIES: Record<LogoVariant, string> = {
  // The fill is the fallback where the style isn't read; CSS beats it.
  adaptive: `${ADAPTIVE_STYLE}<rect class="tile" width="24" height="24" rx="${radius}" fill="${accent}"/>${strokes(accentInk)}`,
  badge: `<rect width="24" height="24" rx="${radius}" fill="${accent}"/>${strokes(accentInk)}`,
  // Maskable icons keep content inside a centred circle of 80% width.
  tile: `<rect width="24" height="24" fill="${accent}"/><g transform="translate(12 12) scale(0.72) translate(-12 -12)">${strokes(accentInk)}</g>`,
};

/** The mark as a standalone SVG document. */
export const logoMarkSvg = (variant: LogoVariant = "badge"): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_GEOMETRY.viewBox}" role="img" aria-label="Tally">${MARK_BODIES[variant]}</svg>`;

/** For `<img src>` in the social card. */
export const logoMarkDataUri = (variant: LogoVariant = "badge"): string =>
  `data:image/svg+xml;base64,${Buffer.from(logoMarkSvg(variant)).toString("base64")}`;
