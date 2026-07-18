/**
 * rpg-zzu-home-8pyeong 프로젝트 재구성:
 *   map_home_8pyeong_v1  (방 2)
 *   map_home_4rooms_v1   (방 4 가정집)
 *   map_home_inn_4rooms_v1 (방 4 여관 — 객실 사이 문 없음, 홀/주방으로만 문)
 *
 * bun scripts/build-home-inn-4rooms.mts
 */
import fs from "node:fs";
import {
  ensureInteriorRoomHarness,
  evaluateInteriorRoom,
  INTERIOR_ROOM_TILESET_ID,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { applyEasyRpgThemeMetadataPacks } from "../src/project/tilesetHarness/themePacks.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapId, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-home-8pyeong";
const MAP8 = "map_home_8pyeong_v1" as MapId;
const MAP4 = "map_home_4rooms_v1" as MapId;
const MAP_INN = "map_home_inn_4rooms_v1" as MapId;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function pageText(
  id: string,
  name: string,
  body: string,
  graphic: Record<string, unknown> = {},
  priority: "same" | "below" = "below",
) {
  return {
    id,
    name,
    conditions: [],
    graphic,
    trigger: { kind: "action" as const },
    priority,
    overlapForbidden: priority === "same",
    movement: { type: "fixed" as const, speed: 3, frequency: 3 },
    commands: [{ kind: "text" as const, body }],
  };
}

function addEvents(map: GameMap, extras: GameMap["events"]) {
  map.events = [...(map.events ?? []), ...extras];
}

const plan8: InteriorRoomPlan = {
  mapId: MAP8,
  name: "가정집 · 8평 (거실+침실)",
  width: 16,
  height: 12,
  wings: [],
  rooms: [
    { id: "living", x: 2, y: 3, w: 7, h: 5, theme: "dining" },
    { id: "bedroom", x: 10, y: 3, w: 4, h: 5, theme: "bedroom" },
  ],
  // 방마다 문: 거실↔침실만
  innerDoors: [{ x: 9, y: 5 }],
  door: { x: 5, y: 7 },
  theme: "dining",
  floorTile: 72,
  seed: 88,
};

const planHome4: InteriorRoomPlan = {
  mapId: MAP4,
  name: "가정집 4방 (침실·서재·거실·주방)",
  width: 18,
  height: 17,
  wings: [],
  rooms: [
    { id: "bedroom", x: 2, y: 3, w: 7, h: 4, theme: "bedroom" },
    { id: "study", x: 10, y: 3, w: 6, h: 4, theme: "study" },
    { id: "living", x: 2, y: 10, w: 7, h: 5, theme: "dining" },
    { id: "kitchen", x: 10, y: 10, w: 6, h: 5, theme: "kitchen", floorTile: 12 },
  ],
  // 모든 인접 방에 문 (십자)
  innerDoors: [
    { x: 9, y: 4 },
    { x: 9, y: 12 },
    { x: 5, y: 7 },
    { x: 12, y: 7 },
  ],
  door: { x: 5, y: 14 },
  theme: "dining",
  floorTile: 72,
  seed: 42,
};

// 여관 4방: 객실1 | 객실2 (사이 문 없음 — 벽만)
//            주방  | 홀   (주방↔홀 문, 객실→홀 문만)
// 방마다 문이 있을 수도 / 없을 수도 있음 → 객실 간 통로 없음
const planInn: InteriorRoomPlan = {
  mapId: MAP_INN,
  name: "여관 1층 (객실×2·주방·홀)",
  width: 20,
  height: 17,
  wings: [],
  rooms: [
    { id: "guest1", x: 2, y: 3, w: 7, h: 4, theme: "bedroom" },
    { id: "guest2", x: 10, y: 3, w: 7, h: 4, theme: "bedroom" },
    // 수직 파티션 x=9: 객실1|객실2 — innerDoor 없음 (벽만)
    { id: "kitchen", x: 2, y: 10, w: 7, h: 5, theme: "kitchen", floorTile: 12 },
    { id: "hall", x: 10, y: 10, w: 7, h: 5, theme: "tavern" },
  ],
  innerDoors: [
    { x: 5, y: 7 }, // 객실1 → 주방 쪽 복도/아래로 (수평 파티션) — 객실1만 남쪽 문
    { x: 13, y: 7 }, // 객실2 → 홀 (수평)
    { x: 9, y: 12 }, // 주방 ↔ 홀 (수직 1칸 문)
    // 객실1↔객실2 문 없음
  ],
  door: { x: 13, y: 14 }, // 홀 남측 현관
  theme: "tavern",
  floorTile: 72,
  seed: 17,
};

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};

const builds = [
  { plan: plan8, label: "8pyeong" },
  { plan: planHome4, label: "home4" },
  { plan: planInn, label: "inn4" },
] as const;

