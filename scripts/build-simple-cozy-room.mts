/**
 * 간단한 실내 방(침실 테마, 가구 포함) 1맵 프로젝트 → Supabase 저장 + 재로드 검증.
 * 실행: bun scripts/build-simple-cozy-room.mts
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

const PROJECT_ID = "rpg-zzu-cozy-room";
const MAP_ID = "map_cozy_room_v1" as MapId;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const plan: InteriorRoomPlan = {
  mapId: MAP_ID,
  name: "아담한 침실",
  width: 14,
  height: 12,
  wings: [{ x: 2, y: 3, w: 10, h: 6 }],
  door: { x: 6, y: 8 },
  theme: "bedroom",
  floorTile: 72, // 나무 바닥
  seed: 42,
};

const result = runInteriorRoomPipeline(plan);
const report = evaluateInteriorRoom(result.map, plan);
console.log("[pipeline]", result.ok ? "ok" : "fail", "score", report.score);
console.log("[warnings]", result.warnings.slice(0, 8));
console.log("[log]");
for (const line of result.log) console.log(" ", line);

if (!result.ok) {
  console.error("interior critique failed — abort save");
  process.exit(1);
}

const map: GameMap = result.map;
// 간단한 환영 이벤트(남쪽 문 안쪽)
const welcome = {
  id: "ev_room_welcome",
  x: plan.door.x,
  y: plan.door.y - 1,
  trigger: { kind: "action" as const },
  commands: [],
  pages: [
    {
      id: "page_1",
      name: "메모",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" as const },
      priority: "below" as const,
      overlapForbidden: false,
      movement: { type: "fixed" as const, speed: 3, frequency: 3 },
      commands: [
        { kind: "text" as const, body: "작은 침실이다. 침대와 가구가 가지런히 놓여 있다." },
      ],
    },
  ],
};
map.events = [...(map.events ?? []), welcome as (typeof map.events)[number]];

const project = createBlankProject() as Project;
project.meta = {
  ...(project.meta ?? {}),
  title: "아담한 침실",
  description: "간단한 실내 방 데모 — 침대·가구가 있는 침실 1맵",
};
(project as { maps: Record<string, GameMap> }).maps = { [MAP_ID]: map };
project.startMapId = MAP_ID;
project.startPos = { x: plan.door.x, y: plan.door.y - 1 };
project.mapTree = { mapId: MAP_ID, children: [] };

const upperFilled = map.upperTiles.filter((t) => t !== -1 && t !== 0).length;
const lowerNonVoid = map.lowerTiles.filter((t) => t !== 430).length;
console.log("[map]", MAP_ID, `${map.width}×${map.height}`, "events", map.events.length, "upper", upperFilled, "floorish", lowerNonVoid);

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};
if (!config.url || !config.anonKey) {
  console.error(".env.local에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필요");
  process.exit(2);
}

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);
if (saved.kind !== "saved" && saved.kind !== "created") {
  console.error("save failed", saved);
  process.exit(1);
}

const verify = await loadProjectFromSupabase(config);
if (!verify) {
  console.error("reload failed — null project");
  process.exit(1);
}
const vmap = verify.maps[MAP_ID];
console.log(
  "[verify]",
  "title=",
  verify.meta?.title,
  "projectId=",
  PROJECT_ID,
  "map=",
  vmap ? `${vmap.width}×${vmap.height}` : null,
  "events=",
  vmap?.events?.length,
  "start=",
  verify.startMapId,
  verify.startPos,
);
if (!vmap || verify.startMapId !== MAP_ID || (vmap.events?.length ?? 0) < 1) {
  console.error("verify failed");
  process.exit(1);
}

// 로컬 스냅샷(보조)
const outDir = path.resolve("output/maps");
fs.mkdirSync(outDir, { recursive: true });
const snap = {
  projectId: PROJECT_ID,
  title: verify.meta?.title,
  mapId: MAP_ID,
  size: `${vmap.width}x${vmap.height}`,
  events: vmap.events.length,
  upperFilled,
  pipelineLog: result.log,
};
fs.writeFileSync(path.join(outDir, "cozy-room-snapshot.json"), JSON.stringify(snap, null, 2));
console.log("[ok] Supabase projectId=", PROJECT_ID, "map=", MAP_ID);
