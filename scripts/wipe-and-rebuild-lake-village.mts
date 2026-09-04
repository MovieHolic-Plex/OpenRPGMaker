/**
 * 호수 마을 — 이전과 다른 레이아웃으로 완전 재생성.
 * NW 큰 호수 + 동쪽 주거지 클러스터 + 남쪽 광장 가구 + 서남 묘지.
 */
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../src/project/defaults.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { BUILD_PALETTE_GROUP_IDS, ensureBuildPaletteTileGroups } from "../src/editor/panels/buildPaletteCore.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { isLakeAutotileTile } from "../src/project/defaults/lakeAutotile.ts";
import { isSandTile } from "../src/project/defaults/sandAutotile.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { recordAiActivity } from "../src/ai/activityLog.ts";
import {
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "../src/project/lint/layoutPlacementValidate.ts";
import type { Project } from "../src/project/types.ts";

const MAP_ID = "map_lake_village";
const TREE_IDS = new Set([260, 290, 261, 291, 262, 263, 292, 293]);
const YARD_IDS = new Set([349, 350, 351, 352]);
const CEMETERY_IDS = new Set([323, 353, 383]);

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

try {
  const existing = await loadProjectFromSupabase(config);
  console.log("[before] maps:", existing ? Object.keys(existing.maps) : null);
} catch (err) {
  console.warn("[before] load failed, will overwrite:", err);
}

// 완전 새 프로젝트 (기존 레이아웃 복사 금지)
const blank = createBlankProject();
blank.meta.title = "호수 마을";
blank.maps = {};
blank.mapTree = { mapId: "", children: [] };
blank.startMapId = "";
const ctx = { project: blank };
const logs: string[] = ["layout: NW-lake + east village + south plaza + SW cemetery"];

// 56×56 — 이전 52 중앙호수 링 배치와 구분
logs.push(runOk(ctx, "create_map", { id: MAP_ID, name: "호수 마을", width: 56, height: 56 }));
ensureBuildPaletteTileGroups(ctx.project.tilesets[ctx.project.maps[MAP_ID]!.tilesetId]!);

// ── 호수: 북서 쪽 큰 원 (중앙 아님) ──
logs.push(
  runOk(ctx, "fill_region", {
    mapId: MAP_ID,
    rect: { x: 3, y: 4, w: 20, h: 18 },
    material: BUILD_PALETTE_GROUP_IDS.water,
    layer: "lower",
    shape: "circle",
  }),
);

// ── 모래길: 남쪽 진입 → 세로 척추 → 호수 동쪽 기슭 + 주거지 가로축 ──
const roads: { points: { x: number; y: number }[]; naturalness: number; seed: number }[] = [
  // 남→북 메인 척추 (맵 동쪽 주거지 쪽)
  {
    points: [
      { x: 38, y: 54 },
      { x: 38, y: 40 },
      { x: 38, y: 28 },
      { x: 38, y: 18 },
    ],
    naturalness: 0.28,
    seed: 701,
  },
  // 척추 → 호수 동쪽 기슭
  {
    points: [
      { x: 38, y: 18 },
      { x: 28, y: 16 },
      { x: 22, y: 14 },
    ],
    naturalness: 0.2,
    seed: 702,
  },
  // 동쪽 가로 상인 거리
  {
    points: [
      { x: 30, y: 28 },
      { x: 38, y: 28 },
      { x: 48, y: 28 },
    ],
    naturalness: 0.16,
    seed: 703,
  },
  // 광장 루프 (남쪽 가구 구역)
  {
    points: [
      { x: 32, y: 38 },
      { x: 44, y: 38 },
      { x: 44, y: 44 },
      { x: 32, y: 44 },
      { x: 32, y: 38 },
    ],
    naturalness: 0.14,
    seed: 704,
  },
  // 북동 촌장 집 연결
  {
    points: [
      { x: 38, y: 18 },
      { x: 42, y: 12 },
      { x: 44, y: 8 },
    ],
    naturalness: 0.12,
    seed: 705,
  },
  // 남서 묘지 쪽 오솔길 (모래, 짧음)
  {
    points: [
      { x: 32, y: 44 },
      { x: 20, y: 48 },
      { x: 10, y: 50 },
    ],
    naturalness: 0.35,
    seed: 706,
  },
];
for (const road of roads) {
  logs.push(
    runOk(ctx, "paint_road", {
      mapId: MAP_ID,
      style: "sand",
      points: road.points,
      naturalness: road.naturalness,
      seed: road.seed,
    }),
  );
}

// ── 집: 동쪽·남동 클러스터 (8방위 분산 아님) ──
type HouseSpec = {
  kitId: "blue-stone" | "bright-plaster";
  wings: readonly { x: number; y: number; w: number; h: number }[];
  ownerName: string;
  interior?: boolean;
};
const houses: readonly HouseSpec[] = [
  // 북동 — 촌장 (큰 집)
  { kitId: "blue-stone", wings: [{ x: 40, y: 2, w: 12, h: 8 }], ownerName: "촌장", interior: true },
  // 호수 동안 — 어부
  { kitId: "bright-plaster", wings: [{ x: 24, y: 20, w: 8, h: 6 }], ownerName: "어부" },
  // 동 가로 — 상인 2채
  { kitId: "blue-stone", wings: [{ x: 42, y: 20, w: 8, h: 6 }], ownerName: "상인" },
  {
    kitId: "bright-plaster",
    wings: [
      { x: 48, y: 26, w: 6, h: 5 },
      { x: 50, y: 28, w: 4, h: 6 },
    ],
    ownerName: "행상",
  },
  // 광장 북 — 목수
  { kitId: "blue-stone", wings: [{ x: 30, y: 30, w: 7, h: 6 }], ownerName: "목수" },
  // 광장 동 — 농부
  { kitId: "bright-plaster", wings: [{ x: 46, y: 34, w: 7, h: 6 }], ownerName: "농부" },
  // 남 — 아이엄마
  { kitId: "bright-plaster", wings: [{ x: 34, y: 46, w: 7, h: 6 }], ownerName: "아이엄마" },
  // 호수 남안 작은 집 — 약초꾼
  { kitId: "blue-stone", wings: [{ x: 22, y: 26, w: 6, h: 6 }], ownerName: "약초꾼" },
];
for (const house of houses) {
  logs.push(
    runOk(ctx, "author_house", {
      kind: "single",
      mapId: MAP_ID,
      kitId: house.kitId,
      wings: house.wings,
      door: true,
      interior: house.interior === true ? "linked-interior" : "exterior-only",
      ownerName: house.ownerName,
      yard: [],
    }),
  );
}

const CONIFER = BUILD_PALETTE_GROUP_IDS.tree;
const BROADLEAF = "harness-combined-town-broadleaf-tree-2x2";
const BENCH_H = "벤치";
const BENCH_V = "harness-combined-town-bench-vertical";
const FLOWERS = "꽃";
const YARD = "harness-combined-town-house-yard-props";
const CEMETERY = "harness-combined-town-cemetery-props";
const TABLE_H = "가로 탁자";
const TABLE_V = "harness-combined-town-table-vertical";
const FRUIT = "과일박스";
const WOOD_BOX = "나무 상자";
const MAGIC = "마법진";
const FREE_CHAIR = "harness-combined-town-free-chairs";
const TABLE_CHAIRS = "harness-combined-town-table-chairs";

// 숲: 서·북 띠 (호수 서/북) + 남동 외곽 — 예전 네 귀퉁이 대칭 아님
for (const [area, coniferCount, broadCount, seed] of [
  [{ x: 1, y: 1, w: 12, h: 28 }, 36, 12, 801], // 서쪽 숲
  [{ x: 12, y: 1, w: 20, h: 8 }, 18, 8, 802], // 호수 북
  [{ x: 1, y: 30, w: 14, h: 14 }, 20, 8, 803], // 서남 숲→묘지 근처
  [{ x: 48, y: 1, w: 7, h: 14 }, 10, 4, 804], // 동북 외곽 얇게
] as const) {
  logs.push(
    runOk(ctx, "place_props", {
      mapId: MAP_ID,
      area,
      material: CONIFER,
      count: coniferCount,
      naturalness: 0.92,
      minGap: 0,
      seed,
    }),
  );
  logs.push(
    runOk(ctx, "place_props", {
      mapId: MAP_ID,
      area,
      material: BROADLEAF,
      count: broadCount,
      naturalness: 0.9,
      minGap: 0,
      seed: seed + 20,
    }),
  );
}

// 집 앞 마당 (각 집 문 쪽 — 대략 남측)
for (const [area, count, seed] of [
  [{ x: 40, y: 10, w: 12, h: 3 }, 4, 901], // 촌장
  [{ x: 24, y: 26, w: 8, h: 3 }, 3, 902], // 어부
  [{ x: 42, y: 26, w: 8, h: 3 }, 3, 903], // 상인
  [{ x: 48, y: 34, w: 6, h: 3 }, 2, 904], // 행상
  [{ x: 30, y: 36, w: 7, h: 3 }, 3, 905], // 목수
  [{ x: 46, y: 40, w: 7, h: 3 }, 2, 906], // 농부
  [{ x: 34, y: 52, w: 7, h: 3 }, 2, 907], // 아이엄마
  [{ x: 22, y: 32, w: 6, h: 3 }, 2, 908], // 약초꾼
] as const) {
  logs.push(
    runOk(ctx, "place_props", {
      mapId: MAP_ID,
      area,
      material: YARD,
      count,
      naturalness: 0.35,
      minGap: 1,
      seed,
    }),
  );
}

// 남쪽 광장 — 가구를 눈에 띄게 (가로/세로 벤치, 탁자, 의자, 과일)
const plaza: { id: string; area: { x: number; y: number; w: number; h: number }; count: number; naturalness: number; minGap: number; seed: number }[] = [
  { id: BENCH_H, area: { x: 33, y: 39, w: 10, h: 4 }, count: 4, naturalness: 0.25, minGap: 1, seed: 920 },
  { id: BENCH_V, area: { x: 34, y: 39, w: 8, h: 5 }, count: 3, naturalness: 0.25, minGap: 1, seed: 921 },
  { id: TABLE_H, area: { x: 35, y: 40, w: 8, h: 3 }, count: 2, naturalness: 0.2, minGap: 1, seed: 922 },
  { id: TABLE_V, area: { x: 40, y: 39, w: 3, h: 5 }, count: 1, naturalness: 0.2, minGap: 1, seed: 923 },
  { id: TABLE_CHAIRS, area: { x: 34, y: 39, w: 10, h: 5 }, count: 6, naturalness: 0.3, minGap: 0, seed: 924 },
  { id: FREE_CHAIR, area: { x: 36, y: 41, w: 6, h: 3 }, count: 3, naturalness: 0.3, minGap: 1, seed: 925 },
  { id: FRUIT, area: { x: 42, y: 40, w: 4, h: 3 }, count: 2, naturalness: 0.25, minGap: 1, seed: 926 },
  { id: WOOD_BOX, area: { x: 33, y: 42, w: 4, h: 3 }, count: 3, naturalness: 0.3, minGap: 1, seed: 927 },
  { id: FLOWERS, area: { x: 32, y: 38, w: 14, h: 8 }, count: 12, naturalness: 0.55, minGap: 1, seed: 928 },
];
for (const prop of plaza) {
  logs.push(
    runOk(ctx, "place_props", {
      mapId: MAP_ID,
      area: prop.area,
      material: prop.id,
      count: prop.count,
      naturalness: prop.naturalness,
      minGap: prop.minGap,
      seed: prop.seed,
    }),
  );
}

// 묘지: 서남 구석 — 집과 멀리
logs.push(
  runOk(ctx, "place_props", {
    mapId: MAP_ID,
    area: { x: 2, y: 48, w: 12, h: 6 },
    material: CEMETERY,
    count: 8,
    naturalness: 0.5,
    minGap: 1,
    seed: 940,
  }),
);

// 호수 북안 마법진
logs.push(
  runOk(ctx, "place_props", {
    mapId: MAP_ID,
    area: { x: 10, y: 3, w: 6, h: 4 },
    material: MAGIC,
    count: 1,
    naturalness: 0.15,
    minGap: 0,
    seed: 941,
  }),
);

// NPC — 새 좌표
const villagers = [
  {
    name: "촌장",
    x: 44,
    y: 11,
    graphic: { query: "old man" },
    lines: ["호수는 서쪽에 두고, 집은 동쪽에 모았지. 광장 벤치에 앉아 쉬어가게."],
  },
  {
    name: "어부",
    x: 26,
    y: 18,
    graphic: { query: "villager" },
    lines: ["호수 기슭에서 그물을 말려. 서쪽 숲은 안개 끼면 조심하게."],
    movement: "random" as const,
  },
  {
    name: "상인",
    x: 40,
    y: 27,
    graphic: { query: "people" },
    lines: ["동쪽 가로에 가게를 열었어. 과일박스 옆에서 흥정하자고."],
  },
  {
    name: "아이",
    x: 38,
    y: 41,
    graphic: { query: "people" },
    lines: ["광장에 세로 의자도 생겼어! 탁자 옆이 제일 좋아."],
    movement: "random" as const,
  },
  {
    name: "묘지기",
    x: 12,
    y: 49,
    graphic: { query: "old woman" },
    lines: ["남서쪽 묘지는 집과 멀리 두었네. 해골은 장난감이 아니야."],
  },
];
for (const npc of villagers) {
  logs.push(
    runOk(ctx, "place_npc", {
      mapId: MAP_ID,
      x: npc.x,
      y: npc.y,
      name: npc.name,
      graphic: npc.graphic,
      movement: npc.movement ?? "fixed",
      pages: [{ lines: npc.lines }],
    }),
  );
}

const project = ctx.project;
project.meta.title = "호수 마을";
project.startMapId = MAP_ID;
project.startPos = { x: 38, y: 52 }; // 남쪽 척추 길
const interiorIds = Object.keys(project.maps).filter((id) => id !== MAP_ID);
project.mapTree = {
  mapId: MAP_ID,
  children: interiorIds.map((mapId) => ({ mapId, children: [] })),
};

const layoutIssues = validateLayoutPlacement(project, {
  mapId: MAP_ID,
  instruction: "NW 호수 + 동쪽 마을 + 남쪽 광장 가구 + 서남 묘지 (이전 중앙링 레이아웃 아님)",
  toolNames: ["fill_region", "place_props", "paint_road", "author_house", "place_npc"],
});
const blocking = layoutValidationBlocking(layoutIssues);
if (blocking.length > 0) {
  throw new Error(`layout blocking: ${JSON.stringify(blocking)}`);
}

const map = project.maps[MAP_ID]!;
let water = 0;
let trees = 0;
let sand = 0;
let treesOnWater = 0;
let treesOnSand = 0;
let benchHTiles = 0;
let benchVPairs = 0;
let yardTiles = 0;
let cemeteryTiles = 0;
let tableTiles = 0;
let forestStackCells = 0;

for (let i = 0; i < map.lowerTiles.length; i += 1) {
  const lower = map.lowerTiles[i]!;
  const upper = map.upperTiles[i]!;
  const x = i % map.width;
  const y = Math.floor(i / map.width);
  if (isLakeAutotileTile(lower)) {
    water += 1;
    if (upper !== TILE.EMPTY && upper >= 0) treesOnWater += 1;
  }
  if (TREE_IDS.has(upper) || TREE_IDS.has(lower)) trees += 1;
  if (upper === 327 || upper === 328) benchHTiles += 1;
  if (upper === 358 && y + 1 < map.height && map.upperTiles[(y + 1) * map.width + x] === 388) {
    benchVPairs += 1;
  }
  if (YARD_IDS.has(upper)) yardTiles += 1;
  if (CEMETERY_IDS.has(upper)) cemeteryTiles += 1;
  if (upper === 234 || upper === 235 || upper === 236 || upper === 144 || upper === 174 || upper === 204) {
    tableTiles += 1;
  }
  if (
    (lower === 290 || lower === 291 || lower === 292 || lower === 293)
    && (upper === 260 || upper === 261 || upper === 262 || upper === 263)
  ) {
    forestStackCells += 1;
  }
  if (isSandTile(lower)) {
    sand += 1;
    if (TREE_IDS.has(upper)) treesOnSand += 1;
  }
}

if (treesOnWater !== 0 || treesOnSand !== 0) {
  throw new Error(`trees on water=${treesOnWater} sand=${treesOnSand}`);
}
if (benchHTiles < 1 || benchVPairs < 1 || yardTiles < 1 || cemeteryTiles < 1 || tableTiles < 1) {
  throw new Error(
    `props incomplete: benchH=${benchHTiles} benchV=${benchVPairs} yard=${yardTiles} cemetery=${cemeteryTiles} table=${tableTiles}`,
  );
}

const finalSaved = await saveProjectToSupabase(project, config);
console.log("[rebuild] saved:", finalSaved);

const verify = await loadProjectFromSupabase(config);
const verifyMap = verify?.maps[MAP_ID];
console.log("[verify] maps:", verify ? Object.keys(verify.maps) : null);
console.log("[verify] size:", verifyMap ? `${verifyMap.width}x${verifyMap.height}` : null);
console.log("[verify] start:", verify?.startMapId, verify?.startPos);

await recordAiActivity({
  channel: "other",
  instruction: "호수 마을 레이아웃 전면 교체: NW호수·동마을·남광장·서남묘지",
  result: { ok: true, applied: true, changedCells: water + sand + trees },
  toolCalls: logs.map((summary) => ({ name: "compose", args: {}, ok: true, summary })),
  audit: [{ kind: "status", text: logs.join(" | ") }],
});

const report = {
  layout: "NW-lake + east-village + south-plaza + SW-cemetery",
  size: "56x56",
  finalMaps: verify ? Object.keys(verify.maps) : [],
  finalSaved,
  map: {
    id: MAP_ID,
    width: map.width,
    height: map.height,
    water,
    trees,
    sand,
    forestStackCells,
    benchHTiles,
    benchVPairs,
    yardTiles,
    cemeteryTiles,
    tableTiles,
    treesOnWater,
    treesOnSand,
    houses: houses.length,
    npcs: villagers.length,
    interiors: interiorIds.length,
  },
  start: project.startPos,
  logs,
};

const outDir = path.join("output", "evidence", "lake-wipe-rebuild");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map, null, 2));
console.log("[done] NEW layout saved — not the old centered ring village");