const maps: Record<string, GameMap> = {};
for (const { plan, label } of builds) {
  const result = runInteriorRoomPipeline(plan);
  const report = evaluateInteriorRoom(result.map, plan);
  console.log(`[${label}]`, result.ok ? "ok" : "fail", "score", report.score, plan.mapId);
  if (result.warnings.length) console.log(`  warnings`, result.warnings);
  if (!result.ok) {
    console.error(result.log);
    process.exit(1);
  }
  if (result.map.tilesetId !== INTERIOR_ROOM_TILESET_ID) {
    result.map.tilesetId = INTERIOR_ROOM_TILESET_ID;
  }
  maps[plan.mapId] = result.map;
}

// events
addEvents(maps[MAP8]!, [
  {
    id: "ev_home_resident",
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      pageText("p1", "주민", "어서 와요. 여긴 우리 집 거실이에요.", {
        characterName: "People1",
        characterIndex: 0,
      }, "same"),
    ],
  } as GameMap["events"][number],
  {
    id: "ev_bedroom_note",
    x: 11,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [pageText("p1", "침대 메모", "작은 침실. 창가에 햇살이 들어온다.")],
  } as GameMap["events"][number],
]);

addEvents(maps[MAP4]!, [
  {
    id: "ev_home4_resident",
    x: 4,
    y: 12,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      pageText("p1", "주민", "위층은 없고, 방 네 개로 나눠 썼어.", {
        characterName: "People1",
        characterIndex: 0,
      }, "same"),
    ],
  } as GameMap["events"][number],
]);

addEvents(maps[MAP_INN]!, [
  {
    id: "ev_inn_keeper",
    x: 12,
    y: 12,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      pageText(
        "p1",
        "여관 주인",
        "객실은 위쪽 둘. 서로 문은 없고, 홀·주방으로만 내려와요.",
        { characterName: "People2", characterIndex: 1 },
        "same",
      ),
    ],
  } as GameMap["events"][number],
  {
    id: "ev_inn_guest1_note",
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [pageText("p1", "1호실", "1호실. 옆방과는 벽만 닿아 있다.")],
  } as GameMap["events"][number],
  {
    id: "ev_inn_guest2_note",
    x: 13,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [pageText("p1", "2호실", "2호실. 홀 쪽으로만 문이 있다.")],
  } as GameMap["events"][number],
]);

const project = createBlankProject() as Project;
for (const ts of Object.values(project.tilesets)) {
  applyEasyRpgThemeMetadataPacks(ts);
}
ensureInteriorRoomHarness(project);

project.meta = {
  ...(project.meta ?? {}),
  title: "가정집·여관",
  description: "8평 + 4방 가정집 + 4방 여관 (Interior 칩셋)",
};
(project as { maps: Record<string, GameMap> }).maps = maps;
project.startMapId = MAP_INN;
project.startPos = { x: planInn.door.x, y: planInn.door.y - 1 };
// 8평 아래 자식: 4방 집, 여관
project.mapTree = {
  mapId: MAP8,
  children: [
    { mapId: MAP4, children: [] },
    { mapId: MAP_INN, children: [] },
  ],
};

const interior = project.tilesets[INTERIOR_ROOM_TILESET_ID];
console.log("[chipset]", interior?.image, "autotile", interior?.autotileGroups?.length);

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved.kind);
if (saved.kind !== "saved" && saved.kind !== "created") process.exit(1);

const v = await loadProjectFromSupabase(config);
console.log("[verify] maps", Object.keys(v.maps));
console.log("[verify] tree", JSON.stringify(v.mapTree));
console.log("[verify] start", v.startMapId, v.startPos);
console.log(
  "[verify] tileset",
  v.tilesets[INTERIOR_ROOM_TILESET_ID]?.image,
  "map tilesets",
  Object.fromEntries(Object.entries(v.maps).map(([k, m]) => [k, m.tilesetId])),
);

const inn = v.maps[MAP_INN]!;
const at = (x: number, y: number) => inn.lowerTiles[y * inn.width + x]!;
// 객실 사이 x=9, y=3..6 — 문(72) 없이 벽(77/107/428)
console.log(
  "[inn partition guest|guest x=9]",
  [3, 4, 5, 6].map((y) => `(9,${y})=${at(9, y)}`).join(" "),
);
console.log(
  "[inn doors]",
  `guest1 south (5,7)=${at(5, 7)}`,
  `guest2 south (13,7)=${at(13, 7)}`,
  `kitchen|hall (9,12)=${at(9, 12)}`,
  `entrance (13,14)=${at(13, 14)}`,
);
console.log("[inn events]", inn.events.map((e) => `${e.id}@${e.x},${e.y}`).join(" | "));

if (!v.maps[MAP8] || !v.maps[MAP4] || !v.maps[MAP_INN]) process.exit(1);
if (v.tilesets[INTERIOR_ROOM_TILESET_ID]?.image?.type !== "bundled") process.exit(1);
// 객실 사이 개구부 없어야 함
for (const y of [3, 4, 5, 6]) {
  if (at(9, y) === 72) {
    console.error("unexpected door between guest rooms at", 9, y);
    process.exit(1);
  }
}
console.log("[ok] projectId=", PROJECT_ID, "inn=", MAP_INN);
