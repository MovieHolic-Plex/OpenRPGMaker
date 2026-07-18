/**
 * 에디터 툴만으로 마을·집·실내·던전·퀘스트·NPC·상점을 시공한 뒤 Supabase 저장/재로드.
 *
 * 툴 경로: build_village, place_npc, set_shop_stock, declare_story_flag, define_quest
 * + dungeon layout 모듈(기존 에디터 콘텐츠 파이프와 동일)
 *
 * bun scripts/build-editor-demo-village.mts
 */
import fs from "node:fs";
import path from "node:path";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { ToolContext, ToolResult } from "../src/editor/tools/types.ts";
import {
  buildDungeonThemeMap,
  canReachDungeonLandmarks,
  DUNGEON_MAP_HEIGHT,
  DUNGEON_MAP_WIDTH,
  DUNGEON_TILESET_ID,
} from "../src/project/defaults/dungeonThemedLayouts.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { ensureSwitchVariableSlots } from "../src/project/defaults/defaultProject.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import type { GameEvent, GameMap, MapId, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-editor-demo-village";
const DUNGEON_MAP_ID = "map_demo_dungeon_cave" as MapId;
const FLAG_TALK_CHIEF = "talk-chief";
const FLAG_CLEAR_DUNGEON = "clear-dungeon";
const SW_DUNGEON_CLEAR = "sw_demo_dungeon_clear";
const QUEST_ID = "q-editor-demo-golem";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function mustOk(label: string, result: ToolResult): void {
  console.log(`[tool] ${label}:`, result.ok ? "ok" : "FAIL", result.summary);
  if (!result.ok) {
    console.error(result.issues ?? result);
    process.exit(1);
  }
}

/** runTool write 는 ctx.project 를 draft 로 교체한다 — 항상 이 헬퍼로 호출. */
function runWrite(ctx: ToolContext, name: string, args: Record<string, unknown>, label = name): ToolResult {
  const result = runTool(ctx, name, args);
  mustOk(label, result);
  return result;
}

function findNpcByName(map: GameMap, name: string): GameEvent | undefined {
  return map.events.find(
    (event) => event.pages?.some((page) => page.name === name) || event.id.includes(name),
  );
}

function appendPortal(
  map: GameMap,
  input: {
    id: string;
    name: string;
    x: number;
    y: number;
    body: string;
    mapId: MapId;
    destX: number;
    destY: number;
  },
): void {
  map.events.push({
    id: input.id,
    x: input.x,
    y: input.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${input.id}_page`,
        name: input.name,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: input.body },
          {
            kind: "transfer",
            mapId: input.mapId,
            x: input.destX,
            y: input.destY,
            direction: "up",
            fade: "black",
          },
        ],
      },
    ],
  });
}

function buildDungeonMap(
  project: Project,
  villageId: MapId,
  returnPos: { x: number; y: number },
): { map: GameMap; start: { x: number; y: number } } {
  ensureTilesetHarnesses(project);
  const built = buildDungeonThemeMap("stone");
  if (!canReachDungeonLandmarks(built)) {
    throw new Error("dungeon landmarks not reachable");
  }
  const boss = built.landmarks.find((l) => l.role === "boss");
  const map: GameMap = {
    id: DUNGEON_MAP_ID,
    name: "석재 던전 (데모)",
    width: DUNGEON_MAP_WIDTH,
    height: DUNGEON_MAP_HEIGHT,
    tilesetId: DUNGEON_TILESET_ID,
    tileSize: 16,
    lowerTiles: [...built.grid.lower],
    upperTiles: [...built.grid.upper],
    events: [
      {
        id: "ev_dungeon_exit",
        x: built.start.x,
        y: built.start.y,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p_exit",
            name: "지상으로",
            conditions: [],
            graphic: { transparent: true },
            trigger: { kind: "action" },
            priority: "below",
            overlapForbidden: false,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              { kind: "text", body: "지상으로 돌아간다." },
              {
                kind: "transfer",
                mapId: villageId,
                x: returnPos.x,
                y: returnPos.y,
                direction: "down",
                fade: "black",
              },
            ],
          },
        ],
      },
      {
        id: "ev_dungeon_boss",
        x: boss?.x ?? Math.floor(DUNGEON_MAP_WIDTH / 2),
        y: boss?.y ?? Math.floor(DUNGEON_MAP_HEIGHT / 2),
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p_boss_live",
            name: "수호 골렘",
            conditions: [{ kind: "switch", switchId: SW_DUNGEON_CLEAR, value: false }],
            graphic: {
              sprite: { type: "bundled", id: "tex_easyrpg_charset_monster2" },
              direction: "down",
              pattern: 1,
            },
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              { kind: "text", speaker: "수호 골렘", body: "침입자를 허용하지 않는다!" },
              {
                kind: "battleProcessing",
                troopId: "troop_golem_guard",
                canEscape: true,
                canLose: false,
              },
              { kind: "setSwitch", switchId: SW_DUNGEON_CLEAR, value: true },
              { kind: "text", body: "골렘이 쓰러졌다. 촌장에게 돌아가자." },
            ],
          },
          {
            id: "p_boss_gone",
            name: "빈 자리",
            conditions: [{ kind: "switch", switchId: SW_DUNGEON_CLEAR, value: true }],
            graphic: { transparent: true },
            trigger: { kind: "action" },
            priority: "below",
            overlapForbidden: false,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{ kind: "text", body: "이미 쓰러뜨린 자리이다." }],
          },
        ],
      },
    ],
  };
  project.maps[DUNGEON_MAP_ID] = map;
  return { map, start: built.start };
}

// ── main ────────────────────────────────────────────────────────────
const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};

const ctx: ToolContext = { project: createBlankProject() as Project };
ctx.project.meta = {
  ...(ctx.project.meta ?? {}),
  title: "에디터 데모 마을",
  description: "에디터 툴로 시공: 마을·집·실내·던전·퀘스트·NPC·상점",
  id: PROJECT_ID,
};

// 1) 마을 + 집 + 실내 + NPC
const villageResult = runWrite(ctx, "build_village", {
  name: "이슬빛 마을",
  width: 48,
  height: 48,
  seed: 77,
  theme: "장터 마을",
  pathStyle: "sand",
  yardStyle: "market",
  plazaStyle: "market",
  kitMix: "mixed",
  interior: true,
  doorEvent: true,
  fences: true,
  decor: true,
  // 집마다 키트·마당을 갈라 외관 다양성 확보 (2층은 seed 템플릿 후보에서 섞임)
  housePlans: [
    // 촌장 로안: 외관 ㄱ자 + 실내 cottage-l (owner/program 1급 필드 — 이름 정규식 의존 금지)
    { kitId: "blue-stone", templateId: "l", ownerName: "촌장 로안", program: "manor", yard: ["mailbox", "flowers"] },
    { kitId: "amber-wood", yard: ["fruit_box", "bench_h"] },
    { kitId: "slate-wood", yard: ["firewood", "pot"] },
    { kitId: "bright-plaster", yard: ["sign", "jar"] },
    { kitId: "amber-wood", yard: ["wood_box", "flowers"] },
    { kitId: "slate-wood", yard: ["mailbox", "pot"] },
  ],
  npcs: [
    { name: "촌장 로안", lines: ["마을에 온 걸 환영하네.", "남쪽 석재 던전에 골렘이 나타났어. 부탁하마."] },
    { name: "상인 리코", lines: ["어서 와요. 필요한 물건 골라 보세요."] },
    { name: "파수꾼 데릭", lines: ["동쪽에서 이상한 발소리가 들렸어."] },
  ],
});

const villageId = String(
  (villageResult.data as { mapId?: string } | undefined)?.mapId ?? ctx.project.startMapId,
) as MapId;
ctx.project.startMapId = villageId;
if (ctx.project.maps.map_blank_start && villageId !== "map_blank_start") {
  delete ctx.project.maps.map_blank_start;
}
const village = ctx.project.maps[villageId];
if (!village) {
  console.error("village map missing", villageId, Object.keys(ctx.project.maps));
  process.exit(1);
}
console.log(
  "[village]",
  villageId,
  `${village.width}x${village.height}`,
  "events",
  village.events.length,
  "interiors",
  Object.keys(ctx.project.maps).filter((id) => id.includes("interior")).length,
);

// 2) 스토리 플래그
runWrite(ctx, "declare_story_flag", {
  action: "declare",
  id: FLAG_TALK_CHIEF,
  kind: "switch",
  description: "촌장과 대화함",
  questId: QUEST_ID,
}, "declare_story_flag talk");
runWrite(ctx, "declare_story_flag", {
  action: "declare",
  id: FLAG_CLEAR_DUNGEON,
  kind: "switch",
  description: "석재 던전 골렘 격파",
  questId: QUEST_ID,
}, "declare_story_flag clear");

const talkFlag = ctx.project.storyFlags?.find((f) => f.id === FLAG_TALK_CHIEF);
const clearFlag = ctx.project.storyFlags?.find((f) => f.id === FLAG_CLEAR_DUNGEON);
const talkSwitch = talkFlag?.targetId ?? "sw_0001";
if (clearFlag) clearFlag.targetId = SW_DUNGEON_CLEAR;
if (!ctx.project.switches.some((s) => s.id === SW_DUNGEON_CLEAR)) {
  ctx.project.switches.push({ id: SW_DUNGEON_CLEAR, name: "석재 던전 골렘 격파" });
}
console.log("[flags]", { talkSwitch, clear: SW_DUNGEON_CLEAR, storyFlags: ctx.project.storyFlags?.length });

// 3) 상점
const merchant =
  findNpcByName(village, "상인 리코") ||
  village.events.find((e) => e.pages?.some((p) => (p.name ?? "").includes("상인")));
if (merchant) {
  runWrite(ctx, "set_shop_stock", {
    mapId: villageId,
    eventId: merchant.id,
    stock: [
      { itemId: "item_potion", seasons: ["spring", "summer", "fall", "winter"], priceOverride: 20 },
      { itemId: "item_ether", seasons: ["spring", "summer", "fall", "winter"], priceOverride: 45 },
      { itemId: "item_antidote", seasons: ["spring", "summer", "fall", "winter"], priceOverride: 15 },
      { itemId: "item_hi_potion", seasons: ["winter"], priceOverride: 80 },
    ],
  }, "set_shop_stock");
} else {
  runWrite(ctx, "place_npc", {
    mapId: villageId,
    x: Math.min(village.width - 3, Math.max(2, ctx.project.startPos.x + 2)),
    y: Math.min(village.height - 3, Math.max(2, ctx.project.startPos.y)),
    name: "상인 리코",
    id: "ev_demo_merchant",
    pages: [
      {
        lines: ["어서 와요. 필요한 물건 골라 보세요."],
        commands: [
          {
            kind: "shop",
            itemIds: ["item_potion", "item_ether", "item_antidote"],
            allowSell: true,
          },
        ],
      },
    ],
  }, "place_npc merchant");
  runWrite(ctx, "set_shop_stock", {
    mapId: villageId,
    eventId: "ev_demo_merchant",
    stock: [
      { itemId: "item_potion", priceOverride: 20 },
      { itemId: "item_ether", priceOverride: 45 },
      { itemId: "item_antidote", priceOverride: 15 },
    ],
  }, "set_shop_stock fallback");
}

// 4) 촌장 퀘스트 NPC
const chiefX = Math.min(village.width - 4, Math.max(3, ctx.project.startPos.x));
const chiefY = Math.min(village.height - 4, Math.max(3, ctx.project.startPos.y + 2));
runWrite(ctx, "place_npc", {
  mapId: villageId,
  x: chiefX,
  y: chiefY,
  name: "촌장 로안",
  id: "ev_demo_chief",
  pages: [
    {
      name: "의뢰 전",
      conditions: [{ kind: "switch", switchId: talkSwitch, value: false }],
      lines: ["남쪽 석재 던전에 골렘이 나타났네.", "쓰러뜨리고 돌아와 주게."],
      commands: [{ kind: "setSwitch", switchId: talkSwitch, value: true }],
    },
    {
      name: "진행 중",
      conditions: [
        { kind: "switch", switchId: talkSwitch, value: true },
        { kind: "switch", switchId: SW_DUNGEON_CLEAR, value: false },
      ],
      lines: ["던전 입구는 마을 남쪽일세. 조심하게."],
    },
    {
      name: "완료",
      conditions: [{ kind: "switch", switchId: SW_DUNGEON_CLEAR, value: true }],
      lines: ["고맙네! 마을이 한시름 놓았네.", "사례로 회복약을 주겠네."],
      commands: [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 }],
    },
  ],
}, "place_npc chief");

// village ref may be stale after writes — re-read
const villageLive = ctx.project.maps[villageId]!;
const portalX = Math.min(villageLive.width - 3, Math.max(2, Math.floor(villageLive.width / 2)));
const portalY = Math.min(villageLive.height - 2, Math.max(2, villageLive.height - 4));

// 5) 던전 + 포탈
const { start: dungeonStart } = buildDungeonMap(ctx.project, villageId, {
  x: portalX,
  y: Math.max(1, portalY - 1),
});
appendPortal(villageLive, {
  id: "ev_portal_dungeon",
  name: "석재 던전 입구",
  x: portalX,
  y: portalY,
  body: "서늘한 바람이 새어 나온다. 석재 던전에 들어갈까?",
  mapId: DUNGEON_MAP_ID,
  destX: dungeonStart.x,
  destY: dungeonStart.y,
});

// 6) 퀘스트 그래프
runWrite(ctx, "define_quest", {
  id: QUEST_ID,
  title: "석재 골렘 퇴치",
  summary: "촌장 로안의 부탁으로 석재 던전의 골렘을 물리친다.",
  nodes: [
    {
      id: "talk-chief",
      description: "촌장 로안과 대화해 의뢰를 받는다",
      completesWhen: { kind: "storyFlag", flagId: FLAG_TALK_CHIEF, value: true },
    },
    {
      id: "clear-dungeon",
      description: "석재 던전에서 수호 골렘을 격파한다",
      completesWhen: { kind: "switch", switchId: SW_DUNGEON_CLEAR, value: true },
    },
    {
      id: "report-chief",
      description: "촌장에게 보고하고 보상을 받는다",
      completesWhen: { kind: "switch", switchId: SW_DUNGEON_CLEAR, value: true },
    },
  ],
  edges: [
    { from: "talk-chief", to: "clear-dungeon" },
    { from: "clear-dungeon", to: "report-chief" },
  ],
}, "define_quest");

// 맵 트리
const interiorIds = Object.keys(ctx.project.maps).filter((id) => id.includes("interior"));
ctx.project.mapTree = {
  mapId: villageId,
  children: [
    ...interiorIds.map((mapId) => ({ mapId, children: [] as [] })),
    { mapId: DUNGEON_MAP_ID, children: [] },
  ],
};
ctx.project.startMapId = villageId;
ensureSwitchVariableSlots(ctx.project);
ctx.project.meta = {
  ...(ctx.project.meta ?? {}),
  title: "에디터 데모 마을",
  description: "마을·집·실내·던전·퀘스트·NPC·상점 (editor tools)",
  id: PROJECT_ID,
};

const mapSummary = Object.values(ctx.project.maps).map((m) => ({
  id: m.id,
  name: m.name,
  size: `${m.width}x${m.height}`,
  events: m.events?.length ?? 0,
}));
console.log("[maps]", JSON.stringify(mapSummary, null, 2));
console.log("[quests]", ctx.project.quests?.length);
console.log("[start]", ctx.project.startMapId, ctx.project.startPos);

// 7) Supabase 저장 + 재로드
const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", saved.kind, "projectId=", PROJECT_ID);
if (saved.kind !== "saved" && saved.kind !== "created") {
  console.error(saved);
  process.exit(1);
}

const verify = await loadProjectFromSupabase(config);
if (!verify) {
  console.error("[verify] load returned null");
  process.exit(1);
}
const vVillage = verify.maps[villageId];
const vDungeon = verify.maps[DUNGEON_MAP_ID];
const interiors = Object.keys(verify.maps).filter((id) => id.includes("interior"));
const chiefInterior = Object.values(verify.maps).find((m) => (m.name ?? "").includes("촌장"));
if (!chiefInterior) {
  console.error("[verify] chief interior map missing");
  process.exit(1);
}
if (chiefInterior.width !== 20 || chiefInterior.height !== 16) {
  console.error("[verify] chief interior size", chiefInterior.width, chiefInterior.height);
  process.exit(1);
}
// L SE void under bedroom band (x=14..19, y=8..13) must not be wood/stone floor
const FLOOR_OK = new Set([12, 13, 42, 43, 72, 73, 102, 103, 139]);
let seFloor = 0;
for (let y = 8; y <= 13; y += 1) {
  for (let x = 14; x <= 19; x += 1) {
    const tile = chiefInterior.lowerTiles[y * chiefInterior.width + x] ?? -1;
    if (FLOOR_OK.has(tile)) seFloor += 1;
  }
}
if (seFloor > 0) {
  console.error("[verify] chief SE not void; floor cells", seFloor);
  process.exit(1);
}
// kitchen NW should have stone floor samples
const kSamples = [[3,3],[4,4],[6,5]];
for (const [x, y] of kSamples) {
  const tile = chiefInterior.lowerTiles[y * chiefInterior.width + x];
  if (tile !== 12) {
    console.error("[verify] kitchen stone sample fail", { x, y, tile });
    process.exit(1);
  }
}
const shopEvents = Object.values(verify.maps)
  .flatMap((m) => m.events)
  .filter(
    (e) =>
      (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "shop")) ||
      (e.commands ?? []).some((c) => c.kind === "shop"),
  );
const questCount = verify.quests?.length ?? 0;

const report = {
  projectId: PROJECT_ID,
  title: verify.meta?.title,
  maps: Object.keys(verify.maps),
  villageEvents: vVillage?.events?.length ?? 0,
  interiors: interiors.length,
  dungeon: Boolean(vDungeon),
  dungeonEvents: vDungeon?.events?.length ?? 0,
  shopEvents: shopEvents.length,
  quests: questCount,
  startMapId: verify.startMapId,
  startPos: verify.startPos,
};
console.log("[verify]", JSON.stringify(report, null, 2));

if (
  !vVillage ||
  !vDungeon ||
  interiors.length < 1 ||
  shopEvents.length < 1 ||
  questCount < 1 ||
  (vVillage.events?.length ?? 0) < 3
) {
  console.error("[verify failed] incomplete content");
  process.exit(1);
}

const outDir = path.resolve("output/maps");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "editor-demo-village-snapshot.json"), JSON.stringify(report, null, 2));
console.log("[ok] projectId=", PROJECT_ID);
