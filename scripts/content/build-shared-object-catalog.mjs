#!/usr/bin/env node
// 공용 오브젝트 카탈로그 → src/assets/sharedObjectCatalog.json + public/assets/shared-objects/<id>.png
//
// 원본: scripts/content/lib/shared-object-catalog-entry.ts (잎 없는 고목·화산 봉우리·기후 지형·항구 부품·생성 건물·
// 저작 집 형태·마을 소품). 오브젝트마다 이름·태그·쓸 타일셋·통행·「주인」 규칙·미리보기 그림을 적는다.
// 에디터 「오브젝트」 탭 카드와 조수 list_spatial_designs(kind:object) / stamp_object 가 이 목록을 읽는다.
// 재생성: node scripts/content/build-shared-object-catalog.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import { buildTsModule } from "../ontology-ts-loader.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = resolve(ROOT, "public");
const OUT_DIR = resolve(PUBLIC, "assets/shared-objects");
const bundle = resolve(tmpdir(), `oprn-shared-object-catalog-${process.pid}.mjs`);
await buildTsModule(resolve(ROOT, "scripts/content/lib/shared-object-catalog-entry.ts"), bundle);
const api = await import(pathToFileURL(bundle).href);
const objects = await api.collectSharedObjects(PUBLIC);
rmSync(bundle, { force: true });

// ── images ────────────────────────────────────────────────────────────────
const images = new Map();
function sheet(key, assets) {
  if (images.has(key)) return images.get(key);
  let png = null;
  const asset = assets[key];
  if (asset?.dataUrl?.startsWith("data:image/png;base64,")) png = PNG.sync.read(Buffer.from(asset.dataUrl.slice(22), "base64"));
  else if (api.TEXTURE_PATHS[key] && existsSync(resolve(PUBLIC, api.TEXTURE_PATHS[key]))) png = PNG.sync.read(readFileSync(resolve(PUBLIC, api.TEXTURE_PATHS[key])));
  images.set(key, png);
  return png;
}
function picture(tileset, grafts, tile) {
  const graft = grafts.get(tile);
  return graft ? { key: graft.sourceChipset, tile: graft.sourceTile } : { key: tileset.image.id, tile };
}
function blit(dst, src, sx, sy, dx, dy, size, scale) {
  for (let y = 0; y < size * scale; y++) for (let x = 0; x < size * scale; x++) {
    const px = sx + Math.floor(x / scale), py = sy + Math.floor(y / scale);
    if (px >= src.width || py >= src.height) continue;
    const s = (py * src.width + px) * 4, d = ((dy + y) * dst.width + dx + x) * 4;
    const a = src.data[s + 3] / 255;
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
    dst.data[d + 3] = Math.max(dst.data[d + 3], src.data[s + 3]);
  }
}
let missingPictures = 0;
function render(object) {
  const ts = object.sourceTileset, size = ts.tileSize ?? 16, scale = Math.max(1, Math.min(3, Math.floor(96 / (Math.max(object.width, object.height) * size)) || 1));
  const png = new PNG({ width: object.width * size * scale, height: object.height * size * scale });
  const grafts = new Map((ts.tileGrafts ?? []).map((g) => [g.targetTile, g]));
  for (const layer of [object.lower, object.upper]) {
    layer.forEach((tile, i) => {
      if (tile < 0) return;
      const p = picture(ts, grafts, tile), src = sheet(p.key, object.assets);
      if (!src) { missingPictures += 1; return; }
      const cols = Math.floor(src.width / size);
      blit(png, src, (p.tile % cols) * size, Math.floor(p.tile / cols) * size, (i % object.width) * size * scale, Math.floor(i / object.width) * size * scale, size, scale);
    });
  }
  return png;
}
function passage(object) {
  const ts = object.sourceTileset;
  let blocked = 0, open = 0;
  for (let i = 0; i < object.width * object.height; i++) {
    const tiles = [object.lower[i], object.upper[i]].filter((t) => t >= 0);
    if (!tiles.length) continue;
    const solid = tiles.some((t) => { const p = ts.passability[t]; return p && !p.up && !p.down && !p.left && !p.right; });
    if (solid) blocked += 1; else open += 1;
  }
  return blocked && open ? `일부 통행(막힘 ${blocked}칸·통행 ${open}칸)` : blocked ? "통행 불가" : "위를 걸을 수 있음";
}

// A lower-layer tile with see-through pixels replaces the ground under it and shows black in the
// editor and the game (dune edges, cactus bases). Such cells go to the upper layer so the map's own
// ground stays underneath.
const seeThrough = new Map();
function hasSeeThrough(ts, grafts, tile, assets) {
  const key = `${ts.id}:${tile}`;
  if (seeThrough.has(key)) return seeThrough.get(key);
  const size = ts.tileSize ?? 16, p = picture(ts, grafts, tile), src = sheet(p.key, assets);
  let clear = false;
  if (src) {
    const cols = Math.floor(src.width / size), sx = (p.tile % cols) * size, sy = Math.floor(p.tile / cols) * size;
    for (let y = 0; y < size && !clear; y++) for (let x = 0; x < size; x++) {
      if (src.data[((sy + y) * src.width + sx + x) * 4 + 3] < 255) { clear = true; break; }
    }
  }
  seeThrough.set(key, clear);
  return clear;
}
let liftedCells = 0;
function liftSeeThroughLower(object) {
  if (object.source.kind !== "tileset") return;
  const ts = object.sourceTileset, grafts = new Map((ts.tileGrafts ?? []).map((g) => [g.targetTile, g]));
  object.lower.forEach((tile, i) => {
    if (tile < 0 || object.upper[i] >= 0 || !hasSeeThrough(ts, grafts, tile, object.assets)) return;
    object.upper[i] = tile; object.lower[i] = -1; liftedCells += 1;
    if (object.defaultLayers === "lower") object.defaultLayers = "both";
  });
}

// ── write ─────────────────────────────────────────────────────────────────
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const manifest = [];
for (const object of objects) {
  liftSeeThroughLower(object);
  const file = `${object.id.replace(/^obj:/, "").replace(/[^a-z0-9가-힣_-]+/gi, "_")}.png`;
  writeFileSync(resolve(OUT_DIR, file), PNG.sync.write(render(object)));
  const { sourceTileset: _t, assets: _a, lower, upper, ...rest } = object;
  manifest.push({ ...rest, passage: passage(object), preview: `/assets/shared-objects/${file}`,
    ...(object.source.kind === "tileset" ? { lower, upper } : {}) });
}
writeFileSync(resolve(ROOT, "src/assets/sharedObjectCatalog.json"), `${JSON.stringify({ objects: manifest })}\n`);
const byCategory = {};
for (const entry of manifest) byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
console.log(`${manifest.length} objects`, JSON.stringify(byCategory), missingPictures ? `(${missingPictures} cells without a picture)` : "", `lifted ${liftedCells} see-through lower cells`);
