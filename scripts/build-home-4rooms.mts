/**
 * 가정집 · 방 4개 (침실·서재 / 거실·주방) → 기존 프로젝트 rpg-zzu-home-8pyeong 에 맵 추가.
 * bun scripts/build-home-4rooms.mts
 */
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../src/project/defaults.ts";
import {
  evaluateInteriorRoom,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapId, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-home-8pyeong";
const MAP_ID = "map_home_4rooms_v1" as MapId;
const EXISTING_MAP_ID = "map_home_8pyeong_v1" as MapId;

function loadEnv(): Record<string, string> {
  const e: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) e[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return e;
}

// 18×17 · 십자 파티션
//  침실(2,3 7×4) | 서재(10,3 6×4)     수직 파티션 x=9
//  ─────────────────────────────     수평 파티션 y=7..9 (3행)
//  거실(2,10 7×5) | 주방(10,10 6×5)
//  현관 문 (5,14) 거실 남측
const plan: InteriorRoomPlan = {
  mapId: MAP_ID,
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
  innerDoors: [
    { x: 9, y: 4 }, // 침실 ↔ 서재
    { x: 9, y: 12 }, // 거실 ↔ 주방
    { x: 5, y: 7 }, // 침실 → 거실
    { x: 12, y: 7 }, // 서재 → 주방
  ],
  door: { x: 5, y: 14 },
  theme: "dining",
  floorTile: 72,
  seed: 42,
};

const result = runInteriorRoomPipeline(plan);
const report = evaluateInteriorRoom(result.map, plan);
console.log("[pipeline]", result.ok ? "ok" : "fail", "score", report.score);
console.log(result.log.join("\n"));
if (result.warnings.length) console.log("[warnings]", result.warnings);
if (!result.ok) process.exit(1);

const map: GameMap = result.map;

map.events = [
  ...(map.events ?? []),
  {
    id: "ev_home4_resident",
    x: 4,
    y: 12,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p1",
        name: "주민",
        conditions: [],
        graphic: { characterName: "People1", characterIndex: 0 },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", speaker: "집주인", body: "위층은 없고, 방 네 개로 나눠 썼어." },
          { kind: "text", speaker: "집주인", body: "북쪽은 침실·서재, 남쪽은 거실·주방이야." },
        ],
      },
    ],
  } as (typeof map.events)[number],
  {
    id: "ev_home4_bedroom_note",
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p1",
        name: "침실 메모",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "침대 맡에 메모: ‘서재 책 반납할 것’." }],
      },
    ],
  } as (typeof map.events)[number],
  {
    id: "ev_home4_kitchen_note",
    x: 12,
    y: 12,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p1",
        name: "주방 메모",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "화덕이 따뜻하다. 돌바닥이라 청소가 쉽다." }],
      },
    ],
  } as (typeof map.events)[number],
];

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};

// 기존 8평 맵 유지 + 4방 맵 추가
let base: Project;
try {
  base = await loadProjectFromSupabase(config);
  console.log("[load] existing maps", Object.keys(base.maps));
} catch (err) {
  console.warn("[load] failed, blank base", err);
  base = createBlankProject() as Project;
}

const project = {
  ...base,
  meta: {
    ...base.meta,
    title: base.meta?.title ?? "가정집 (8평 + 4방)",
    id: PROJECT_ID,
  },
  maps: {
    ...base.maps,
    [MAP_ID]: map,
  },
  startMapId: MAP_ID,
  startPos: { x: plan.door.x, y: plan.door.y - 1 },
  mapTree: {
    mapId: EXISTING_MAP_ID in (base.maps ?? {}) ? EXISTING_MAP_ID : MAP_ID,
    children:
      EXISTING_MAP_ID in (base.maps ?? {})
        ? [{ mapId: MAP_ID, children: [] as [] }]
        : [],
  },
} as Project;

// mapTree: keep both maps reachable
if (base.maps[EXISTING_MAP_ID] && base.maps[MAP_ID] === undefined) {
  project.mapTree = {
    mapId: EXISTING_MAP_ID,
    children: [{ mapId: MAP_ID, children: [] }],
  };
} else if (base.maps[EXISTING_MAP_ID]) {
  project.mapTree = {
    mapId: EXISTING_MAP_ID,
    children: [{ mapId: MAP_ID, children: [] }],
  };
}

const upper = map.upperTiles.filter((t) => t >= 0).length;
console.log("[map]", MAP_ID, `${map.width}×${map.height}`, "events", map.events.length, "upper", upper);

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved.kind);
if (saved.kind !== "saved" && saved.kind !== "created") {
  console.error(saved);
  process.exit(1);
}

const verify = await loadProjectFromSupabase(config);
const vmap = verify?.maps[MAP_ID];
const v8 = verify?.maps[EXISTING_MAP_ID];
console.log(
  "[verify]",
  verify?.meta?.title,
  "maps",
  Object.keys(verify?.maps ?? {}),
  "4rooms",
  vmap ? `${vmap.width}×${vmap.height} events ${vmap.events?.length}` : null,
  "8pyeong",
  v8 ? `${v8.width}×${v8.height}` : "missing",
  "start",
  verify?.startMapId,
  verify?.startPos,
);
if (!vmap || (vmap.events?.length ?? 0) < 3) {
  console.error("[verify] 4rooms map missing or thin events");
  process.exit(1);
}
if (!v8) {
  console.error("[verify] 8pyeong map was dropped");
  process.exit(1);
}

// sample partition grammar: vertical x=9 under ceiling, horizontal band
const at = (x: number, y: number) => vmap.lowerTiles[y * vmap.width + x]!;
console.log("[tiles] col9", [0, 1, 2, 3, 4, 5, 6].map((y) => `(9,${y})=${at(9, y)}`).join(" "));
console.log("[tiles] door row", `(5,14)=${at(5, 14)}`, `(5,13)=${at(5, 13)}`);

const outDir = path.resolve("output/maps");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "home-4rooms-snapshot.json"),
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      mapId: MAP_ID,
      size: `${vmap.width}x${vmap.height}`,
      rooms: plan.rooms,
      innerDoors: plan.innerDoors,
      events: vmap.events.length,
      upper,
      score: report.score,
    },
    null,
    2,
  ),
);
// dual-map rebuild note: if remote load fails (corrupt events), re-run with both maps via inline dual save.
console.log("[ok] projectId=", PROJECT_ID, "mapId=", MAP_ID);
