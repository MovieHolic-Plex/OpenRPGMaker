/**
 * 장식 배선 보고 렌더 — 전부 실경로: author_house(runTool) 산출을 그대로 그린다.
 * 실행: npx tsx scripts/render-house-decor-report.mts
 * 산출: output/evidence/house-decor-report/*.png + meta.json
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { ALL_HOUSE_KIT_IDS, HOUSE_KITS } from "../src/editor/houseKit.ts";
import { createEmptyToolProject, runTool } from "../src/editor/tools/index.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const T = 16;
const COLS = 30;
const GRASS = 240;
const OUT = path.resolve("output/evidence/house-decor-report");
fs.mkdirSync(OUT, { recursive: true });
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));

const meta: Record<string, string> = {};

function renderMap(map: GameMap, scale: number): PNG {
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 64; png.data[i + 1] = 108; png.data[i + 2] = 74; png.data[i + 3] = 255;
  }
  const blit = (tile: number, dx: number, dy: number): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T;
    const sy0 = Math.floor(tile / COLS) * T;
    for (let y = 0; y < T * scale; y += 1) for (let x = 0; x < T * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const lower = map.lowerTiles[i]!;
    const upper = map.upperTiles[i]!;
    if (lower >= 0) blit(lower, x * T * scale, y * T * scale);
    if (upper >= 0) blit(upper, x * T * scale, y * T * scale);
  }
  return png;
}

function toolContext(width: number, height: number): { context: { project: Project }; mapId: string } {
  const project = createEmptyToolProject("보고 렌더");
  const context = { project };
  const created = runTool(context, "create_map", { name: "보고맵", width, height });
  if (!created.ok) throw new Error(`create_map 실패: ${created.summary}`);
  const mapId = Object.keys(context.project.maps)[0]!;
  context.project.maps[mapId]!.lowerTiles.fill(GRASS);
  context.project.maps[mapId]!.upperTiles.fill(-1);
  // create_map은 시작 위치를 맵 중앙에 두는데, 집이 중앙을 덮으면 무결성 게이트(start-position)가
  // 커밋을 거부한다 — 좌상단 잔디로 옮겨 둔다.
  (context.project as { startPos: { x: number; y: number } }).startPos = { x: 1, y: 1 };
  return { context, mapId };
}

function saveMap(file: string, map: GameMap, scale = 4): void {
  fs.writeFileSync(path.join(OUT, `${file}.png`), PNG.sync.write(renderMap(map, scale)));
  console.log("rendered", file);
}

// ── 1. before/after — 같은 호출, 장식 옵션만 추가 ────────────────────────────
{
  const bare = toolContext(15, 14);
  const r1 = runTool(bare.context, "author_house", {
    kind: "single", mapId: bare.mapId, kitId: "blue-stone", wings: [{ x: 3, y: 2, w: 9, h: 8 }],
    interior: "exterior-only", door: true, yard: [],
  });
  if (!r1.ok) throw new Error(r1.summary);
  saveMap("1-before", bare.context.project.maps[bare.mapId]!);
  meta["1-before"] = r1.summary;

  const decorated = toolContext(15, 14);
  const r2 = runTool(decorated.context, "author_house", {
    kind: "single", mapId: decorated.mapId, kitId: "blue-stone", wings: [{ x: 3, y: 2, w: 9, h: 8 }],
    interior: "exterior-only", door: true, yard: [], fence: true, banner: true, chimney: true,
  });
  if (!r2.ok) throw new Error(r2.summary);
  saveMap("1-after", decorated.context.project.maps[decorated.mapId]!);
  meta["1-after"] = r2.summary;
}

// ── 2. 킷 6종 × 풀장식 ─────────────────────────────────────────────────
for (const kitId of ALL_HOUSE_KIT_IDS) {
  const { context, mapId } = toolContext(15, 14);
  const result = runTool(context, "author_house", {
    kind: "single", mapId, kitId, wings: [{ x: 3, y: 2, w: 9, h: 8 }],
    interior: "exterior-only", door: true, yard: [], fence: true, banner: true, chimney: true,
  });
  if (!result.ok) throw new Error(`${kitId}: ${result.summary}`);
  saveMap(`2-kit-${kitId}`, context.project.maps[mapId]!);
  meta[`2-kit-${kitId}`] = `${HOUSE_KITS[kitId].name} — ${result.summary}`;
}

// ── 3. L자 평면 + 풀장식 (조합 실증) ─────────────────────────────────────────
{
  const { context, mapId } = toolContext(20, 17);
  const result = runTool(context, "author_house", {
    kind: "single", mapId, kitId: "amber-wood",
    wings: [{ x: 2, y: 2, w: 6, h: 12 }, { x: 2, y: 7, w: 14, h: 7 }],
    interior: "exterior-only", door: true, yard: [], fence: true, banner: true, chimney: true,
  });
  if (!result.ok) throw new Error(result.summary);
  saveMap("3-lplan-decor", context.project.maps[mapId]!);
  meta["3-lplan-decor"] = result.summary;
}

fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
console.log("done ->", OUT);
