/**
 * 호수 마을 소품을 좁은 광장 뭉침에서 마을 전역으로 재산포.
 * naturalness ≥ 0.55 (poisson) + 구역별 넓은 area.
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import type { Project } from "../src/project/types.ts";

const MAP_ID = "map_lake_village";

/** 재배치 대상 (나무/집/꽃 일부는 유지 — 가구·마당·묘지만 리셋) */
const CLEAR_UPPER = new Set([
  327, 328, 358, 388, // benches
  349, 350, 351, 352, // yard
  323, 353, 383, // cemetery
  144, 174, 204, 234, 235, 236, // tables
  147, 148, 175, 176, 205, 206, // chairs
  202, 203, 237, 231, // crates/magic
]);

const YARD = "harness-combined-town-house-yard-props";
const CEMETERY = "harness-combined-town-cemetery-props";
const BENCH_H = "harness-combined-town-bench-horizontal";
const BENCH_V = "harness-combined-town-bench-vertical";
const TABLE_H = "harness-combined-town-table-horizontal";
const TABLE_V = "harness-combined-town-table-vertical";
const FREE_CHAIR = "harness-combined-town-free-chairs";
const TABLE_CHAIRS = "harness-combined-town-table-chairs";
const FRUIT = "harness-combined-town-fruit-box";
const WOOD_BOX = "harness-combined-town-wood-box";
const MAGIC = "harness-combined-town-magic-circle";
const FLOWERS = "harness-combined-town-flower-props";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>): string {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name} failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
  return result.summary;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("load failed");
const map = project.maps[MAP_ID];
if (!map) throw new Error("no map");

let cleared = 0;
for (let i = 0; i < map.upperTiles.length; i += 1) {
  const u = map.upperTiles[i]!;
  if (CLEAR_UPPER.has(u)) {
    map.upperTiles[i] = TILE.EMPTY;
    cleared += 1;
  }
}
console.log("[clear] removed furniture/yard/cemetery tiles:", cleared);

const ctx = { project };
const logs: string[] = [];

type Job = {
  id: string;
  area: { x: number; y: number; w: number; h: number };
  count: number;
  minGap: number;
  naturalness: number;
  seed: number;
};

