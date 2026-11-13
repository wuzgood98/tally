/**
 * Renders every favicon and app icon from the mark in lib/brand.ts.
 *
 *   pnpm icons            write the icon files
 *   pnpm icons --preview  also write a contact sheet to check the mark by eye
 *
 * Runs on plain Node (type stripping), so it imports with relative paths.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import type { OverlayOptions } from "sharp";

import { logoMarkSvg } from "../lib/brand.ts";
import type { LogoVariant } from "../lib/brand.ts";

const ROOT = path.join(import.meta.dirname, "..");

/** Render the SVG large, then downscale, for crisp small sizes. */
const RENDER_DENSITY = 1200;

const renderPng = async (variant: LogoVariant, size: number): Promise<Buffer> =>
  await sharp(Buffer.from(logoMarkSvg(variant)), { density: RENDER_DENSITY })
    .resize(size, size)
    .png()
    .toBuffer();

/** An ICO is a small header, one directory entry per image, then the PNGs. */
const encodeIco = (
  images: readonly { size: number; png: Buffer }[]
): Buffer => {
  const HEADER = 6;
  const ENTRY = 16;
  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER + ENTRY * images.length;

  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(ENTRY);
    // 0 means 256 in the ICO format.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;

    return entry;
  });

  return Buffer.concat([
    header,
    ...entries,
    ...images.map((image) => image.png),
  ]);
};

const write = async (
  relativePath: string,
  data: Buffer | string
): Promise<void> => {
  const filePath = path.join(ROOT, relativePath);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  console.info(`  ${relativePath}`);
};

const PREVIEW_SIZES = [256, 64, 32, 16] as const;
const PREVIEW_GAP = 24;

const writePreview = async (): Promise<void> => {
  const renders = (["badge", "tile"] as const).flatMap((variant) =>
    PREVIEW_SIZES.map(async (size) => ({
      input: await renderPng(variant, size),
      size,
    }))
  );

  const tiles: OverlayOptions[] = [];
  let left = PREVIEW_GAP;

  for (const { input, size } of await Promise.all(renders)) {
    tiles.push({ input, left, top: PREVIEW_GAP });
    left += size + PREVIEW_GAP;
  }

  const sheet = await sharp({
    create: {
      background: "#ffffff",
      channels: 4,
      height: 256 + PREVIEW_GAP * 2,
      width: left,
    },
  })
    .composite(tiles)
    .png()
    .toBuffer();

  await write("scripts/.icon-preview.png", sheet);
};

console.info("Generating icons:");

await write("app/icon.svg", logoMarkSvg("badge"));

await write(
  "app/favicon.ico",
  encodeIco(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({
        png: await renderPng("badge", size),
        size,
      }))
    )
  )
);

// Apple rounds the corners itself and ignores transparency: use the full-bleed tile.
await write("app/apple-icon.png", await renderPng("tile", 180));

await write("public/icons/icon-192.png", await renderPng("badge", 192));

await write("public/icons/icon-512.png", await renderPng("badge", 512));

await write("public/icons/maskable-512.png", await renderPng("tile", 512));

if (process.argv.includes("--preview")) {
  await writePreview();
}
