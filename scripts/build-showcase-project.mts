/**
 * 맵 쇼케이스 프로젝트 — 에디터가 만들 수 있는 맵 유형을 전부 한 프로젝트에 시공한다.
 * 사용자 피드백(직접 수정) 대상. 열람: 에디터 URL에 ?project=rpg-zzu-showcase
 *
 * 구성:
 *  A. 마을 3종 — 강촌 장터(강·호수·시장), 숲 사냥꾼(흙길·침엽수), 석조 장터(돌마당)
 *  B. 성 5종 — 관문 요새 / 대탑 본성 / 동심원 성 / 궁정 알현실 / 폐성
 *  C. 던전 3종 — 용암 / 석재 / 얼음
 *  D. 집 외관 카탈로그 — 킷 6종 + 굴뚝/울타리/깃발 데코
 *  E. 실내 정본 세트 — 대저택(2층)·L형 민가·2층 민가·여관(2층)·상점·공방·서재
 *  F. 특수 실내 — 도서관·연회장(금장)·만찬장(석벽)·병영·공방·창고·40×40 대저택층
 *
 * 실행: npx tsx scripts/build-showcase-project.mts
 * 산출: Supabase(rpg-zzu-showcase) + output/evidence/showcase-project/*.png
 *       + docs/2026-07-20-showcase-project.html
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { defaultDatabase } from "../src/project/defaults/defaultDatabase.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import { saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { buildLargeRiverMarketVillageProject } from "../src/editor/content/largeRiverMarketVillageBuild.ts";
import {
  buildDungeonThemeMap,
  DUNGEON_TILESET_ID,
  type DungeonTheme,
} from "../src/project/defaults/dungeonThemedLayouts.ts";
import { buildHouseKit } from "../src/editor/tools/houseKitDomain.ts";
import { createHouseInteriorMap, registerInteriorMaps } from "../src/editor/houseInteriors.ts";
import {
  evaluateInteriorRoom,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { stampCastle, evaluateCastle, paintCourtyardPavement } from "../src/editor/castleKit.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap, MapId, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-showcase";
const TOWN_TILESET = "easyrpg_chipset_combined_town";
const INTERIOR_TILESET = "easyrpg_chipset_interior";
const GRASS = 240;
const T = 16;
const COLS = 30;
const OUT = path.resolve("output/evidence/showcase-project");
fs.mkdirSync(OUT, { recursive: true });

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const ctx: { project: Project } = { project: createEmptyToolProject("맵 쇼케이스") };
ctx.project.database = defaultDatabase();
ctx.project.meta = { ...ctx.project.meta, title: "맵 쇼케이스 — 피드백용" };
ensureTilesetHarnesses(ctx.project);

function runOk(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name}: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  if (result.warnings?.length) console.log(`  [warn:${name}]`, result.warnings.join(" | "));
  return (result.data ?? {}) as Record<string, unknown>;
}

function newTownMap(id: string, name: string, w: number, h: number): GameMap {
  runOk("create_map", { id, name, width: w, height: h });
  const map = ctx.project.maps[id]!;
  map.tilesetId = TOWN_TILESET;
  map.lowerTiles.fill(GRASS);
  map.upperTiles.fill(-1);
  return map;
}

const sL = (m: GameMap, x: number, y: number, t: number): void => {
  if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.lowerTiles[y * m.width + x] = t;
};
const sU = (m: GameMap, x: number, y: number, t: number): void => {
  if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.upperTiles[y * m.width + x] = t <= 0 ? -1 : t;
};

// ═════════════════════════════ A. 마을 3종 ═════════════════════════════
console.log("\n[A] 마을 3종");

// A1. 강촌 장터 50×50 — 검증된 강·호수·시장 파이프라인(별도 프로젝트 생성 후 병합)
console.log("  A1. 강촌 장터 50×50 (강·호수·시장·낚시꾼)");
const river = buildLargeRiverMarketVillageProject({
  mapW: 50,
  mapH: 50,
  seed: 42,
  mapId: "map_sc_village_river",
  mapName: "마을 · 강촌 장터 (50×50)",
  wipeAllMaps: false,
});
if (!river.ok) console.log("  [warn] 강촌 QA 이슈:", JSON.stringify(river.qa));
for (const [id, map] of Object.entries(river.project.maps)) {
  ctx.project.maps[id] = map;
}
// 맵 이벤트가 참조하는 스위치·변수·맵 연결도 함께 병합(무결성 왕복 검사 대비)
for (const sw of river.project.switches) {
  if (!ctx.project.switches.some((s) => s.id === sw.id)) ctx.project.switches.push(sw);
}
for (const v of river.project.variables) {
  if (!ctx.project.variables.some((s) => s.id === v.id)) ctx.project.variables.push(v);
}
for (const conn of river.project.mapConnections ?? []) {
  ctx.project.mapConnections.push(conn);
}
const riverStart = { mapId: river.project.startMapId, pos: river.project.startPos };
console.log(`  강촌: 집 ${river.housesBuilt} · NPC ${river.npcCount} · 맵 ${river.mapTreeIds.length}개(실내 포함)`);

// A2. 숲 사냥꾼 마을 50×50 — 흙길 + 침엽수 우거진 가장자리 + 목조 킷
console.log("  A2. 숲 사냥꾼 마을 50×50");
newTownMap("map_sc_village_forest", "마을 · 숲 사냥꾼 (50×50)", 50, 50);
const forestData = runOk("build_village", {
  mapId: "map_sc_village_forest",
  seed: 11,
  pathStyle: "dirt",
  kitMix: "amber-wood",
  yardStyle: "workshop",
  edgeTrees: "dense",
  plazaStyle: "garden",
  fences: true,
  decor: true,
  interior: false,
  doorEvent: false,
});
console.log(`  숲 마을: 집 ${forestData.housesBuilt} · NPC ${forestData.npcCount}`);

// A3. 석조 장터 마을 50×50 — 유기 돌마당 필드 + 청석 킷 + 장터 광장
console.log("  A3. 석조 장터 마을 50×50");
newTownMap("map_sc_village_stone", "마을 · 석조 장터 (50×50)", 50, 50);
const stoneData = runOk("build_village", {
  mapId: "map_sc_village_stone",
  seed: 13,
  pathStyle: "stone",
  kitMix: "blue-stone",
  yardStyle: "market",
  plazaStyle: "market",
  plazaLayout: "center",
  fences: true,
  decor: true,
  interior: false,
  doorEvent: false,
});
console.log(`  석조 마을: 집 ${stoneData.housesBuilt} · NPC ${stoneData.npcCount}`);

// ═════════════════════════════ B. 성 3종 (정본 stampCastle) ═════════════════════════════
console.log("\n[B] 성 3종 — 정본 성채 스탬프(문법 린트 게이트)");

const DECOR = { WELL: 382, BRAZIER: 381, POT: 352, CRATE: 203 };

function stampCastleMap(spec: {
  id: string; name: string; w: number; h: number;
  wallHeight: 2 | 3 | 4; gateWidth: number; pave: boolean;
  decorate?: boolean;
}): void {
  const m = newTownMap(spec.id, spec.name, spec.w, spec.h);
  const result = stampCastle(m, {
    area: { x: 1, y: 1, w: spec.w - 2, h: spec.h - 2 },
    wallHeight: spec.wallHeight,
    gateWidth: spec.gateWidth,
    roundTower: true,
  });
  if (!result.ok) throw new Error(`${spec.id}: ${result.reason}`);
  if (spec.pave) {
    const c = result.courtyard;
    paintCourtyardPavement(m, c.x, c.y, c.w, c.h);
  }
  if (spec.decorate) {
    const c = result.courtyard;
    sU(m, c.x + 2, c.y + Math.floor(c.h / 2), DECOR.WELL);
    sU(m, c.x + c.w - 3, c.y + Math.floor(c.h / 2), DECOR.BRAZIER);
    sU(m, c.x + 3, c.y + 1, DECOR.CRATE);
    sU(m, c.x + c.w - 4, c.y + 1, DECOR.POT);
  }
  const evalReport = evaluateCastle(m, result);
  const fails = (evalReport as { checks?: { key: string; pass: boolean }[] }).checks?.filter((ch) => !ch.pass) ?? [];
  console.log(`  ${spec.name} — 배너 ${result.banners}쌍, 린트 ${fails.length === 0 ? "전항 통과" : `실패 ${fails.map((f) => f.key).join(",")}`}`);
}

stampCastleMap({ id: "map_sc_castle_main", name: "성 · 정본 성채 (46×36)", w: 46, h: 36, wallHeight: 2, gateWidth: 8, pave: true, decorate: true });
stampCastleMap({ id: "map_sc_castle_small", name: "성 · 소형 성채 · 정면 3단 (32×28)", w: 32, h: 28, wallHeight: 3, gateWidth: 6, pave: false });
stampCastleMap({ id: "map_sc_castle_large", name: "성 · 대형 성채 · 정면 4단 (52×42)", w: 52, h: 42, wallHeight: 4, gateWidth: 10, pave: true });

// ═════════════════════════════ C. 던전 3종 ═════════════════════════════
console.log("\n[C] 던전 3종");
const DUNGEONS: { theme: DungeonTheme; id: string; name: string }[] = [
  { theme: "lava", id: "map_sc_dungeon_lava", name: "던전 · 용암 동굴" },
  { theme: "stone", id: "map_sc_dungeon_stone", name: "던전 · 석재 홀" },
  { theme: "ice", id: "map_sc_dungeon_ice", name: "던전 · 얼음 동굴" },
];
for (const d of DUNGEONS) {
  const built = buildDungeonThemeMap(d.theme);
  ctx.project.maps[d.id] = {
    id: d.id,
    name: `${d.name} (${built.width}×${built.height})`,
    width: built.width,
    height: built.height,
    tilesetId: DUNGEON_TILESET_ID,
    tileSize: 16,
    lowerTiles: built.grid.lower,
    upperTiles: built.grid.upper,
    events: [],
  } as unknown as GameMap;
  console.log(`  ${d.name}`);
}

// ═════════════════════════════ D. 집 외관 카탈로그 ═════════════════════════════
console.log("\n[D] 집 외관 카탈로그 (킷 6종 + 데코)");
const KIT_MAP_ID = "map_sc_house_kits";
newTownMap(KIT_MAP_ID, "집 외관 · 킷 6종 카탈로그 (46×32)", 46, 32);
const KIT_SPECS: {
  kitId: string; x: number; y: number; ownerName: string;
  chimney?: boolean; fence?: boolean; banner?: boolean;
}[] = [
  { kitId: "blue-stone", x: 2, y: 2, ownerName: "청석 민가", chimney: true },
  { kitId: "bright-plaster", x: 17, y: 2, ownerName: "회벽 민가", banner: true },
  { kitId: "amber-wood", x: 32, y: 2, ownerName: "호박 목조", chimney: true, fence: true },
  { kitId: "slate-wood", x: 2, y: 15, ownerName: "청회 목조", fence: true },
  { kitId: "timber-hall", x: 17, y: 15, ownerName: "목골 회관", chimney: true, banner: true },
  { kitId: "aframe-stone", x: 32, y: 15, ownerName: "석조 저택", chimney: true, fence: true, banner: true },
];
const kitDoors: Record<string, { x: number; y: number }> = {};
for (const spec of KIT_SPECS) {
  try {
    const res = buildHouseKit(ctx.project, {
      mapId: KIT_MAP_ID as MapId,
      kitId: spec.kitId as never,
      wings: [{ x: spec.x, y: spec.y, w: 9, h: 8 }],
      door: true,
      doorEvent: false,
      interior: false,
      ownerName: spec.ownerName,
      ...(spec.chimney ? { chimney: true } : {}),
      ...(spec.fence ? { fence: true } : {}),
      ...(spec.banner ? { banner: true } : {}),
    });
    if (res.data.doorAt) kitDoors[spec.kitId] = res.data.doorAt;
    console.log(`  ${spec.ownerName}(${spec.kitId}): ${res.summary}`);
  } catch (err) {
    console.log(`  [skip] ${spec.kitId}: ${(err as Error).message}`);
  }
}
const kitMapRef = ctx.project.maps[KIT_MAP_ID]!;
const fallbackDoor = { x: 6, y: 10 };

// ═════════════════════════════ E. 실내 정본 세트 ═════════════════════════════
console.log("\n[E] 실내 정본 세트");
const INTERIOR_SETS: {
  id: string; name: string; seed: number;
  exterior: Record<string, unknown>; returnKit: string;
}[] = [
  { id: "map_sc_int_manor", name: "실내 · 대저택", seed: 20, exterior: { program: "manor", stories: 2, kitId: "aframe-stone" }, returnKit: "aframe-stone" },
  { id: "map_sc_int_cottage_l", name: "실내 · L형 민가", seed: 5, exterior: { program: "dwelling", stories: 1, templateId: "cottage-l" }, returnKit: "blue-stone" },
  { id: "map_sc_int_house2f", name: "실내 · 2층 민가", seed: 8, exterior: { program: "dwelling", stories: 2, kitId: "amber-wood" }, returnKit: "amber-wood" },
  { id: "map_sc_int_inn", name: "실내 · 여관", seed: 16, exterior: { program: "inn", stories: 2, kitId: "timber-hall" }, returnKit: "timber-hall" },
  { id: "map_sc_int_shop", name: "실내 · 상점", seed: 9, exterior: { program: "shop", stories: 1, kitId: "bright-plaster" }, returnKit: "bright-plaster" },
  { id: "map_sc_int_workshop", name: "실내 · 공방", seed: 31, exterior: { program: "workshop", stories: 1, kitId: "slate-wood", footprintArea: 40 }, returnKit: "slate-wood" },
  { id: "map_sc_int_study", name: "실내 · 서재", seed: 33, exterior: { program: "study", stories: 1, footprintArea: 50 }, returnKit: "bright-plaster" },
];
const interiorSetIds: string[] = [];
for (const set of INTERIOR_SETS) {
  const door = kitDoors[set.returnKit] ?? fallbackDoor;
  const interior = createHouseInteriorMap({
    id: set.id as MapId,
    name: set.name,
    returnMapId: KIT_MAP_ID as MapId,
    returnX: door.x,
    returnY: Math.min(kitMapRef.height - 1, door.y + 1),
    exitEventId: `evt_${set.id}_exit`,
    seed: set.seed,
    exterior: set.exterior as never,
  });
  registerInteriorMaps(ctx.project, interior);
  for (const floor of interior.floors) interiorSetIds.push(floor.mapId);
  if (interior.warnings?.length) console.log(`  [warn] ${set.name}:`, interior.warnings.join(" | "));
  console.log(`  ${set.name}: scale=${interior.scale} program=${interior.program} ${interior.stories}층 (맵 ${interior.floors.length}개)`);
}

// ═════════════════════════════ F. 특수 실내 ═════════════════════════════
console.log("\n[F] 특수 실내 7종");
const SPECIAL_PLANS: readonly InteriorRoomPlan[] = [
  {
    mapId: "map_sc_rp_library", name: "특수 · 도서관 (24×16)", width: 24, height: 16,
    wings: [{ x: 2, y: 4, w: 20, h: 8 }], door: { x: 11, y: 11 }, theme: "study", floorTile: 102, seed: 21,
  },
  {
    mapId: "map_sc_rp_feast", name: "특수 · 연회장 금장 (18×15)", width: 18, height: 15,
    wings: [{ x: 2, y: 4, w: 9, h: 8 }, { x: 11, y: 9, w: 5, h: 3 }],
    door: { x: 6, y: 11 }, theme: "dining", wallMaterial: "gold-brick", seed: 19,
  },
  {
    mapId: "map_sc_rp_dining", name: "특수 · 만찬장 석벽 (19×13)", width: 19, height: 13,
    wings: [{ x: 2, y: 4, w: 15, h: 6 }], door: { x: 9, y: 9 }, theme: "dining", wallMaterial: "stone-brick", seed: 28,
  },
  {
    mapId: "map_sc_rp_barracks", name: "특수 · 병영 숙소 (21×16)", width: 21, height: 16,
    wings: [],
    rooms: [
      { id: "bunk1", x: 3, y: 4, w: 4, h: 3, theme: "bedroom", floorTile: 139 },
      { id: "bunk2", x: 8, y: 4, w: 4, h: 3, theme: "bedroom", floorTile: 139 },
      { id: "bunk3", x: 13, y: 4, w: 4, h: 3, theme: "bedroom", floorTile: 139 },
      { id: "hall", x: 3, y: 10, w: 15, h: 3, theme: "dining" },
    ],
    innerDoors: [{ x: 4, y: 7 }, { x: 9, y: 7 }, { x: 14, y: 7 }],
    door: { x: 10, y: 12 }, theme: "tavern", seed: 25,
  },
  {
    mapId: "map_sc_rp_atelier", name: "특수 · 연금술 공방 (14×12)", width: 14, height: 12,
    wings: [{ x: 2, y: 4, w: 10, h: 5 }], door: { x: 6, y: 8 }, theme: "kitchen", floorTile: 12, seed: 26,
  },
  {
    mapId: "map_sc_rp_warehouse", name: "특수 · 대형 창고 (20×14)", width: 20, height: 14,
    wings: [{ x: 2, y: 4, w: 16, h: 6 }], door: { x: 9, y: 9 }, theme: "storage", floorTile: 12, seed: 23,
  },
  {
    mapId: "map_sc_rp_manor40", name: "특수 · 대저택 층 (40×40)", width: 40, height: 40,
    wings: [],
    rooms: [
      { id: "a1", x: 3, y: 4, w: 8, h: 6, theme: "bedroom" },
      { id: "a2", x: 12, y: 4, w: 8, h: 6, theme: "study" },
      { id: "a3", x: 21, y: 4, w: 7, h: 6, theme: "bedroom" },
      { id: "a4", x: 29, y: 4, w: 8, h: 6, theme: "storage", floorTile: 12 },
      { id: "b1", x: 3, y: 13, w: 8, h: 6, theme: "kitchen", floorTile: 12 },
      { id: "b2", x: 12, y: 13, w: 8, h: 6, theme: "dining" },
      { id: "b3", x: 21, y: 13, w: 7, h: 6, theme: "study", floorTile: 102 },
      { id: "b4", x: 29, y: 13, w: 8, h: 6, theme: "bedroom" },
      { id: "c1", x: 3, y: 22, w: 8, h: 6, theme: "storage", floorTile: 12 },
      { id: "c2", x: 12, y: 22, w: 8, h: 6, theme: "bedroom" },
      { id: "c3", x: 21, y: 22, w: 7, h: 6, theme: "kitchen" },
      { id: "c4", x: 29, y: 22, w: 8, h: 6, theme: "study" },
      { id: "hall", x: 3, y: 31, w: 34, h: 4, theme: "tavern" },
    ],
    innerDoors: [
      { x: 5, y: 10 }, { x: 14, y: 10 }, { x: 23, y: 10 }, { x: 31, y: 10 },
      { x: 11, y: 15 }, { x: 20, y: 16 }, { x: 28, y: 15 },
      { x: 6, y: 19 }, { x: 15, y: 19 }, { x: 24, y: 19 }, { x: 32, y: 19 },
      { x: 11, y: 24 }, { x: 28, y: 25 },
      { x: 5, y: 28 }, { x: 14, y: 28 }, { x: 23, y: 28 }, { x: 31, y: 28 },
    ],
    door: { x: 19, y: 34 }, theme: "tavern", wallMaterial: "gold-brick", seed: 20,
  },
];
const MAX_TRIES = 12;
for (const plan of SPECIAL_PLANS) {
  const baseSeed = plan.seed ?? 1;
  let best: { map: GameMap; score: number; ok: boolean } | null = null;
  for (let k = 0; k < MAX_TRIES; k += 1) {
    const rolled = { ...plan, seed: baseSeed + k * 131 };
    const result = runInteriorRoomPipeline(rolled);
    const report = evaluateInteriorRoom(result.map, rolled);
    if (!best || report.score > best.score) best = { map: result.map, score: report.score, ok: report.ok };
    if (report.ok) break;
  }
  ctx.project.maps[plan.mapId] = best!.map;
  console.log(`  ${plan.name} — ${best!.ok ? "합격" : "불합격"} score=${best!.score}`);
}

// ═════════════════════════════ 마무리: 트리·시작점·저장 ═════════════════════════════
console.log("\n[마무리] 맵 트리·시작점·저장");

const riverInteriorIds = river.mapTreeIds.filter((id) => id !== "map_sc_village_river");
const orderedTop: { mapId: string; children: { mapId: string; children: never[] }[] }[] = [
  { mapId: "map_sc_village_forest", children: [] },
  { mapId: "map_sc_village_stone", children: [] },
  { mapId: "map_sc_castle_main", children: [] },
  { mapId: "map_sc_castle_small", children: [] },
  { mapId: "map_sc_castle_large", children: [] },
  { mapId: "map_sc_dungeon_lava", children: [] },
  { mapId: "map_sc_dungeon_stone", children: [] },
  { mapId: "map_sc_dungeon_ice", children: [] },
  {
    mapId: KIT_MAP_ID,
    children: interiorSetIds.map((id) => ({ mapId: id, children: [] as never[] })),
  },
  ...SPECIAL_PLANS.map((p) => ({ mapId: p.mapId, children: [] as never[] })),
];
ctx.project.mapTree = {
  mapId: "map_sc_village_river",
  children: [
    ...riverInteriorIds.map((id) => ({ mapId: id, children: [] as never[] })),
    ...orderedTop,
  ],
};
ctx.project.startMapId = (riverStart.mapId || "map_sc_village_river") as MapId;
ctx.project.startPos = riverStart.pos ?? { x: 25, y: 25 };

const mapCount = Object.keys(ctx.project.maps).length;
console.log(`  총 맵 수: ${mapCount}`);

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};
const saved = await saveProjectToSupabase(ctx.project, config);
console.log("  [saved]", (saved as { kind?: string })?.kind ?? saved, "→ projectId:", PROJECT_ID);

fs.writeFileSync(path.join(OUT, "project.json"), JSON.stringify(ctx.project));
console.log("  백업: output/evidence/showcase-project/project.json");

// ═════════════════════════════ 렌더 ═════════════════════════════
console.log("\n[렌더] 전 맵 PNG");
const CHIPS: Record<string, PNG> = {
  [TOWN_TILESET]: PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png")),
  [INTERIOR_TILESET]: PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png")),
  [DUNGEON_TILESET_ID]: PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png")),
};

function renderMap(map: GameMap): PNG | null {
  const chip = CHIPS[map.tilesetId];
  if (!chip) return null;
  const tileset = ctx.project.tilesets[map.tilesetId];
  const scale = map.width >= 40 ? 2 : 3;
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255;
  }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
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
    const dx = x * T * scale;
    const dy = y * T * scale;
    const composition = tileset ? chipsetQuarterComposition(map, tileset, x, y) : null;
    if (composition) {
      blit(composition.underlayTile ?? lower, dx, dy);
      for (const src of composition.sources) {
        blit(src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (lower >= 0) blit(lower, dx, dy);
    if (upper >= 0) blit(upper, dx, dy);
  }
  // 이벤트 마커(NPC·문·전이) — 우상단 모서리 주황 점
  for (const ev of map.events ?? []) {
    const px = ev.x * T * scale, py = ev.y * T * scale;
    const s = Math.max(4, 2 * scale);
    for (let y = 0; y < s; y += 1) for (let x = 0; x < s; x += 1) {
      const di = ((py + y) * png.width + (px + (T * scale - s) + x)) * 4;
      if (di < 0 || di + 3 >= png.data.length) continue;
      png.data[di] = 255; png.data[di + 1] = 140; png.data[di + 2] = 0; png.data[di + 3] = 255;
    }
  }
  return png;
}

const rendered: { id: string; name: string; file: string; w: number; h: number; events: number }[] = [];
for (const [id, map] of Object.entries(ctx.project.maps)) {
  const png = renderMap(map);
  if (!png) {
    console.log("  [skip render]", id, map.tilesetId);
    continue;
  }
  const file = `${id}.png`;
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png));
  rendered.push({ id, name: map.name, file, w: map.width, h: map.height, events: (map.events ?? []).length });
  console.log("  rendered", id);
}
fs.writeFileSync(path.join(OUT, "rendered.json"), JSON.stringify(rendered, null, 2));
console.log(`\n[done] 맵 ${mapCount}개 · 렌더 ${rendered.length}장 → ${OUT}`);
console.log(`열람: 에디터 URL에 ?project=${PROJECT_ID}`);
