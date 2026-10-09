// scripts/render-generate-map-border-report.mts
// generate_map 외곽 테두리 보고서(docs/2026-08-29-generate-map-border.html)의 시각 자산을 만든다.
// 실제 툴(runTool)을 돌려 나온 맵을 번들 치프셋으로 합성해 PNG 로 굽는다 — 손으로 그린 목업이 아니다.
//
//   npx vite-node scripts/render-generate-map-border-report.mts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankProject } from "@/project/defaults";
import { MAP_GENERATION_PROFILES } from "@/editor/tools/mapGenerationProfiles";
import { runTool } from "@/editor/tools/toolRunner";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = resolve(ROOT, "docs/2026-08-29-generate-map-border-assets");
const TILE = 16;
const COLUMNS = 30;
const SCALE = 4;

mkdirSync(OUT_DIR, { recursive: true });

// ── 치프셋 로딩 ──────────────────────────────────────────────────────────────
const chipsetCache = new Map<string, PNG>();

function chipsetFor(tilesetId: string): PNG {
  const cached = chipsetCache.get(tilesetId);
  if (cached) return cached;
  const asset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((a) => bundledEasyRpgTilesetId(a.textureKey) === tilesetId);
  if (!asset) throw new Error(`번들 치프셋 없음: ${tilesetId}`);
  const png = PNG.sync.read(readFileSync(resolve(ROOT, "public", asset.path)));
  chipsetCache.set(tilesetId, png);
  return png;
}

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

function samplePixel(png: PNG, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return { r: 0, g: 0, b: 0, a: 0 };
  const i = (png.width * y + x) << 2;
  return { r: png.data[i]!, g: png.data[i + 1]!, b: png.data[i + 2]!, a: png.data[i + 3]! };
}

function blend(dst: PNG, x: number, y: number, src: Rgba, tint?: readonly [number, number, number, number]): void {
  if (src.a === 0) return;
  const i = (dst.width * y + x) << 2;
  const alpha = src.a / 255;
  let { r, g, b } = src;
  if (tint) {
    const [tr, tg, tb, ta] = tint;
    r = Math.round(r * (1 - ta) + tr * ta);
    g = Math.round(g * (1 - ta) + tg * ta);
    b = Math.round(b * (1 - ta) + tb * ta);
  }
  dst.data[i] = Math.round(dst.data[i]! * (1 - alpha) + r * alpha);
  dst.data[i + 1] = Math.round(dst.data[i + 1]! * (1 - alpha) + g * alpha);
  dst.data[i + 2] = Math.round(dst.data[i + 2]! * (1 - alpha) + b * alpha);
  dst.data[i + 3] = 255;
}

/** 맵 → PNG. highlight 에 든 "x,y" 는 붉게 틴트해 강조한다. */
function renderMap(
  project: Project,
  map: GameMap,
  options: { readonly highlight?: ReadonlySet<string>; readonly scale?: number } = {},
): PNG {
  const scale = options.scale ?? SCALE;
  const chipset = chipsetFor(map.tilesetId);
  const out = new PNG({ width: map.width * TILE * scale, height: map.height * TILE * scale });
  // 배경(투명 치프셋 대비용 어두운 회색).
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 24;
    out.data[i + 1] = 26;
    out.data[i + 2] = 32;
    out.data[i + 3] = 255;
  }
  for (let ty = 0; ty < map.height; ty += 1) {
    for (let tx = 0; tx < map.width; tx += 1) {
      const index = ty * map.width + tx;
      const tint = options.highlight?.has(`${tx},${ty}`) ? ([255, 64, 72, 0.42] as const) : undefined;
      for (const tile of [map.lowerTiles[index]!, map.upperTiles[index]!]) {
        if (tile < 0) continue;
        const sx = (tile % COLUMNS) * TILE;
        const sy = Math.floor(tile / COLUMNS) * TILE;
        for (let py = 0; py < TILE; py += 1) {
          for (let px = 0; px < TILE; px += 1) {
            const src = samplePixel(chipset, sx + px, sy + py);
            for (let dy = 0; dy < scale; dy += 1) {
              for (let dx = 0; dx < scale; dx += 1) {
                blend(out, (tx * TILE + px) * scale + dx, (ty * TILE + py) * scale + dy, src, tint);
              }
            }
          }
        }
      }
    }
  }
  return out;
}

function save(png: PNG, name: string): string {
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, PNG.sync.write(png));
  return name;
}

/** 치프셋에서 타일 1장을 잘라 확대 저장(팔레트 스와치). */
function saveTileSwatch(tilesetId: string, tile: number, name: string, scale = 6): string {
  const chipset = chipsetFor(tilesetId);
  const out = new PNG({ width: TILE * scale, height: TILE * scale });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 24;
    out.data[i + 1] = 26;
    out.data[i + 2] = 32;
    out.data[i + 3] = 255;
  }
  const sx = (tile % COLUMNS) * TILE;
  const sy = Math.floor(tile / COLUMNS) * TILE;
  for (let py = 0; py < TILE; py += 1) {
    for (let px = 0; px < TILE; px += 1) {
      const src = samplePixel(chipset, sx + px, sy + py);
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) blend(out, px * scale + dx, py * scale + dy, src);
      }
    }
  }
  return save(out, name);
}

// ── 케이스 실행 ──────────────────────────────────────────────────────────────
const W = 24;
const H = 18;

function perimeterKeys(map: GameMap): Set<string> {
  const keys = new Set<string>();
  for (let x = 0; x < map.width; x += 1) {
    keys.add(`${x},0`);
    keys.add(`${x},${map.height - 1}`);
  }
  for (let y = 0; y < map.height; y += 1) {
    keys.add(`0,${y}`);
    keys.add(`${map.width - 1},${y}`);
  }
  return keys;
}

