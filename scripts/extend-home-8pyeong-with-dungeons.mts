/**
 * 가정집 8평 프로젝트에 던전 3종(용암/석재/얼음) + 몬스터 전투 이벤트 추가.
 * 실행: npx tsx scripts/extend-home-8pyeong-with-dungeons.mts
 */
import fs from "node:fs";
import path from "node:path";
import { charsetFrameIndex } from "../src/assets/easyrpgRtp.ts";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { ensureSwitchVariableSlots } from "../src/project/defaults/defaultProject.ts";
import {
  seedHomeDungeonComplexTroops,
} from "../src/project/defaults/complexMonsterAuthoring.ts";
import {
  buildDungeonThemeMap,
  countUpperDecorations,
  canReachDungeonLandmarks,
  DUNGEON_MAP_HEIGHT,
  DUNGEON_MAP_WIDTH,
  DUNGEON_TILESET_ID,
} from "../src/project/defaults/dungeonThemedLayouts.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import type { EventPage, GameEvent, GameMap, MapId, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-home-8pyeong";
const HOME_MAP_ID = "map_home_8pyeong_v1" as MapId;
const TILESET_ID = DUNGEON_TILESET_ID;
const W = DUNGEON_MAP_WIDTH;
const H = DUNGEON_MAP_HEIGHT;
const MONSTER1 = "tex_easyrpg_charset_monster1";
const MONSTER2 = "tex_easyrpg_charset_monster2";
const MONSTER3 = "tex_easyrpg_charset_monster3";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function graphic(spriteId: string, characterIndex: number): EventPage["graphic"] {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

function battleMonster(input: {
  id: string;
  name: string;
  x: number;
  y: number;
  troopId: string;
  intro: string;
  victory: string;
  spriteId: string;
  characterIndex: number;
  clearSwitch: string;
}): GameEvent {
  return {
    id: input.id,
    x: input.x,
    y: input.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${input.id}_live`,
        name: input.name,
        conditions: [{ kind: "switch", switchId: input.clearSwitch, value: false }],
        graphic: graphic(input.spriteId, input.characterIndex),
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "random", speed: 2, frequency: 3 },
        commands: [
          { kind: "text", body: input.intro },
          {
            kind: "battleProcessing",
            troopId: input.troopId,
            canEscape: true,
            canLose: false,
          },
          { kind: "setSwitch", switchId: input.clearSwitch, value: true },
          { kind: "text", body: input.victory },
        ],
      },
      {
        id: `${input.id}_gone`,
        name: "빈 자리",
        conditions: [{ kind: "switch", switchId: input.clearSwitch, value: true }],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "이미 쓰러뜨린 자리이다." }],
      },
    ],
  };
}

function transferEvent(id: string, x: number, y: number, mapId: string, tx: number, ty: number, label: string): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_p`,
        name: label,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: label },
          { kind: "transfer", mapId, x: tx, y: ty, direction: "up", fade: "black" },
        ],
      },
    ],
  };
}

// ── dungeon terrain (shared builders) ────────────────────────────────
function lavaMap() {
  const built = buildDungeonThemeMap("lava");
  if (!canReachDungeonLandmarks(built)) throw new Error("lava landmarks not reachable");
  if (countUpperDecorations(built.grid) < 18) throw new Error("lava upper decor too sparse");
  return built.grid;
}

function stoneMap() {
  const built = buildDungeonThemeMap("stone");
  if (!canReachDungeonLandmarks(built)) throw new Error("stone landmarks not reachable");
  if (countUpperDecorations(built.grid) < 18) throw new Error("stone upper decor too sparse");
  return built.grid;
}

function iceMap() {
  const built = buildDungeonThemeMap("ice");
  if (!canReachDungeonLandmarks(built)) throw new Error("ice landmarks not reachable");
  if (countUpperDecorations(built.grid) < 18) throw new Error("ice upper decor too sparse");
  return built.grid;
}

function dungeonMap(input: {
  id: MapId;
  name: string;
  grid: { lower: number[]; upper: number[] };
  events: GameEvent[];
}): GameMap {
  return {
    id: input.id,
    name: input.name,
    width: W,
    height: H,
    tilesetId: TILESET_ID,
    tileSize: 16,
    lowerTiles: input.grid.lower,
    upperTiles: input.grid.upper,
    events: input.events,
  };
}

// ── main ───────────────────────────────────────────────────────────
const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};

// DB에 깨진 프로젝트가 있으면 가정집 시드부터 다시 깐다.
console.log("[seed] npx tsx scripts/build-home-8pyeong.mts");
import { spawnSync } from "node:child_process";
const seed = spawnSync("npx", ["tsx", "scripts/build-home-8pyeong.mts"], { stdio: "inherit", shell: true });
if (seed.status !== 0) process.exit(seed.status ?? 1);

let project = await loadProjectFromSupabase(config);
if (!project?.maps[HOME_MAP_ID]) {
  console.error("[fail] home project/map missing — run scripts/build-home-8pyeong.mts first");
  process.exit(1);
}

