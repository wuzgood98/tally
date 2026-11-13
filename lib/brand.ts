/**
 * The Tally mark: four strokes and a gate on a rounded green tile. The single
 * source for the in-app mark (components/brand/tally-mark.tsx), every favicon
 * and app icon (scripts/generate-icons.ts) and the social card. Plain strings
 * and no "@/" imports, so Node can run it directly.
 */

export const BRAND_COLORS = {
  /** The light theme's accent: the tile. */
  green: "#0d6b46",
  /** The dark theme's accent: highlights on the social card. */
  greenLight: "#4cc48b",
  ink: "#1a1c19",
  inkSoft: "#55594f",
  /** The dark theme's page colour: the social card and app splash. */
  night: "#121411",
  nightInk: "#ebeae4",
  nightInkSoft: "#a6aa9f",
  paper: "#f5f3ee",
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
  /** Full-bleed green square with the strokes inside the safe zone: Apple and maskable icons. */
  | "tile";

const strokes = (): string => {
  const { gate, strokeWidth } = MARK_GEOMETRY;

  return `<g fill="none" stroke="${BRAND_COLORS.white}" stroke-linecap="round" stroke-width="${strokeWidth}"><path d="${MARK_GEOMETRY.strokes}"/><path d="${gate}"/></g>`;
};

/** The mark as a standalone SVG document. */
export const logoMarkSvg = (variant: LogoVariant = "badge"): string => {
  const { green } = BRAND_COLORS;

  // Maskable icons keep content inside a centred circle of 80% width.
  const body =
    variant === "badge"
      ? `<rect width="24" height="24" rx="${MARK_GEOMETRY.radius}" fill="${green}"/>${strokes()}`
      : `<rect width="24" height="24" fill="${green}"/><g transform="translate(12 12) scale(0.72) translate(-12 -12)">${strokes()}</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_GEOMETRY.viewBox}" role="img" aria-label="Tally">${body}</svg>`;
};

/** For `<img src>` in the social card. */
export const logoMarkDataUri = (variant: LogoVariant = "badge"): string =>
  `data:image/svg+xml;base64,${Buffer.from(logoMarkSvg(variant)).toString("base64")}`;
