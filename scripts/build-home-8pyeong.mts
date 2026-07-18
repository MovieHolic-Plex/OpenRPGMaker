/**
 * 가정집 8평 · 방 2개 (거실 + 침실) → Supabase 저장/재로드.
 * bun scripts/build-home-8pyeong.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  evaluateInteriorRoom,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapId, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-home-8pyeong";
const MAP_ID = "map_home_8pyeong_v1" as MapId;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

// 8평 ≈ 작은 집: 16×12 맵, 거실 7×5 + 침실 4×5, 사이 문
// InteriorRoomTheme에 living 없음 → 거실은 dining(식탁/의자 거실 배치)
const plan: InteriorRoomPlan = {
  mapId: MAP_ID,
  name: "가정집 · 8평 (거실+침실)",
  width: 16,
  height: 12,
  wings: [],
  rooms: [
    { id: "living", x: 2, y: 3, w: 7, h: 5, theme: "dining" },
    { id: "bedroom", x: 10, y: 3, w: 4, h: 5, theme: "bedroom" },
  ],
  innerDoors: [{ x: 9, y: 5 }],
  door: { x: 5, y: 7 },
  theme: "dining",
  floorTile: 72,
  seed: 88,
};

const result = runInteriorRoomPipeline(plan);
const report = evaluateInteriorRoom(result.map, plan);
console.log("[pipeline]", result.ok ? "ok" : "fail", "score", report.score);
console.log(result.log.join("\n"));
if (result.warnings.length) console.log("[warnings]", result.warnings);
if (!result.ok) process.exit(1);

const map: GameMap = result.map;

// 거실 쪽 간단 NPC + 침실 쪽 조사 메모
map.events = [
  ...(map.events ?? []),
  {
    id: "ev_home_resident",
    x: 4,
    y: 5,
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
          { kind: "text", speaker: "집주인", body: "어서 와요. 여긴 우리 집 거실이에요." },
          { kind: "text", speaker: "집주인", body: "오른쪽 문은 침실로 이어져요." },
        ],
      },
    ],
  } as (typeof map.events)[number],
  {
    id: "ev_bedroom_note",
    x: 11,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p1",
        name: "침대 메모",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "작은 침실. 창가에 햇살이 들어온다." }],
      },
    ],
  } as (typeof map.events)[number],
];

const project = createBlankProject() as Project;
project.meta = {
  ...(project.meta ?? {}),
  title: "가정집 8평",
  description: "거실+침실 방 2개 가정집 (약 8평 규모)",
};
(project as { maps: Record<string, GameMap> }).maps = { [MAP_ID]: map };
project.startMapId = MAP_ID;
project.startPos = { x: plan.door.x, y: plan.door.y - 1 };
project.mapTree = { mapId: MAP_ID, children: [] };

const upper = map.upperTiles.filter((t) => t >= 0).length;
console.log("[map]", MAP_ID, `${map.width}×${map.height}`, "events", map.events.length, "upper", upper);

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};
const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved.kind);
if (saved.kind !== "saved" && saved.kind !== "created") {
  console.error(saved);
  process.exit(1);
}

const verify = await loadProjectFromSupabase(config);
const vmap = verify?.maps[MAP_ID];
console.log(
  "[verify]",
  verify?.meta?.title,
  "map",
  vmap ? `${vmap.width}×${vmap.height}` : null,
  "events",
  vmap?.events?.length,
  "start",
  verify?.startMapId,
  verify?.startPos,
);
if (!vmap || (vmap.events?.length ?? 0) < 2) {
  console.error("verify failed");
  process.exit(1);
}

const outDir = path.resolve("output/maps");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "home-8pyeong-snapshot.json"),
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      mapId: MAP_ID,
      title: verify!.meta?.title,
      size: `${vmap.width}x${vmap.height}`,
      rooms: plan.rooms,
      events: vmap.events.length,
      upper,
      score: report.score,
    },
    null,
    2,
  ),
);
console.log("[ok] projectId=", PROJECT_ID);
