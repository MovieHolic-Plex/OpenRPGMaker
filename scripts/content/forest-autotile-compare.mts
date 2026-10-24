/**
 * 숲 칠하기 방식 비교 — 같은 30×20 표본(굽은 숲길 + 작은 빈터)에 쓸 수 있는 숲 칠하기를 하나씩 깔아 맵으로 남긴다.
 *   node --max-old-space-size=12000 node_modules/vite-node/dist/cli.mjs --script scripts/content/forest-autotile-compare.mts <out.project.json>
 *   bun scripts/qa-game/render.mts --project <out.project.json> --out <dir>
 * 맵 id = 방식(cmp_canopy · cmp_composer_* · cmp_dungeon_forest · cmp_jp_*).
 */
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { runTool } from "@/editor/tools/toolRunner";
import { BEODEUL_PLAIN_GRASS, plantBeodeulForestWall } from "@/editor/tools/wildRouteBeodeul";
import { composeBeodeulForest, beodeulWoodlandGrass, type BeodeulForestType } from "@/editor/tools/beodeulForest";
import { paintJpForestArea } from "@/editor/jpCity/forestPainter";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3/constructionTools";
import { serialize } from "@/project/io";
import type { GameMap, Project } from "@/project/types";

const out = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? "/tmp/forest-compare.project.json";
const W = 30, H = 20;
let project: Project = createBlankProject();
ensureBundledTilesets?.(project as never);

