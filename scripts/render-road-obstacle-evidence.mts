/**
 * 길 깔기 결함 증거 렌더러 — 같은 입력으로 (A) 옛 무차별 페인트와 (B) 고친 paint_road 를
 * 각각 실행해 실제 칩셋으로 렌더하고, 부서진 건물 칸을 빨갛게 표시한다.
 * 실행: npx tsx scripts/render-road-obstacle-evidence.mts
 * 산출: output/evidence/road-obstacle/*.png
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { ToolContext } from "../src/editor/tools/types.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { DIRT_ROAD_TILE } from "../src/project/defaults/chipsetMapping.ts";
import { shapeRoadAround } from "../src/project/defaults/roadAutotile.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { isPassable } from "../src/project/collision.ts";
import { inMapBounds, lineCells, type Point } from "../src/editor/tools/mapHelpers.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const T = 16;
const COLS = 30;
const SCALE = 2;
const MAP_ID = "map_road_evidence";
const OUT = path.resolve("output/evidence/road-obstacle");
fs.mkdirSync(OUT, { recursive: true });

const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));

type Scene = {
  readonly houses: readonly { readonly origin: Point; readonly w: number; readonly h: number }[];
  readonly points: readonly Point[];
  readonly naturalness: number;
};

function scenario(width: number, height: number, scene: Scene): ToolContext {
  const ctx: ToolContext = { project: createBlankProject() };
  ok(runTool(ctx, "create_map", { id: MAP_ID, name: "길 증거", width, height }));
  for (const house of scene.houses) {
    ok(runTool(ctx, "build_house", { mapId: MAP_ID, origin: house.origin, width: house.w, height: house.h, material: "plaster" }));
  }
  return ctx;
}

function ok(result: { ok: boolean; summary: string }): void {
  if (!result.ok) throw new Error(result.summary);
}

function mapOf(ctx: ToolContext): GameMap {
  const map = ctx.project.maps[MAP_ID];
  if (!map) throw new Error("missing map");
  return map;
}

// 통행 불가 + 저작물이 있는 칸 = 건물 몸통.
function structureCells(project: Project, map: GameMap): ReadonlySet<string> {
  const cells = new Set<string>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const authored = (map.lowerTiles[i] ?? TILE.EMPTY) !== TILE.EMPTY || (map.upperTiles[i] ?? TILE.EMPTY) !== TILE.EMPTY;
      if (authored && !isPassable(project, map, x, y)) cells.add(`${x},${y}`);
    }
  }
  return cells;
}

// 2026-08-30 이전 paint_road 의 몸통: 폴리라인을 장애물 검사 없이 덮고 upper 를 지운다.
function paintLegacyRoad(map: GameMap, points: readonly Point[]): void {
  const painted: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const segment = index === 0 ? [points[0]!] : lineCells(points[index - 1]!, points[index]!);
    for (const cell of segment) {
      if (!inMapBounds(map, cell.x, cell.y)) continue;
      const i = cell.y * map.width + cell.x;
      map.lowerTiles[i] = DIRT_ROAD_TILE.BODY;
      map.upperTiles[i] = TILE.EMPTY;
      painted.push(cell);
    }
  }
  shapeRoadAround(map, painted);
}

function renderMap(map: GameMap, project: Project, marks: ReadonlySet<string>): PNG {
  const png = new PNG({ width: map.width * T * SCALE, height: map.height * T * SCALE });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 26; png.data[i + 1] = 28; png.data[i + 2] = 34; png.data[i + 3] = 255;
  }
  const tileset = project.tilesets[map.tilesetId];
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh * SCALE; y += 1) for (let x = 0; x < sw * SCALE; x += 1) {
      const si = ((sy0 + Math.floor(y / SCALE)) * chip.width + (sx0 + Math.floor(x / SCALE))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const lower = map.lowerTiles[i]!;
    const upper = map.upperTiles[i]!;
    const dx = x * T * SCALE;
    const dy = y * T * SCALE;
    const composition = tileset ? chipsetQuarterComposition(map, tileset as never, x, y) : null;
    if (composition) {
      blit(composition.underlayTile ?? lower, dx, dy);
      for (const src of composition.sources) {
        blit(src.tile, dx + src.offsetX * SCALE, dy + src.offsetY * SCALE, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (lower >= 0) blit(lower, dx, dy);
    if (upper >= 0) blit(upper, dx, dy);
  }
  for (const key of marks) {
    const [mx, my] = key.split(",").map(Number) as [number, number];
    const dx = mx * T * SCALE;
    const dy = my * T * SCALE;
    for (let y = 0; y < T * SCALE; y += 1) for (let x = 0; x < T * SCALE; x += 1) {
      const edge = x < 2 || y < 2 || x >= T * SCALE - 2 || y >= T * SCALE - 2;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (edge) {
        png.data[di] = 255; png.data[di + 1] = 45; png.data[di + 2] = 60;
      } else {
        png.data[di] = Math.min(255, png.data[di]! + 90);
        png.data[di + 1] = Math.max(0, png.data[di + 1]! - 40);
        png.data[di + 2] = Math.max(0, png.data[di + 2]! - 40);
      }
    }
  }
  return png;
}

function save(name: string, png: PNG): string {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}

type CaseReport = {
  readonly id: string;
  readonly title: string;
  readonly points: readonly Point[];
  readonly naturalness: number;
  readonly destroyedByLegacy: number;
  readonly destroyedByFixed: number;
  readonly obstacleCells: number;
  readonly detouredSegments: number;
  readonly disconnectedSegments: number;
  readonly summary: string;
  readonly warnings: readonly string[];
};

function runCase(id: string, title: string, size: { w: number; h: number }, scene: Scene): CaseReport {
  const baseCtx = scenario(size.w, size.h, scene);
  const structures = structureCells(baseCtx.project, mapOf(baseCtx));
  save(`${id}-0-before.png`, renderMap(mapOf(baseCtx), baseCtx.project, new Set()));

  const legacyCtx = scenario(size.w, size.h, scene);
  paintLegacyRoad(mapOf(legacyCtx), scene.points);
  const legacyLost = [...structures].filter((key) => {
    const [x, y] = key.split(",").map(Number) as [number, number];
    return !structureCells(legacyCtx.project, mapOf(legacyCtx)).has(`${x},${y}`);
  });
  save(`${id}-1-legacy.png`, renderMap(mapOf(legacyCtx), legacyCtx.project, new Set(legacyLost)));

  const fixedCtx = scenario(size.w, size.h, scene);
  const result = runTool(fixedCtx, "paint_road", {
    mapId: MAP_ID,
    points: scene.points,
    style: "dirt",
    naturalness: scene.naturalness,
    ...(scene.naturalness > 0 ? { seed: 4242 } : {}),
  });
  ok(result);
  const fixedStructures = structureCells(fixedCtx.project, mapOf(fixedCtx));
  const fixedLost = [...structures].filter((key) => !fixedStructures.has(key));
  save(`${id}-2-fixed.png`, renderMap(mapOf(fixedCtx), fixedCtx.project, new Set(fixedLost)));

  const data = (result.data ?? {}) as Record<string, number>;
  return {
    destroyedByFixed: fixedLost.length,
    destroyedByLegacy: legacyLost.length,
    detouredSegments: data.detouredSegments ?? 0,
    disconnectedSegments: data.disconnectedSegments ?? 0,
    id,
    naturalness: scene.naturalness,
    obstacleCells: data.obstacleCells ?? 0,
    points: scene.points,
    summary: result.summary,
    title,
    warnings: result.diff?.warnings ?? [],
  };
}

const reports: CaseReport[] = [
  runCase("two-houses", "집 두 채 사이를 직선으로 관통", { w: 40, h: 22 }, {
    houses: [{ origin: { x: 10, y: 5 }, w: 8, h: 8 }, { origin: { x: 24, y: 5 }, w: 8, h: 8 }],
    naturalness: 0,
    points: [{ x: 2, y: 9 }, { x: 37, y: 9 }],
  }),
  runCase("one-house", "집 한 채를 정면으로 관통", { w: 36, h: 20 }, {
    houses: [{ origin: { x: 13, y: 4 }, w: 10, h: 9 }],
    naturalness: 0,
    points: [{ x: 3, y: 8 }, { x: 32, y: 8 }],
  }),
  runCase("natural-village", "구불구불한 길(자연도 0.7)이 마을 세 채를 지나감", { w: 44, h: 26 }, {
    houses: [
      { origin: { x: 8, y: 4 }, w: 8, h: 8 },
      { origin: { x: 20, y: 12 }, w: 9, h: 8 },
      { origin: { x: 32, y: 5 }, w: 8, h: 9 },
    ],
    naturalness: 0.7,
    points: [{ x: 2, y: 12 }, { x: 22, y: 9 }, { x: 41, y: 14 }],
  }),
];

fs.writeFileSync(path.join(OUT, "report.json"), `${JSON.stringify(reports, null, 2)}\n`);
for (const report of reports) {
  console.log(`[${report.id}] 옛 로직 파괴 ${report.destroyedByLegacy}칸 → 고친 뒤 ${report.destroyedByFixed}칸 / 우회 ${report.detouredSegments}회 · 끊김 ${report.disconnectedSegments}`);
  console.log(`  ${report.summary}`);
}