// 넓은 구역 + poisson (naturalness 0.55~0.7) + minGap ≥ 2 → 한 덩어리 금지
const jobs: Job[] = [
  // 집 앞 마당 — 집마다 소구역 (장작·우편함 등)
  { id: YARD, area: { x: 40, y: 10, w: 14, h: 6 }, count: 3, minGap: 2, naturalness: 0.55, seed: 1101 },
  { id: YARD, area: { x: 22, y: 24, w: 10, h: 6 }, count: 3, minGap: 2, naturalness: 0.55, seed: 1102 },
  { id: YARD, area: { x: 40, y: 24, w: 12, h: 6 }, count: 3, minGap: 2, naturalness: 0.55, seed: 1103 },
  { id: YARD, area: { x: 46, y: 32, w: 8, h: 6 }, count: 2, minGap: 2, naturalness: 0.55, seed: 1104 },
  { id: YARD, area: { x: 28, y: 34, w: 10, h: 6 }, count: 3, minGap: 2, naturalness: 0.55, seed: 1105 },
  { id: YARD, area: { x: 44, y: 38, w: 10, h: 6 }, count: 2, minGap: 2, naturalness: 0.55, seed: 1106 },
  { id: YARD, area: { x: 32, y: 50, w: 10, h: 5 }, count: 2, minGap: 2, naturalness: 0.55, seed: 1107 },
  { id: YARD, area: { x: 20, y: 30, w: 10, h: 6 }, count: 2, minGap: 2, naturalness: 0.55, seed: 1108 },

  // 벤치 — 메인 척추/호수 기슭/광장/진입로에 분산
  { id: BENCH_H, area: { x: 34, y: 46, w: 10, h: 8 }, count: 2, minGap: 3, naturalness: 0.6, seed: 1201 },
  { id: BENCH_H, area: { x: 34, y: 30, w: 12, h: 8 }, count: 2, minGap: 3, naturalness: 0.6, seed: 1202 },
  { id: BENCH_H, area: { x: 24, y: 14, w: 12, h: 8 }, count: 2, minGap: 3, naturalness: 0.6, seed: 1203 },
  { id: BENCH_H, area: { x: 40, y: 14, w: 10, h: 8 }, count: 1, minGap: 3, naturalness: 0.55, seed: 1204 },
  { id: BENCH_V, area: { x: 36, y: 36, w: 8, h: 10 }, count: 2, minGap: 3, naturalness: 0.6, seed: 1210 },
  { id: BENCH_V, area: { x: 28, y: 20, w: 8, h: 10 }, count: 2, minGap: 3, naturalness: 0.6, seed: 1211 },
  { id: BENCH_V, area: { x: 42, y: 42, w: 8, h: 8 }, count: 1, minGap: 3, naturalness: 0.55, seed: 1212 },

  // 탁자 — 상인 거리 / 광장 / 호수 기슭 각 1
  { id: TABLE_H, area: { x: 34, y: 26, w: 14, h: 6 }, count: 1, minGap: 2, naturalness: 0.55, seed: 1301 },
  { id: TABLE_H, area: { x: 32, y: 40, w: 12, h: 6 }, count: 1, minGap: 2, naturalness: 0.55, seed: 1302 },
  { id: TABLE_V, area: { x: 26, y: 18, w: 6, h: 10 }, count: 1, minGap: 2, naturalness: 0.55, seed: 1303 },

  // 의자·상자 — 길 따라 넓게
  { id: TABLE_CHAIRS, area: { x: 30, y: 24, w: 18, h: 12 }, count: 4, minGap: 2, naturalness: 0.65, seed: 1401 },
  { id: FREE_CHAIR, area: { x: 24, y: 36, w: 20, h: 12 }, count: 4, minGap: 2, naturalness: 0.65, seed: 1402 },
  { id: FRUIT, area: { x: 40, y: 22, w: 12, h: 10 }, count: 2, minGap: 3, naturalness: 0.55, seed: 1403 },
  { id: WOOD_BOX, area: { x: 28, y: 28, w: 16, h: 14 }, count: 4, minGap: 3, naturalness: 0.6, seed: 1404 },

  // 꽃 — 주거지 사이 넓게
  { id: FLOWERS, area: { x: 22, y: 12, w: 28, h: 36 }, count: 16, minGap: 2, naturalness: 0.7, seed: 1501 },

  // 묘지 — 서남 (집과 멀리) 한 구역만
  { id: CEMETERY, area: { x: 2, y: 46, w: 14, h: 8 }, count: 7, minGap: 2, naturalness: 0.55, seed: 1601 },

  // 마법진 — 호수 북안 단독
  { id: MAGIC, area: { x: 8, y: 2, w: 10, h: 6 }, count: 1, minGap: 0, naturalness: 0.5, seed: 1701 },
];

for (const job of jobs) {
  logs.push(
    runOk(ctx, "place_props", {
      mapId: MAP_ID,
      area: job.area,
      propVocabId: job.id,
      count: job.count,
      minGap: job.minGap,
      naturalness: job.naturalness,
      seed: job.seed,
    }),
  );
}

// 스프레드 검증
const benchCells: { x: number; y: number }[] = [];
const yardCells: { x: number; y: number }[] = [];
const tableCells: { x: number; y: number }[] = [];
const m = ctx.project.maps[MAP_ID]!;
for (let y = 0; y < m.height; y += 1) {
  for (let x = 0; x < m.width; x += 1) {
    const u = m.upperTiles[y * m.width + x]!;
    if (u === 327 || u === 328 || u === 358 || u === 388) benchCells.push({ x, y });
    if (u === 349 || u === 350 || u === 351 || u === 352) yardCells.push({ x, y });
    if (u === 234 || u === 235 || u === 236 || u === 144 || u === 174 || u === 204) tableCells.push({ x, y });
  }
}

function span(cells: { x: number; y: number }[]) {
  if (cells.length === 0) return { n: 0, spanX: 0, spanY: 0 };
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  return {
    n: cells.length,
    spanX: Math.max(...xs) - Math.min(...xs),
    spanY: Math.max(...ys) - Math.min(...ys),
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

const benchSpan = span(benchCells);
const yardSpan = span(yardCells);
const tableSpan = span(tableCells);
console.log("[spread]", JSON.stringify({ benchSpan, yardSpan, tableSpan }, null, 2));

if (benchSpan.spanX < 12 || benchSpan.spanY < 10) {
  throw new Error(`benches still clustered: ${JSON.stringify(benchSpan)}`);
}
if (yardSpan.spanX < 15 || yardSpan.spanY < 20) {
  throw new Error(`yard still clustered: ${JSON.stringify(yardSpan)}`);
}

const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", saved);

const outDir = path.join("output", "evidence", "prop-redistribute");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "report.json"),
  JSON.stringify({ cleared, benchSpan, yardSpan, tableSpan, saved, logs }, null, 2),
);
console.log("[done] props redistributed across village");