// ensure dungeon tileset harness + default troops exist
ensureTilesetHarnesses(project);
// blank project already has troops; empty tool project pattern also seeds them via createBlankProject ancestry
if (!project.database.troops?.some((t) => t.id === "troop_slime")) {
  const seed = createEmptyToolProject("seed");
  project.database.troops = seed.database.troops;
  project.database.enemies = seed.database.enemies;
}

// 전투 프리뷰 배경 — 에디터 "전투 처리" 미리보기/트룹 테스트에 사용
const troopBackdrop: Record<string, string> = {
  troop_slime: "easyrpg-backdrop-sunset1",
  troop_slime_pair: "easyrpg-backdrop-sunset1",
  troop_bat_swarm: "easyrpg-backdrop-night-sky1",
  troop_forest_hornets: "easyrpg-backdrop-dawn1",
  troop_golem_guard: "easyrpg-backdrop-dimension-rift",
  troop_dragon: "easyrpg-backdrop-cosmos1",
};
for (const troop of project.database.troops) {
  const bg = troopBackdrop[troop.id];
  if (bg) troop.previewBackgroundResourceId = bg;
}

const complex = seedHomeDungeonComplexTroops(project);
console.log("[complex-enemies]", complex.enemies.map((e) => e.id).join(", "));
console.log("[complex-troops]", complex.troops.map((t) => t.id).join(", "));

const lavaId = "map_home_dungeon_lava" as MapId;
const stoneId = "map_home_dungeon_stone" as MapId;
const iceId = "map_home_dungeon_ice" as MapId;

const lava = dungeonMap({
  id: lavaId,
  name: "용암 동굴",
  grid: lavaMap(),
  events: [
    transferEvent("ev_lava_exit", 14, 7, HOME_MAP_ID, 5, 6, "집으로 돌아간다."),
    battleMonster({
      id: "monster_lava_slime",
      name: "불꽃 슬라임",
      x: 8,
      y: 14,
      troopId: "troop_lava_ember_pack",
      intro: "용암 웅덩이에서 불꽃 슬라임이 튀어나왔다!",
      victory: "불꽃 슬라임을 쓰러뜨렸다.",
      spriteId: MONSTER1,
      characterIndex: 0,
      clearSwitch: "sw_0001",
    }),
    battleMonster({
      id: "monster_lava_bat",
      name: "재 박쥐",
      x: 19,
      y: 11,
      troopId: "troop_lava_ash_bats",
      intro: "천장에서 재 박쥐 떼가 덤벼든다!",
      victory: "박쥐 떼가 흩어졌다.",
      spriteId: MONSTER3,
      characterIndex: 0,
      clearSwitch: "sw_0002",
    }),
  ],
});

const stone = dungeonMap({
  id: stoneId,
  name: "석재 홀",
  grid: stoneMap(),
  events: [
    transferEvent("ev_stone_exit", 11, 9, HOME_MAP_ID, 5, 6, "집으로 돌아간다."),
    battleMonster({
      id: "monster_stone_golem",
      name: "돌 골렘",
      x: 6,
      y: 11,
      troopId: "troop_stone_ruin_guard",
      intro: "석상 같은 골렘이 천천히 눈을 떴다!",
      victory: "골렘이 모래처럼 무너졌다.",
      spriteId: MONSTER2,
      characterIndex: 4,
      clearSwitch: "sw_0003",
    }),
    battleMonster({
      id: "monster_stone_skeleton",
      name: "해골 병사",
      x: 18,
      y: 14,
      troopId: "troop_stone_bone_pair",
      intro: "먼지 쌓인 해골이 칼날을 세운다!",
      victory: "해골이 바스러졌다.",
      spriteId: MONSTER1,
      characterIndex: 4,
      clearSwitch: "sw_0004",
    }),
  ],
});

const ice = dungeonMap({
  id: iceId,
  name: "얼음 동굴",
  grid: iceMap(),
  events: [
    transferEvent("ev_ice_exit", 13, 11, HOME_MAP_ID, 5, 6, "집으로 돌아간다."),
    battleMonster({
      id: "monster_ice_ghost",
      name: "서리 유령",
      x: 8,
      y: 14,
      troopId: "troop_ice_wraith_pack",
      intro: "하얀 숨결과 함께 유령이 나타났다!",
      victory: "유령이 안개처럼 사라졌다.",
      spriteId: MONSTER1,
      characterIndex: 3,
      clearSwitch: "sw_0005",
    }),
    battleMonster({
      id: "monster_ice_dragon",
      name: "얼음 비룡",
      x: 19,
      y: 11,
      troopId: "troop_ice_azure_drake",
      intro: "동굴 깊숙이 푸른 비룡이 낮게 으르렁거린다!",
      victory: "비룡이 물러났다. 숨길이 열린다.",
      spriteId: MONSTER3,
      characterIndex: 5,
      clearSwitch: "sw_0006",
    }),
  ],
});