function blockedPerimeterCount(project: Project, map: GameMap): number {
  let n = 0;
  for (const key of perimeterKeys(map)) {
    const [x, y] = key.split(",").map(Number);
    if (!isPassable(project, map, x!, y!)) n += 1;
  }
  return n;
}

interface Shot {
  readonly file: string;
  readonly caption: string;
  readonly blocked: number;
  readonly total: number;
  readonly summary: string;
}

const shots: Record<string, Shot> = {};

function runGenerate(key: string, args: Record<string, unknown>, caption: string, highlight: boolean): void {
  const ctx: ToolContext = { project: createEmptyToolProject() };
  const id = `map_${key}`;
  const result = runTool(ctx, "generate_map", { width: W, height: H, seed: 11, chokepoints: 10, id, ...args }, { dryRun: false });
  if (!result.ok) throw new Error(`${key}: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  const map = ctx.project.maps[id]!;
  const perimeter = perimeterKeys(map);
  const blockedRing = new Set<string>();
  for (const cellKey of perimeter) {
    const [x, y] = cellKey.split(",").map(Number);
    if (!isPassable(ctx.project, map, x!, y!)) blockedRing.add(cellKey);
  }
  const png = renderMap(ctx.project, map, highlight ? { highlight: blockedRing } : {});
  shots[key] = {
    file: save(png, `${key}.png`),
    caption,
    blocked: blockedRing.size,
    total: perimeter.size,
    summary: result.summary,
  };
  console.log(`${key}: 외곽 통행불가 ${blockedRing.size}/${perimeter.size} — ${result.summary}`);
}

for (const theme of ["village", "forest", "cave"] as const) {
  runGenerate(`before-${theme}`, { theme, border: "wall" }, `수정 전 — generate_map theme="${theme}" (강제 테두리)`, true);
  runGenerate(`after-${theme}`, { theme }, `수정 후 — generate_map theme="${theme}" (border 생략)`, true);
}
runGenerate("opt-in-cave", { theme: "cave", border: "wall" }, 'generate_map theme="cave", border:"wall" — 옵트인', false);

// create_map 대조(2026-07-08 47b0d51d 선례).
function runCreate(key: string, args: Record<string, unknown>, caption: string): void {
  const ctx: ToolContext = { project: createEmptyToolProject() };
  const id = `map_${key}`;
  const result = runTool(ctx, "create_map", { name: "대조", width: W, height: H, id, ...args }, { dryRun: false });
  if (!result.ok) throw new Error(`${key}: ${result.summary}`);
  const map = ctx.project.maps[id]!;
  shots[key] = {
    file: save(renderMap(ctx.project, map, { highlight: perimeterKeys(map) }), `${key}.png`),
    caption,
    blocked: blockedPerimeterCount(ctx.project, map),
    total: perimeterKeys(map).size,
    summary: result.summary,
  };
  console.log(`${key}: 외곽 통행불가 ${shots[key]!.blocked}/${shots[key]!.total}`);
}

runCreate("create-map-none", {}, "create_map — 기본(2026-07-08 이후 테두리 없음)");
runCreate("create-map-wall", { border: "wall" }, 'create_map border:"wall" — 옵트인');

// 실내 파이프라인(설계상 외곽=벽) 대조.
// 빈 툴 프로젝트로는 커밋 무결성 게이트를 못 넘는다(시작 맵 부재) — 기본 프로젝트를 쓴다.
{
  const ctx: ToolContext = { project: createBlankProject() };
  const result = runTool(
    ctx,
    "run_interior_room_pipeline",
    { mapId: "map_interior", name: "침실", width: 20, height: 15, wings: [{ x: 3, y: 6, w: 14, h: 6 }], door: { x: 10, y: 11 }, theme: "bedroom" },
    { dryRun: false },
  );
  if (!result.ok) throw new Error(`interior: ${result.summary}`);
  const map = ctx.project.maps.map_interior!;
  shots.interior = {
    file: save(renderMap(ctx.project, map), "interior.png"),
    caption: "run_interior_room_pipeline — 바닥 bbox 바깥이 전부 천장·벽. 방이니 설계상 맞다",
    blocked: blockedPerimeterCount(ctx.project, map),
    total: perimeterKeys(map).size,
    summary: result.summary,
  };
  console.log(`interior: 외곽 통행불가 ${shots.interior.blocked}/${shots.interior.total}`);
}

// ── 프로파일 13종 장애물 스와치 ───────────────────────────────────────────────
interface ProfileRow {
  readonly tilesetId: string;
  readonly layout: string;
  readonly themes: readonly { readonly theme: string; readonly obstacle: number; readonly base: number; readonly swatch: string; readonly baseSwatch: string }[];
}

const profileRows: ProfileRow[] = [];
for (const [tilesetId, profile] of MAP_GENERATION_PROFILES) {
  const themes = (["village", "forest", "cave"] as const).map((theme) => {
    const palette = profile.palettes[theme];
    return {
      theme,
      obstacle: palette.obstacle,
      base: palette.base,
      swatch: saveTileSwatch(tilesetId, palette.obstacle, `swatch-${tilesetId}-${theme}-obstacle.png`),
      baseSwatch: saveTileSwatch(tilesetId, palette.base, `swatch-${tilesetId}-${theme}-base.png`),
    };
  });
  profileRows.push({ tilesetId, layout: profile.layout, themes });
}

writeFileSync(
  resolve(OUT_DIR, "shots.json"),
  `${JSON.stringify({ shots, profileRows }, null, 2)}\n`,
);
console.log(`\n자산 ${Object.keys(shots).length}장 + 스와치 ${profileRows.length * 6}장 → ${OUT_DIR}`);
