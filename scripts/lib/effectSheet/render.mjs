// 이펙트 시트 렌더러. 카탈로그(src/assets/generatedEffectSheets.json)가 정본이고
// slug → 페인터 매핑이 여기 있다. 카탈로그에 slug 를 넣고 페인터를 안 붙이면 즉시 던진다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePng } from "../pixelPng.mjs";
import { createFrame, mulberry32, slugSeed, toStrip } from "./canvas.mjs";
import { fireBurst, iceShatter, slashSteel, thunderStrike, waterColumn } from "./paintersImpact.mjs";
import { arcaneNova, earthSpike, healBloom, poisonMist, windSlice } from "./paintersArcane.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
export const CATALOG_PATH = path.join(REPO_ROOT, "src", "assets", "generatedEffectSheets.json");
export const OUTPUT_DIR = path.join(REPO_ROOT, "public", "assets", "generated", "effects");

const PAINTERS = {
  "slash-steel": slashSteel,
  "fire-burst": fireBurst,
  "ice-shatter": iceShatter,
  "thunder-strike": thunderStrike,
  "water-column": waterColumn,
  "wind-slice": windSlice,
  "earth-spike": earthSpike,
  "heal-bloom": healBloom,
  "poison-mist": poisonMist,
  "arcane-nova": arcaneNova,
};

export function loadEffectCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
}

export function effectSheetFileName(slug) {
  return `effect-${slug}.png`;
}

export function effectSheetOutputPath(slug) {
  return path.join(OUTPUT_DIR, effectSheetFileName(slug));
}

/** slug 하나를 480x96 RGBA 스트립으로 렌더한다. 같은 입력이면 항상 같은 픽셀이 나온다. */
export function renderEffectStrip(slug, catalog = loadEffectCatalog()) {
  const painter = PAINTERS[slug];
  if (painter === undefined) {
    throw new Error(`이펙트 페인터가 없다: ${slug} (scripts/lib/effectSheet/render.mjs 의 PAINTERS 에 등록하라)`);
  }
  const { columns, frameWidth, frameHeight } = catalog.sheet;
  const seed = slugSeed(slug);
  const frames = [];
  for (let index = 0; index < columns; index += 1) {
    const frame = createFrame();
    painter(frame, columns === 1 ? 0 : index / (columns - 1), mulberry32(seed));
    frames.push(frame);
  }
  const strip = toStrip(frames);
  if (strip.width !== frameWidth * columns || strip.height !== frameHeight) {
    throw new Error(
      `시트 규격 불일치: ${slug} 는 ${frameWidth * columns}x${frameHeight} 여야 하는데 ${strip.width}x${strip.height} 가 나왔다.`
    );
  }
  return strip;
}

/** 같은 스트립을 PNG 바이트로. */
export function renderEffectSheetPng(slug, catalog = loadEffectCatalog()) {
  const strip = renderEffectStrip(slug, catalog);
  return writePng(strip.width, strip.height, strip.data);
}

export function paintedEffectSlugs() {
  return Object.keys(PAINTERS);
}