// home map portals (south wall area / living room)
const home = project.maps[HOME_MAP_ID]!;
const portalIds = new Set(["ev_portal_lava", "ev_portal_stone", "ev_portal_ice"]);
home.events = (home.events ?? []).filter((e) => !portalIds.has(e.id));
home.events.push(
  {
    id: "ev_portal_lava",
    x: 3,
    y: 8,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p_lava",
        name: "용암 동굴 입구",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", speaker: "집주인", body: "지하실 문이 뜨거운 김을 내뿜는다… 용암 동굴로 내려갈까?" },
          { kind: "transfer", mapId: lavaId, x: 14, y: 8, direction: "up", fade: "black" },
        ],
      },
    ],
  },
  {
    id: "ev_portal_stone",
    x: 5,
    y: 8,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p_stone",
        name: "석재 홀 입구",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", speaker: "집주인", body: "오래된 석재 홀이 열려 있다. 들어가 볼까?" },
          { kind: "transfer", mapId: stoneId, x: 11, y: 10, direction: "up", fade: "black" },
        ],
      },
    ],
  },
  {
    id: "ev_portal_ice",
    x: 7,
    y: 8,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p_ice",
        name: "얼음 동굴 입구",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", speaker: "집주인", body: "서늘한 바람이 새어 나온다. 얼음 동굴이다." },
          { kind: "transfer", mapId: iceId, x: 13, y: 12, direction: "up", fade: "black" },
        ],
      },
    ],
  },
);

project.maps[HOME_MAP_ID] = home;
project.maps[lavaId] = lava;
project.maps[stoneId] = stone;
project.maps[iceId] = ice;
project.meta = {
  ...(project.meta ?? {}),
  title: "가정집 8평 + 던전 3종",
  description: "거실·침실 가정집과 용암/석재/얼음 던전, 몬스터 전투 이벤트",
};
project.mapTree = {
  mapId: HOME_MAP_ID,
  children: [
    { mapId: lavaId, children: [] },
    { mapId: stoneId, children: [] },
    { mapId: iceId, children: [] },
  ],
};
project.startMapId = HOME_MAP_ID;

const monsterCount =
  lava.events.filter((e) => e.id.startsWith("monster_")).length +
  stone.events.filter((e) => e.id.startsWith("monster_")).length +
  ice.events.filter((e) => e.id.startsWith("monster_")).length;

console.log("[maps]", Object.keys(project.maps));
console.log("[monsters]", monsterCount);
console.log("[troops]", project.database.troops.map((t) => t.id).join(", "));

const dungeonSwitches: Record<string, string> = {
  sw_0001: "용암 슬라임 격파",
  sw_0002: "용암 박쥐 격파",
  sw_0003: "석재 골렘 격파",
  sw_0004: "석재 해골 격파",
  sw_0005: "얼음 유령 격파",
  sw_0006: "얼음 비룡 격파",
};
for (const [id, name] of Object.entries(dungeonSwitches)) {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
ensureSwitchVariableSlots(project);
for (const s of project.switches) {
  if (dungeonSwitches[s.id]) s.name = dungeonSwitches[s.id]!;
}

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved.kind);
if (saved.kind !== "saved" && saved.kind !== "created") {
  console.error(saved);
  process.exit(1);
}

const verify = await loadProjectFromSupabase(config);
const okMaps = [HOME_MAP_ID, lavaId, stoneId, iceId].every((id) => verify?.maps[id]);
const vLava = verify?.maps[lavaId];
const vStone = verify?.maps[stoneId];
const vIce = verify?.maps[iceId];
const vMonsters =
  (vLava?.events.filter((e) => e.id.startsWith("monster_")).length ?? 0) +
  (vStone?.events.filter((e) => e.id.startsWith("monster_")).length ?? 0) +
  (vIce?.events.filter((e) => e.id.startsWith("monster_")).length ?? 0);
const vPortals = verify?.maps[HOME_MAP_ID]?.events.filter((e) => e.id.startsWith("ev_portal_")).length ?? 0;

console.log(
  JSON.stringify(
    {
      title: verify?.meta?.title,
      maps: Object.keys(verify?.maps ?? {}),
      portals: vPortals,
      monsters: vMonsters,
      lavaEvents: vLava?.events.map((e) => e.id),
      stoneEvents: vStone?.events.map((e) => e.id),
      iceEvents: vIce?.events.map((e) => e.id),
    },
    null,
    2,
  ),
);

if (!okMaps || vMonsters < 6 || vPortals < 3) {
  console.error("[verify failed]");
  process.exit(1);
}

const outDir = path.resolve("output/maps");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "home-8pyeong-dungeons-snapshot.json"),
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      title: verify!.meta?.title,
      maps: [HOME_MAP_ID, lavaId, stoneId, iceId],
      portals: vPortals,
      monsters: vMonsters,
    },
    null,
    2,
  ),
);
console.log("[ok] projectId=", PROJECT_ID);