function tool(name: string, args: Record<string, unknown>) {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name}: ${res.summary} ${JSON.stringify(res.issues ?? []).slice(0, 300)}`);
  project = ctx.project as Project;
  return res;
}

// 굽은 숲길(폭 2~3) — 서쪽 (0,~12) 에서 동쪽 (29,~6) 으로, 사인 곡선 + 넓어지는 굽이. 빈터는 (20,13) 둘레 둥근 덩이.
const path = new Set<number>();
for (let x = 0; x < W; x++) {
  const cy = 10 + 3.2 * Math.sin(x / 4.2) - x * 0.12;
  const half = 1 + (Math.sin(x / 3) > 0.6 ? 0.8 : 0.3);
  for (let y = 0; y < H; y++) if (Math.abs(y - cy) <= half) path.add(y * W + x);
}
const clearing = new Set<number>();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = (x - 19.5) / 4.2, dy = (y - 14.5) / 3.2;
  if (dx * dx + dy * dy < 1 + 0.15 * Math.sin(x * 1.7 + y)) clearing.add(y * W + x);
}
const near = (c: number, set: Set<number>, r: number) => {
  const x = c % W, y = Math.floor(c / W);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H && set.has(ny * W + nx)) return true;
  }
  return false;
};
const open = new Set<number>();
for (let c = 0; c < W * H; c++) if (near(c, path, 1) || clearing.has(c)) open.add(c);
const isForest = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !open.has(y * W + x);

function blank(id: string, name: string, tilesetId = "beodeul_city"): GameMap {
  tool("create_map", { id, name, width: W, height: H, tilesetId });
  const map = project.maps[id]!;
  const size = W * H;
  if (tilesetId === "beodeul_city") map.lowerTiles = Array.from({ length: size }, () => BEODEUL_PLAIN_GRASS);
  map.upperTiles = Array.from({ length: size }, () => -1);
  return map;
}
function beodeulPath(map: GameMap) {
  const fill = CONSTRUCTION_TOOLS_V3.find((t) => t.name === "fill_region")!;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!path.has(y * W + x)) { x++; continue; }
      let e = x; while (e + 1 < W && path.has(y * W + e + 1)) e++;
      fill.run(project, { mapId: map.id, rect: { x, y, w: e - x + 1, h: 1 }, material: "버들항 모랫길" });
      x = e + 1;
    }
  }
}
const woodland = (map: GameMap) => {
  const ts = project.tilesets[map.tilesetId]!;
  const g = beodeulWoodlandGrass(project, ts);
  const live = project.maps[map.id]!;
  if (g >= 0) for (let i = 0; i < live.lowerTiles.length; i++) if (live.lowerTiles[i] === BEODEUL_PLAIN_GRASS) live.lowerTiles[i] = g;
};

// 1. 버들항 이어진 수관 오토타일(#3223/#3229/#3259) — 지금 폴른 스타 숲.
{
  const map = blank("cmp_canopy", "수관 오토타일");
  beodeulPath(map);
  const live = project.maps[map.id]!;
  const reserved = new Set<number>(open);
  plantBeodeulForestWall(project, live, project.tilesets.beodeul_city!, reserved, Math.random, CONSTRUCTION_TOOLS_V3[0]!);
  woodland(live);
}
// 2. 버들항 woodland 나무 composer(#3122) — 활엽·침엽·혼효.
for (const type of ["broadleaf", "conifer", "mixed"] as BeodeulForestType[]) {
  const map = blank(`cmp_composer_${type}`, `나무 composer ${type}`);
  beodeulPath(map);
  const live = project.maps[map.id]!;
  const hold = (x: number, y: number) => isForest(x, y);
  composeBeodeulForest(project, live, project.tilesets.beodeul_city!, type, isForest, hold, 7, hold, "woodland");
  woodland(live);
}
// 2b. 섞음(제안) — 수관 덩이는 길에서 들쭉날쭉 물러나고(잡음 문턱), 그 사이 띠에 composer 낱 나무·짙은 풀이 선다.
{
  const map = blank("cmp_hybrid", "수관 + 가장자리 낱 나무(제안)");
  beodeulPath(map);
  const live = project.maps[map.id]!;
  const noise = (x: number, y: number) => Math.sin(x * 0.9 + y * 0.4) * 0.8 + Math.sin(x * 0.31 - y * 0.77) * 1.1 + Math.sin((x + y) * 1.7) * 0.4;
  const dist = new Float32Array(W * H).fill(99);
  for (let c = 0; c < W * H; c++) if (open.has(c)) dist[c] = 0;
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      dist[c] = Math.min(dist[c]!, dist[ny * W + nx]! + (dx && dy ? 1.4 : 1));
    }
  }
  const canopyOk = (x: number, y: number) => dist[y * W + x]! > 1.8 + 0.6 * noise(x, y);
  const reserved = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!canopyOk(x, y)) reserved.add(y * W + x);
  plantBeodeulForestWall(project, live, project.tilesets.beodeul_city!, reserved, Math.random, CONSTRUCTION_TOOLS_V3[0]!);
  const after = project.maps[map.id]!;
  const fringe = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !open.has(y * W + x) && after.upperTiles[y * W + x]! < 0
    && ([2, 3, 4] as const).every((L) => (L === 2 ? after.upperTiles : L === 3 ? after.upperOverlayTiles : undefined)?.[y * W + x] === undefined || ((L === 2 ? after.upperTiles : after.upperOverlayTiles)![y * W + x]! < 0));
  composeBeodeulForest(project, after, project.tilesets.beodeul_city!, "mixed", fringe, fringe, 11, fringe, "woodland");
  woodland(project.maps[map.id]!);
}
// 3. 던전 주제 숲(#3285) — author_dungeon type forest(같은 수관 오토타일 + 던전 방 문법). 표본 모양은 못 맞춘다.
try {
  tool("author_dungeon", { id: "cmp_dungeon_forest", name: "던전 숲", type: "forest", adapter: "beodeul", genre: "rpg", size: "small", width: 40, height: 30, populate: false, seed: 5 });
} catch (e) { console.error("dungeon forest:", String((e as Error).message).slice(0, 300)); }
// 4. jp_city 숲 r7(#3058) — dense·grove.
for (const forestType of ["dense", "grove"] as const) {
  try {
    const map = blank(`cmp_jp_${forestType}`, `jp_city 숲 ${forestType}`, "jp_city");
    const live = project.maps[map.id]!;
    // 숲 바닥은 잔디 위에만 선다 — composer 가 넘칠 수 있는 잔디 칸(overhangOnTiles 첫 칸)으로 바닥을 깐다.
    const groups = (project.tilesets.jp_city!.autotileGroups ?? []) as unknown as { composer?: { ground?: { apronBases?: number[] } } }[];
    const lawn = groups.map((g) => g.composer?.ground?.apronBases?.[0]).find((t) => t !== undefined && t >= 0);
    if (lawn !== undefined) live.lowerTiles = Array.from({ length: W * H }, () => lawn);
    const want = new Uint8Array(W * H);
    for (let c = 0; c < W * H; c++) if (!open.has(c)) want[c] = 1;
    const r = paintJpForestArea(live, project.tilesets.jp_city as never, want, { forestType, seed: 3 });
    console.log("jp", forestType, JSON.stringify(r));
  } catch (e) { console.error("jp forest:", String((e as Error).message).slice(0, 300)); }
}

for (const id of Object.keys(project.maps)) if (!id.startsWith("cmp_")) delete project.maps[id];
project.startMapId = "cmp_canopy";
writeFileSync(out, serialize(project));
console.log("maps", Object.keys(project.maps).join(" "), "→", out);
