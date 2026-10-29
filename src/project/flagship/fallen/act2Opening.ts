/**
 * 『폴른 스타』 제2막 「빌린 불」 — 여는 비트(기획 docs/fallen-star/act2-plan.md B1~B6).
 *
 * 모두 조수 도구(exec = runTool)로 짓는다. 이 파일은 도구를 부를 순서·좌표·대사만 가진다 — 새 기능은 도구 쪽에 있다.
 *   - 다리: 제1막 엔딩(end_fs_act1)은 그대로 기록되고, 마지막 화면 버튼이 「제2막으로」가 되어 B1 감방으로 옮긴다
 *     (define_ending continueTo — 막 끝 엔딩이 타이틀 대신 다음 막으로 잇는 일반 기능, 2026-10-26).
 *   - B1 감방의 납작빵: 초소 지하 감방(build_hand_interior_room) → 리노의 빵 → 열쇠 → 쇠살문 → 막사 잠입(author_map_puzzle stealth_guard_patrol)
 *     → 사다리로 광장(통금의 밤 판 fs2_hub_night, duplicate_map).
 *
 * 좌표는 지어진 맵 기준. 감방 평면은 CELL_ROOM 한 곳에서만 고친다.
 */
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_NAMES } from "../fallenStarStory";
import { FS_SILVER_SPOON } from "./townLife";
import { FS_KEEPER_SEAL } from "./battleItems";
import { originEdge } from "@/editor/tools/forestRouteTool";
import { canMove, isPassable } from "@/project/collision";
import { applyVariantTerrain } from "@/editor/tools/mapVariantTerrain";

/** 도구 실행 — 결과 data 를 돌려준다(author_forest_route 처럼 만든 맵 id 가 결과에만 있는 도구). */
type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Rec = Record<string, unknown>;

const KAEL = FS_NAMES.hero;
const ELENA = FS_NAMES.mage;
const RINO = "리노";

// ── id ─────────────────────────────────────────────────────────────────
export const FS2_CELL_ID = "fs2_cell";
export const FS2_BARRACKS_ID = "fs2_barracks";
export const FS2_HUB_NIGHT_ID = "fs2_hub_night";
export const FS2_BREAD_ITEM = "item_fs2_heavy_bread";
export const FS2_CELL_KEY_ITEM = "item_fs2_cell_key";
export const FS2_GEAR_ITEM = "item_fs2_confiscated";
const SW_ACT2 = "sw_fs2_act2_started";
const SW_BREAD = "sw_fs2_bread_given";
const SW_KEY = "sw_fs2_cell_key_found";
const SW_CELL_OPEN = "sw_fs2_cell_open";
const SW_BARRACKS = "sw_fs2_barracks_cleared";
const SW_OUT = "sw_fs2_out_of_cells";
const SW_MEDS = "sw_fs2_gear_meds";

// ── 감방 평면(21×11) ─────────────────────────────────────────────────────
// 서쪽 = 감방(x1..12, y1..5, 남쪽 y6 쇠창살 줄, 가운데 x7 쇠살문) · 그 아래 복도(y7..9) · 동쪽 = 간수실(x14..19)과 막사로 오르는 돌 계단.
// 칸막이 벽(x13)의 앞면이 y7·y8 까지 내려와 복도와 간수실은 맨 아랫줄 y9 로만 이어진다.
const CELL_PLAN = [
  "#####################",
  "#............#......#",
  "#............#......#",
  "#............#......#",
  "#............#......#",
  "#............#......#",
  "#............#......#",
  "#...................#",
  "#...................#",
  "#...................#",
  "#####################",
];
const CELL = {
  gate: { x: 7, y: 6 } as Cell,
  start: { x: 6, y: 4 } as Cell,
  rino: { x: 9, y: 8 } as Cell,
  /** 리노가 들어와 서는 자리(쇠살문 앞 복도). */
  rinoStop: { x: 7, y: 7 } as Cell,
  stairs: [{ x: 15, y: 3 }, { x: 16, y: 3 }, { x: 17, y: 3 }] as Cell[],
  /** 막사에서 내려오면 서는 칸. */
  arrive: { x: 16, y: 4 } as Cell,
};
const CELL_ROOM = {
  plan: CELL_PLAN,
  floor: "dungeon",
  wall: "dungeonw",
  ceiling: "dark",
  objects: [
    { id: "straw bed", x: 2, y: 3 },
    { id: "straw bed", x: 10, y: 3 },
    { id: "slop bucket", x: 12, y: 3 },
    { id: "shackles", x: 5, y: 1 },
    { id: "shackles", x: 8, y: 1 },
    { id: "drip puddle", x: 4, y: 5 },
    { id: "iron gate", x: CELL.gate.x, y: CELL.gate.y },
    { id: "stairs up stone", x: CELL.stairs[0]!.x, y: CELL.stairs[0]!.y },
    { id: "wall torch", x: 14, y: 1 },
    { id: "wall torch", x: 19, y: 1 },
    { id: "stool", x: 18, y: 8 },
    { id: "barrel", x: 19, y: 5 },
  ],
  lines: [{ id: "bars", cells: Array.from({ length: 12 }, (_, i) => ({ x: i + 1, y: 6 })).filter((c) => c.x !== CELL.gate.x) }],
};

/** 막사(stealth_guard_patrol 20×15) — 입구는 남쪽 (10,13) 근처, 금고(16,5). 북동 벽에 광장으로 오르는 사다리. */
const BARRACKS = {
  entry: { x: 10, y: 13 } as Cell,
  ladder: { x: 18, y: 3 } as Cell,
  ladderFoot: { x: 18, y: 5 } as Cell,
  /** 순찰 기사가 오가는 통로(상자 두 줄 사이) 양 끝. */
  patrol: [{ x: 3, y: 10 }, { x: 15, y: 10 }] as Cell[],
};
/** 광장(통금의 밤) — 사다리를 오르면 서는 칸: 광장 동쪽 초소 뒤 골목. */
const HUB_ARRIVE: Cell = { x: 52, y: 25 };
/** 뚜껑 문 골목(47..54, 25)에서 광장으로 나가는 유일한 틈 — (49,24)→(49,23). */
const HUB_ALLEY_GAP: Cell = { x: 49, y: 24 };

// ── 명령 조각(act1Finale.ts 와 같은 꼴) ─────────────────────────────────────
const say = (speaker: string, body: string, extra: Rec = {}): Command => ({ kind: "text", speaker, body, ...extra } as unknown as Command);
const narrate = (body: string, extra: Rec = {}): Command => ({ kind: "text", body, ...extra } as unknown as Command);
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const bgm = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm" } as unknown as Command);
const emote = (target: string, kind: string, durationMs = 800): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as unknown as Command);
const route = (eventId: string, moves: Rec[], waitFor = true): Command =>
  ({ kind: "moveEvent", eventId, route: { moves, repeat: false, wait: waitFor, skippable: true } } as unknown as Command);
const walk = (dirs: Dir[]): Rec[] => dirs.map((dir) => ({ kind: "move", dir }));
const shake = (level = 3, durationMs = 500): Command =>
  m2("m2-048-shake-screen", { intensity: level <= 1 ? "1" : level <= 3 ? "3" : "6", durationMs, direction: "vertical" });
const fadeOut = (ms = 1200): Command => m2("m2-202-screen-effect", { effect: "fadeOut", value: "", durationMs: ms });
const fadeIn = (ms = 900): Command => m2("m2-202-screen-effect", { effect: "fadeIn", value: "", durationMs: ms });
const cutBegin = (): Command => ({ kind: "cutsceneControl", mode: "begin", skippable: true } as unknown as Command);
const cutEnd = (): Command => ({ kind: "cutsceneControl", mode: "end" } as unknown as Command);
const cutLabel = (): Command => ({ kind: "label", name: "cutscene_end" } as unknown as Command);
const transfer = (mapId: string, at: Cell, direction: Dir = "down"): Command =>
  ({ kind: "transfer", mapId, x: at.x, y: at.y, direction, fade: "black" } as unknown as Command);
const item = (itemId: string, amount = 1): Command => ({ kind: "changeItem", itemId, op: amount >= 0 ? "+=" : "-=", amount: Math.abs(amount) } as unknown as Command);

const fixedMove = { type: "fixed", speed: 3, frequency: 3 };
function page(id: string, name: string, conditions: Condition[], commands: Command[], extra: Rec = {}): EventPage {
  const out = {
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: fixedMove, commands, ...extra,
  } as Rec;
  // 칩이 보이는 사람(같은 층)은 몸으로 막는다 — overlapForbidden 이 없으면 주인공이 그 칸을 걸어 지나간다(QA 2026-10-26 하넬).
  const g = out.graphic as { transparent?: boolean; sprite?: unknown } | undefined;
  if (!("overlapForbidden" in extra) && out.priority === "same" && g?.sprite && !g.transparent) out.overlapForbidden = true;
  return out as unknown as EventPage;
}
function addEvent(map: GameMap, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  map.events = map.events.filter((e) => e.id !== id);
  const event = { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent;
  map.events.push(event);
  return event;
}
const chip = (sprite: string, characterIndex: number, direction: Dir): Rec => ({
  sprite: { type: "bundled", id: sprite }, direction, pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
});
/** 리노 — 제1막 초소 기사와 같은 칩(Actor1 #2, 파란 갑옷). */
const RINO_CHIP: [string, number] = ["tex_easyrpg_charset_actor1", 2];

/** 도구를 부를 때마다 맵 객체가 새로 바뀐다 — 이벤트는 그때그때 맵을 다시 찾아 붙인다(쥐고 있던 옛 객체에 붙이면 사라진다). */
function addEv(project: Project, mapId: string, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  return addEvent(M(project, mapId), id, name, at, pages);
}
/** 어느 맵에 있든 그 이벤트의 걷기 칩(새 사람 그림 금지 — 1막 칩 재사용). */
function hubChipAny(project: Project, eventId: string): { textureKey: string; characterIndex: number } {
  const ev = Object.values(project.maps).flatMap((m) => m.events).find((e) => e.id === eventId);
  const g = ev?.pages?.find((pg) => (pg.graphic as { sprite?: unknown } | undefined)?.sprite)?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
  if (!g?.sprite?.id || typeof g.pattern !== "number") throw new Error(`[fallen-star act2] 칩을 못 찾음: ${eventId}`);
  return { textureKey: g.sprite.id, characterIndex: decodeCharsetFrameIndex(g.pattern).characterIndex };
}
function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function M(project: Project, id: string): GameMap {
  const map = project.maps[id];
  if (!map) throw new Error(`[fallen-star act2] 맵이 없다: ${id}`);
  return map;
}
function layerOf(map: GameMap, at: Cell, tile: number): "lower" | "upper" | "lower2" | "upper2" {
  const i = at.y * map.width + at.x;
  const m = map as unknown as Record<string, number[] | undefined>;
  if (m.upperTiles?.[i] === tile) return "upper";
  if (m.lowerTiles?.[i] === tile) return "lower";
  if (m.lowerOverlayTiles?.[i] === tile) return "lower2";
  if (m.upperOverlayTiles?.[i] === tile) return "upper2";
  throw new Error(`[fallen-star act2] ${map.id} ${at.x},${at.y} 에 타일 ${tile} 이 없다`);
}
/** 쇠살문(iron gate, 손 도트 v5 6421 위·6422 아래) 열기 — 제1막 지하 3층 openGate 와 같은 칸 바꾸기. */
function openGate(map: GameMap, at: Cell): Command[] {
  return [
    se("cc0-se-osx-metal-03"),
    { kind: "changeTile", mapId: map.id, layer: layerOf(map, { x: at.x, y: at.y - 1 }, 6421), x: at.x, y: at.y - 1, tile: 6423 } as unknown as Command,
    { kind: "changeTile", mapId: map.id, layer: layerOf(map, at, 6422), x: at.x, y: at.y, tile: -1 } as unknown as Command,
  ];
}

// ════════════════════════════════════════════════════════════════════
// 0. 데이터 — 스위치·물건·일지
// ════════════════════════════════════════════════════════════════════

/**
 * 2막 사람 적 — 난이도 곡선(VQA 2차 2026-10-28): 왕도(B1·B2)는 약한 야경꾼만, 순찰 기사는 요새(B6)부터.
 *   야경꾼 Lv5 HP140 — B1 막사(붙잡히면 전투 없이 감방)·B2 통금 광장(2인조 둘, 지면 쉬운 전투·이기면 사라짐).
 *   순찰 기사 Lv9 HP300 — B6 요새 첫 등장. 들키면 짧게 몰아쳐 와 덮친다(돌진). 피해 가는 쪽이 이득.
 * 1막 레코드는 그대로 두고 복사해 그림·능력치만 바꾼다. 야경꾼 그림은 1막 성문 경비 칩(People3 #7)과 같은 사람.
 */
const FS2_WATCHMAN = "enemy_fs2_watchman";
const FS2_FORT_KNIGHT = "enemy_fs2_fort_knight";
const FS2_BARRACKS_GUARDS = "troop_fs2_barracks_guards";
/** 요새 순찰 기사 무리(1층 순찰)·수문장(1층 중간 보스 자리). */
const FS2_KNIGHT_TROOP = "troop_fs2_fort_knights";
const FS2_GATE_CAPTAIN_TROOP = "troop_fs2_fort_gate";
/** 야경꾼 걷기 칩 — 1막 성문 경비(ev_fs_gate)와 같은 People3 #7. 기사(Actor1 #2) 칩이 아니다. */
const WATCHMAN_CHIP = { textureKey: "tex_easyrpg_charset_people3", characterIndex: 7 };
const potionDrop = (rate: number) => ({ itemId: "item_potion", ratePercent: rate, quantity: 1, condition: { kind: "always" } });
const act = (skillId: string, priority: number) => ({ skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
/** 1막·앞 비트 적 레코드를 복사해 그림·능력치·기술만 바꾼다(upsert_enemy 가 받는 칸만). */
function copyEnemy(project: Project, exec: Exec, fromId: string, patch: Rec): void {
  const base = project.database.enemies.find((e) => e.id === fromId);
  if (!base) throw new Error(`[fallen-star act2] ${fromId} 가 없다`);
  const rec = { ...(JSON.parse(JSON.stringify(base)) as Rec), ...patch };
  for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
  exec(project, "upsert_enemy", { enemy: rec });
}

function nightSoldiers(project: Project, exec: Exec): void {
  copyEnemy(project, exec, "enemy_fs_valen_spearman", {
    id: FS2_WATCHMAN, name: "야경꾼", level: 5, monsterResourceId: "charset-battler-people3-7",
    stats: { maxHp: 140, maxMp: 0, attack: 50, defense: 18, mind: 10, agility: 46 },
    // 몽둥이 휘두르기뿐 — 1막 병사 「검격」을 복사해 쓰지 않는다(VQA: 창병이 검격을 썼다).
    skillIds: ["skill_attack"], actions: [act("skill_attack", 5)],
    rewards: { exp: 30, gold: 8, dropRatePercent: 0, drops: [potionDrop(10)] },
  });
  copyEnemy(project, exec, "enemy_fs_valen_soldier", {
    id: FS2_FORT_KNIGHT, name: "순찰 기사", level: 9, monsterResourceId: "charset-battler-actor1-2",
    stats: { maxHp: 300, maxMp: 20, attack: 80, defense: 46, mind: 20, agility: 54 },
    skillIds: ["skill_attack", "skill_sword_slash"], actions: [act("skill_attack", 6), act("skill_sword_slash", 4)],
    rewards: { exp: 60, gold: 20, dropRatePercent: 0, drops: [potionDrop(15)] },
  });
  exec(project, "upsert_troop", { troop: { id: FS2_BARRACKS_GUARDS, name: "초소 야경꾼", enemyIds: [FS2_WATCHMAN, FS2_WATCHMAN], previewBackgroundResourceId: "battle-scenery-cave" } });
}

function database(project: Project, exec: Exec): void {
  nightSoldiers(project, exec);
  for (const [id, name] of [
    [SW_ACT2, "제2막 시작"], [SW_BREAD, "B1: 리노가 빵을 넣어 줌"], [SW_KEY, "B1: 빵 속 열쇠"], [SW_CELL_OPEN, "B1: 감방 쇠살문 열림"],
    [SW_OUT, "B1: 초소를 빠져나옴"],
  ] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_item", { item: {
    id: FS2_BREAD_ITEM, name: "무거운 납작빵", type: "normalGoods", occasion: "never", consumable: false, price: 0,
    description: "토마 아저씨네 납작빵. 이것만 유난히 무겁다.\n손으로는 안 쪼개진다. 침대 모서리에라도 내리쳐 볼까?",
  } });
  exec(project, "upsert_item", { item: {
    id: FS2_UNLIT_LAMP, name: "꺼진 등", type: "special", occasion: "never", consumable: false, price: 0,
    description: "미레 아주머니가 맡긴 등. 불은 꺼져 있다.\n잠긴 집 문고리에 걸어 두면 된다.",
  } });
  exec(project, "upsert_item", { item: {
    id: FS2_CELL_KEY_ITEM, name: "빵 속 감방 열쇠", type: "special", occasion: "never", consumable: false, price: 0,
    description: "납작빵에 넣고 같이 구운 쇠 열쇠. 아직 따뜻하다.",
  } });
}

// ════════════════════════════════════════════════════════════════════
// 1. 다리 — 제1막 끝 → 제2막
// ════════════════════════════════════════════════════════════════════

function bridge(project: Project, exec: Exec): void {
  const end = (project.endings ?? []).find((e) => e.id === "end_fs_act1");
  if (!end) throw new Error("[fallen-star act2] 제1막 엔딩이 없다");
  // 엔딩 기록·크레딧은 그대로, 마지막 버튼만 「제2막으로」 — 조수 도구 define_ending continueTo.
  exec(project, "define_ending", {
    id: end.id, name: end.name, conditions: end.conditions, priority: end.priority,
    continueTo: { mapId: FS2_CELL_ID, x: CELL.start.x, y: CELL.start.y, direction: "down", label: "제2막으로" },
  });
  const now = (project.endings ?? []).find((e) => e.id === "end_fs_act1")!;
  if (now.presentation?.credits) now.presentation.credits = now.presentation.credits.replace("제2막에서 계속됩니다.", "제2막 「빌린 불」로 이어집니다.");
}

// ════════════════════════════════════════════════════════════════════
// 2. B1 감방 — 리노의 납작빵
// ════════════════════════════════════════════════════════════════════

function cellMap(project: Project, exec: Exec): GameMap {
  exec(project, "build_hand_interior_room", {
    mapId: FS2_CELL_ID, name: "심문회 초소 · 지하 감방", tileset: "atlas_biome_interior", ...CELL_ROOM,
  });
  const map = M(project, FS2_CELL_ID);
  (map as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  // 횃불 둘만 밝다 — 감방 쪽은 거의 어둡다.
  exec(project, "set_lighting_volume", {
    mapId: FS2_CELL_ID, ambient: 0.5, color: "#0b0f1a", applyMode: "map",
    sources: [
      { id: "t1", at: { x: 14, y: 2 }, radius: 4, intensity: 0.9, color: "#ffb860", flicker: true },
      { id: "t2", at: { x: 19, y: 2 }, radius: 4, intensity: 0.9, color: "#ffb860", flicker: true },
      { id: "grate", at: { x: 7, y: 2 }, radius: 3, intensity: 0.35, color: "#8fa6d8" },
    ],
  });
  return map;
}

function cellEvents(map: GameMap): void {
  const rinoId = "ev_fs2_cell_rino";
  const director = "ev_fs2_cell_director";
  // 리노 — 처음엔 복도 동쪽 끝(간수실 앞)에 서 있다가, 여는 장면에서 쇠살문 앞으로 와 빵을 넣는다. 빵을 준 뒤엔 사라진다.
  const rinoGraphic = (dir: Dir): Rec => chip(RINO_CHIP[0], RINO_CHIP[1], dir);
  addEvent(map, rinoId, "기사 리노", CELL.rino, [
    page(`${rinoId}_wait`, "간수(빵 전)", [], [say(RINO, "얌전히 있어라. …오늘 밤은 특히.")], { graphic: rinoGraphic("left"), priority: "same" }),
    page(`${rinoId}_gone`, "떠남", [sw(SW_BREAD)], [], { priority: "below" }),
  ]);
  // 여는 장면 — 제2막으로 들어오면 한 번. 1막 에필로그 두 줄 뒤 막 제목 → 감방.
  const toGate: Dir[] = ["left", "left", "up"];
  addEvent(map, director, "제2막 여는 장면", { x: 0, y: 0 }, [
    page(`${director}_run`, "감방의 밤", [sw(SW_ACT2, false)], [
      cutBegin(),
      setSw(SW_ACT2),
      fadeOut(1),
      wait(600),
      narrate("제2막 「빌린 불」", { position: "center", context: "narration" }),
      wait(300),
      narrate("이튿날 밤, 심문회 초소 지하.", { position: "center", context: "narration" }),
      fadeIn(1200),
      se("cc0-se-osx-splash-01"),
      wait(500),
      emote("player", "ellipsis", 900),
      say(ELENA, "…이리스가 없어.\n발렌이 따로 데려갔어."),
      say(KAEL, "선생님은 천문대에 갇히셨대.\n간수들이 떠드는 걸 들었어."),
      se("cc0-se-osx-door-open"),
      route(rinoId, [{ kind: "setThrough", enabled: true }, ...walk(toGate), { kind: "setThrough", enabled: false }, { kind: "turn", dir: "up" }]),
      say(RINO, "저녁이다. …토마 아저씨가 구운 거다."),
      say(RINO, "딱딱하니까 꼭꼭 씹어라. 꼭."),
      se("cc0-se-orp-inventory-cloth"),
      item("fs_bread_flat", 1),
      item(FS2_BREAD_ITEM, 1),
      narrate("「납작빵」과 「무거운 납작빵」을 받았다.", { context: "system" }),
      say(RINO, "나는 오늘 밤 아무것도 못 봤다.\n…이름은 리노다. 이번엔 잊지 마라."),
      route(rinoId, [{ kind: "setThrough", enabled: true }, { kind: "turn", dir: "right" }, ...walk(["down", "down", "right", "right", "right", "right", "right", "right", "right", "up", "up", "up"]), { kind: "setThrough", enabled: false }]),
      setSw(SW_BREAD),
      say(ELENA, "카엘, 이 빵… 무게가 이상해."),
      say(KAEL, "반죽이 또 안 부풀었나 봐."),
      cutLabel(),
      cutEnd(),
    ], { trigger: { kind: "auto" } }),
  ]);
  // 빵 — 짚 침대 위에서 쪼개 본다(아무 데서나: 감방 쪽 침대 둘 앞). 열쇠가 나온다.
  // 침대 아래 칸(침대 그림의 아랫줄) — 앞(y5)에서 위를 보고 조사한다.
  for (const [i, at] of [{ x: 2, y: 4 }, { x: 10, y: 4 }].entries()) {
    const id = `ev_fs2_cell_bed_${i}`;
    addEvent(map, id, "짚 침대", at, [
      page(`${id}_p`, "짚 침대", [], [narrate("짚이 눅눅하다. 오래 누울 곳은 아니다.")], { priority: "same" }),
      page(`${id}_bread`, "빵을 쪼갠다", [sw(SW_BREAD), sw(SW_KEY, false)], [
        narrate("침대 모서리에 납작빵을 내리친다."),
        se("cc0-se-osx-wooded-box-open"),
        shake(1, 200),
        narrate("빠각! 빵 속에서 쇠붙이가 튀어나온다."),
        item(FS2_BREAD_ITEM, -1),
        item(FS2_CELL_KEY_ITEM, 1),
        setSw(SW_KEY),
        narrate("「빵 속 감방 열쇠」를 얻었다.", { context: "system" }),
        say(ELENA, "토마 아저씨…!\n「꼭꼭 씹어라」가 이 소리였구나."),
        say(KAEL, "선생님 말씀이 맞았어.\n작은 일들이 먼저 대답을 해."),
      ], { priority: "same" }),
      page(`${id}_after`, "짚 침대", [sw(SW_KEY)], [narrate("빵 부스러기만 남았다.")], { priority: "same" }),
    ]);
  }
  // 쇠살문 — 열쇠가 있으면 연다. 문 칸 자체가 이벤트(쇠창살 줄 가운데).
  const gateId = "ev_fs2_cell_gate";
  addEvent(map, gateId, "감방 쇠살문", CELL.gate, [
    page(`${gateId}_locked`, "잠김", [], [
      narrate("굵은 쇠살문이 잠겨 있다."),
      say(KAEL, "열쇠 구멍은 있는데…"),
    ]),
    // 빵을 받고도 문만 두드리면 엘레나가 길을 짚는다(독립 플레이 판정: 180걸음 동안 문 앞에서 맴돌았다).
    page(`${gateId}_hint`, "잠김(빵 힌트)", [sw(SW_BREAD), sw(SW_KEY, false)], [
      narrate("굵은 쇠살문이 잠겨 있다."),
      say(KAEL, "열쇠 구멍은 있는데…"),
      say(ELENA, "…리노가 「꼭꼭 씹어라」 그랬지.\n그 무거운 빵, 침대 모서리에 내리쳐 볼까?"),
    ]),
    page(`${gateId}_key`, "열쇠로 연다", [sw(SW_KEY), sw(SW_CELL_OPEN, false)], [
      narrate("빵에서 나온 열쇠를 꽂아 돌린다. 딸깍."),
      ...openGate(map, CELL.gate),
      setSw(SW_CELL_OPEN),
      item(FS2_CELL_KEY_ITEM, -1),
      say(ELENA, "열렸어. 발소리 죽이고 가자.\n위층은 초소 막사야. 야경꾼이 돌 거야."),
    ]),
    page(`${gateId}_open`, "열림", [sw(SW_CELL_OPEN)], [], { priority: "below" }),
  ]);
  // 돌 계단 — 막사(잠입 퍼즐)로 오른다.
  CELL.stairs.forEach((c, i) => {
    const id = `ev_fs2_cell_stairs_${i}`;
    addEvent(map, id, "막사로 오르는 계단", c, [
      page(`${id}_p`, "계단", [], [transfer(FS2_BARRACKS_ID, BARRACKS.entry, "up")], { priority: "same", trigger: { kind: "playerTouch" } }),
    ]);
  });
}

// ════════════════════════════════════════════════════════════════════
// 3. B1 막사 — 등불 시야를 피해(잠입 퍼즐) 압수품을 되찾고 사다리로 광장
// ════════════════════════════════════════════════════════════════════

function barracks(project: Project, exec: Exec): void {
  exec(project, "create_map", { id: FS2_BARRACKS_ID, name: "심문회 초소 · 막사", width: 20, height: 15, tilesetId: "atlas_biome_interior" });
  exec(project, "author_map_puzzle", {
    mapId: FS2_BARRACKS_ID, presetId: "stealth_guard_patrol", puzzleId: "fs2_barracks", title: "초소 막사",
    solveSwitchId: SW_BARRACKS,
    hintText: "(근무표) 「깃발 종이 울리면 같은 색 초소가 살필 것.\n붉은 종은 붉은 초소, 푸른 종은 푸른 초소.\n등불 비추는 곳으로는 아무도 지나가지 말 것.」",
    reward: { itemId: FS2_GEAR_ITEM, itemName: "압수품 꾸러미", itemDescription: "초소에서 빼앗긴 짐. 카엘의 검도, 엘레나의 책도 그대로다." },
    // 들키면 경비 둘과 싸우고(도망 불가) 감방으로 다시 끌려간다 — 실수에 값을 치른다.
    // 들키면 감방으로 끌려간다. 경비와의 전투는 뺐다 — 쉬운 전투가 매번 금화를 줘서, 붙잡히는 게 벌이 아니라 벌이였다(독립 판정: 29번 붙잡혀 696G).
    failPenalty: { sendTo: { mapId: FS2_CELL_ID, x: CELL.arrive.x, y: CELL.arrive.y }, text: "경비병: 「거기 누구냐! 탈옥이다!」\n등불에 들켜 지하 감방으로 도로 끌려갔다." },
  });
  // 야경꾼 — 두 상자 줄 사이 통로를 천천히 오간다(난이도 곡선: 왕도에는 기사 대신 약한 야경꾼). 등 뒤로, 그가 끝에서 돌아설 때 건넌다.
  // 보면 짧게 달려와 덮친다(돌진 4칸). 붙잡히면 전투 없이 감방으로 끌려간다.
  const watch = exec(project, "make_chase_scene", {
    mapId: FS2_BARRACKS_ID,
    chaser: { at: BARRACKS.patrol[0], graphic: { selectionId: `charset:${WATCHMAN_CHIP.textureKey}:${WATCHMAN_CHIP.characterIndex}` }, speed: 5, sightRange: 3 },
    patrol: { waypoints: BARRACKS.patrol },
    pursuit: { scope: "map", doorDelayMs: 0, searchMs: 1500, onLost: "return" },
    caughtPenalty: { sendTo: { mapId: FS2_CELL_ID, x: CELL.arrive.x, y: CELL.arrive.y }, text: "야경꾼: 「거기 서! 탈옥이다!」\n야경꾼에게 붙잡혀 지하 감방으로 끌려갔다." },
    checkpointOnEntry: false,
    mood: false,
  }) as { eventId?: string } | undefined;
  if (watch?.eventId) {
    exec(project, "set_field_detection", { mapIds: [FS2_BARRACKS_ID], eventIds: [watch.eventId], alertMs: 200, rush: true, rushSteps: 4, rushStepMs: 100, searchMs: 1500 });
    const ev = M(project, FS2_BARRACKS_ID).events.find((e) => e.id === watch.eventId);
    if (ev) (ev as unknown as Rec).name = "야경꾼";
  }
  // 처음 들어서면 엘레나가 방의 규칙을 짚는다 — 근무표·등불 빛·순찰(독립 판정: 입구 두 칸 옆 근무표를 끝내 안 읽고 29번 붙잡혔다).
  const hintId = "ev_fs2_barracks_enter";
  addEv(project, FS2_BARRACKS_ID, hintId, "막사에 들어섬", { x: 0, y: 0 }, [
    page(`${hintId}_p`, "막사 규칙", [sw("sw_fs2_barracks_entered", false)], [
      setSw("sw_fs2_barracks_entered"),
      say(ELENA, "(속삭임) 카엘, 입구 옆에 근무표가 붙어 있어.\n그것부터 읽어 보자."),
      say(ELENA, "(속삭임) 등불 빛 닿는 데는 밟지 마.\n순찰이 등 돌렸을 때 상자 사이로 건너가."),
      // 독립 판정(2회차): 근무표의 「깃발 종」이 벽 깃발 장식으로만 읽혀 끝내 못 찾았다 — 동사(줄을 당긴다)를 짚는다.
      say(ELENA, "(속삭임) 벽 깃발 밑 종 줄을 당기면\n같은 색 초소 경비가 소리 쪽을 돌아봐."),
    ], { trigger: { kind: "auto" } }),
  ]);
  ensureSwitch(project, "sw_fs2_barracks_entered", "B1: 막사에 처음 들어섬(규칙 귀띔)");
  ensureSwitch(project, SW_MEDS, "B1: 되찾은 짐에서 약을 챙김");
  // 북동 벽 사다리 — 광장 초소 뒷골목으로. 압수품을 되찾기 전엔 「짐부터」.
  exec(project, "stamp_object", { objectId: "kit:atlas_biome_interior/hand-interior:ship ladder", mapId: FS2_BARRACKS_ID, x: BARRACKS.ladder.x, y: BARRACKS.ladder.y });
  exec(project, "set_map_properties", { mapId: FS2_BARRACKS_ID, battleBackground: "battle-scenery-cave" });
  (M(project, FS2_BARRACKS_ID) as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  const ladderId = "ev_fs2_barracks_ladder";
  addEv(project, FS2_BARRACKS_ID, ladderId, "광장으로 오르는 사다리", { x: BARRACKS.ladder.x, y: BARRACKS.ladder.y + 2 }, [
    page(`${ladderId}_wait`, "짐부터", [], [
      narrate("위로 난 사다리다. 바깥바람이 내려온다."),
      say(ELENA, "잠깐, 우리 짐. 저 금고에 있을 거야.\n빈손으로는 못 나가."),
    ]),
    page(`${ladderId}_go`, "오른다", [sw(SW_BARRACKS)], [
      // 독립 판정: 2막 내내 회복약이 하나도 없어 쓰러진 동료를 못 일으켰다 — 되찾은 짐 속 약을 챙긴다(한 번).
      say(ELENA, "꾸러미에 약 주머니도 그대로 있어.\n…다행이다. 챙겨 가자."),
      se("cc0-se-orp-inventory-cloth"), item("item_potion", 5), item("item_ether", 2), item("item_panacea", 1),
      narrate("「회복약」 5개, 「마력약」 2개,\n「만병통치약」 1개를 챙겼다.", { context: "system" }),
      setSw(SW_MEDS),
      se("cc0-se-osx-wooded-box-open"),
      narrate("사다리를 올라 뚜껑 문을 민다."),
      setSw(SW_OUT),
      transfer(FS2_HUB_NIGHT_ID, HUB_ARRIVE, "down"),
    ]),
    page(`${ladderId}_go2`, "오른다(다시)", [sw(SW_BARRACKS), sw(SW_MEDS)], [
      se("cc0-se-osx-wooded-box-open"),
      narrate("사다리를 올라 뚜껑 문을 민다."),
      setSw(SW_OUT),
      transfer(FS2_HUB_NIGHT_ID, HUB_ARRIVE, "down"),
    ]),
  ]);
  // 잠입 퍼즐 도구의 기본 문구를 2막 말투로(2026-10-29 대사 2차: 「과(와)」·「획득」·「퍼즐 해독 보상!」이 화면에 그대로 떴다).
  const PUZZLE_LINES: Record<string, string> = {
    "땡그랑— 붉은 깃발 아래 경비병이 종소리 쪽으로 돌아섰다.": "땡그랑. 붉은 깃발 밑 경비병이\n종소리 쪽으로 돌아선다.",
    "땡그랑— 푸른 깃발 아래 경비병이 종소리 쪽으로 돌아섰다.": "땡그랑. 푸른 깃발 밑 경비병이\n종소리 쪽으로 돌아선다.",
    "경비병들이 서로를 바라보는 사이 금고 상자를 열었다!": "경비병들이 서로 마주 보는 사이\n금고 상자를 연다.",
    "퍼즐 해독 보상! 「압수품 꾸러미」과(와) 200G를 획득했다!": "「압수품 꾸러미」와 200G를 되찾았다.",
    "경비병: 「방금 종이 울렸지…?」": "경비병: 「방금 종 울렸지?」",
  };
  const rewrite = (cmds: unknown[] | undefined): void => {
    for (const c of cmds ?? []) {
      if (!c || typeof c !== "object") continue;
      const r = c as Rec;
      if (r.kind === "text" && typeof r.body === "string" && PUZZLE_LINES[r.body]) r.body = PUZZLE_LINES[r.body];
      for (const v of Object.values(r)) if (Array.isArray(v)) rewrite(v);
    }
  };
  for (const e of M(project, FS2_BARRACKS_ID).events) for (const pg of e.pages ?? []) rewrite(pg.commands as unknown[]);
  // 막사 아래 계단(남쪽 입구) — 감방으로 돌아가는 길(도착 칸 바로 아래 줄).
  const back = "ev_fs2_barracks_down";
  addEv(project, FS2_BARRACKS_ID, back, "감방으로 내려가는 계단", { x: BARRACKS.entry.x, y: BARRACKS.entry.y + 1 }, [
    page(`${back}_p`, "계단", [], [transfer(FS2_CELL_ID, CELL.arrive, "down")], { priority: "below", trigger: { kind: "playerTouch" } }),
  ]);
}

// ════════════════════════════════════════════════════════════════════
// 4. 통금의 밤 — 광장 판(B2 의 무대). B1 에서는 도착 칸·밤 분위기까지만.
// ════════════════════════════════════════════════════════════════════

function hubNight(project: Project, exec: Exec, hubId: string): void {
  // 같은 광장의 「통금의 밤」 판 — 사람·연출(1막 포위·군중·발렌)은 비우고 문만 남겨 잠근다(duplicate_map events:doors).
  // B2 가 순찰 기사·창틈 주민을, B3·B4 가 천문대 우물·대장간 문을 새로 연다.
  exec(project, "duplicate_map", {
    mapId: hubId, id: FS2_HUB_NIGHT_ID, name: "왕도 아스텔 · 통금의 밤",
    events: "doors", lockedDoorText: "통금이다. 문이 안에서 굳게 잠겨 있다.",
  });
  exec(project, "set_scene_mood", {
    mapId: FS2_HUB_NIGHT_ID, applyMode: "map",
    lighting: { ambient: 0.7, color: "#0a1024", sources: [{ id: "lamp", at: { kind: "player" }, radius: 3, intensity: 0.45, color: "#9fb4ff" }] },
  });
  (M(project, FS2_HUB_NIGHT_ID) as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  const arriveId = "ev_fs2_hub_arrive";
  addEv(project, FS2_HUB_NIGHT_ID, arriveId, "뚜껑 문으로 나옴", { x: 0, y: 0 }, [
    page(`${arriveId}_p`, "광장의 밤", [sw(SW_OUT), sw("sw_fs2_hub_arrived", false)], [
      setSw("sw_fs2_hub_arrived"),
      bgm("cc0-bgm-rtp-mys-002"),
      narrate("광장은 캄캄하다. 집집마다 등불이 꺼졌다.\n야경꾼들 손등불만 흔들린다."),
      say(KAEL, "통금이야. 야경꾼들이 돌고 있어."),
      say(ELENA, "눈에 띄면 바로 덤벼들 거야.\n그늘로만 가자."),
      // 독립 판정: 뚜껑 문 골목이 캄캄하고 출구가 한 칸이라 40분을 헤맸다 — 나갈 틈과 첫 목적지를 짚는다.
      say(ELENA, "저기, 골목 왼쪽 위에 불빛 새는 틈 보여?\n그리로 빠져서 광장 서쪽 빵집,\n미레 아주머니한테 가자."),
    ], { trigger: { kind: "auto" } }),
  ]);
  ensureSwitch(project, "sw_fs2_hub_arrived", "B1: 통금의 밤 광장에 나옴");
}


// ════════════════════════════════════════════════════════════════════
// 5. B2 불 꺼진 왕도 — 순찰 기사(보이는 적, 들키면 전투)·창틈 주민(미레·토비·마르타)
// ════════════════════════════════════════════════════════════════════

export const FS2_PATROL_TROOP = "troop_fs2_curfew_patrol";
const SW_SPOON = "sw_fs2_toby_spoon";
const SW_CARRIAGE = "sw_fs2_heard_carriage";
const SW_MIRE = "sw_fs2_mire_well";
/**
 * 야경꾼 2인조 둘 — 광장 동쪽(뚜껑 문 골목 앞)과 가운데 우물 길목. 앞쪽 부채꼴 시야라 등 뒤·건물 그늘로 돌면 지나간다.
 * 서쪽 빵집(미레) 길과 남쪽 여관(마르타) 길은 비워 둔다 — 순찰을 피하는 길이 늘 하나는 있게(VQA 2차: 넷이 모든 길목을 막았다).
 */
const PATROLS: { at: Cell; axis: "horizontal" | "vertical"; length: number }[] = [
  { at: { x: 44, y: 21 }, axis: "horizontal", length: 4 },
  { at: { x: 27, y: 25 }, axis: "vertical", length: 3 },
];
/** 창틈 주민 — 문간에 서서 길을 알려 준다(place_npc 가 통행 칸으로 옮긴 자리 그대로). */
const MIRE_AT: Cell = { x: 12, y: 12 };
const TOBY_AT: Cell = { x: 34, y: 25 };
const MARTA_AT: Cell = { x: 49, y: 32 };
const MARTA = "여관 주인 마르타";
const MIRE = "빵집 아주머니 미레";
const TOBY = "꼬마 토비";

const FS2_UNLIT_LAMP = "item_fs2_unlit_lamp";
const SW_Q4_TAKEN = "sw_fs2_q4_lamps_taken";
const SW_Q4_DONE = "sw_fs2_q4_lamps_done";
/** 문고리마다 하나 — 뒤에 0·1·2. */
const SW_Q4_LAMP = "sw_fs2_q4_lamp_";

/**
 * Q4 — 기사들이 등을 떼 간 집 셋(늙은 별지기의 집·약방·리사네 집)에 「등 걸기」 페이지를 단다.
 * 잠긴 집 문 가운데 주민이 문간에 선 집(빵집·여관)·천문대·대장간을 빼면 꼭 셋이다 — 미레가 집 이름으로 짚고(문 찾기 헤맴 방지, 2026-10-29 결함 목록),
 * 그 셋은 창이 캄캄하다(다른 집 창엔 불빛이 샌다). 등을 걸면 그 집 창에 불이 든다(병렬 페이지가 맵에 들 때마다 광원을 붙인다).
 */
function lampQuestDoors(project: Project, hubId: string): GameEvent[] {
  for (const [id, name] of [[SW_Q4_TAKEN, "B2 Q4: 꺼진 등을 맡았다"], [SW_Q4_DONE, "B2 Q4: 꺼진 등 — 보상"],
    [`${SW_Q4_LAMP}0`, "B2 Q4: 등 1"], [`${SW_Q4_LAMP}1`, "B2 Q4: 등 2"], [`${SW_Q4_LAMP}2`, "B2 Q4: 등 3"]] as const) ensureSwitch(project, id, name);
  const hub = M(project, FS2_HUB_NIGHT_ID);
  const day = M(project, hubId);
  const target = (e: GameEvent): GameMap | undefined => {
    const orig = day.events.find((o) => o.x === e.x && o.y === e.y && JSON.stringify(o.pages ?? []).includes('"kind":"transfer"'));
    const to = JSON.stringify(orig?.pages ?? []).match(/"kind":"transfer","mapId":"([^"]+)"/)?.[1];
    return to ? project.maps[to] : undefined;
  };
  const near = (e: GameEvent, c: Cell) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 2;
  const picked = hub.events.filter((e) => {
    const text = JSON.stringify(e.pages ?? []);
    const to = target(e);
    return text.includes("통금이다. 문이 안에서 굳게 잠겨 있다.") && !text.includes('"kind":"transfer"') && !(e.x === SMITHY.hubDoor.x && e.y === SMITHY.hubDoor.y)
      && to?.tilesetId === "atlas_biome_interior" && !to.name.includes("천문대") && !near(e, MIRE_AT) && !near(e, MARTA_AT);
  }).sort((a, b) => a.x - b.x || a.y - b.y);
  if (picked.length !== 3) throw new Error(`[fallen-star act2] Q4 등 걸 집이 셋이 아니다: ${picked.map((e) => `${e.x},${e.y}`).join(" ")}`);
  picked.forEach((door, i) => {
    const base = door.pages![0]!;
    const lamp = `${SW_Q4_LAMP}${i}`;
    door.pages = [
      ...door.pages!,
      { ...base, id: `${door.id}_q4_hang`, name: "등 걸기", conditions: [sw(SW_Q4_TAKEN)], commands: [
        narrate("문고리에 꺼진 등을 건다."),
        item(FS2_UNLIT_LAMP, -1),
        setSw(lamp),
        se("cc0-se-ors-item-wood-01"),
        narrate("안에서 누가 가만히 두드린다. 똑, 똑, 똑.\n잠시 뒤, 창 안쪽에 작은 불이 켜진다."),
      ] } as EventPage,
      { ...base, id: `${door.id}_q4_hung`, name: "등이 걸린 문", conditions: [sw(lamp)], commands: [narrate("문고리에 꺼진 등이 걸려 있다.\n창 안쪽에 촛불 하나가 켜져 있다.")] } as EventPage,
    ];
    // 등을 건 집 창에 불 — 맵에 들 때마다 광원을 다시 붙인다(맵 조명은 들 때마다 기본값으로 돌아간다).
    addEv(project, FS2_HUB_NIGHT_ID, `ev_fs2_q4_glow_${i}`, "등 건 집 창불", { x: 1 + i, y: 0 }, [
      page(`ev_fs2_q4_glow_${i}_off`, "꺼짐", [], [], { priority: "below" }),
      page(`ev_fs2_q4_glow_${i}_on`, "켜짐", [sw(lamp)], [
        // 그 집 창(없으면 문 위 틈)에만 작은 불 — 큰 원 하나는 벽 전체가 불난 것처럼 보였다(VQA 1·2차).
        ...(Q4_WINDOWS[`${door.x},${door.y}`] ?? [{ x: door.x, y: door.y - 1 }]).map((c, k) =>
          ({ kind: "addLight", source: { id: `q4_glow_${i}_${k}`, at: c, radius: 1, intensity: 0.85, color: "#ffb050", flicker: true } } as unknown as Command)),
        wait(600000),
      ], { priority: "below", trigger: { kind: "parallel" } }),
    ]);
  });
  return picked;
}

/** 창마다 새는 불빛(계획 그림 royal_rain) — 통금에도 사람 사는 집 창은 희미하게 샌다. 등을 뺏긴 Q4 세 집은 캄캄하다. */
const HUB_WINDOWS: Cell[] = [
  // 창 그림이 있는 칸만(2026-10-29 VQA 2차: 지붕·벽 한가운데 놓인 불빛이 「불난 집」처럼 보였다 — 칸마다 그림을 보고 다시 골랐다).
  { x: 3, y: 8 }, { x: 13, y: 9 }, { x: 23, y: 11 }, { x: 24, y: 11 }, { x: 24, y: 14 },
  { x: 3, y: 29 }, { x: 50, y: 29 }, { x: 36, y: 39 }, { x: 39, y: 40 }, { x: 45, y: 39 },
];
/** Q4 세 집의 창(없으면 문 위 틈). 문 칸 → 불이 들 칸. */
const Q4_WINDOWS: Record<string, Cell[]> = {
  "31,31": [{ x: 30, y: 28 }, { x: 32, y: 28 }],   // 약방 — 창 둘
  "4,20": [{ x: 4, y: 19 }],                       // 별지기 할아버지 댁 — 창이 없는 벽, 문 위 틈
  "32,20": [{ x: 32, y: 19 }],                     // 리사네 집 — 벽돌 벽, 문 위 틈
};

/** 제1막 광장 이벤트의 걷기 칩을 그대로 쓴다(새 사람 그림 금지). */
function hubChip(project: Project, hubId: string, eventId: string): { textureKey: string; characterIndex: number } {
  const ev = M(project, hubId).events.find((e) => e.id === eventId);
  const g = ev?.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
  if (!g?.sprite?.id || typeof g.pattern !== "number") throw new Error(`[fallen-star act2] 칩을 못 찾음: ${eventId}`);
  return { textureKey: g.sprite.id, characterIndex: decodeCharsetFrameIndex(g.pattern).characterIndex };
}

function curfewHub(project: Project, exec: Exec, hubId: string): void {
  for (const [id, name] of [[SW_SPOON, "B2: 토비의 은수저"], [SW_CARRIAGE, "B2: 마르타 — 쇠 마차 북문으로"], [SW_MIRE, "B2: 미레 — 우물 길"]] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_troop", { troop: {
    id: FS2_PATROL_TROOP, name: "야경꾼 2인조", enemyIds: [FS2_WATCHMAN, FS2_WATCHMAN],
    // 밤 광장 싸움 — 들판 그림(맵 battleBackground)에 밤 겹(남색·별)을 덮는다. 낮 올리브 들판으로 뜨던 문제(VQA 2차).
    backdropLayers: NIGHT_LAYERS,
  } });
  // 점령된 밤의 광장은 「필드」다 — 마을 판정이면 보이는 적을 거절한다(set_map_properties mapRole).
  exec(project, "set_map_properties", { mapId: FS2_HUB_NIGHT_ID, mapRole: "field", battleBackground: "battle-scenery-plains" });
  PATROLS.forEach((p, i) => {
    exec(project, "place_field_enemy", {
      mapId: FS2_HUB_NIGHT_ID, x: p.at.x, y: p.at.y, troopId: FS2_PATROL_TROOP, behavior: "chase",
      patrol: { length: p.length, axis: p.axis }, sightRange: 6, vision: "cone", pace: "normal", approachStyle: "dash",
      // 야경꾼 칩(1막 성문 경비) — 기사 칩이 아니다. 이기면 그 2인조는 사라진다(부활 없음).
      graphic: WATCHMAN_CHIP, alert: "exclamation", respawnSec: 0, clearSwitchId: `sw_fs2_patrol_${i}_down`,
      // 지면 광장 입구(사다리 뚜껑 문)에서 다시 — 타이틀로 내쫓지 않는다(독립 판정: 통금 순찰에 지고 1막부터 다시).
      checkpointOnEntry: true,
    });
  });
  // 남색 밤(계획 그림 royal_fall·royal_rain) — 검은 막이 아니라 푸른 막. 길은 어둡고, 창마다 불빛이 조금씩 샌다.
  // 주민이 선 문간마다 작은 등잔. 등을 뺏긴 Q4 세 집 창만 캄캄하다(등을 걸면 켜진다 — lampQuestDoors).
  // 야경꾼 손등불 — 순찰 2인조를 따라다니는 불빛. 「손등불만 흔들린다」는데 등불이 없었다(VQA 1차).
  const patrolIds = M(project, FS2_HUB_NIGHT_ID).events.filter((e) => JSON.stringify(e.pages ?? []).includes(`"troopId":"${FS2_PATROL_TROOP}"`)).map((e) => e.id);
  if (patrolIds.length < PATROLS.length) throw new Error(`[fallen-star act2] 야경꾼 이벤트를 못 찾았다(${patrolIds.length})`);
  exec(project, "set_lighting_volume", {
    mapId: FS2_HUB_NIGHT_ID, applyMode: "map", ambient: 0.78, color: "#0f1a4c",
    sources: [
      { id: "lamp", at: { kind: "player" }, radius: 3, intensity: 0.45, color: "#9fb4ff" },
      ...[MIRE_AT, TOBY_AT, MARTA_AT].map((c, i) => ({ id: `crack${i}`, at: { x: c.x, y: c.y - 1 }, radius: 1.5, intensity: 0.7, color: "#ffc070", flicker: true })),
      ...HUB_WINDOWS.map((c, i) => ({ id: `window${i}`, at: c, radius: 1, intensity: 0.75, color: "#ffb050" })),
      ...patrolIds.map((eventId, i) => ({ id: `patrol_lamp${i}`, at: { eventId }, radius: 2.2, intensity: 0.75, color: "#ffc070", flicker: true })),
      // 뚜껑 문 골목의 출구 틈(한 칸) — 불빛이 새어 나와 보이게(엘레나가 도착 때 이 불빛을 짚는다).
      { id: "alley_gap", at: { x: HUB_ALLEY_GAP.x, y: HUB_ALLEY_GAP.y }, radius: 2, intensity: 0.75, color: "#ffc070", flicker: true },
    ],
  });
  const mire = hubChip(project, hubId, "ev_fs_baker");
  const toby = hubChip(project, hubId, "ev_fs_kid");
  exec(project, "place_npc", {
    mapId: FS2_HUB_NIGHT_ID, id: "ev_fs2_night_mire", name: MIRE, x: MIRE_AT.x, y: MIRE_AT.y, movement: "fixed", graphic: mire,
    pages: [
      { name: "문틈", commands: [
        say(MIRE, "쉿, 너희구나.\n리노가 빵은 잘 넣어 줬니?"),
        say(KAEL, "네. 이가 나갈 뻔했어요.\n덕분에 나왔어요."),
        say(MIRE, "천문대 정문은 기사들이 지키고 있어.\n장터 한가운데 우물로 가렴."),
        say(MIRE, "우물 안쪽 사다리가\n천문대 서고 밑까지 이어져 있단다."),
        setSw(SW_MIRE),
      ] },
      // 잔 일 Q4 「꺼진 등」 — 기사들이 거둬 간 집집 등을 몰래 문고리에 다시 건다(계획 4-6).
      { name: "문틈(다시)·꺼진 등", conditions: [sw(SW_MIRE)], commands: [
        say(MIRE, "우물로 가렴. 등불 든 야경꾼 앞으론 가지 말고."),
        say(MIRE, "…하나만 더 부탁하자.\n기사들이 집집 등을 죄다 거둬 갔어."),
        say(MIRE, "이 등 셋, 문고리에 몰래 걸어 줄래?\n불은 안 켜도 돼. 걸려만 있으면 다들 알아들어."),
        say(MIRE, "서쪽 끝 별지기 할아버지 댁,\n장터 옆 약방, 천문대 곁 리사네 집."),
        say(MIRE, "셋 다 창이 캄캄할 거야.\n등을 뺏긴 집이거든."),
        { kind: "choices", prompt: "등을 맡을까?", options: [
          { text: "맡는다", branch: [
            se("cc0-se-orp-inventory-cloth"), item(FS2_UNLIT_LAMP, 3),
            narrate("「꺼진 등」 3개를 받았다.\n별지기 할아버지 댁·약방·리사네 집 문고리에 걸자.", { context: "system" }),
            setSw(SW_Q4_TAKEN),
          ] },
          { text: "지금은 못 한다", branch: [say(MIRE, "그래, 너희 몸이 먼저지.")] },
        ] } as unknown as Command,
      ] },
      { name: "꺼진 등(진행)", conditions: [sw(SW_Q4_TAKEN)], commands: [say(MIRE, "별지기 할아버지 댁, 약방, 리사네 집.\n셋 다 걸고 다시 오렴. 야경꾼 눈에 띄지 말고.")] },
      { name: "꺼진 등(다 걸었다)", conditions: [sw(`${SW_Q4_LAMP}0`), sw(`${SW_Q4_LAMP}1`), sw(`${SW_Q4_LAMP}2`)], commands: [
        say(MIRE, "…봤어. 캄캄하던 창에 불이 들었더라.\n이제 다들 알 거야."),
        say(MIRE, "이거 가져가. 우리 토마가\n숨겨 둔 반죽으로 구운 거야."),
        se("cc0-se-orp-inventory-cloth"), item("fs_bread_starlight", 2),
        narrate("「별빛빵」 2개를 받았다.", { context: "system" }),
        setSw(SW_Q4_DONE),
      ] },
      { name: "꺼진 등(뒤)", conditions: [sw(SW_Q4_DONE)], commands: [say(MIRE, "아침 되면 저 등부터 켤 거야. 꼭 돌아오렴.")] },
    ],
  });
  lampQuestDoors(project, hubId);
  // 천문대 정문 — 잠긴 집 문과 같은 「통금이다」 문구였다. 미레 말(기사가 지킨다)과 맞춘다.
  const obsDoorAt = M(project, hubId).events.find((e) => /"kind":"transfer","mapId":"([^"]+)"/.test(JSON.stringify(e.pages ?? []))
    && project.maps[JSON.stringify(e.pages ?? []).match(/"kind":"transfer","mapId":"([^"]+)"/)![1]!]?.name.includes("천문대"));
  const obsDoor = obsDoorAt && M(project, FS2_HUB_NIGHT_ID).events.find((e) => e.x === obsDoorAt.x && e.y === obsDoorAt.y && JSON.stringify(e.pages ?? []).includes("통금이다."));
  if (obsDoor?.pages?.[0]) obsDoor.pages = [{ ...obsDoor.pages[0], commands: [narrate("천문대 정문에 쇠사슬이 감겨 있다.\n문 너머에서 쇠 장화 소리가 오간다.")] } as EventPage];
  exec(project, "place_npc", {
    mapId: FS2_HUB_NIGHT_ID, id: "ev_fs2_night_toby", name: TOBY, x: TOBY_AT.x, y: TOBY_AT.y, movement: "fixed", graphic: toby,
    pages: [
      { name: "기둥 뒤", commands: [
        say(TOBY, "형! 여기, 여기."),
        say(TOBY, "형, 이거. 은수저.\n이번엔 말하고 가져가는 거야. 형한테."),
        se("cc0-se-orp-inventory-cloth"),
        item(FS_SILVER_SPOON, 1),
        narrate("「은수저」를 받았다.", { context: "system" }),
        say(TOBY, "별한테 줄 선물. 이번엔 형이 갖다 줘."),
        say(KAEL, "…응. 꼭 전할게."),
        setSw(SW_SPOON),
      ] },
      { name: "기둥 뒤(다시)", conditions: [sw(SW_SPOON)], commands: [say(TOBY, "엄마가 깨기 전에 들어가야 해. 형도 조심해.")] },
    ],
  });
  exec(project, "place_npc", {
    mapId: FS2_HUB_NIGHT_ID, id: "ev_fs2_night_marta", name: MARTA, x: MARTA_AT.x, y: MARTA_AT.y, movement: "fixed",
    graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 5 },
    pages: [
      { name: "여관 문간", commands: [
        say(MARTA, "새벽녘에 발렌이 쇠로 덮은 마차를 몰고\n북문으로 나갔어요."),
        say(MARTA, "마차 창에 은빛 머리카락이 보였어요.\n…창을 두드리더라고요. 세 번."),
        say(KAEL, "세 번?"),
        say(ELENA, "…「달의 아이」 얘기랑 같아."),
        setSw(SW_CARRIAGE),
      ] },
      { name: "여관 문간(다시)", conditions: [sw(SW_CARRIAGE)], commands: [say(MARTA, "북문엔 오늘 밤 기사가 두 배로 섰어요.\n하넬 선생님부터 찾아가 봐요.")] },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════
// 6. B3 승강구로 들어간 천문대 — 광장 우물 → 서고 밑 승강구 → (1막 승강 장치를 거꾸로) 천문대, 하넬
// ════════════════════════════════════════════════════════════════════

export const FS2_SHAFT_ID = "fs2_well_shaft";
export const FS2_OBS_NIGHT_ID = "fs2_obs_night";
const SW_HANEL = "sw_fs2_hanel_told";
const HANEL = "천문대장 하넬";
/** 광장 우물(2×2 그림의 아랫줄) — 앞(y29)에서 위를 보고 조사. */
const WELL: Cell[] = [{ x: 40, y: 28 }, { x: 41, y: 28 }];
const WELL_FRONT: Cell = { x: 40, y: 29 };
const SHAFT_PLAN = [
  "############",
  "#..........#",
  "#..........#",
  "#..........#",
  "#..........#",
  "#..........#",
  "#..........#",
  "#..........#",
  "############",
];
const SHAFT = { ladder: { x: 2, y: 1 } as Cell, ladderUse: { x: 2, y: 3 } as Cell, arrive: { x: 2, y: 4 } as Cell, lift: { x: 6, y: 4 } as Cell };
/** 천문대 서쪽 서고 — 제1막 승강 장치가 올라오던 칸(3,19), 하넬은 서고 탁자 곁. */
const OBS = { lift: { x: 3, y: 19 } as Cell, hanel: { x: 7, y: 18 } as Cell, door: { x: 15, y: 22 } as Cell };

function observatoryNight(project: Project, exec: Exec, obsId: string): void {
  ensureSwitch(project, SW_HANEL, "B3: 하넬 — 세린·인장");
  // 우물 밑 승강구 — 서고 지하. 쇠 사다리로 우물과, 승강 장치로 천문대와 잇는다.
  exec(project, "build_hand_interior_room", {
    mapId: FS2_SHAFT_ID, name: "우물 밑 · 서고 승강구", tileset: "atlas_biome_interior", plan: SHAFT_PLAN, start: SHAFT.arrive,
    floor: "dungeon", wall: "dungeonw", ceiling: "dark",
    objects: [{ id: "wall torch", x: 5, y: 1 }, { id: "wall torch", x: 9, y: 1 }, { id: "barrel", x: 10, y: 6 }, { id: "drip puddle", x: 3, y: 6 }],
  });
  exec(project, "stamp_object", { objectId: "kit:atlas_biome_interior/hand-interior:ship ladder", mapId: FS2_SHAFT_ID, x: SHAFT.ladder.x, y: SHAFT.ladder.y });
  exec(project, "set_lighting_volume", {
    mapId: FS2_SHAFT_ID, ambient: 0.55, color: "#0b0f1a", applyMode: "map",
    sources: [{ id: "t1", at: { x: 5, y: 2 }, radius: 4, intensity: 0.85, color: "#ffb860", flicker: true }, { id: "t2", at: { x: 9, y: 2 }, radius: 4, intensity: 0.85, color: "#ffb860", flicker: true },
      // 승강 발판 — 위(천문대)에서 새는 푸른 별빛. 발판이 어둠에 묻혀 안 보였다(2026-10-29 결함 목록).
      { id: "lift", at: { x: SHAFT.lift.x + 1, y: SHAFT.lift.y + 1 }, radius: 2.5, intensity: 0.7, color: "#9fb8ff" }],
  });
  const shaft = M(project, FS2_SHAFT_ID);
  (shaft as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };

  // 천문대 · 연금의 밤 — 같은 방, 사람·연출 없이(문만 남기면 서고 승강 칸의 옛 이동 이벤트가 잠긴 문이 된다 — 다 비운다).
  exec(project, "duplicate_map", { mapId: obsId, id: FS2_OBS_NIGHT_ID, name: "별빛 천문대 · 연금의 밤", events: "none" });
  const obs = M(project, FS2_OBS_NIGHT_ID);
  (obs as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  exec(project, "set_lighting_volume", {
    mapId: FS2_OBS_NIGHT_ID, ambient: 0.55, color: "#0c1230", applyMode: "map",
    sources: [
      { id: "slit", at: { x: 15, y: 4 }, radius: 5, intensity: 0.6, color: "#9fb8ff" },
      { id: "lamp", at: { x: OBS.hanel.x, y: OBS.hanel.y - 1 }, radius: 3, intensity: 0.9, color: "#ffc070", flicker: true },
    ],
  });

  // 우물 → 승강구, 승강구 사다리 → 우물.
  WELL.forEach((c, i) => {
    const id = `ev_fs2_well_${i}`;
    addEv(project, FS2_HUB_NIGHT_ID, id, "광장 우물", c, [
      page(`${id}_p`, "우물", [], [narrate("깊은 우물이다. 바닥이 보이지 않는다.")]),
      page(`${id}_down`, "사다리", [sw(SW_MIRE)], [
        narrate("우물 안쪽 벽에 쇠 사다리가 박혀 있다.\n미레 아주머니 말대로다."),
        se("cc0-se-osx-wooded-box-open"),
        transfer(FS2_SHAFT_ID, SHAFT.arrive, "down"),
      ]),
    ]);
  });
  addEv(project, FS2_SHAFT_ID, "ev_fs2_shaft_ladder", "우물로 오르는 사다리", SHAFT.ladderUse, [
    page("ev_fs2_shaft_ladder_p", "사다리", [], [narrate("사다리를 타고 우물 위로 올라간다."), transfer(FS2_HUB_NIGHT_ID, WELL_FRONT, "down")]),
  ]);
  // 1막 지하 4층에서 탔던 승강 장치를 이번엔 서고 밑에서 탄다 — 오르면 천문대 서고, 내려오면 다시 여기.
  // 양쪽 다 도착 칸이 발판 위라, 밟으면 타는 방식이면 걸어 나가다 도로 탄다(QA 2026-10-26) — 발판 위에서 조사해야 탄다.
  exec(project, "place_lift", {
    mapId: FS2_SHAFT_ID, x: SHAFT.lift.x, y: SHAFT.lift.y, direction: "up", distance: 5, trigger: "action", text: "승강 장치에 올라탄다. 위는 천문대 서고다.",
    toMapId: FS2_OBS_NIGHT_ID, toX: OBS.lift.x, toY: OBS.lift.y, toDirection: "right",
  });
  exec(project, "place_lift", {
    mapId: FS2_OBS_NIGHT_ID, x: OBS.lift.x, y: OBS.lift.y, direction: "down", distance: 5, trigger: "action", text: "승강 장치로 서고 밑으로 내려간다.",
    toMapId: FS2_SHAFT_ID, toX: SHAFT.lift.x, toY: SHAFT.lift.y, toDirection: "down",
  });
  // 승강구 쪽 발판 그림 — 천문대 쪽 승강 칸(2×2 발판 그림, 아래 겹층)을 그대로 옮겨 찍는다. 그림이 없어 「어디서 타는지」 몰랐다.
  const obsMap = M(project, FS2_OBS_NIGHT_ID);
  for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
    const tile = obsMap.lowerOverlayTiles?.[(OBS.lift.y + dy) * obsMap.width + OBS.lift.x + dx] ?? -1;
    if (tile < 0) throw new Error("[fallen-star act2] 천문대 승강 발판 그림이 없다");
    exec(project, "paint_tiles", { mapId: FS2_SHAFT_ID, layer: "2", mode: "cells", tile, cells: [{ x: SHAFT.lift.x + dx, y: SHAFT.lift.y + dy }] });
  }
  // 정문 — 연금 중. 기사가 지킨다.
  addEv(project, FS2_OBS_NIGHT_ID, "ev_fs2_obs_door", "천문대 정문", OBS.door, [
    page("ev_fs2_obs_door_p", "정문", [], [narrate("문 밖에서 쇠 장화 소리가 오간다.\n정문으로는 못 나간다.")], { trigger: { kind: "playerTouch" } }),
  ]);
  // 하넬 — 서고 탁자 곁. 처음 올라오면 한 번 이야기한다.
  const hanelChip = { textureKey: "", characterIndex: 0 };
  const hubHanel = Object.values(project.maps).flatMap((m) => m.events).find((e) => e.id === "ev_fs_hanel");
  const hg = hubHanel?.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
  if (!hg?.sprite?.id || typeof hg.pattern !== "number") throw new Error("[fallen-star act2] 하넬 칩이 없다");
  hanelChip.textureKey = hg.sprite.id; hanelChip.characterIndex = decodeCharsetFrameIndex(hg.pattern).characterIndex;
  const talk: Command[] = [
    cutBegin(),
    emote("ev_fs2_obs_hanel", "exclamation", 700),
    say(HANEL, "…밑으로 올 줄 알았다.\n정문으로 왔으면 혼쭐을 냈을 게다."),
    say(ELENA, "선생님! 이리스가—"),
    say(HANEL, "안다. 발렌이 쇠 마차에 태워 북쪽으로 데려갔지."),
    say(HANEL, "서른 해 전, 둘째 아이에게 대답한 건\n숲에 드나들던 젊은 것 셋이었다.\n나, 브람, 그리고 세린."),
    say(HANEL, "세린은 나보다 별 이름을 잘 외웠다.\n그리고 나보다 먼저, 대답하자고 했지."),
    say(KAEL, "그다음은요?"),
    emote("ev_fs2_obs_hanel", "ellipsis", 900),
    { kind: "fork", condition: { kind: "item", itemId: FS_KEEPER_SEAL, present: true }, then: [
      say(HANEL, "숲 지하에서 별지기 인장을 주웠다지.\n그게 하늘탑 두 번째 렌즈를 여는 열쇠다."),
    ], else: [
      say(HANEL, "내 인장을 가져가거라.\n하늘탑 두 번째 렌즈를 여는 열쇠다."),
      se("cc0-se-orp-inventory-cloth"),
      item(FS_KEEPER_SEAL, 1),
      narrate("「별지기 인장」을 받았다.", { context: "system" }),
    ] } as unknown as Command,
    say(HANEL, "그 인장을 들고 탑으로 가거라.\n나머지 이야기는… 거기서 내 입으로 하마."),
    say(KAEL, "선생님, 또 숙제예요?"),
    say(HANEL, "이번엔 내 숙제다."),
    say(HANEL, "북문은 기사들이 막았다. 로한을 찾아가거라.\n대장간 뒷문은 아무도 안 지킨다."),
    setSw(SW_HANEL),
    cutLabel(),
    cutEnd(),
  ];
  addEv(project, FS2_OBS_NIGHT_ID, "ev_fs2_obs_hanel", HANEL, OBS.hanel, [
    page("ev_fs2_obs_hanel_p", "하넬(연금)", [], talk, { graphic: chip(hanelChip.textureKey, hanelChip.characterIndex, "left") }),
    page("ev_fs2_obs_hanel_after", "하넬(뒤)", [sw(SW_HANEL)], [say(HANEL, "가거라. 별 이름은 잊지 말고.")], { graphic: chip(hanelChip.textureKey, hanelChip.characterIndex, "left") }),
  ]);
  // 처음 올라오면 하넬이 먼저 부른다(승강 장치 도착 뒤 한 번).
  addEv(project, FS2_OBS_NIGHT_ID, "ev_fs2_obs_call", "하넬이 부른다", { x: 0, y: 0 }, [
    page("ev_fs2_obs_call_wait", "대기", [], [], { priority: "below" }),
    page("ev_fs2_obs_call_run", "부른다", [sw(SW_HANEL, false)], [
      wait(400),
      say(HANEL, "거기 누구냐. …카엘이냐?"),
      { kind: "setSelfSwitch", key: "A", value: true } as unknown as Command,
    ], { trigger: { kind: "auto" } }),
    page("ev_fs2_obs_call_done", "끝", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], [], { priority: "below" }),
  ]);
}

// ════════════════════════════════════════════════════════════════════
// 7. B4 로한의 창, 북문 — 대장간(뒷문) → 로한의 창·새라 소식 → 성벽 개구멍(브람) → 북쪽 숲 어귀
// ════════════════════════════════════════════════════════════════════

export const FS2_SMITHY_ID = "fs2_smithy_night";
export const FS2_ROHAN_SPEAR = "equip_fs2_rohan_spear";
const SW_ROHAN = "sw_fs2_rohan_spear";
const SW_BRAM = "sw_fs2_bram_hole";
/** B4 추격 — 개구멍을 빠지는 순간 등불에 들킨다(경보), 숲 가장자리 브람에게 닿으면 기사들이 돌아선다(끝). */
const SW_B4_ALARM = "sw_fs2_b4_alarm";
const SW_B4_EDGE = "sw_fs2_b4_forest_edge";
const ROHAN = "대장장이 로한";
const BRAM = "숲지기 브람";
/** 광장 → 대장간 문(1막 문 칸) · 대장간 안 문 칸·로한 자리. */
const SMITHY = { hubDoor: { x: 29, y: 42 } as Cell, hubFront: { x: 29, y: 43 } as Cell, door: { x: 7, y: 10 } as Cell, arrive: { x: 7, y: 9 } as Cell, rohan: { x: 10, y: 6 } as Cell };
/** 북쪽 성벽 개구멍 — 광장 북쪽 돌바닥(38,16)에서 위를 보고 조사. 브람이 그 곁(39,16)에 숨어 있다. */
const HOLE = { wall: { x: 38, y: 15 } as Cell, front: { x: 38, y: 16 } as Cell, bram: { x: 39, y: 16 } as Cell };

/** 북쪽 숲 어귀·재의 들판(B5 가 이어 짓는다). 만든 맵 id 는 결과에서 받는다. */
export const FS2_NORTH_ROUTE: { mapIds: string[]; entry: Cell; entries: Cell[] } = { mapIds: [], entry: { x: 0, y: 0 }, entries: [] };
/** B4 추격 장면 좌표(체크포인트·QA 용). */
export const FS2_B4: { edge: Cell[]; knights: Cell[]; bram: Cell } = { edge: [], knights: [], bram: { x: 0, y: 0 } };

function northGate(project: Project, exec: Exec, smithyId: string): void {
  for (const [id, name] of [[SW_ROHAN, "B4: 로한의 창"], [SW_BRAM, "B4: 브람 — 개구멍"], [SW_B4_ALARM, "B4: 개구멍 — 들켰다"], [SW_B4_EDGE, "B4: 숲 가장자리 — 브람의 고백"]] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_equipment", { equipment: {
    id: FS2_ROHAN_SPEAR, name: "로한의 별쇠 창", slot: "weapon", price: 0, iconResourceId: "cc0-jetrel-bronze-sword", imageResourceId: "cc0-jetrel-bronze-sword",
    description: "공격 40 · 상대의 회피를 무시한다.\n로한이 「네가 쓸 몫」으로 벼려 둔 별쇠 창.\n손잡이 무늬가 새라의 창과 같다.",
    statBonuses: { attack: 40, defense: 0, mind: 0, agility: 2 }, equippableActorIds: ["actor_hero", "actor_fs2_sarah"], equippableClassIds: ["class_hero", "class_guardian", "class_fs2_lancer"],
    attackElementIds: ["spear"], effectFlags: { ignoreDodge: true },
  } });
  // 대장간 · 통금의 밤 — 같은 방, 사람 없이. 문은 밤 광장으로.
  exec(project, "duplicate_map", { mapId: smithyId, id: FS2_SMITHY_ID, name: "로한의 대장간 · 통금의 밤", events: "none" });
  exec(project, "set_lighting_volume", {
    mapId: FS2_SMITHY_ID, ambient: 0.45, color: "#1a1020", applyMode: "map",
    sources: [{ id: "forge", at: { x: 18, y: 4 }, radius: 5, intensity: 0.9, color: "#ff9050", flicker: true }],
  });
  // 북쪽 숲 어귀 → 재의 들판 — 성벽 개구멍에서 이벤트로 들여보낸다(linkFrom:false, 성벽을 허물지 않는다).
  const route = exec(project, "author_forest_route", {
    fromMapId: FS2_HUB_NIGHT_ID, side: "north", count: 2, terrain: "field", linkFrom: false,
    names: ["북쪽 숲 어귀", "재의 들판"], moods: ["dark", "fog"], seed: 211,
  }) as { maps?: { mapId: string; entry: Cell }[] } | undefined;
  const maps = route?.maps ?? [];
  if (maps.length !== 2) throw new Error("[fallen-star act2] 북쪽 들판이 두 장이 아니다");
  FS2_NORTH_ROUTE.mapIds = maps.map((m) => m.mapId);
  FS2_NORTH_ROUTE.entry = maps[0]!.entry;
  FS2_NORTH_ROUTE.entries = maps.map((m) => m.entry);
}

function northGateEvents(project: Project, exec: Exec, hubId: string): void {
  // 광장 대장간 문 — 하넬을 만난 뒤엔 뒷문이 열려 있다.
  const hub = M(project, FS2_HUB_NIGHT_ID);
  const door = hub.events.find((e) => e.x === SMITHY.hubDoor.x && e.y === SMITHY.hubDoor.y);
  if (!door?.pages?.length) throw new Error("[fallen-star act2] 대장간 문이 없다");
  door.pages = [door.pages[0]!, { ...door.pages[0]!, id: `${door.id}_fs2_open`, name: "뒷문(열림)", conditions: [sw(SW_HANEL)],
    commands: [narrate("대장간 뒷문이 살짝 열려 있다."), transfer(FS2_SMITHY_ID, SMITHY.arrive, "up")] } as EventPage];
  addEv(project, FS2_SMITHY_ID, "ev_fs2_smithy_door", "대장간 문", SMITHY.door, [
    page("ev_fs2_smithy_door_p", "문", [], [transfer(FS2_HUB_NIGHT_ID, SMITHY.hubFront, "down")], { trigger: { kind: "playerTouch" } }),
  ]);
  const rohanChip = hubChipAny(project, "ev_fs_smith");
  addEv(project, FS2_SMITHY_ID, "ev_fs2_smithy_rohan", ROHAN, SMITHY.rohan, [
    page("ev_fs2_smithy_rohan_p", "로한(창)", [], [
      cutBegin(),
      say(ROHAN, "…왔구나. 하넬이 보낼 줄 알았다."),
      say(ROHAN, "약속한 몫이다. 별쇠를 섞었다."),
      se("cc0-se-orp-inventory-cloth"),
      { kind: "changeEquipment", actorId: "actor_hero", slot: "weapon", equipmentId: FS2_ROHAN_SPEAR } as unknown as Command,
      narrate("카엘이 「로한의 별쇠 창」을 받아 들었다.", { context: "system" }),
      say(KAEL, "아저씨, 이거… 손잡이 무늬가 특이해요."),
      say(ROHAN, "딸년 새라 창이랑 같은 무늬다.\n심문회 견습 창기사가 돼서\n지금 북방 관문 요새에 있지."),
      say(ROHAN, "…그 애를 보거든, 고개 들라고 해라."),
      say(ROHAN, "북문은 막혔다. 장터 북쪽 성벽 밑에서\n브람이 기다린다더군."),
      setSw(SW_ROHAN),
      cutLabel(),
      cutEnd(),
    ], { graphic: chip(rohanChip.textureKey, rohanChip.characterIndex, "down") }),
    page("ev_fs2_smithy_rohan_after", "로한(뒤)", [sw(SW_ROHAN)], [say(ROHAN, "창끝 내리지 마라. 사람 말고, 앞길을 겨눠.")], { graphic: chip(rohanChip.textureKey, rohanChip.characterIndex, "down") }),
  ]);
  // 개구멍 앞(38,16)·브람 자리(39,16)를 3×3 덤불 그림(37~39, 16~18)이 통째로 막아 닿을 길이 없었다(2026-10-29 결함 목록, 진행 불가).
  // 덤불 윗층만 걷어 성벽 밑 풀밭을 연다 — 남쪽(37~38,19)에서 걸어 들어간다. 좌우 사이프러스는 남겨 그늘진 틈으로 보이게.
  exec(project, "paint_tiles", { mapId: FS2_HUB_NIGHT_ID, layer: "3", mode: "rect", tile: -1, from: { x: 37, y: 16 }, to: { x: 39, y: 18 } });
  if (!walkSteps(project, M(project, FS2_HUB_NIGHT_ID), WELL_FRONT).has(`${HOLE.front.x},${HOLE.front.y}`)) throw new Error("[fallen-star act2] 개구멍 앞 칸에 닿을 수 없다");
  // 브람 — 성벽 밑 그늘. 로한을 만난 뒤에만 나타나 개구멍을 연다.
  const bramChip = hubChipAny(project, "ev_fs_bram");
  addEv(project, FS2_HUB_NIGHT_ID, "ev_fs2_hub_bram", BRAM, HOLE.bram, [
    page("ev_fs2_hub_bram_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_hub_bram_p", "브람", [sw(SW_ROHAN)], [
      say(BRAM, "쉿. 여기다, 꼬마들."),
      say(BRAM, "이 돌 하나가 쑥 빠진다. 서른 해 전에\n내가 헐겁게 해 둔 거다. 그때도 밤이었지."),
      say(BRAM, "곧 순찰 등불이 이리 돈다.\n빠지거든 돌아보지 말고 숲 그늘까지 뛰어라.\n거기서 기다리마."),
      setSw(SW_BRAM),
    ], { graphic: chip(bramChip.textureKey, bramChip.characterIndex, "left") }),
    page("ev_fs2_hub_bram_after", "브람(뒤)", [sw(SW_BRAM)], [say(BRAM, "숲 그늘까지. 뒤돌아보지 마라.")], { graphic: chip(bramChip.textureKey, bramChip.characterIndex, "left") }),
    page("ev_fs2_hub_bram_gone", "브람(숲으로)", [sw(SW_B4_ALARM)], [], { priority: "below", graphic: { transparent: true } }),
  ]);
  const [first] = FS2_NORTH_ROUTE.mapIds;
  addEv(project, FS2_HUB_NIGHT_ID, "ev_fs2_hub_hole", "성벽 개구멍", HOLE.wall, [
    page("ev_fs2_hub_hole_p", "성벽", [], [narrate("두꺼운 성벽이다. 돌 하나가 조금 튀어나와 있다.")]),
    page("ev_fs2_hub_hole_open", "개구멍", [sw(SW_BRAM)], [
      se("cc0-se-osx-wooded-box-open"),
      narrate("브람이 돌을 빼낸다.\n사람 하나 빠져나갈 구멍이 뚫린다."),
      se("cc0-se-osx-metal-01"),
      shake(2, 300),
      say("순찰 기사", "거기, 성벽 밑! 누구냐!"),
      say(ELENA, "들켰어! 뛰어!"),
      setSw(SW_B4_ALARM),
      transfer(first!, { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 }, "up"),
    ]),
  ]);
  forestEdgeChase(project, exec, first!, hubId, bramChip);
  addEv(project, first!, "ev_fs2_north_back", "성벽 개구멍으로", FS2_NORTH_ROUTE.entry, [
    page("ev_fs2_north_back_p", "돌아간다", [], [narrate("개구멍으로 기어 광장으로 돌아간다."), transfer(FS2_HUB_NIGHT_ID, HOLE.front, "down")], { priority: "below", trigger: { kind: "playerTouch" } }),
  ]);
}

/** 걸어서 닿는 칸까지의 걸음 수(문·이벤트는 무시) — 장면 자리를 맵 모양에서 고른다. */
function walkSteps(project: Project, map: GameMap, from: Cell): Map<string, number> {
  const dist = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    const d = dist.get(`${c.x},${c.y}`)!;
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (dist.has(`${n.x},${n.y}`) || !canMove(project, map, c.x, c.y, n.x, n.y)) continue;
      dist.set(`${n.x},${n.y}`, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

/**
 * B4 숲 가장자리 — 개구멍을 빠지자 등불에 들켰다. 순찰 기사 둘이 경보(make_chase_scene activateSwitch)로 깨어 쫓는다.
 * 기사는 다섯~여섯 걸음 떨어진 곳에서 깨어 0.2초 멈칫한 뒤 다섯 칸을 칸당 0.1초로 내닫는다(v1.25 VQA: 예전엔 기사가 느려 추격이 아니었다).
 * 입구에서 여덟~열 줄 북쪽의 「숲 그늘」 줄(그림자로 칠하고 달빛을 그 앞까지만 비춘다 — 눈에 보이는 도착선)에 닿으면 기사들이 돌아서고
 * 브람이 서른 해 전 일을 고백한다. 붙잡히면 전투 없이 개구멍 안쪽으로 도로 기어들어 다시 시도한다.
 */
function forestEdgeChase(project: Project, exec: Exec, mapId: string, hubId: string, bramChip: { textureKey: string; characterIndex: number }): void {
  const map = M(project, mapId);
  const arrive = { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 };
  const dist = walkSteps(project, map, arrive);
  const cells = (d: number) => [...dist.entries()].filter(([, v]) => v === d).map(([k]) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; });
  // 숲 그늘 줄 — 입구에서 여덟~열 줄 북쪽의 가로 한 줄 전체(걸어 닿는 칸만). 맵 좌우 끝이 막고 있어 북쪽으로 가려면 반드시 밟는다.
  const row = (y: number) => [...dist.keys()].map((k) => { const [x, yy] = k.split(",").map(Number); return { x: x!, y: yy! }; }).filter((c) => c.y === y);
  let edge: Cell[] = [];
  let edgeY = 0;
  for (let y = arrive.y - 8; y >= Math.max(1, arrive.y - 10); y -= 1) {
    const r = row(y);
    if (r.length && (!edge.length || r.length < edge.length)) { edge = r; edgeY = y; }
  }
  if (!edge.length || edge.length > 28) throw new Error(`[fallen-star act2] 숲 가장자리 줄을 못 골랐다(${edge.length}칸)`);
  FS2_B4.edge = edge;
  // 숲 그늘 — 도착선 줄과 그 북쪽 두 줄을 그림자로 덮고(가로 전체), 남쪽 한 줄은 위 절반만 — 그늘의 가장자리가 보인다.
  const shade: Rec[] = [];
  for (let x = 0; x < map.width; x += 1) {
    for (let y = edgeY - 2; y <= edgeY; y += 1) if (y >= 0) shade.push({ x, y, bits: 15 });
    if (edgeY + 1 < map.height) shade.push({ x, y: edgeY + 1, quarters: ["tl", "tr"] });
  }
  exec(project, "paint_shadow", { mapId, cells: shade, mode: "add" });
  // 밤 숲 — 1막 낮 숲길과 다른 맵처럼 어둡게. 개구멍~숲 그늘 사이 빈터에만 달빛이 들어, 그늘 줄이 어둠의 경계로 읽힌다.
  const moonY = Math.round((arrive.y + edgeY) / 2) + 1;
  // 순찰 기사 둘 — 경보가 켜지면 개구멍 곁 다섯~여섯 걸음에서 깨어 쫓는다. 숲 그늘에 닿으면 사라진다(전투 없음).
  const knight = hubChip(project, hubId, "ev_fs_knight");
  const near = [...cells(5), ...cells(6)].filter((c) => c.y > edgeY + 2).sort((a, b) => Math.abs(b.x - arrive.x) - Math.abs(a.x - arrive.x));
  const knightIds: string[] = [];
  let why = "후보 없음";
  for (const at of near) {
    if (knightIds.length >= 2) break;
    if (knightIds.length === 1 && FS2_B4.knights[0] && Math.sign(at.x - arrive.x) === Math.sign(FS2_B4.knights[0].x - arrive.x)) continue;
    try {
      const made = exec(project, "make_chase_scene", {
        mapId,
        chaser: { at, graphic: { selectionId: `charset:${knight.textureKey}:${knight.characterIndex}` }, speed: 5, sightRange: 9 },
        pursuit: { scope: "map", doorDelayMs: 0, searchMs: 4000, onLost: "wait" },
        // 끌려가는 곳(개구멍 앞)은 아래에서 직접 잇는다 — 도구의 통행 검사가 그 칸(광장 개구멍 앞, 돌아가는 이벤트도 같은 칸)을 막힌 칸으로 본다.
        caughtPenalty: {
          text: "순찰 기사: 「잡았다, 이 쥐새끼들!」\n카엘은 손을 뿌리치고\n개구멍 안으로 도로 기어들었다.",
        },
        activateSwitch: SW_B4_ALARM,
        checkpointOnEntry: false,
        mood: false,
      }) as { eventId?: string } | undefined;
      if (!made?.eventId) continue;
      const ev = M(project, mapId).events.find((e) => e.id === made.eventId);
      if (ev) {
        (ev as unknown as Rec).name = "순찰 기사";
        ev.pages = [...(ev.pages ?? []), page(`${made.eventId}_gone`, "물러남", [sw(SW_B4_EDGE)], [], { priority: "below", graphic: { transparent: true } }) as EventPage];
        FS2_B4.knights.push({ x: ev.x, y: ev.y });
      }
      knightIds.push(made.eventId);
    } catch (e) { why = String((e as Error).message).slice(0, 300); /* 그 칸은 도구가 거절 — 다음 자리 */ }
  }
  if (!knightIds.length) throw new Error(`[fallen-star act2] 숲 어귀에 추격 기사를 못 세웠다(후보 ${near.length}칸): ${why}`);
  // 밤 숲 조명 — 기사마다 손등불(이벤트를 따라다닌다). 등불이 없어 「등불들이 멈춘다」가 화면과 어긋났다(VQA 1차).
  exec(project, "set_lighting_volume", {
    mapId, applyMode: "map", ambient: 0.7, color: "#0a1024",
    sources: [
      { id: "moon", at: { x: arrive.x, y: moonY }, radius: Math.max(4, arrive.y - edgeY - 3), intensity: 0.45, color: "#c4d2ff" },
      { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.35, color: "#9fb4ff" },
      ...knightIds.map((eventId, i) => ({ id: `knight_lamp${i}`, at: { eventId }, radius: 2.5, intensity: 0.8, color: "#ffb050", flicker: true })),
    ],
  });
  // 기사 추격 — 시야 9. 「거기 서라!」 0.8초 뒤에 움직인다(예전 1.4초는 기사가 멀뚱히 선 채 추격이 3초 만에 끝났다 — VQA 1차), 네 칸 돌진(칸당 0.1초), 평소 0.17초/칸(주인공 0.16초보다 조금 느림).
  exec(project, "set_field_detection", { mapIds: [mapId], eventIds: knightIds, sightRange: 9, alertMs: 800, chaseStepMs: 170, rush: true, rushSteps: 4, rushStepMs: 100, searchMs: 4000, giveUpRange: 20 });
  // 붙잡히면 개구멍 앞(광장)으로 — 도구 검사 뒤에 직접 붙인다(위 caughtPenalty 주석).
  for (const id of knightIds) {
    const chasePage = M(project, mapId).events.find((e) => e.id === id)?.pages?.[0];
    if (chasePage) chasePage.commands = [...(chasePage.commands ?? []), transfer(FS2_HUB_NIGHT_ID, HOLE.front, "down")];
  }
  // 브람 — 숲 그늘 줄 너머 한두 걸음.
  const beyond = [...row(edgeY - 1), ...row(edgeY - 2)];
  const bramAt = beyond.sort((a, b) => Math.abs(a.x - arrive.x) - Math.abs(b.x - arrive.x))[0];
  if (!bramAt) throw new Error("[fallen-star act2] 숲 가장자리 브람 자리가 없다");
  FS2_B4.bram = bramAt;
  const bramPage = (dir: Dir): Rec => ({ graphic: chip(bramChip.textureKey, bramChip.characterIndex, dir) });
  addEv(project, mapId, "ev_fs2_edge_bram", BRAM, bramAt, [
    page("ev_fs2_edge_bram_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_edge_bram_wait", "숲 그늘", [sw(SW_B4_ALARM)], [say(BRAM, "이리 와라. 그늘 안으로.")], bramPage("down")),
    page("ev_fs2_edge_bram_after", "브람(뒤)", [sw(SW_B4_EDGE)], [say(BRAM, "가라. 여기서부턴 내 숲이 아니다.")], bramPage("down")),
  ]);
  const confess: Command[] = [
    cutBegin(),
    se("cc0-se-osx-wooded-box-open"),
    narrate("숲 그늘로 들어서자 뒤쫓던 등불들이 멈춘다.\n「…숲지기 땅이다. 돌아가자.」"),
    setSw(SW_B4_EDGE),
    wait(500),
    say(BRAM, "기사 놈들은 숲에 못 들어온다.\n여기까진 아직 내 숲이니까."),
    say(BRAM, "…그 가락 말이다. 쇠 긁는 소리.\n둘째 아이가 부르던 거다."),
    say(BRAM, "서른 해 전 그 밤에도 들었다.\n알았으면서 모른 척했다. 늙으면 겁이 많아져."),
    say(KAEL, "…이번엔 모른 척 안 하셨잖아요."),
    say(BRAM, "그러느라 숨이 턱에 찼다. 가거라.\n여기서부턴 내 숲이 아니다."),
    cutLabel(),
    cutEnd(),
  ];
  edge.forEach((c, i) => {
    addEv(project, mapId, `ev_fs2_edge_${i}`, "숲 그늘", c, [
      page(`ev_fs2_edge_${i}_idle`, "대기", [], [], { priority: "below" }),
      page(`ev_fs2_edge_${i}_run`, "숲 그늘", [sw(SW_B4_ALARM)], confess, { priority: "below", trigger: { kind: "playerTouch" } }),
      page(`ev_fs2_edge_${i}_done`, "끝", [sw(SW_B4_EDGE)], [], { priority: "below" }),
    ]);
  });
}

// ════════════════════════════════════════════════════════════════════
// 8. B5 새벽샘 터 — 재의 들판의 적(잿불 도깨비·재까마귀·숯덩이 골렘·굶은 들개·재뱀), 불탄 마을, 잠긴 집, 정착 확인서
// ════════════════════════════════════════════════════════════════════

export const FS2_DAWNWELL_ID = "fs2_dawnwell";
const FS2_DAWNWELL_BASE = "fs2_dawnwell_before";
export const FS2_CERT_ITEM = "item_fs2_serin_form";
const SW_CERT = "sw_fs2_serin_form";
const SW_MEMS = ["sw_fs2_dawn_mem_0", "sw_fs2_dawn_mem_1", "sw_fs2_dawn_mem_2"] as const;
const SAVE_CRYSTAL = "kit:beodeul_city/bd-pick-dungeon-theme-crystal-pedestal";
/**
 * 재의 들판 적 — 이미 있는 몬스터 도트를 쓴다(새 그림 없음). 난이도 곡선(VQA 2차): 2막 시작 Lv6 → 새벽샘 끝 Lv8.
 * 모의전(simulate_battle n=40, 카엘+엘레나, 카엘 로한의 창, 2026-10-28) — 기술 자동 전투 / 통상 공격만:
 *   들개 셋(Lv6)  승 100%·남은 HP 69% / 승 100%·회복약 1.7   까마귀 셋(Lv6) 100%·59% / 70%·1.1
 *   재뱀 둘+까마귀(Lv7) 100%·83% / 100%·2.0   도깨비 셋(Lv7) 100%·69%·약 0.4 / 100%·2.3
 *   숯덩이 골렘+도깨비(Lv7, 피할 수 있는 정예) 100%·68% / 100%·회복약 4.0
 * 경험치 — 한 번씩 다 싸우면(들개·까마귀·도깨비·재뱀·마을 도깨비) 935 → Lv6 바닥 1145 + 935 = 2080 ≥ Lv8 문턱 2070.
 */
const ASH_FOES: { id: string; name: string; art: string; level: number; stats: Rec; style: string; elementRates?: Rec; skills: string[]; exp: number }[] = [
  // 잿불 도깨비 — 불의 정령. 얼음 구체가 아니라 불(화염)을 쓴다(VQA: 도깨비가 얼음 기술).
  { id: "enemy_fs2_ash_wisp", name: "잿불 도깨비", art: "generated-enemy-spirit-fire", level: 7, style: "float", stats: { maxHp: 170, maxMp: 40, attack: 58, defense: 22, mind: 90, agility: 52 }, elementRates: { fire: "E", ice: "A", water: "A" }, skills: ["skill_attack", "skill_fire"], exp: 70 },
  { id: "enemy_fs2_ash_crow", name: "재까마귀", art: "generated-enemy-bird-hawk", level: 6, style: "swoop", stats: { maxHp: 130, maxMp: 0, attack: 76, defense: 18, mind: 20, agility: 78 }, skills: ["skill_attack"], exp: 55 },
  { id: "enemy_fs2_cinder_golem", name: "숯덩이 골렘", art: "generated-enemy-golem-clay", level: 8, style: "lumber", stats: { maxHp: 700, maxMp: 0, attack: 118, defense: 72, mind: 60, agility: 30 }, elementRates: { fire: "E", water: "A" }, skills: ["skill_attack", "skill_earth"], exp: 280 },
  { id: "enemy_fs2_starved_dog", name: "굶은 들개", art: "generated-enemy-hound-hell", level: 6, style: "dash", stats: { maxHp: 150, maxMp: 0, attack: 74, defense: 20, mind: 20, agility: 66 }, skills: ["skill_attack"], exp: 55 },
  { id: "enemy_fs2_ash_snake", name: "재뱀", art: "generated-enemy-snake-viper", level: 7, style: "slither", stats: { maxHp: 180, maxMp: 0, attack: 78, defense: 30, mind: 30, agility: 40 }, skills: ["skill_attack"], exp: 65 },
];
/** 무리 — 숲 어귀(밤 숲)의 들개·까마귀는 밤 겹, 재의 들판·마을 터의 도깨비·뱀·골렘은 잿빛 연기 겹. 배경 그림(숲·들판)은 맵 battleBackground 가 정한다. */
const ASH_TROOPS: { id: string; name: string; members: string[]; night?: boolean }[] = [
  { id: "troop_fs2_ash_wisps", name: "잿불 도깨비 떼", members: ["enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp"] },
  { id: "troop_fs2_ash_crows", name: "재까마귀 떼", members: ["enemy_fs2_ash_crow", "enemy_fs2_ash_crow", "enemy_fs2_ash_crow"], night: true },
  { id: "troop_fs2_cinder_golem", name: "숯덩이 골렘", members: ["enemy_fs2_cinder_golem", "enemy_fs2_ash_wisp"] },
  { id: "troop_fs2_starved_dogs", name: "굶은 들개", members: ["enemy_fs2_starved_dog", "enemy_fs2_starved_dog", "enemy_fs2_starved_dog"], night: true },
  { id: "troop_fs2_ash_snakes", name: "재뱀", members: ["enemy_fs2_ash_snake", "enemy_fs2_ash_snake", "enemy_fs2_ash_crow"] },
];
/** 잿빛 들판·불탄 마을 터 전투 — 들판 그림에 잿빛 연기·불티를 덮는다(낮 올리브 들판으로 뜨던 문제). */
const ASH_LAYERS = [{ preset: "smoke" }, { preset: "embers", opacity: 60 }];
/** 밤 광장 전투 — 남색 밤 겹 + 별. */
const NIGHT_LAYERS = [{ preset: "night" }, { preset: "stars", opacity: 70 }];

const ENEMY_TOOL_FIELDS = new Set(["id", "name", "speciesId", "monsterResourceId", "battleScalePercent", "collapseEffect", "hideHp", "damageTypeRates", "criticalHit", "attackOptions", "skillIds", "level", "stats", "rewards", "actions", "reactions", "stealItems", "stateRates", "elementRates"]);
function ashFoes(project: Project, exec: Exec): void {
  const base = project.database.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!base) throw new Error("[fallen-star act2] enemy_fs_wolf 가 없다");
  for (const f of ASH_FOES) {
    const rec = JSON.parse(JSON.stringify(base)) as Rec;
    Object.assign(rec, {
      id: f.id, name: f.name, level: f.level, monsterResourceId: f.art, stats: f.stats, skillIds: f.skills,
      actions: f.skills.map((skillId, i) => ({ skillId, priority: i === 0 ? 7 : 8, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } })),
      rewards: { exp: f.exp, gold: 14, dropRatePercent: 0, drops: [{ itemId: "item_potion", ratePercent: 8, quantity: 1, condition: { kind: "always" } }] },
      ...(f.elementRates ? { elementRates: { ...(base as unknown as Rec).elementRates as Rec, ...f.elementRates } } : {}),
    });
    delete rec.lungeSpeedPercent;
    // upsert_enemy 가 받는 칸만 넘긴다(graphicHue·transparent·flying 은 도구 밖 — 전투가 읽지 않는다).
    for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
    exec(project, "upsert_enemy", { enemy: rec });
  }
  for (const t of ASH_TROOPS) exec(project, "upsert_troop", { troop: { id: t.id, name: t.name, enemyIds: t.members, backdropLayers: t.night ? NIGHT_LAYERS : ASH_LAYERS } });
}

function dawnwell(project: Project, exec: Exec): void {
  ensureSwitch(project, SW_CERT, "B5: 세린의 정착 확인서");
  SW_MEMS.forEach((id, i) => ensureSwitch(project, id, `B5: 새벽샘 기억 ${i + 1}`));
  exec(project, "upsert_item", { item: {
    id: FS2_CERT_ITEM, name: "반쯤 탄 정착 확인서", type: "special", occasion: "never", consumable: false, price: 0,
    description: "천문대 서랍에 있던 것과 같은 양식. 서명란: 「기록자 세린」.\n그 밑에 삐뚤빼뚤한 아이 글씨. 「엄마 문 열어」.",
  } });
  ashFoes(project, exec);
  // 서른 해 전의 새벽샘 — 작은 강가 마을을 한 번 짓고(보이지 않는 원본), 불탄 모습으로 바꾼다. 북쪽 끝 집 한 채만 남는다.
  const town0 = exec(project, "author_beodeul_town", { id: FS2_DAWNWELL_BASE, name: "새벽샘 (서른 해 전)", houseCount: 5, theme: "river", form: "street", water: "none", seed: 31 }) as
    { doors?: { kit: string; x: number; y: number }[] } | undefined;
  const derived = exec(project, "derive_map_variant", {
    sourceMapId: FS2_DAWNWELL_BASE, variants: [{ id: FS2_DAWNWELL_ID, name: "새벽샘 터", look: "burned", keepIntact: "north", scorch: "whole" }],
  }) as { variants?: { look?: { keptIntact?: { kitId: string; x: number; y: number; w: number; h: number } } }[] } | undefined;
  const kept = derived?.variants?.[0]?.look?.keptIntact;
  if (!kept) throw new Error("[fallen-star act2] 새벽샘 남은 집이 없다");
  DAWN.kept = kept;
  // 남은 집의 문 앞 칸(author_beodeul_town data.doors = 문 앞 칸). 문 그림 칸은 그 바로 위.
  const front = town0?.doors?.find((d) => d.kit === `bd-house-${kept.kitId.replace(/^bd-house-/, "")}` || d.kit === kept.kitId);
  if (!front) throw new Error(`[fallen-star act2] 남은 집(${kept.kitId}) 문을 못 찾음`);
  DAWN.front = { x: front.x, y: front.y };
  // 서른 해 전 원본은 변형을 뽑은 뒤 쓸 데가 없다 — 남기면 연결 없는 고아 맵이 된다.
  exec(project, "remove_map", { mapId: FS2_DAWNWELL_BASE });
  exec(project, "set_map_properties", { mapId: FS2_DAWNWELL_ID, mapRole: "field" });
  scorchDawnwell(project, exec, kept);
  exec(project, "set_scene_mood", {
    mapId: FS2_DAWNWELL_ID, applyMode: "map",
    lighting: { ambient: 0.4, color: "#3a3440" }, weather: { kind: "fog", intensity: 0.45 },
  });
  // 재의 들판(두 번째 들판) 북쪽 끝 → 마을 터 남쪽.
  const [north1, field] = FS2_NORTH_ROUTE.mapIds;
  const town = M(project, FS2_DAWNWELL_ID);
  const fieldEntry = FS2_NORTH_ROUTE.entries[1]!;
  const a = originEdge(project, M(project, field!), "north", { x: fieldEntry.x, y: fieldEntry.y - 1 });
  const b = originEdge(project, town, "south");
  exec(project, "create_transfer_pair", { a: { mapId: field!, ...a }, b: { mapId: FS2_DAWNWELL_ID, ...b } });
  DAWN.entry = b;
  // 보이는 적 — 숲 어귀엔 들개·까마귀, 들판엔 도깨비·뱀·골렘(하나, 길에서 비켜 선 정예), 마을 터엔 도깨비.
  // 알아채기·돌진은 detection() 이 종류별로 정한다(들짐승·도깨비는 보면 달려와 덮치고, 뱀·골렘은 느린 정예).
  const foe = (mapId: string, troopId: string, x: number, y: number, style: string, respawnSec = 90): void => {
    try {
      exec(project, "place_field_enemy", { mapId, x, y, troopId, behavior: "chase", patrol: { length: 2, axis: x % 2 ? "horizontal" : "vertical" },
        sightRange: 6, vision: "cone", pace: "normal", approachStyle: style, respawnSec, checkpointOnEntry: true });
    } catch { /* 그 칸은 도구가 거절(입구 곁·막힌 칸) — 건너뛴다 */ }
  };
  for (const mapId of [north1!, field!]) exec(project, "set_map_properties", { mapId, mapRole: "field" });
  // 전투 배경 — 밤 숲 어귀는 숲, 재의 들판·마을 터는 들판 그림(무리마다 밤·잿빛 연기 겹이 덮는다).
  exec(project, "set_map_properties", { mapId: north1!, battleBackground: "battle-scenery-forest" });
  for (const mapId of [field!, FS2_DAWNWELL_ID]) exec(project, "set_map_properties", { mapId, battleBackground: "battle-scenery-plains" });
  const W = (id: string) => M(project, id).width, H = (id: string) => M(project, id).height;
  foe(north1!, "troop_fs2_starved_dogs", Math.floor(W(north1!) / 2), Math.floor(H(north1!) / 2), "dash");
  foe(north1!, "troop_fs2_ash_crows", Math.floor(W(north1!) / 2) + 4, Math.floor(H(north1!) / 3), "swoop");
  foe(field!, "troop_fs2_ash_wisps", Math.floor(W(field!) / 2), Math.floor(H(field!) / 2), "float");
  foe(field!, "troop_fs2_ash_snakes", Math.floor(W(field!) / 2) - 5, Math.floor(H(field!) * 2 / 3), "slither");
  // 골렘은 하나 — 이기면 다시 안 나온다. 피해 갈 수 있는 정예(느리고 돌진 없음).
  foe(field!, "troop_fs2_cinder_golem", Math.floor(W(field!) / 2) + 4, Math.floor(H(field!) / 4), "lumber", 0);
  // 마을 터 — 잠긴 집(서쪽) 앞을 비워 두고 서쪽 길목에 도깨비 한 무리.
  foe(FS2_DAWNWELL_ID, "troop_fs2_ash_wisps", 7, 22, "float");
  // 별빛 결정 — 마을 터 입구 곁.
  exec(project, "place_savepoint", { mapId: FS2_DAWNWELL_ID, x: b.x + 2, y: b.y - 3, id: "ev_fs2_dawnwell_save", name: "별빛 결정", mode: "slot",
    objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2 });
}
/** 버들항 구역 키트 가운데 칸 — 그을린 바닥 칠하기용. */
function kitCenterTile(project: Project, tilesetId: string, kitId: string): number {
  const kit = project.tilesets[tilesetId]?.structureKits?.find((k) => k.id === kitId) as { width: number; height: number; rows: { tiles: number[] }[] } | undefined;
  const tile = kit?.rows[Math.floor(kit.height / 2)]?.tiles[Math.floor(kit.width / 2)];
  if (tile === undefined || tile < 0) throw new Error(`[fallen-star act2] 키트 ${kitId} 가 없다`);
  return tile;
}

/**
 * 새벽샘 터 다듬기(v1.25 VQA) — derive_map_variant scorch:"whole" 은 남긴 집 발자국과 둘레 한 칸을 빼서
 * 한가운데 연두 잔디 사각형(12×11)이 남았다. 그 자리도 그을리고, 잠긴 집 둘레를 숯 바닥·숯더미로 두른다(집 그림 자체는 새로 그리지 않는다).
 */
function scorchDawnwell(project: Project, exec: Exec, kept: { x: number; y: number; w: number; h: number }): void {
  const town = M(project, FS2_DAWNWELL_ID);
  const tileset = project.tilesets[town.tilesetId];
  const mask = new Uint8Array(town.width * town.height);
  for (let y = kept.y - 2; y < kept.y + kept.h + 2; y += 1) for (let x = kept.x - 2; x < kept.x + kept.w + 2; x += 1) {
    if (x >= 0 && y >= 0 && x < town.width && y < town.height) mask[y * town.width + x] = 1;
  }
  applyVariantTerrain(town, tileset, "scorched", 0x5eed31, mask);
  // 모랫길 오토타일은 가장자리에 풀 테두리가 그려져 있어 잿빛 땅 위에 연두 줄로 남았다 — 길은 그을린 마당 흙으로 덮는다.
  const meta = tileset?.tileMeta ?? [];
  const yard = kitCenterTile(project, town.tilesetId, "bd-pick-mining-valley-ground-yard");
  const ash = kitCenterTile(project, town.tilesetId, "bd-pick-mining-valley-ground-slagg");
  town.lowerTiles.forEach((t, i) => { if (t >= 0 && meta[t]?.tags?.includes("sand")) town.lowerTiles[i] = yard; });
  // 잠긴 집 — 벽은 버텼지만 둘레 한 칸은 숯 바닥, 앞마당 풀 장식은 걷는다. 집 앞 두 귀퉁이에 숯더미·불씨.
  for (let y = kept.y - 1; y <= kept.y + kept.h; y += 1) for (let x = kept.x - 1; x <= kept.x + kept.w; x += 1) {
    if (x < 0 || y < 0 || x >= town.width || y >= town.height) continue;
    const i = y * town.width + x;
    const ring = x === kept.x - 1 || y === kept.y - 1 || x === kept.x + kept.w || y === kept.y + kept.h;
    const lo = town.lowerTiles[i] ?? -1;
    if (ring && lo >= 0 && isPassable(project, town, x, y) && (town.upperTiles[i] ?? -1) < 0) town.lowerTiles[i] = ash;
    const up = town.upperTiles[i] ?? -1;
    if (up >= 0 && meta[up]?.tags?.includes("decal") && /풀|꽃|고사리|덤불/.test(meta[up]?.label ?? "")) town.upperTiles[i] = -1;
  }
  for (const [x, y, id] of [[kept.x - 2, kept.y + kept.h - 2, "bd-pick-volcano-cave-coal-pile"], [kept.x + kept.w, kept.y + kept.h - 2, "bd-pick-volcano-cave-pillar-fallen"], [kept.x + 1, kept.y + kept.h + 1, "bd-pick-volcano-cave-ember-a"]] as const) {
    try { exec(project, "stamp_object", { objectId: `kit:beodeul_city/${id}`, mapId: FS2_DAWNWELL_ID, x, y }); } catch { /* 자리 없음 — 건너뛴다 */ }
  }
}

/**
 * 재의 들판 — 들불이 숲 사이 빈터를 태웠다. 숲 덩이(두 겹 수관·줄기)는 그대로 두고, 나무가 없는 빈터 땅만 그을린 흙·잿빛 마당 얼룩으로,
 * 풀꽃·고사리는 덩어리 진 곳에서만 불씨 자국·자갈로(나머지는 지운다), 빈터 가장자리에 마른 고목 덩이 몇(고목 + 그루터기·숯더미).
 * 북쪽 숲 어귀는 숲 그늘 줄(B4 도착선) 너머 북쪽만 태운다 — 그 줄과 남쪽 개구멍 빈터가 브람의 「아직은 내 숲」이다.
 * (v1.25 1차 시도: 마을용 그을림 도구를 숲길 맵에 그대로 썼더니 위층 나무만 걷혀 수관 사이에 통나무·숯더미가 박혔다 — 그래서 빈터만 다룬다.)
 */
function scorchAshFields(project: Project, exec: Exec): void {
  const [north1, field] = FS2_NORTH_ROUTE.mapIds;
  const edgeY = FS2_B4.edge[0]?.y ?? 0;
  const tileset = project.tilesets[M(project, field!).tilesetId];
  const meta = tileset?.tileMeta ?? [];
  const grafts = new Map((tileset?.tileGrafts ?? []).map((g) => [g.targetTile, g.sourceChipset]));
  const tags = (t: number | undefined): readonly string[] => (t === undefined || t < 0 ? [] : meta[t]?.tags ?? []);
  const isTreeish = (t: number | undefined): boolean => t !== undefined && t >= 0 && (tags(t).includes("tree") || grafts.get(t) === "tex_beodeul_forest_trunks" || grafts.get(t) === "tex_beodeul_nature");
  const base = kitCenterTile(project, field ? M(project, field).tilesetId : "beodeul_city", "bd-pick-temple-ruins-floor-dirt");
  const gravel = kitCenterTile(project, M(project, field!).tilesetId, "bd-pick-mining-valley-ground-rock");
  const kitUpper = (id: string): number => {
    const kit = tileset?.structureKits?.find((k) => k.id === id) as { rows: { upperTiles?: number[] }[] } | undefined;
    return kit?.rows[0]?.upperTiles?.find((t) => t >= 0) ?? -1;
  };
  const embers = ["bd-pick-volcano-cave-ember-a", "bd-pick-mountain-pass-scree-a", "bd-pick-mountain-pass-scree-b"].map(kitUpper).filter((t) => t >= 0);
  const hash = (a: number, b: number, c: number): number => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0) % 100;
  for (const [mapId, seed] of [[north1!, 11], [field!, 12]] as const) {
    const map = M(project, mapId);
    const W = map.width;
    const yMax = mapId === north1 ? Math.max(0, edgeY - 4) : map.height;
    const layers = [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles];
    // 바꾸기 전에 빈터 칸을 정해 둔다(바꾼 뒤엔 풀 칸이 아니라 고목 자리를 못 찾았다).
    const openMask = new Uint8Array(W * map.height);
    for (let i = 0; i < W * map.height; i += 1) {
      const lo = map.lowerTiles[i];
      if (!layers.some((l) => isTreeish(l?.[i])) && lo !== undefined && lo >= 0 && (tags(lo).includes("grass") || grafts.get(lo) === "tex_beodeul_ground")) openMask[i] = 1;
    }
    const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < map.height && openMask[y * W + x] === 1;
    for (let y = 0; y < yMax; y += 1) for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      // 모랫길 오토타일은 풀 테두리가 그려져 있다 — 잿빛 땅 위 연두 줄이 되므로 자갈 흙길로 바꾼다.
      if (tags(map.lowerTiles[i]).includes("sand")) map.lowerTiles[i] = gravel;
      if (open(x, y)) {
        // 마당 흙 얼룩은 경계 오토타일이 없어 네모 판으로 보였다 — 탄 흙 한 가지로 깐다.
        map.lowerTiles[i] = base;
        if (map.lowerOverlayTiles) map.lowerOverlayTiles[i] = -1;
      }
      // 풀꽃·고사리·버섯 장식 — 6×6 묶음 셋 중 하나쯤에만 불씨·자갈로 남긴다.
      const up = map.upperTiles[i] ?? -1;
      if (up >= 0 && tags(up).includes("decal") && /들꽃|고사리|버섯|헤더|풀/.test(meta[up]?.label ?? "")) {
        map.upperTiles[i] = hash(Math.floor(x / 6), Math.floor(y / 6), seed + 7) < 36 && embers.length ? embers[hash(x, y, seed) % embers.length]! : -1;
      }
    }
    // 마른 고목 덩이 — 빈터 가장자리(숲에서 한두 칸) 세 곳, 서로 8칸 넘게 떨어뜨린다.
    const anchors: Cell[] = [];
    const spots: Cell[] = [];
    for (let y = 2; y < yMax - 5; y += 1) for (let x = 2; x < W - 4; x += 1) spots.push({ x, y });
    spots.sort((a, b) => hash(a.x, a.y, seed + 3) - hash(b.x, b.y, seed + 3) || a.y - b.y || a.x - b.x);
    for (const { x, y } of spots) {
      if (anchors.length >= 3) break;
      if (anchors.some((a) => Math.abs(a.x - x) + Math.abs(a.y - y) < 9)) continue;
      let ok = true;
      for (let dy = 0; dy < 4 && ok; dy += 1) for (let dx = 0; dx < 3 && ok; dx += 1) ok = open(x + dx, y + dy) && isPassable(project, map, x + dx, y + dy) && (map.upperTiles[(y + dy) * W + x + dx] ?? -1) < 0;
      if (!ok || map.events.some((e) => Math.abs(e.x - (x + 1)) + Math.abs(e.y - (y + 2)) <= 4)) continue;
      // 길(모랫길)에서 두 칸 떼고, 숲에서 세 칸 안쪽 — 빈터 한가운데 혼자 서지 않게.
      let nearPath = false, nearForest = false;
      for (let dy = -2; dy <= 5; dy += 1) for (let dx = -2; dx <= 4; dx += 1) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= map.height) continue;
        const ii = yy * W + xx;
        if (tags(map.lowerTiles[ii]).includes("sand")) nearPath = true;
        if (layers.some((l) => isTreeish(l?.[ii]))) nearForest = true;
      }
      if (nearPath || !nearForest) continue;
      try {
        exec(project, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-swamp-stilt-snag", mapId, x, y });
        anchors.push({ x, y });
        for (const [dx, dy, id] of [[3, 3, "bd-pick-deep-forest-path-stump"], [-1, 3, "bd-pick-volcano-cave-coal-pile"]] as const) {
          try { exec(project, "stamp_object", { objectId: `kit:beodeul_city/${id}`, mapId, x: x + dx, y: y + dy }); } catch { /* 곁가지 — 자리 없으면 건너뛴다 */ }
        }
      } catch { /* 도장이 거절 — 다음 자리 */ }
    }
  }
}

const DAWN: { kept: { x: number; y: number; w: number; h: number; kitId?: string }; entry: Cell; front: Cell } = { kept: { x: 0, y: 0, w: 0, h: 0 }, entry: { x: 0, y: 0 }, front: { x: 0, y: 0 } };

function dawnwellEvents(project: Project): void {
  const town = M(project, FS2_DAWNWELL_ID);
  const k = DAWN.kept;
  // 남은 집의 문 — 문 앞 칸 바로 위(문 그림 칸). 그 칸에 원본 이벤트가 있으면 대신한다.
  const door: Cell = { x: DAWN.front.x, y: DAWN.front.y - 1 };
  const doorY = door.y;
  town.events = town.events.filter((e) => !(e.x === door.x && e.y === door.y));
  // 기억 셋(Q7) — 마을 터 세 곳. 다 보면 잠긴 문을 연다.
  const mems: { at: Cell; lines: [string, string][] }[] = [
    { at: { x: Math.max(2, k.x - 6), y: Math.min(town.height - 3, doorY + 4) }, lines: [["", "그을린 우물 둘레에 작은 손자국이 찍혀 있다."], [ELENA, "아이가… 여기서 물을 마셨나 봐."]] },
    { at: { x: Math.min(town.width - 3, k.x + k.w + 5), y: Math.min(town.height - 3, doorY + 3) }, lines: [["", "잿더미에 반쯤 묻힌 종이 등.\n물에 띄우는 등이다."], [KAEL, "대답의 등이야. 여기서도 띄웠구나."]] },
    { at: { x: door.x, y: Math.min(town.height - 3, doorY + 7) }, lines: [["", "길 한가운데 잿더미에 장갑 한 짝.\n안쪽에 실로 「ㅅ」을 떠 놓았다."], [KAEL, "…발렌 장갑이랑 같은 실이야."]] },
  ];
  mems.forEach((m, i) => {
    const id = `ev_fs2_dawn_mem_${i}`;
    addEvent(town, id, "새벽샘의 흔적", m.at, [
      page(`${id}_p`, "흔적", [], [...m.lines.map(([who, body]) => who ? say(who, body) : narrate(body)), setSw(SW_MEMS[i]!)], { priority: "below" }),
    ]);
  });
  const allMems: Condition[] = SW_MEMS.map((id) => sw(id));
  addEvent(town, "ev_fs2_dawn_door", "바깥에서 잠긴 문", door, [
    page("ev_fs2_dawn_door_p", "잠긴 문", [], [
      narrate("혼자 무너지지 않은 집.\n빗장이 바깥에 걸려 있다."),
      narrate("문 아래쪽, 아이 키 높이에 작은 주먹 자국 셋."),
      say(ELENA, "문이 바깥에서 잠겨 있었어.\n안에 있던 사람이 못 나오게."),
      say(KAEL, "…마을부터 둘러보자."),
    ]),
    page("ev_fs2_dawn_door_open", "빗장을 연다", [...allMems, sw(SW_CERT, false)], [
      cutBegin(),
      se("cc0-se-osx-door-open"),
      narrate("빗장을 들어 올렸다. 서른 해 만에 문이 열렸다."),
      narrate("안은 텅 비어 있다. 탁자 위에 반쯤 탄 종이 한 장."),
      se("cc0-se-orp-inventory-cloth"),
      item(FS2_CERT_ITEM, 1),
      narrate("「반쯤 탄 정착 확인서」를 얻었다.", { context: "system" }),
      say(ELENA, "천문대 서랍에 있던 양식이랑 같아.\n서명란에… 「기록자 세린」."),
      say(ELENA, "그 밑에 아이 글씨가 있어.\n「엄마 문 열어」."),
      say(KAEL, "대답하려던 사람을 가둔 거야.\n…규약 넷째 줄 때문에."),
      emote("player", "ellipsis", 900),
      say(ELENA, "「ㅅ」. 장갑 안쪽 첫 획이랑 같아."),
      setSw(SW_CERT),
      cutLabel(),
      cutEnd(),
    ]),
    page("ev_fs2_dawn_door_after", "빈 집", [sw(SW_CERT)], [narrate("빈 집이다. 재 냄새만 남았다.")]),
  ]);
  void DAWN.entry;
}

// ════════════════════════════════════════════════════════════════════
// 9. B6 새라 — 북방 관문 요새: 새벽샘 북쪽 → 요새(경비견·순찰 기사) → 성벽 위 새라 + 경비견 둘. 지면 감방에서 다시. 이기면 선택 1, 합류.
// ════════════════════════════════════════════════════════════════════

export const FS2_FORTRESS_ID = "fs2_fortress";
export const FS2_SARAH_ACTOR = "actor_fs2_sarah";
const FS2_SARAH_ENEMY = "enemy_fs2_sarah";
const FS2_FORT_DOG = "enemy_fs2_fort_dog";
const FS2_SARAH_TROOP = "troop_fs2_sarah";
const FS2_CROSSBOW = "enemy_fs2_fort_crossbow";
const FS2_CROSSBOW_TROOP = "troop_fs2_fort_crossbows";
const FS2_FORT_DOGS = "troop_fs2_fort_dogs";
const SW_SARAH = "sw_fs2_sarah_joined";
const SW_SPEAR_BACK = "sw_fs2_spear_returned";
const SW_SPEAR_KEPT = "sw_fs2_spear_kept";
const SW_SARAH_LOST = "sw_fs2_sarah_lost_once";
const VAR_BOND_SARAH = "var_fs2_bond_sarah";
const FS2_STAR_IRON = "item_fs2_star_iron";
const SARAH = "새라";
/** 새라 걷기 칩 — Actor1 #3(붉은 갑옷 창기사). 새 사람 그림은 만들지 않는다. */
const SARAH_CHIP: [string, number] = ["tex_easyrpg_charset_actor1", 3];
/** 요새 방(author_dungeon rooms 문법) — 성문 홀 → 안뜰 → (감방·무기고) → 계단 홀 → 성벽 위. */
/** 2층 요새(계획 B6): 1층 정문 → 안뜰 → 감방·무기고 → 계단 홀 / 2층 막사(레버) → 성벽 위 결투장. */
const FORT_FLOORS = [
  [{ id: "gate", kind: "entrance" }, { id: "yard", kind: "hall" }, { id: "cells", kind: "cell", from: "yard" },
    { id: "armory", kind: "storage", from: "yard" }, { id: "stair", kind: "hall" }],
  [{ id: "landing", kind: "entrance" }, { id: "barracks", kind: "storage" }, { id: "watch", kind: "hall", from: "landing" }, { id: "rampart", kind: "boss", from: "watch" }],
];
export const FS2_FORT_TOP_ID = "fs2_fortress_f2";
/** 새벽샘 북쪽 맵 끝 요새 입구 칸(돌길 북쪽, 나무 덤불 서쪽). */
const FORT_GATE: Cell = { x: 24, y: 0 };
type FortRoom = { id: string; kind: string; x: number; y: number; w: number; h: number; spots: Cell[] };
const FORT: { sarah: Cell; cell: Cell; rooms: FortRoom[]; top: FortRoom[] } = { sarah: { x: 0, y: 0 }, cell: { x: 0, y: 0 }, rooms: [], top: [] };

// ── 새라의 기술·직업·연계기 (계획 4-2) ──────────────────────────────
const FS2_LANCER_CLASS = "class_fs2_lancer";
export const FS2_SKILL_PIERCE = "skill_fs2_pierce_lance";
export const FS2_SKILL_HOLD = "skill_fs2_hold_line";
export const FS2_SKILL_COVER = "skill_fs2_cover";
/** 유대 3 에 새라가 배우는 기술 — 쌍창 돌파의 열쇠. */
const FS2_SKILL_HEADS_UP = "skill_fs2_heads_up";
/** 유대 3 에 엘레나가 배우는 기술 — 불꽃 십자참·겹의 열쇠. */
const FS2_SKILL_EMBER_KEEP = "skill_fs2_ember_keep";
export const FS2_COMBO_TWIN_LANCE = "combo_fs2_twin_lance";
export const FS2_COMBO_THUNDER_LANCE = "combo_fs2_thunder_lance";
export const FS2_COMBO_EMBER_WALL = "combo_fs2_ember_wall";
export const FS2_COMBO_FROST_STARS = "combo_fs2_frost_stars";
export const FS2_COMBO_FLAME_CROSS_TWIN = "combo_fs2_flame_cross_twin";
const PIERCED = "state_fs_pierced";

function sarahKit(project: Project, exec: Exec): void {
  exec(project, "upsert_skill", { skill: {
    id: FS2_SKILL_PIERCE, name: "꿰뚫는 창", scope: "enemy", type: "normal", power: 72, variance: 12, hitRate: 98, criticalRate: 15,
    description: "창끝에 온 체중을 싣는다. 단단한 적도 꿰뚫어 「관통상」을 남긴다.",
    mpCost: { flat: 4, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "hp" }, elementId: "spear",
    stateEffects: [{ stateId: PIERCED, chance: 100, operation: "add" }], animationId: "anim_gen_slash_steel", retroChoreographyId: "skill_dragoon_lance_thrust",
  } });
  exec(project, "upsert_skill", { skill: {
    id: FS2_SKILL_HOLD, name: "막아서기", scope: "self", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "창을 가로로 들고 앞을 막아선다. 3턴 동안 적의 공격을 새라가 받아 내고 방어가 오른다.",
    mpCost: { flat: 3, percentMax: 0 }, effect: { kind: "support" },
    stateEffects: [{ stateId: "state_taunt", chance: 100, operation: "add" }, { stateId: "state_defense_up", chance: 100, operation: "add" }],
    animationId: "anim_gen_power_aura", retroChoreographyId: "skill_guard_taunt",
  } });
  const cover = project.database.skills.find((s) => s.id === "skill_motion_cover");
  exec(project, "upsert_skill", { skill: {
    id: FS2_SKILL_COVER, name: "감싸기", scope: "self", type: "normal", power: 20, variance: 10, hitRate: 96,
    description: "동료 앞으로 몸을 던진다. 2턴 동안 동료 하나를 노린 공격을 새라가 대신 맞는다.",
    mpCost: { flat: 6, percentMax: 0 }, effect: { kind: "support" }, stateEffects: [],
    ...(cover?.battleGimmick ? { battleGimmick: cover.battleGimmick } : {}), retroChoreographyId: "chor_builtin_cover",
  } });
  exec(project, "upsert_skill", { skill: {
    id: FS2_SKILL_HEADS_UP, name: "고개 들어라", scope: "ally", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "새라의 말버릇. 동료 어깨를 툭 쳐 공격을 올린다. 익히면 카엘과의 「쌍창 돌파」가 열린다.",
    mpCost: { flat: 4, percentMax: 0 }, effect: { kind: "support" }, stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }],
    animationId: "anim_gen_power_aura",
  } });
  exec(project, "upsert_skill", { skill: {
    id: FS2_SKILL_EMBER_KEEP, name: "불씨 지키기", scope: "ally", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "손바닥 불씨를 동료에게 건네 몇 턴 동안 조금씩 회복시킨다. 익히면 카엘과의 「불꽃 십자참·겹」이 열린다.",
    mpCost: { flat: 6, percentMax: 0 }, effect: { kind: "support" }, stateEffects: [{ stateId: "state_regen", chance: 100, operation: "add" }],
    animationId: "anim_gen_power_aura",
  } });
  // 창기사 — 용기사 레코드를 복사해 습득표만 북문 기사답게 바꾼다(용 숨결·용혼 대신 막아서기·감싸기).
  // 직업 능력치 곡선은 직업 변경 뒤에만 쓰이고, 새라의 전투 능력치는 배우 곡선이 정한다.
  const dragoon = project.database.classes.find((c) => c.id === "class_dragoon");
  if (!dragoon) throw new Error("[fallen-star act2] class_dragoon 이 없다");
  const lancer = JSON.parse(JSON.stringify(dragoon)) as Rec;
  exec(project, "upsert_class", { class: {
    ...lancer, id: FS2_LANCER_CLASS, name: "창기사",
    learnedSkills: [
      { level: 1, skillId: "skill_attack" }, { level: 1, skillId: FS2_SKILL_PIERCE }, { level: 1, skillId: FS2_SKILL_HOLD },
      { level: 1, skillId: "skill_dragoon_jump" }, { level: 12, skillId: FS2_SKILL_COVER }, { level: 15, skillId: "skill_dragoon_sweeping_lance" },
      { level: 18, skillId: "skill_dragoon_high_jump" },
    ],
  } });
}

function sarahCombos(project: Project, exec: Exec): void {
  const HERO = "actor_hero", MAGE = "actor_fs_elena", GUNNER = "actor_fs_iris";
  // 듀얼 — 카엘+새라. 새라 유대 3(고개 들어라)이 열쇠.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_TWIN_LANCE, name: "쌍창 돌파",
    description: "카엘의 돌진 찌르기와 새라의 꿰뚫는 창이 한 점에 꽂힌다. 단일 2타, 「관통상」 확정.",
    actorIds: [HERO, FS2_SARAH_ACTOR],
    requires: [{ actorId: HERO, skillId: "skill_hero_rush_pierce" }, { actorId: FS2_SARAH_ACTOR, skillId: FS2_SKILL_HEADS_UP }],
    mpCosts: [{ actorId: HERO, mp: 4 }, { actorId: FS2_SARAH_ACTOR, mp: 5 }],
    scope: "enemy", kind: "damage", statistic: "attack", power: 66, elementId: "spear", hits: 2,
    stateEffects: [{ stateId: PIERCED, chance: 100, operation: "add" }],
    choreographyId: "skill_hero_rush_pierce",
  });
  // 듀얼 — 엘레나+새라. 새라가 앞을 막는 동안 엘레나의 불이 창날에 감긴다.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_EMBER_WALL, name: "불씨 창벽",
    description: "새라가 창을 세우고 엘레나가 그 창날에 불을 감는다. 아군 전체에 「반격」. 맞으면 불로 되받아친다.",
    actorIds: [MAGE, FS2_SARAH_ACTOR],
    requires: [{ actorId: MAGE, skillId: "skill_mage_fireball" }, { actorId: FS2_SARAH_ACTOR, skillId: FS2_SKILL_HOLD }],
    mpCosts: [{ actorId: MAGE, mp: 6 }, { actorId: FS2_SARAH_ACTOR, mp: 4 }],
    scope: "allAllies", kind: "support",
    stateEffects: [{ stateId: "state_counter", chance: 100, operation: "add" }, { stateId: "state_defense_up", chance: 100, operation: "add" }],
    choreographyId: "skill_guard_counter",
  });
  // 듀얼 — 새라+이리스(이리스가 돌아온 뒤). 창에 전격을 실어 꽂는다.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_THUNDER_LANCE, name: "뇌창",
    description: "이리스의 광선이 새라의 창끝에 번개를 싣는다. 적 하나에 번개 피해. 기계에게 특히 잘 듣는다.",
    actorIds: [FS2_SARAH_ACTOR, GUNNER],
    requires: [{ actorId: FS2_SARAH_ACTOR, skillId: FS2_SKILL_PIERCE }, { actorId: GUNNER, skillId: "skill_gunner_shot" }],
    mpCosts: [{ actorId: FS2_SARAH_ACTOR, mp: 5 }, { actorId: GUNNER, mp: 5 }],
    scope: "enemy", kind: "damage", statistic: "attack", power: 90, elementId: "thunder",
    stateEffects: [{ stateId: PIERCED, chance: 60, operation: "add" }],
    choreographyId: "skill_mage_chain_lightning",
  });
  // 트리플 — 엘레나+새라+이리스. 회수자 3단계의 열쇠.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_FROST_STARS, name: "서리 별무리",
    description: "엘레나의 눈보라에 새라의 창과 이리스의 광선이 별처럼 박힌다. 적 전체 얼음, 「관통상」 60%·둔화 확정.",
    actorIds: [MAGE, FS2_SARAH_ACTOR, GUNNER],
    requires: [{ actorId: MAGE, skillId: "skill_mage_blizzard" }, { actorId: FS2_SARAH_ACTOR, skillId: FS2_SKILL_PIERCE }, { actorId: GUNNER, skillId: "skill_gunner_snipe" }],
    mpCosts: [{ actorId: MAGE, mp: 9 }, { actorId: FS2_SARAH_ACTOR, mp: 6 }, { actorId: GUNNER, mp: 6 }],
    scope: "allEnemies", kind: "damage", statistic: "mind", power: 64, elementId: "ice", combinedStats: true,
    stateEffects: [{ stateId: PIERCED, chance: 60, operation: "add" }, { stateId: "state_agility_down", chance: 100, operation: "add" }],
    choreographyId: "skill_ranger_storm_arrow",
  });
  // 듀얼 — 카엘+엘레나 강화판. 엘레나 유대 3(불씨 지키기)이 열쇠.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_FLAME_CROSS_TWIN, name: "불꽃 십자참·겹",
    description: "엘레나가 지켜 온 불씨를 카엘의 검에 통째로 옮긴다. 불 속성 3타 + 화상 확정.",
    actorIds: [HERO, MAGE],
    requires: [{ actorId: HERO, skillId: "skill_hero_cross_slash" }, { actorId: MAGE, skillId: FS2_SKILL_EMBER_KEEP }],
    mpCosts: [{ actorId: HERO, mp: 4 }, { actorId: MAGE, mp: 7 }],
    scope: "enemy", kind: "damage", statistic: "attack", power: 58, elementId: "fire", hits: 3,
    stateEffects: [{ stateId: "fs_state_burn", chance: 100, operation: "add" }],
    choreographyId: "skill_hero_cross_slash",
  });
}

function northFortress(project: Project, exec: Exec, hubId: string): void {
  for (const [id, name] of [[SW_SARAH, "B6: 새라 합류"], [SW_SPEAR_BACK, "B6 선택1: 창을 돌려줬다"], [SW_SPEAR_KEPT, "B6 선택1: 창을 맡아 뒀다"], [SW_SARAH_LOST, "B6: 성벽 위에서 한 번 졌다"]] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_item", { item: {
    id: FS2_STAR_IRON, name: "별쇠 조각", type: "special", occasion: "never", consumable: false, price: 0,
    description: "새라의 창끝에서 떼어 낸 별쇠. 로한이라면 창을 한 번 더 벼릴 수 있다.",
  } });
  sarahKit(project, exec);
  // 새라 — 창기사(꿰뚫는 창·막아서기는 합류 때, 감싸기는 합류 +4). 합류 Lv8 = 새라에게 닿는 파티(Lv8, 요새를 다 싸우면 9).
  // 능력치 곡선은 카엘 곡선을 따라간다(HP 6% 많고 방어 +3, 마력 −6) — 예전엔 직업 기본 곡선이라 Lv10 공격 95(카엘 1.8배)였다.
  // 경험 곡선도 파티와 같게(예전 값 1/677/40 은 다른 동료와 레벨이 따로 놀았다).
  const hero = project.database.actors.find((a) => a.id === "actor_hero");
  if (!hero?.parameterCurves || !hero.expCurve) throw new Error("[fallen-star act2] 카엘 곡선이 없다");
  const hc = hero.parameterCurves as unknown as Record<string, number[]>;
  const tweak: Record<string, (v: number) => number> = { maxHp: (v) => Math.round(v * 1.06), defense: (v) => v + 3, mind: (v) => Math.max(1, v - 6) };
  const sarahCurves = Object.fromEntries(Object.entries(hc).map(([k, arr]) => [k, arr.map((v) => (tweak[k] ?? ((x: number) => x))(v))]));
  exec(project, "upsert_actor", { actor: {
    id: FS2_SARAH_ACTOR, name: SARAH, nickname: "북문의 창", classId: FS2_LANCER_CLASS, initialLevel: 8, maxLevel: 99,
    faceResourceId: "easyrpg-faceset-actor1-03", characterResourceId: "easyrpg-charset-actor1", characterIndex: 3,
    battleCharacterResourceId: "charset-battler-actor1-3",
    parameterCurves: sarahCurves, expCurve: hero.expCurve,
    initialEquipment: { weapon: "equip_gen_spear_iron", armor: "equip_leather_armor", helmet: "equip_traveler_hat" },
    learnedSkills: [],
  } });
  sarahCombos(project, exec);
  // 적 판 새라·요새 경비견·쇠뇌병 — 1막 창병·B5 들개·병사 레코드를 복사해 그림·능력치만 바꾼다.
  // 모의전(n=40, 카엘+엘레나 Lv8, 카엘 로한의 창, 2026-10-28): 새라+경비견 — 기술 자동 전투 승 100%·파티 행동 11.7(≈6턴)·회복약 1.1·남은 HP 39%,
  //   통상 공격만이면 0% — 기술(엘레나 불·카엘 돌진 찌르기)을 써야 이기는 보스. 지면 요새 감방에서 다시(게임 오버 아님).
  //   VQA 표의 HP ~900 은 6~8턴을 못 채웠다(4턴) — 턴 목표를 따라 1400.
  copyEnemy(project, exec, "enemy_fs_valen_spearman", {
    id: FS2_SARAH_ENEMY, name: SARAH, level: 10, monsterResourceId: "charset-battler-actor1-3",
    stats: { maxHp: 1400, maxMp: 60, attack: 66, defense: 50, mind: 30, agility: 64 },
    skillIds: ["skill_attack", "skill_dragoon_lance_thrust", "skill_fs_taunt"],
    actions: [act("skill_attack", 6), act("skill_dragoon_lance_thrust", 5), act("skill_fs_taunt", 3)],
    rewards: { exp: 450, gold: 0, dropRatePercent: 0, drops: [] },
  });
  // 요새 적 경험치는 낮게 — 다 싸워도 새라 앞에서 Lv9 를 넘지 않게(피해 가면 Lv8). 경비견 둘 70 · 기사 둘 120 · 쇠뇌병 둘 90 · 수문장 95.
  copyEnemy(project, exec, "enemy_fs2_starved_dog", {
    id: FS2_FORT_DOG, name: "요새 경비견", level: 8, stats: { maxHp: 200, maxMp: 0, attack: 80, defense: 28, mind: 20, agility: 72 },
    rewards: { exp: 35, gold: 10, dropRatePercent: 0, drops: [potionDrop(8)] },
  });
  copyEnemy(project, exec, "enemy_fs2_watchman", {
    id: FS2_CROSSBOW, name: "요새 쇠뇌병", level: 8, monsterResourceId: "charset-battler-actor1-2",
    stats: { maxHp: 180, maxMp: 0, attack: 82, defense: 26, mind: 10, agility: 66 },
    rewards: { exp: 45, gold: 16, dropRatePercent: 0, drops: [potionDrop(10)] },
  });
  const stone = { previewBackgroundResourceId: "battle-scenery-cave" };
  exec(project, "upsert_troop", { troop: { id: FS2_FORT_DOGS, name: "요새 경비견", enemyIds: [FS2_FORT_DOG, FS2_FORT_DOG], ...stone } });
  exec(project, "upsert_troop", { troop: { id: FS2_KNIGHT_TROOP, name: "순찰 기사", enemyIds: [FS2_FORT_KNIGHT, FS2_FORT_KNIGHT], ...stone } });
  exec(project, "upsert_troop", { troop: { id: FS2_GATE_CAPTAIN_TROOP, name: "요새 수문장", enemyIds: [FS2_FORT_KNIGHT, FS2_FORT_DOG], ...stone } });
  exec(project, "upsert_troop", { troop: { id: FS2_CROSSBOW_TROOP, name: "요새 쇠뇌병", enemyIds: [FS2_CROSSBOW, FS2_CROSSBOW], ...stone } });
  // 성벽 위 결투 — 바깥 하늘 아래(들판 그림 + 밤 겹). 새라 + 경비견 하나(VQA 2차: 개 둘이면 Lv8 파티가 전멸).
  exec(project, "upsert_troop", { troop: { id: FS2_SARAH_TROOP, name: "성벽 위의 새라", enemyIds: [FS2_SARAH_ENEMY, FS2_FORT_DOG], uncapturable: true,
    previewBackgroundResourceId: "battle-scenery-plains", backdropLayers: [{ preset: "night", opacity: 65 }, { preset: "clouds", opacity: 45 }] } });
  exec(project, "upsert_troop_battle_page", { troopId: FS2_SARAH_TROOP, page: {
    id: "fs2_sarah_open", name: "새라 — 시작", span: "battle", conditions: [{ kind: "onRound", round: 1 }],
    commands: [say(SARAH, "물지는 마라. 넘어뜨리기만 해."), say(ELENA, "개부터 떼어 놓자!\n새라 씨 창은 길어. 너무 붙지 마!")],
  } });
  exec(project, "upsert_troop_battle_page", { troopId: FS2_SARAH_TROOP, page: {
    id: "fs2_sarah_half", name: "새라 — 반", span: "battle", conditions: [{ kind: "enemyHpBelow", enemyId: FS2_SARAH_ENEMY, percent: 50 }],
    commands: [say(SARAH, "…그 창, 아버지가 벼린 거지.\n손잡이 무늬가 내 창이랑 같아."), say(KAEL, "네. 아저씨가 새라 씨 걱정을 많이 하셨어요.")],
  } });
  // 새벽샘 북쪽 — 돌길에서 맵 끝까지 흙길을 내 요새 입구로 이끈다(풀밭 한가운데 출구로 보이지 않게).
  // paint_road dirt 는 버들항 칩셋에서 검은 칸 기둥으로 찍혔다(v1.25 VQA) — 그을린 마당 흙 칸으로 직접 깐다.
  {
    const town = M(project, FS2_DAWNWELL_ID);
    const yard = kitCenterTile(project, town.tilesetId, "bd-pick-mining-valley-ground-yard");
    for (let y = 0; y <= 6; y += 1) {
      const i = y * town.width + FORT_GATE.x;
      town.lowerTiles[i] = yard;
      town.upperTiles[i] = -1;
      if (town.lowerOverlayTiles) town.lowerOverlayTiles[i] = -1;
    }
  }
  // 요새 — 새벽샘 북쪽 길 끝. 2층으로 짓고(층마다 방 목록), 2층 성벽 위 결투장 앞을 레버 쇠창살로 막는다.
  // 보이는 적(경비견)·상자·쉼터·1층 수문장(경비 병사+창병)은 도구가 채운다. 사람 순찰·쇠뇌병은 아래에서 칩을 주고 따로 놓는다.
  const d = exec(project, "author_dungeon", {
    type: "castle", adapter: "beodeul", genre: "rpg", name: "북방 관문 요새", id: FS2_FORTRESS_ID, floors: 2, direction: "up", floorRooms: FORT_FLOORS,
    populate: true, troops: { field: [FS2_FORT_DOGS], midBoss: FS2_GATE_CAPTAIN_TROOP, boss: FS2_FORT_DOGS }, gimmick: "lever", gateStyle: "portcullis",
    entrance: { fromMapId: FS2_DAWNWELL_ID, x: FORT_GATE.x, y: FORT_GATE.y }, seed: 61,
  }) as { floors?: string[]; floorData?: { rooms?: FortRoom[] }[] } | undefined;
  if (d?.floors?.[1] !== FS2_FORT_TOP_ID) throw new Error(`[fallen-star act2] 요새 2층 id 가 ${FS2_FORT_TOP_ID} 가 아니다(${d?.floors?.join(",")})`);
  FORT.rooms = d.floorData?.[0]?.rooms ?? [];
  FORT.top = d.floorData?.[1]?.rooms ?? [];
  const top = M(project, FS2_FORT_TOP_ID);
  // 도구가 성벽 위 보스방에 둔 경비견 보스 자리에 새라가 선다(보스 전투는 새라 이벤트가 연다).
  const boss = top.events.find((e) => e.id === `ev_${FS2_FORT_TOP_ID}_boss`);
  const rampart = FORT.top.find((r) => r.id === "rampart");
  if (!rampart) throw new Error("[fallen-star act2] 요새 성벽 방이 없다");
  FORT.sarah = boss ? { x: boss.x, y: boss.y } : rampart.spots[0]!;
  top.events = top.events.filter((e) => e.id !== `ev_${FS2_FORT_TOP_ID}_boss`);
  const cells = FORT.rooms.find((r) => r.id === "cells");
  if (!cells) throw new Error("[fallen-star act2] 요새 감방이 없다");
  FORT.cell = { x: cells.x + 1, y: cells.y + cells.h - 2 };
  for (const mapId of [FS2_FORTRESS_ID, FS2_FORT_TOP_ID]) {
    // 날씨는 맵을 넘어 남는다 — 새벽샘 안개가 요새 안까지 따라 들어왔다(QA). 요새는 맑게. 성벽 위는 바깥 바람이라 조금 더 밝다.
    exec(project, "set_scene_mood", { mapId, applyMode: "map", weather: { kind: "none" }, lighting: { ambient: mapId === FS2_FORT_TOP_ID ? 0.4 : 0.55, color: "#40485a" } });
    // 돌 요새 안 싸움 — 풀밭 배경 대신 돌 배경(측면 전투 겹 배경 종류에 성채가 없어 동굴 돌벽이 가장 가깝다).
    exec(project, "set_map_properties", { mapId, battleBackground: "battle-scenery-cave" });
  }
  // 순찰 기사 — 2막에서 처음 맞닥뜨리는 기사(난이도 곡선: 왕도엔 야경꾼뿐). 1층 안뜰·계단 홀에 하나씩. 보면 몰아쳐 온다(detection 돌진).
  // 쇠뇌병 — 2층 막사·망루 홀에 고정 보초. 이기면 다시 안 나온다.
  const knight = hubChip(project, hubId, "ev_fs_knight");
  let k = 0;
  const post = (mapId: string, rooms: FortRoom[], roomIds: string[], want: number, args: (n: number) => Record<string, unknown>): void => {
    let count = 0;
    let why = "빈 자리 없음";
    for (const room of roomIds) {
      if (count >= want) break;
      let placed = false;
      for (const near of [3, 2]) {
        for (const at of rooms.find((r) => r.id === room)?.spots ?? []) {
          // 경비견·상자·레버 곁은 피한다 — 붙어 서면 한 무리로 읽힌다(3칸, 자리가 없으면 2칸).
          if (M(project, mapId).events.some((e) => e.x + e.y > 0 && Math.max(Math.abs(e.x - at.x), Math.abs(e.y - at.y)) <= near)) continue;
          try {
            exec(project, "place_field_enemy", { mapId, x: at.x, y: at.y, graphic: knight, alert: "exclamation", respawnSec: 0, clearSwitchId: `sw_fs2_fort_knight_${k}_down`, checkpointOnEntry: true, ...args(k) });
            k += 1;
            count += 1;
            placed = true;
            break;
          } catch (e) { why = String((e as Error).message).slice(0, 200); /* 그 칸은 도구가 거절 — 다음 자리 */ }
        }
        if (placed) break;
      }
    }
    if (count === 0) throw new Error(`[fallen-star act2] ${mapId} 에 보초를 하나도 못 세웠다(${roomIds.join("·")}): ${why}`);
  };
  post(FS2_FORTRESS_ID, FORT.rooms, ["yard", "stair"], 2, (n) => ({
    troopId: FS2_KNIGHT_TROOP, behavior: "chase", patrol: { length: 2, axis: n % 2 ? "vertical" : "horizontal" },
    sightRange: 5, vision: "cone", pace: "normal", approachStyle: "dash",
  }));
  post(FS2_FORT_TOP_ID, FORT.top, ["watch", "barracks", "landing"], 2, () => ({
    troopId: FS2_CROSSBOW_TROOP, behavior: "chase", sightRange: 7, vision: "cone", coneDegrees: 70, alertMs: 450, chaseStepMs: 200, approachStyle: "dash",
  }));
  fortressDress(project, exec);
}

/**
 * 요새 방마다 쓰임새(v1.25 VQA: 2층 결투장이 왕좌·붉은 융단 알현실이었고, 1층 방들이 다 같은 빈 돌방이었다).
 * - 2층 성벽 위(rampart): 옥좌·융단·갑옷 거치대를 걷어 내고 봉화대 둘·돌 부스러기 더미 — 바람 부는 성벽 위 결투장.
 * - 1층 감방(cells): 볏짚 침상·바닥 쇠창살·양동이·매달린 새장. 무기고(armory): 갑옷 거치대 줄·모루 탁자·선반·통.
 * - 2층 막사(barracks): 짚 침상 줄·통·상자 더미.
 * 모두 버들항 칩셋에 있는 조각(새 그림 없음). 자리가 막히면 그 조각은 건너뛴다.
 */
function fortressDress(project: Project, exec: Exec): void {
  const tileset = project.tilesets[M(project, FS2_FORT_TOP_ID).tilesetId];
  const kits = new Map((tileset?.structureKits ?? []).map((k) => [k.id, k as unknown as { width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[] }]));
  const kitTiles = (ids: string[]): Set<number> => {
    const out = new Set<number>();
    for (const id of ids) for (const row of kits.get(id)?.rows ?? []) for (const t of [...row.tiles, ...(row.upperTiles ?? [])]) if (t >= 0) out.add(t);
    return out;
  };
  // ① 성벽 위 — 알현실 조각을 걷어 낸다. 걷은 칸은 그 방에서 가장 흔한 바닥 칸으로.
  const rampart = FORT.top.find((r) => r.id === "rampart");
  const top = M(project, FS2_FORT_TOP_ID);
  if (rampart) {
    const royal = kitTiles(["bd-pick-dungeon-theme-throne", "bd-pick-dungeon-theme-carpet-runner", "bd-pick-dungeon-theme-carpet-runner-3w", "bd-pick-desert-oasis-rug", "bd-pick-dungeon-theme-armor-stand", "bd-pick-castle-catacombs-iron-maiden"]);
    const floorCount = new Map<number, number>();
    for (let y = rampart.y; y < rampart.y + rampart.h; y += 1) for (let x = rampart.x; x < rampart.x + rampart.w; x += 1) {
      const i = y * top.width + x;
      const lo = top.lowerTiles[i] ?? -1;
      if (lo >= 0 && !royal.has(lo) && (top.upperTiles[i] ?? -1) < 0 && isPassable(project, top, x, y)) floorCount.set(lo, (floorCount.get(lo) ?? 0) + 1);
    }
    const floor = [...floorCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    let cleared = 0;
    if (floor !== undefined) for (let y = rampart.y - 1; y <= rampart.y + rampart.h; y += 1) for (let x = rampart.x - 1; x <= rampart.x + rampart.w; x += 1) {
      if (x < 0 || y < 0 || x >= top.width || y >= top.height) continue;
      const i = y * top.width + x;
      const hitLower = royal.has(top.lowerTiles[i] ?? -1), hitUpper = royal.has(top.upperTiles[i] ?? -1);
      if (!hitLower && !hitUpper) continue;
      if (hitLower) top.lowerTiles[i] = floor;
      top.upperTiles[i] = -1;
      if (top.upperOverlayTiles) top.upperOverlayTiles[i] = -1;
      cleared += 1;
    }
    if (!cleared) throw new Error("[fallen-star act2] 성벽 위에 걷어 낼 옥좌·융단이 없다(도구 장식이 바뀌었나?)");
  }
  const stampAt = (mapId: string, kitId: string, x: number, y: number): boolean => {
    const kit = kits.get(kitId);
    const map = M(project, mapId);
    if (!kit) return false;
    for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) {
      const cx = x + dx, cy = y + dy;
      if (cx < 1 || cy < 1 || cx >= map.width - 1 || cy >= map.height - 1 || !isPassable(project, map, cx, cy) || (map.upperTiles[cy * map.width + cx] ?? -1) >= 0) return false;
      if (map.events.some((e) => e.x + e.y > 0 && Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) return false;
    }
    try { exec(project, "stamp_object", { objectId: `kit:beodeul_city/${kitId}`, mapId, x, y }); return true; } catch { return false; }
  };
  /** 방 윗줄(벽에 등 댄 줄)을 왼쪽부터 훑으며 n 개, 아니면 방 안 아무 곳. */
  const along = (mapId: string, room: FortRoom | undefined, kitId: string, n: number, where: "north" | "south" | "any", step = 2): number => {
    if (!room) return 0;
    const kit = kits.get(kitId);
    if (!kit) return 0;
    let placed = 0;
    const rows = where === "north" ? [room.y] : where === "south" ? [room.y + room.h - kit.height] : Array.from({ length: room.h }, (_, i) => room.y + i);
    for (const y of rows) for (let x = room.x + 1; x + kit.width <= room.x + room.w - 1 && placed < n; x += 1) {
      if (stampAt(mapId, kitId, x, y)) { placed += 1; x += step - 1 + kit.width - 1; }
    }
    return placed;
  };
  const room1 = (id: string) => FORT.rooms.find((r) => r.id === id);
  const room2 = (id: string) => FORT.top.find((r) => r.id === id);
  if (rampart) {
    // 봉화대 둘 — 새라 자리 양옆 세 칸.
    for (const dx of [-3, 3]) stampAt(FS2_FORT_TOP_ID, "bd-pick-mountain-pass-brazier", FORT.sarah.x + dx, FORT.sarah.y - 1);
    // 무너진 성가퀴 돌 — 남쪽 모서리 한 덩이(같은 간격 흩뿌리지 않는다).
    const sx = rampart.x + rampart.w - 3, sy = rampart.y + rampart.h - 2;
    for (const [dx, dy, id] of [[0, 0, "bd-pick-castle-catacombs-rubble"], [1, 0, "bd-pick-mountain-pass-scree-a"], [0, -1, "bd-pick-mountain-pass-scree-b"]] as const) stampAt(FS2_FORT_TOP_ID, id, sx + dx, sy + dy);
  }
  // 감방 — 짚 침상·쇠창살·양동이·새장.
  along(FS2_FORTRESS_ID, room1("cells"), "bd-pick-castle-catacombs-straw-bed", 3, "south", 2);
  along(FS2_FORTRESS_ID, room1("cells"), "bd-pick-aqueduct-sewer-grate-floor", 1, "any", 3);
  along(FS2_FORTRESS_ID, room1("cells"), "bd-pick-aqueduct-sewer-bucket", 1, "any", 3);
  along(FS2_FORTRESS_ID, room1("cells"), "bd-pick-castle-catacombs-cage-hanging", 1, "north", 3);
  // 무기고 — 갑옷 거치대 줄·모루 탁자·선반·통.
  along(FS2_FORTRESS_ID, room1("armory"), "bd-pick-dungeon-theme-armor-stand", 3, "north", 1);
  along(FS2_FORTRESS_ID, room1("armory"), "bd-pick-castle-catacombs-anvil-table", 1, "any", 2);
  along(FS2_FORTRESS_ID, room1("armory"), "bd-pick-mining-valley-rack", 1, "north", 2);
  along(FS2_FORTRESS_ID, room1("armory"), "bd-pick-aqueduct-sewer-barrel", 2, "south", 0);
  // 2층 막사 — 짚 침상 줄·통·상자 더미.
  along(FS2_FORT_TOP_ID, room2("barracks"), "bd-pick-aqueduct-sewer-straw-bed", 4, "north", 1);
  along(FS2_FORT_TOP_ID, room2("barracks"), "bd-pick-mining-valley-crates", 1, "south", 2);
  along(FS2_FORT_TOP_ID, room2("barracks"), "bd-pick-aqueduct-sewer-barrel", 2, "south", 0);
}

function fortressEvents(project: Project): void {
  const fort = M(project, FS2_FORTRESS_ID);
  const top = M(project, FS2_FORT_TOP_ID);
  const sarahChip = chip(SARAH_CHIP[0], SARAH_CHIP[1], "down");
  const lose: Command[] = [
    fadeOut(900),
    { kind: "recoverAll" } as unknown as Command,
    setSw(SW_SARAH_LOST),
    transfer(FS2_FORTRESS_ID, FORT.cell, "up"),
    // 이동 뒤 명령은 돌지 않는다 — 감방 도착 장면은 감방 자동 이벤트가 맡는다.
  ];
  const win: Command[] = [
    cutBegin(),
    narrate("새라가 창을 내렸다. 개들이 그 발치에 엎드린다."),
    say(SARAH, "…졌다. 명령은 지켰고."),
    say(SARAH, "쇠 마차는 사흘 전에 여길 지나갔다.\n안에 탄 아이가 내내 뭘 쓰고 있더군. 공책에."),
    say(ELENA, "이리스 일지예요."),
    say(SARAH, "창살 사이로 한 줄 보여 주더라.\n「오늘은 아무도 대답하지 않았다」."),
    emote("player", "ellipsis", 900),
    say(SARAH, "그 창, 아버지가 너한테 줬구나.\n…나한텐 편지 한 줄 없더니."),
    { kind: "choices", prompt: "창을 어떻게 할까?", options: [
      { text: "창을 돌려준다", branch: [
        say(KAEL, "아저씨가 저한테 맡기신 건\n새라 씨한테 갖다주라는 뜻이었을 거예요."),
        say(SARAH, "…고개 들어라. 아버지 말버릇이야."),
        // 돌려준다 = 정말 돌려준다. 카엘은 1막 검으로 돌아가고 새라가 아버지 창을 든다(공격 40 을 내주고 유대 +1).
        { kind: "changeEquipment", actorId: "actor_hero", slot: "weapon", equipmentId: "equip_sword" } as unknown as Command,
        { kind: "changeEquipment", actorId: FS2_SARAH_ACTOR, slot: "weapon", equipmentId: FS2_ROHAN_SPEAR } as unknown as Command,
        narrate("카엘이 「로한의 별쇠 창」을 새라에게 건넸다.\n카엘은 손에 익은 검을 다시 들었다.", { context: "system" }),
        setSw(SW_SPEAR_BACK),
        { kind: "setVariable", variableId: VAR_BOND_SARAH, op: "+=", value: 1 } as unknown as Command,
        narrate("♥ 새라와의 유대가 깊어졌다.", { context: "system" }),
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_check" } as unknown as Command,
      ] },
      { text: "창을 맡아 둔다", branch: [
        say(KAEL, "북쪽까지는 제가 들고 갈게요.\n돌려드리는 건 그다음에."),
        say(SARAH, "…그래. 대신 내 창끝 별쇠는 떼어 가라.\n아버지라면 그걸로 네 창을 한 번 더 벼릴 거다."),
        se("cc0-se-orp-inventory-cloth"),
        item(FS2_STAR_IRON, 1),
        narrate("「별쇠 조각」을 받았다.", { context: "system" }),
        setSw(SW_SPEAR_KEPT),
      ] },
    ] } as unknown as Command,
    say(SARAH, "발렌 님한테 가는 길이면 나도 간다.\n물어볼 게 있어. 왜 날 북문에 세웠는지."),
    se("cc0-se-orp-inventory-cloth"),
    { kind: "changeParty", actorId: FS2_SARAH_ACTOR, action: "add" } as unknown as Command,
    narrate("새라가 동료가 되었다.", { context: "system" }),
    setSw(SW_SARAH),
    cutLabel(),
    cutEnd(),
    say(SARAH, "북문으로 가는 계단은 성벽 끝에 있다. 따라와."),
    fadeOut(900),
    transfer(FS2_SNOW.mapIds[0]!, FS2_SNOW.entry, "up"),
  ];
  addEvent(top, "ev_fs2_fort_sarah", SARAH, FORT.sarah, [
    page("ev_fs2_fort_sarah_p", "성벽 위의 새라", [], [
      cutBegin(),
      emote("ev_fs2_fort_sarah", "exclamation", 700),
      say(SARAH, "별지기 꼬마들. 여기서 돌아가라.\n명령이다. …내 명령이 아니라서 미안하다."),
      say(KAEL, "로한 아저씨가 전해 달래요.\n「고개 들어라」."),
      say(SARAH, "…그 말, 발렌 님이 늘 하던 말인데.\n아버지한테서 배운 거였구나."),
      say(SARAH, "그래도 길은 못 비켜 준다.\n할 말 있으면 창으로 해라."),
      cutLabel(),
      cutEnd(),
      { kind: "battleProcessing", troopId: FS2_SARAH_TROOP, canEscape: false, canLose: true, branchOnResult: true, victoryBranch: win, defeatBranch: lose, escapeBranch: [] } as unknown as Command,
    ], { graphic: sarahChip }),
    // 합류 뒤 — 새라가 서 있던 자리(성벽 위)에서 조사하면 북문 계단으로 나간다.
    page("ev_fs2_fort_sarah_gone", "북문 계단", [sw(SW_SARAH)], [
      narrate("성벽 끝에 북문으로 내려가는 좁은 계단이 있다."),
      transfer(FS2_SNOW.mapIds[0]!, FS2_SNOW.entry, "up"),
    ], { graphic: { transparent: true }, priority: "below" }),
  ]);
  // 졌을 때 — 요새 감방에서 깬다(게임 오버 아님). 창살 문은 새라가 열어 두었다.
  addEvent(fort, "ev_fs2_fort_cell_wake", "감방에서 깬다", { x: 0, y: 0 }, [
    page("ev_fs2_fort_cell_wait", "대기", [], [], { priority: "below" }),
    page("ev_fs2_fort_cell_run", "깬다", [sw(SW_SARAH_LOST)], [
      fadeIn(900),
      narrate("차가운 돌바닥. 요새 지하 감방이다."),
      say(ELENA, "…창살이 열려 있어. 일부러 안 잠갔나 봐."),
      say(KAEL, "한 번 더 가 보자. 이번엔 개부터."),
      setSw(SW_SARAH_LOST, false),
    ], { trigger: { kind: "auto" }, priority: "below" }),
  ]);
}

// ════════════════════════════════════════════════════════════════════
// 10. B7 서리 가도 — 요새 북문 → 설원 길 두 장(눈 → 눈보라), 얼음 틈 둘(새라 장대 도약), 고개 모닥불(유대 — 한 사람과 이야기)
// ════════════════════════════════════════════════════════════════════

export const FS2_SNOW: { mapIds: string[]; entry: Cell; back: Cell; exit: Cell | null; clearing: Cell } = { mapIds: [], entry: { x: 0, y: 0 }, back: { x: 0, y: 0 }, exit: null, clearing: { x: 0, y: 0 } };
const VAR_BOND_ELENA = "var_fs2_bond_elena";
/** 엘레나 필드 기술 — 얼음 덩이를 녹인다. */
const FS2_SKILL_EMBER_MELT = "skill_fs2_ember_melt";
/** 버들항 던전 「얼음 수정 덩이 1×2」 — 아래 칸(막힘)·윗머리. 칸 번호는 이름표로 찾는다. */
function iceBlockTiles(project: Project, mapId: string): { foot: number; head: number } {
  const meta = project.tilesets[M(project, mapId).tilesetId]?.tileMeta ?? [];
  const find = (label: string) => meta.findIndex((m) => m?.label === label);
  const foot = find("버들항 던전 · 얼음 수정 덩이 1×2 기본 (0,1)"), head = find("버들항 던전 · 얼음 수정 덩이 1×2 기본 (0,0)");
  if (foot < 0 || head < 0) throw new Error("[fallen-star act2] 버들항 칩셋에 얼음 수정 덩이가 없다");
  return { foot, head };
}
const SW_SNOW_ARRIVE = "sw_fs2_snow_arrived";

function snowPass(project: Project, exec: Exec): void {
  ensureSwitch(project, SW_SNOW_ARRIVE, "B7: 서리 가도에 들어섰다");
  const d = exec(project, "author_snow_route", {
    fromMapId: FS2_FORT_TOP_ID, side: "north", count: 2, names: ["서리 가도", "눈보라 고개"], moods: ["snow", "blizzard"],
    gapCount: 2, gapWidth: 1, paintGaps: true, linkFrom: false, openEnd: true, seed: 71,
  }) as { maps?: { mapId: string; entry: Cell; exit: Cell | null; clearing: Cell; gaps: { cells: Cell[]; from: Cell; to: Cell; seals: boolean }[] }[] } | undefined;
  const maps = d?.maps ?? [];
  if (maps.length < 2) throw new Error("[fallen-star act2] 설원 길이 두 장이 아니다");
  FS2_SNOW.mapIds = maps.map((m) => m.mapId);
  // 입구 칸(맵 남쪽 끝)은 요새로 돌아가는 칸 — 들어올 때는 그 한 칸 위에 선다.
  FS2_SNOW.back = maps[0]!.entry;
  FS2_SNOW.entry = { x: maps[0]!.entry.x, y: maps[0]!.entry.y - 1 };
  FS2_SNOW.exit = maps[1]!.exit;
  FS2_SNOW.clearing = maps[1]!.clearing;
  for (const m of maps) exec(project, "set_map_properties", { mapId: m.mapId, battleBackground: "battle-scenery-snow" });
  // 얼음 틈 — 새라가 파티에 있으면 창을 장대 삼아 뛰어넘는다(새 일반 기능: 틈 칠하기 + 배우 조건 도약).
  maps.forEach((m) => m.gaps.forEach((g, k) => {
    exec(project, "place_field_obstacle", {
      mapId: m.mapId, kind: "gap", x: g.from.x, y: g.from.y, requiresActorId: FS2_SARAH_ACTOR, id: `ev_fs2_snow_gap_${m.mapId}_${k}`, name: "얼음 틈",
      hint: "새라가 틈 앞에서 창을 고쳐 쥔다.\n「창을 짚고 넘으면 돼. 내 손 잡아.」", blockedText: "얼음이 길을 가로질러 쩍 갈라졌다.\n맨몸으로 뛰기엔 너무 넓다.",
    });
  }));
  // 얼음 덩이 — 첫 틈을 건넌 뒤 좁은 눈길을 막는다. 엘레나의 불씨로 녹인다(계획 4-3 불씨 녹이기, 필드 기술 게이트).
  // 틈 둘레는 도구가 길 칸만 남기고 숲으로 좁혀 두었다 — 착지 칸에서 두 줄 더 나아간 줄이 아직 그 좁은 목이다.
  const g0 = maps[0]!.gaps[0];
  if (!g0) throw new Error("[fallen-star act2] 서리 가도 첫 틈이 없다");
  const dx = g0.to.x - g0.from.x, dy = g0.to.y - g0.from.y;
  const fwd = Math.abs(dy) >= Math.abs(dx) ? { x: 0, y: Math.sign(dy) } : { x: Math.sign(dx), y: 0 };
  const ICE_BLOCK = iceBlockTiles(project, maps[0]!.mapId);
  let iced = false;
  for (const step of [1, 2, 3]) {
    try {
      exec(project, "place_field_obstacle", {
        mapId: maps[0]!.mapId, kind: "rock", x: g0.to.x + fwd.x * step, y: g0.to.y + fwd.y * step, fullWidth: true, direction: fwd.y !== 0 ? "right" : "down",
        tile: ICE_BLOCK.foot, tileAbove: ICE_BLOCK.head, requiresSkillId: FS2_SKILL_EMBER_MELT, skillName: "불씨 녹이기", machine: "none",
        id: "ev_fs2_snow_ice", name: "얼음 덩이",
        hint: "엘레나가 얼음에 손바닥을 대 본다.\n「불씨로 녹일 수 있겠어. 조금 걸려.」",
        blockedText: "길 한가운데 얼음 덩이가 솟아 있다.\n밀어도 꿈쩍 않는다.",
      });
      iced = true;
      break;
    } catch (e) { if (step === 3) throw e; }
  }
  if (!iced) throw new Error("[fallen-star act2] 얼음 덩이 자리가 없다");
  // 첫 맵 입구 — 요새 북문 계단으로 돌아간다(성벽 위 새라 자리 아래 칸).
  addEv(project, FS2_SNOW.mapIds[0]!, "ev_fs2_snow_back", "요새 북문", FS2_SNOW.back, [
    page("ev_fs2_snow_back_p", "요새로", [], [transfer(FS2_FORT_TOP_ID, { x: FORT.sarah.x, y: FORT.sarah.y + 1 }, "down")], { trigger: { kind: "playerTouch" }, priority: "below" }),
  ]);
  // 들어서면 한 번 — 이리스 없는 눈길.
  addEv(project, FS2_SNOW.mapIds[0]!, "ev_fs2_snow_arrive", "서리 가도", { x: 1, y: 0 }, [
    page("ev_fs2_snow_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_snow_arrive_run", "들어선다", [sw(SW_SARAH)], [
      // 요새에서 화면을 덮고(fadeOut) 넘어온다 — 여기서 걷어야 눈길이 보인다(검은 화면 대사, QA 2026-10-26).
      fadeIn(800),
      wait(300),
      say(SARAH, "이 바람엔 길이 안 보여."),
      say(KAEL, "그럼 별을 보고 가요. 저기, 북쪽 끝."),
      say(ELENA, "이리스가 있었으면 손끝에 불 켜 줬을 텐데."),
      say(KAEL, "그러니까 데리러 가는 거야."),
      say(ELENA, "…불이라면 나도 있어. 손바닥만 한 거지만."),
      { kind: "learnSkill", actorId: "actor_fs_elena", skillId: FS2_SKILL_EMBER_MELT, action: "learn" } as unknown as Command,
      narrate("이제 엘레나가 「불씨 녹이기」를 쓸 수 있다.\n길을 막은 얼음 덩이를 조사해 보자.", { context: "system" }),
      setSw(SW_SNOW_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    // 뒤 페이지가 이긴다 — 한 번 본 뒤에는 멈춘다.
    page("ev_fs2_snow_arrive_done", "끝", [sw(SW_SNOW_ARRIVE)], [], { priority: "below" }),
  ]);
  // 고개 위 바위 그늘 — 모닥불(설원 키트) 앞에서 한 사람과 이야기한다.
  // 빈터 둘레에서 눈길이 아닌 칸을 고른다(도구가 길 위·막힌 칸을 거절하면 다음 자리).
  const c0 = FS2_SNOW.clearing;
  let fire: Cell | null = null;
  for (const [dx, dy] of [[2, -2], [-3, -2], [2, 0], [-3, 0], [2, 2], [-3, 2], [0, -3], [0, 2]] as const) {
    const at = { x: c0.x + dx, y: c0.y + dy };
    try { exec(project, "stamp_tileset_object", { mapId: FS2_SNOW.mapIds[1]!, objectId: "bd-pick-snowfield-bonfire", at }); fire = at; break; } catch { /* 다음 자리 */ }
  }
  if (!fire) throw new Error("[fallen-star act2] 고개 모닥불 자리가 없다");
  exec(project, "configure_party_bonds", {
    members: [
      { actorId: "actor_fs_elena", variableId: VAR_BOND_ELENA, talk: ["불씨는 내가 지킬게. 넌 별이나 세.", "…이리스 몫까지 세 줘."] },
      { actorId: FS2_SARAH_ACTOR, variableId: VAR_BOND_SARAH, talk: ["아버지는 망치를 쥐라고 했어. 난 창을 골랐고.\n…그 뒤로 서로 말을 잘 안 했지.", "발렌 님이 날 북문에 세우면서 그러더라.\n「고개 들어라」. …아버지가 하던 말인데."] },
    ],
    // 모닥불과 여관 밤(B8 여관 주인)이 같은 장면을 쓴다 — 어느 불가에도 맞는 한 줄.
    intro: ["불가에 둘러앉는다. 장작이 탁 튄다."],
    // 유대 3 — 듀얼 연계기 해금(계획 4-4). 새라는 창을 돌려줬으면(B6 +1)·모닥불·장작(Q6)·여관 밤으로 닿는다.
    unlocks: [
      { actorId: FS2_SARAH_ACTOR, atLeast: 3, comboTechId: FS2_COMBO_TWIN_LANCE, message: "새라가 「고개 들어라」를 익혔다!\n카엘과의 연계기 「쌍창 돌파」가 열렸다." },
      { actorId: "actor_fs_elena", atLeast: 3, comboTechId: FS2_COMBO_FLAME_CROSS_TWIN, message: "엘레나가 「불씨 지키기」를 익혔다!\n카엘과의 연계기 「불꽃 십자참·겹」이 열렸다." },
    ],
    campfires: [{ mapId: FS2_SNOW.mapIds[1]!, x: fire.x, y: fire.y + 1, id: "ev_fs2_snow_fire", name: "모닥불" }],
  });
  // 적은 요새 → 설원 이동(새라 합류 뒤 transfer)이 생긴 뒤에 세운다 — 그 전엔 서리 가도 입구가 「걸어 닿지 못하는 칸」이라 도구가 거절했다.
  FS2_SNOW_PLAN.maps = maps.map((m) => ({ mapId: m.mapId, entry: m.entry, exit: m.exit, gaps: m.gaps.map((g) => g.cells) }));
  FS2_SNOW_PLAN.fire = fire;
}
const FS2_SNOW_PLAN: { maps: { mapId: string; entry: Cell; exit: Cell | null; gaps: Cell[][] }[]; fire: Cell } = { maps: [], fire: { x: 0, y: 0 } };

/**
 * B7 서리 가도의 적·갈림길 보물·얼음 틈 그늘(v1.25 VQA: 두 장이 같은 길로 보였고 적이 없었으며 틈이 얼음판으로 읽혔다).
 * 난이도 곡선 — 새라 합류 뒤 Lv9 셋이 싸운다. 서리늑대(Lv9, HP 240, 공 84, EXP 80)·서리박쥐(Lv9, HP 200, 민 92, 냉기 구슬, EXP 65).
 * 모의전(n=40, 카엘 Lv9 검·엘레나·새라): 박쥐 셋 승 100% / 통상 공격만 78%, 늑대+박쥐 둘 승 100% / 73%.
 * 무리 셋 모두 잡으면 EXP 160+195+210=565 — 요새 끝 Lv9(2629) 에서 탑 앞 Lv10(3252) 근처.
 * - 서리 가도(눈): 길 곁 막다른 빈터에 보물(불사조 깃) 하나, 그 앞을 박쥐 떼가 지킨다. 늑대 둘은 첫 굽이.
 * - 눈보라 고개: 서쪽 갈림 고리에 늑대+박쥐, 고개 위에 늑대 둘. 모닥불 곁은 비운다.
 * 얼음 틈 칸은 그림자로 덮고 앞뒤 칸 절반을 어둡게 — 길을 가로지르는 검은 금으로 읽힌다(새 그림 없음).
 */
const FS2_FROST_WOLF = "enemy_fs2_frost_wolf";
const FS2_FROST_BAT = "enemy_fs2_frost_bat";
const FROST_LAYERS = [{ preset: "snow" }, { preset: "mist", opacity: 50 }];
function frostFoes(project: Project, exec: Exec, maps: { mapId: string; entry: Cell; exit: Cell | null; gaps: Cell[][] }[], fire: Cell): void {
  copyEnemy(project, exec, "enemy_fs_wolf", {
    id: FS2_FROST_WOLF, name: "서리늑대", monsterResourceId: "generated-enemy-wolf-dire", level: 9,
    stats: { maxHp: 240, maxMp: 0, attack: 84, defense: 32, mind: 20, agility: 70 },
    skillIds: ["skill_attack", "skill_mon_savage_maul"], actions: [act("skill_attack", 5), act("skill_mon_savage_maul", 3)],
    rewards: { exp: 80, gold: 16, dropRatePercent: 0, drops: [potionDrop(10)] },
  });
  copyEnemy(project, exec, "enemy_bat_cave", {
    id: FS2_FROST_BAT, name: "서리박쥐", monsterResourceId: "generated-enemy-bat-cave", level: 9,
    stats: { maxHp: 200, maxMp: 20, attack: 76, defense: 24, mind: 60, agility: 92 },
    skillIds: ["skill_attack", "skill_mon_frost_orb"], actions: [act("skill_attack", 5), act("skill_mon_frost_orb", 3)],
    rewards: { exp: 65, gold: 14, dropRatePercent: 0, drops: [potionDrop(8)] },
  });
  for (const [id, name, members] of [
    ["troop_fs2_frost_wolves", "서리늑대 한 쌍", [FS2_FROST_WOLF, FS2_FROST_WOLF]],
    ["troop_fs2_frost_bats", "서리박쥐 떼", [FS2_FROST_BAT, FS2_FROST_BAT, FS2_FROST_BAT]],
    ["troop_fs2_frost_mixed", "늑대와 박쥐", [FS2_FROST_WOLF, FS2_FROST_BAT, FS2_FROST_BAT]],
  ] as const) {
    exec(project, "upsert_troop", { troop: { id, name, enemyIds: [...members], previewBackgroundResourceId: "battle-scenery-snow", backdropLayers: FROST_LAYERS } });
  }
  // 얼음 틈 — 틈 칸은 그림자 가득, 진행 방향 앞뒤 칸은 틈 쪽 절반만.
  for (const m of maps) {
    const cells: Rec[] = [];
    for (const band of m.gaps) {
      const inBand = new Set(band.map((c) => `${c.x},${c.y}`));
      const map = M(project, m.mapId);
      for (const c of band) {
        cells.push({ x: c.x, y: c.y, bits: 15 });
        for (const [dx, dy, bits] of [[0, -1, 12], [0, 1, 3], [-1, 0, 10], [1, 0, 5]] as const) {
          const n = { x: c.x + dx, y: c.y + dy };
          if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || inBand.has(`${n.x},${n.y}`)) continue;
          cells.push({ x: n.x, y: n.y, bits });
        }
      }
    }
    if (cells.length) exec(project, "paint_shadow", { mapId: m.mapId, cells, mode: "add" });
  }
  // 걸어 닿는 칸 — 틈은 건넌다고 치고(새라 도약), 입구에서 센 걸음 수.
  const reach = (mapId: string, from: Cell, gapCells: Set<string>): Map<string, number> => {
    const map = M(project, mapId);
    const dist = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
    const queue: Cell[] = [from];
    while (queue.length) {
      const c = queue.shift()!;
      const d = dist.get(`${c.x},${c.y}`)!;
      for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
        const n = { x: c.x + dx, y: c.y + dy };
        const key = `${n.x},${n.y}`;
        if (dist.has(key) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
        if (!gapCells.has(key) && !gapCells.has(`${c.x},${c.y}`) && !canMove(project, map, c.x, c.y, n.x, n.y)) continue;
        dist.set(key, d + 1);
        queue.push(n);
      }
    }
    return dist;
  };
  const cellOf = (k: string): Cell => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; };
  const foe = (mapId: string, troopId: string, at: Cell, style: string): boolean => {
    try {
      exec(project, "place_field_enemy", { mapId, x: at.x, y: at.y, troopId, behavior: "chase", patrol: { length: 2, axis: at.x % 2 ? "horizontal" : "vertical" },
        sightRange: 7, vision: "cone", pace: "normal", approachStyle: style, respawnSec: 120, checkpointOnEntry: true });
      return true;
    } catch (e) {
      if (typeof process !== "undefined" && process.env?.FS_DEBUG) console.error(`[fs2-frost] ${mapId} ${troopId} (${at.x},${at.y}) 거절: ${String((e as Error).message).slice(0, 160)}`);
      return false;
    }
  };
  /** 입구→출구 걸음 비율 t 근처(본길 위)에서 무리를 세운다 — 거절되면 이웃 걸음으로. */
  const onRoute = (mapId: string, dist: Map<string, number>, route: Set<string>, t: number, troopId: string, style: string, avoid: Cell[]): Cell | null => {
    const total = Math.max(...[...route].map((k) => dist.get(k) ?? 0));
    const want = Math.round(total * t);
    const cands = [...route].map(cellOf).filter((c) => avoid.every((a) => Math.abs(a.x - c.x) + Math.abs(a.y - c.y) > 5))
      .sort((a, b) => Math.abs((dist.get(`${a.x},${a.y}`) ?? 0) - want) - Math.abs((dist.get(`${b.x},${b.y}`) ?? 0) - want));
    // 입구 시야(매복 금지)·이벤트 곁은 도구가 거절한다 — 가까운 걸음부터 넉넉히 시도한다.
    if (typeof process !== "undefined" && process.env?.FS_DEBUG) console.error(`[fs2-frost] ${mapId} ${troopId} route=${route.size} total=${total} want=${want} first=${JSON.stringify(cands.slice(0, 4))}`);
    for (const c of cands.slice(0, 80)) if (foe(mapId, troopId, c, style)) return c;
    return null;
  };
  maps.forEach((m, i) => {
    // 틈(새라 도약)과 얼음 덩이(엘레나 불씨)는 건넌다고 친다 — 막힌 칸으로 세면 첫 틈 너머가 「닿지 않는 곳」이 됐다.
    const gapSet = new Set([...m.gaps.flat(), ...M(project, m.mapId).events.filter((e) => e.id.startsWith("ev_fs2_snow_ice")).map((e) => ({ x: e.x, y: e.y }))].map((c) => `${c.x},${c.y}`));
    const start = i === 0 ? FS2_SNOW.entry : { x: m.entry.x, y: m.entry.y - 1 };
    const dist = reach(m.mapId, start, gapSet);
    // 본길 — 출구(없으면 가장 먼 칸)에서 걸음 수를 거꾸로 따라 내려온 칸들.
    const far = m.exit && dist.has(`${m.exit.x},${m.exit.y}`) ? m.exit : cellOf([...dist.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
    const route = new Set<string>();
    let cur = far;
    while (cur) {
      route.add(`${cur.x},${cur.y}`);
      const d = dist.get(`${cur.x},${cur.y}`)!;
      if (d === 0) break;
      const next: Cell | undefined = [[0, -1], [1, 0], [-1, 0], [0, 1]].map(([dx, dy]) => ({ x: cur.x + dx!, y: cur.y + dy! })).find((n) => dist.get(`${n.x},${n.y}`) === d - 1);
      if (!next) break;
      cur = next;
    }
    // 본길에서 떨어진 정도 — 막다른 빈터·갈림 고리를 찾는다.
    const offRoute = new Map<string, number>();
    const q: string[] = [...route];
    for (const k of route) offRoute.set(k, 0);
    while (q.length) {
      const k = q.shift()!; const c = cellOf(k); const d = offRoute.get(k)!;
      for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
        const nk = `${c.x + dx},${c.y + dy}`;
        if (!dist.has(nk) || offRoute.has(nk)) continue;
        offRoute.set(nk, d + 1); q.push(nk);
      }
    }
    const nooks = [...offRoute.entries()].filter(([k, d]) => d >= 3 && (dist.get(k) ?? 0) > 6).sort((a, b) => b[1] - a[1]).map(([k]) => cellOf(k));
    const avoid: Cell[] = [start, ...(i === 1 ? [fire] : [])];
    if (i === 0) {
      // 서리 가도 — 첫 굽이 늑대 둘, 막다른 빈터 보물 + 그 앞 박쥐 떼.
      const w = onRoute(m.mapId, dist, route, 0.3, "troop_fs2_frost_wolves", "dash", avoid);
      if (w) avoid.push(w);
      let chest: Cell | null = null;
      for (const at of nooks.slice(0, 10)) {
        try { exec(project, "place_chest", { mapId: m.mapId, x: at.x, y: at.y, contents: { itemId: "item_phoenix_down", gold: 120 }, name: "눈에 묻힌 짐 상자", id: "ev_fs2_snow_chest" }); chest = at; break; } catch { /* 다음 자리 */ }
      }
      if (!chest) throw new Error("[fallen-star act2] 서리 가도 곁길 보물 자리가 없다");
      FS2_SNOW_EXTRA.chest = chest;
      // 상자와 본길 사이(곁길 중간)에 박쥐 떼.
      const mid = [...offRoute.entries()].filter(([k, d]) => d >= 1 && d <= 2 && avoid.every((a) => { const c = cellOf(k); return Math.abs(a.x - c.x) + Math.abs(a.y - c.y) > 4; }))
        .map(([k]) => cellOf(k)).sort((a, b) => (Math.abs(a.x - chest!.x) + Math.abs(a.y - chest!.y)) - (Math.abs(b.x - chest!.x) + Math.abs(b.y - chest!.y)));
      let bats = false;
      for (const at of mid.slice(0, 40)) if (foe(m.mapId, "troop_fs2_frost_bats", at, "swoop")) { avoid.push(at); bats = true; break; }
      if (!bats) onRoute(m.mapId, dist, route, 0.65, "troop_fs2_frost_bats", "swoop", avoid);
    } else {
      // 눈보라 고개 — 갈림 고리(본길에서 먼 칸)에 늑대+박쥐, 고개 위(본길 70%)에 늑대 둘.
      let mixed = false;
      for (const at of nooks.slice(0, 40)) if (avoid.every((a) => Math.abs(a.x - at.x) + Math.abs(a.y - at.y) > 5) && foe(m.mapId, "troop_fs2_frost_mixed", at, "dash")) { avoid.push(at); mixed = true; break; }
      if (!mixed) { const at = onRoute(m.mapId, dist, route, 0.4, "troop_fs2_frost_mixed", "dash", avoid); if (at) avoid.push(at); }
      onRoute(m.mapId, dist, route, 0.7, "troop_fs2_frost_wolves", "dash", avoid);
    }
  });
  for (const m of maps) {
    const n = M(project, m.mapId).events.filter((e) => JSON.stringify(e.pages ?? []).includes("troop_fs2_frost_")).length;
    if (n < 2) throw new Error(`[fallen-star act2] ${m.mapId} 에 서리 무리를 둘 이상 못 세웠다(${n})`);
  }
}
/** B7 곁길 보물 자리(QA·체크포인트). */
export const FS2_SNOW_EXTRA: { chest: Cell } = { chest: { x: 0, y: 0 } };

// ════════════════════════════════════════════════════════════════════
// 11. B8 서리나루 — 얼어붙은 못가 나루 마을(author_beodeul_town theme snow). 하르마(세린 이야기 · 잔 일 Q5 얼음 낚시),
//     심문회 징발대가 막은 장작 썰매(Q6 · 새라의 한마디), 여관(별빛 결정 · 썰매를 찾아 주면 공짜), 못가 「대답의 등」.
// ════════════════════════════════════════════════════════════════════

export const FS2_FROST_ID = "fs2_frostford";
export const FS2_FROST_INN_ID = "fs2_frostford_inn";
const FS2_TROUT = "item_fs2_silver_trout";
const FS2_HARMA_OAR = "equip_fs2_harma_oar";
const SW_FROST_ARRIVE = "sw_fs2_frost_arrived";
const SW_HARMA = "sw_fs2_harma_told";
const SW_Q5_TAKEN = "sw_fs2_q5_trout_asked";
const SW_Q5_FISH = "sw_fs2_q5_trout_caught";
const SW_Q5_DONE = "sw_fs2_q5_trout_done";
const SW_Q6_DONE = "sw_fs2_q6_sled_back";
const HARMA = "나루지기 하르마";
export const FS2_FROST: { entry: Cell; harma: Cell; holes: Cell[]; innDoor: Cell; innExit: Cell; sled: Cell; locked: Cell[]; lamps: Cell[] } =
  { entry: { x: 0, y: 0 }, harma: { x: 0, y: 0 }, holes: [], innDoor: { x: 0, y: 0 }, innExit: { x: 0, y: 0 }, sled: { x: 0, y: 0 }, locked: [], lamps: [] };

type FrostHome = { id: string; name: string; program: string; seed: number; variant: number; npc: { id: string; name: string; chip: string; lines: string[] } };
/** 서리나루 집 셋 — 손 도트 실내 v5 예제 구성(narshe = 눈 고장 살림집, fish = 생선 손질간, tailor = 작업방). 사람 칩은 1막 광장 칩을 그대로 쓴다. */
const FS2_FROST_HOMES: FrostHome[] = [
  { id: "fs2_frostford_lamp", name: "서리나루 · 등 만드는 집", program: "tailor", seed: 4, variant: 1,
    npc: { id: "ev_fs2_frost_lampmaker", name: "등 만드는 아낙 소이", chip: "ev_fs_crowd_b", lines: [
      "오늘이 「대답의 등」 밤이에요. 장작이 없어 기름도 아껴야 하지만… 등은 띄워야죠.",
      "등마다 한 줄씩 적어요. 받는 사람이 누군지 몰라도 돼요. 「잘 지내」 한마디면 돼요.",
      "세린 언니가 그러더라고요. 대답은 받는 사람보다 하는 사람을 살린다고."] } },
  { id: "fs2_frostford_fisher", name: "서리나루 · 어부 도윤의 집", program: "fish", seed: 6, variant: 0,
    npc: { id: "ev_fs2_frost_fisher", name: "어부 도윤", chip: "ev_fs_crowd_f", lines: [
      "썰매를 다 끌어가니 얼음 위로 나갈 수가 있나. 구멍 하나에 매달려 사는 거지.",
      "밤에 못 한가운데 사당에 등 하나가 뜨면, 그건 세린네 아들이야. 해마다 몰래 와.",
      "…심문회 옷을 입고서도 등 띄우는 손은 안 떨더라."] } },
  { id: "fs2_frostford_harma", name: "서리나루 · 하르마의 집", program: "narshe", seed: 2, variant: 0,
    npc: { id: "ev_fs2_frost_child", name: "하르마네 손주 나래", chip: "ev_fs_crowd_a", lines: [
      "할머니는 못에 나가 있어. 난 등 접는 중이야. 이거 봐, 별 모양!",
      "할머니가 그랬어. 옛날에 달에서 온 아이한테 우리 할머니의 할머니가 「잘 지내」 했대.",
      "오늘 밤엔 나도 등 띄울 거야. 형도 같이 띄워!"] } },
];

/** 서리나루 집 하나 — 실내를 짓고 문을 잇고, 안에 사람 하나. */
function frostHome(project: Project, exec: Exec, hubId: string, front: Cell, doorAt: Cell, home: FrostHome): void {
  const room = exec(project, "build_hand_interior_room", { mapId: home.id, name: home.name, layout: { program: home.program, seed: home.seed, variant: home.variant }, ceiling: "wood" }) as
    { exits?: { x: number; y: number; width?: number }[] } | undefined;
  const ex = room?.exits?.[0];
  if (!ex) throw new Error(`[fallen-star act2] ${home.name} 출구가 없다`);
  const exit = { x: ex.x + Math.floor(((ex.width ?? 1) - 1) / 2), y: ex.y };
  exec(project, "create_transfer_pair", { a: { mapId: FS2_FROST_ID, x: front.x, y: front.y, doorAt }, b: { mapId: home.id, x: exit.x, y: exit.y } });
  const goesTo = (target: string) => (e: GameEvent) => JSON.stringify(e).includes(`"mapId":"${target}"`);
  const outer = M(project, FS2_FROST_ID).events.find((e) => String(e.id).startsWith("ev_gate_") && goesTo(home.id)(e));
  if (outer) {
    outer.x = doorAt.x; outer.y = doorAt.y;
    for (const pg of outer.pages ?? []) {
      pg.priority = "same"; (pg as unknown as Rec).overlapForbidden = true;
      for (const cmd of pg.commands ?? []) if ((cmd as unknown as Rec).kind === "transfer") (cmd as unknown as Rec).direction = "up";
    }
  }
  for (const e of M(project, home.id).events) if (goesTo(FS2_FROST_ID)(e)) for (const pg of e.pages ?? []) for (const cmd of pg.commands ?? []) {
    const t = cmd as unknown as Rec;
    if (t.kind === "transfer") { t.x = front.x; t.y = front.y; t.direction = "down"; }
  }
  exec(project, "set_map_properties", { mapId: home.id, bgm: { mode: "custom", resourceId: "cc0-bgm-rtp-rst-001" } });
  exec(project, "set_scene_mood", { mapId: home.id, applyMode: "map", weather: { kind: "none" }, lighting: { ambient: 0, color: "#000000" } });
  const chipOf = hubChip(project, hubId, home.npc.chip);
  for (const [dx, dy] of [[0, -3], [2, -3], [-2, -3], [0, -5], [3, -2], [-3, -2]] as const) {
    try {
      exec(project, "place_npc", {
        mapId: home.id, id: home.npc.id, name: home.npc.name, x: exit.x + dx, y: exit.y + dy, movement: "fixed", graphic: chipOf,
        pages: [{ name: "이야기", commands: home.npc.lines.map((line) => say(home.npc.name, line)) }],
      });
      return;
    } catch { /* 가구 칸 — 다음 자리 */ }
  }
  throw new Error(`[fallen-star act2] ${home.name} 에 ${home.npc.name} 자리가 없다`);
}

const SW_FROST_LAMP = "sw_fs2_frost_lamp_floated";
/** 「대답의 등」 — 해 질 녘 못가. 등 줄의 첫 등에서 한 줄을 적어 띄운다(B9 밤 장면의 예고). 어부 하나는 못 위 구멍 곁. */
function frostFestival(project: Project, exec: Exec, hubId: string, work: Cell): void {
  ensureSwitch(project, SW_FROST_LAMP, "B8: 대답의 등을 띄웠다");
  // 해 질 녘 — 덮개 세기 0.32 짙은 보랏빛, 등불마다 따뜻한 빛.
  exec(project, "set_lighting_volume", {
    mapId: FS2_FROST_ID, applyMode: "map", ambient: 0.5, color: "#2a1838",
    sources: [
      ...FS2_FROST.lamps.map((c, i) => ({ id: `answer_lamp_${i}`, at: { x: c.x, y: c.y }, radius: 3, intensity: 0.9, color: "#ffc070", flicker: true })),
      { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.3, color: "#ffd8a0" },
    ],
  });
  const first = FS2_FROST.lamps[0];
  if (first) {
    addEv(project, FS2_FROST_ID, "ev_fs2_frost_answer_lamp", "대답의 등", { x: first.x, y: first.y + 1 }, [
      page("ev_fs2_frost_answer_lamp_p", "대답의 등", [], [
        narrate("못가에 종이 등이 줄지어 있다. 등마다 한 줄씩 글씨가 적혀 있다.\n「잘 지내」「밥 먹었니」「오늘은 별이 많다」…"),
        { kind: "choices", prompt: "등 하나에 한 줄을 적어 띄울까?", options: [
          { text: "「잘 지내」라고 적는다", branch: [
            se("cc0-se-orp-inventory-cloth"),
            narrate("카엘은 등에 「잘 지내」라고 적어\n얼음 틈 사이 물에 띄웠다."),
            m2("m2-202-screen-effect", { effect: "flash", value: "#ffc070", durationMs: 700 }),
            say(ELENA, "…이리스한테 닿으면 좋겠다."),
            say(KAEL, "닿을 거야. 대답은 늘 늦게라도 닿았어."),
            setSw(SW_FROST_LAMP),
          ] },
          { text: "그냥 본다", branch: [] },
        ] } as unknown as Command,
      ], { priority: "below", trigger: { kind: "action" } }),
      page("ev_fs2_frost_answer_lamp_done", "띄운 뒤", [sw(SW_FROST_LAMP)], [narrate("우리가 띄운 등이 얼음 틈 사이로 천천히 멀어진다.")], { priority: "below", trigger: { kind: "action" } }),
    ]);
  }
  // 어부 하나 — 못 위 구멍 곁(하르마와 반대쪽).
  const fisher = hubChip(project, hubId, "ev_fs_crowd_c");
  const holes = [...FS2_FROST.holes].sort((a, b) => Math.hypot(b.x - work.x, b.y - work.y) - Math.hypot(a.x - work.x, a.y - work.y));
  for (const h of holes) {
    let ok = false;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [2, 1]] as const) {
      try {
        exec(project, "place_npc", {
          mapId: FS2_FROST_ID, id: "ev_fs2_frost_icefisher", name: "얼음낚시 노인", x: h.x + dx, y: h.y + dy, movement: "fixed", graphic: fisher,
          pages: [{ name: "낚시", commands: [
            say("얼음낚시 노인", "쉿, 물고기 놀란다. …오늘 등 띄우는 날인 거 알지?"),
            say("얼음낚시 노인", "등은 못 한가운데 사당까지 흘러가. 거기서 누가 꼭 받아 주더라고."),
          ] }],
        });
        ok = true;
        break;
      } catch { /* 다음 자리 */ }
    }
    if (ok) break;
  }
}

function tileLabel(project: Project, map: GameMap, i: number, layer: number[] | undefined): string {
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const t = layer?.[i];
  return t !== undefined && t >= 0 ? meta[t]?.label ?? "" : "";
}

function frostford(project: Project, exec: Exec, hubId: string): void {
  for (const [id, name] of [[SW_FROST_ARRIVE, "B8: 서리나루 도착"], [SW_HARMA, "B8: 하르마 — 세린 이야기"], [SW_Q5_TAKEN, "B8 Q5: 은빛 송어 부탁"],
    [SW_Q5_FISH, "B8 Q5: 은빛 송어를 낚았다"], [SW_Q5_DONE, "B8 Q5: 하르마에게 송어를 줬다"], [SW_Q6_DONE, "B8 Q6: 장작 썰매를 되찾았다"]] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_item", { item: {
    id: FS2_TROUT, name: "은빛 송어", type: "special", occasion: "never", consumable: false, price: 0, iconResourceId: "cc0-jetrel-fish",
    description: "얼음 밑에서 올라온 송어. 비늘이 달빛처럼 희다.\n하르마가 「첫째 아이의 고기」라 부르는 물고기.",
  } });
  const actorClasses = (ids: string[]): string[] => [...new Set(ids.map((id) => project.database.actors.find((a) => a.id === id)?.classId).filter((c): c is string => !!c))];
  const wearers = ["actor_hero", "actor_fs_elena", FS2_SARAH_ACTOR, "actor_fs_iris"].filter((id) => project.database.actors.some((a) => a.id === id));
  exec(project, "upsert_equipment", { equipment: {
    id: FS2_HARMA_OAR, name: "하르마의 은빛 노", slot: "accessory", price: 0, iconResourceId: "cc0-jetrel-necklace", imageResourceId: "cc0-jetrel-necklace",
    description: "나루지기 집안에 대대로 내려온 작은 은 노 목걸이. 얼음 피해를 막는다.\n「대답한 집안 물건이야. 달까지 닿는다더라.」",
    statBonuses: { attack: 0, defense: 6, mind: 6, agility: 0 }, equippableActorIds: wearers, equippableClassIds: actorClasses(wearers), elementalDefenseIds: ["ice"],
  } });

  // 마을 — 못(얼음낚시터)·나루 소품은 설원 마을 문법이 깐다. 문 앞 칸은 결과 data.doors.
  const town = exec(project, "author_beodeul_town", { id: FS2_FROST_ID, name: "서리나루", theme: "snow", houseCount: 5, seed: 81 }) as
    { doors?: { kit: string; x: number; y: number; reached?: boolean }[]; work?: Cell & { name?: string }; anchors?: string[] } | undefined;
  const doors = (town?.doors ?? []).filter((d) => d.reached !== false && !(town?.anchors ?? []).includes(d.kit));
  if (doors.length < 3) throw new Error("[fallen-star act2] 서리나루 집 문이 모자란다");
  const work = town?.work ?? { x: 16, y: 12 };
  // 조명은 해 질 녘 「대답의 등」(frostFestival set_lighting_volume)이 정한다 — 분위기 이벤트에 조명을 주면 들어설 때 그 조명이 덮어쓴다.
  exec(project, "set_scene_mood", { mapId: FS2_FROST_ID, applyMode: "map", weather: { kind: "snow", intensity: 0.2 } });
  // 설원 길 두 번째 맵 북쪽 끝 → 마을 남쪽.
  if (!FS2_SNOW.exit) throw new Error("[fallen-star act2] 설원 길 출구가 없다");
  const b = originEdge(project, M(project, FS2_FROST_ID), "south");
  exec(project, "create_transfer_pair", { a: { mapId: FS2_SNOW.mapIds[1]!, ...FS2_SNOW.exit }, b: { mapId: FS2_FROST_ID, ...b } });
  FS2_FROST.entry = b;

  // 얼음 구멍(설원 키트 「얼음 구멍」 칸, 막힘) — 왼쪽 칸마다 하나.
  const tm = M(project, FS2_FROST_ID);
  for (let i = 0; i < tm.upperTiles.length; i += 1) {
    if (tileLabel(project, tm, i, tm.upperTiles) !== "버들항 장소 · 얼음 구멍") continue;
    if (i % tm.width > 0 && tileLabel(project, tm, i - 1, tm.upperTiles) === "버들항 장소 · 얼음 구멍") continue;
    FS2_FROST.holes.push({ x: i % tm.width, y: Math.floor(i / tm.width) });
  }
  if (!FS2_FROST.holes.length) throw new Error("[fallen-star act2] 서리나루 얼음 구멍이 없다");

  // 여관 — 마을 가운데에 가까운 집. 하르마 집은 못에 가장 가까운 집(잠긴 채 하르마는 못가에 선다).
  const mid = { x: tm.width / 2, y: tm.height / 2 };
  const byDist = (c: Cell) => (d: Cell) => Math.hypot(d.x - c.x, d.y - c.y);
  // 여관은 붉은 지붕 목골집(설원 키트 w2)이 있으면 그 집 — 없으면 가운데에 가까운 집.
  const innFront = doors.find((d) => d.kit === "bd-pick-snowfield-w2") ?? [...doors].sort((p, q) => byDist(mid)(p) - byDist(mid)(q))[0]!;
  FS2_FROST.innDoor = { x: innFront.x, y: innFront.y - 1 };
  const room = exec(project, "build_hand_interior_room", { mapId: FS2_FROST_INN_ID, name: "서리나루 · 얼음등 여관", layout: { program: "inn", seed: 1, variant: 1, styleVariant: "A" }, ceiling: "wood" }) as
    { exits?: { x: number; y: number; width?: number }[] } | undefined;
  const ex = room?.exits?.[0];
  if (!ex) throw new Error("[fallen-star act2] 서리나루 여관 출구가 없다");
  FS2_FROST.innExit = { x: ex.x + Math.floor(((ex.width ?? 1) - 1) / 2), y: ex.y };
  exec(project, "create_transfer_pair", {
    a: { mapId: FS2_FROST_ID, x: innFront.x, y: innFront.y, doorAt: FS2_FROST.innDoor },
    b: { mapId: FS2_FROST_INN_ID, x: FS2_FROST.innExit.x, y: FS2_FROST.innExit.y },
  });
  // 문 짝 다듬기 — 바깥은 문 그림 칸의 부딪힘 문(들어가면 위를 본다), 나오면 문 앞 칸에 아래를 보고 선다.
  const goesTo = (target: string) => (e: GameEvent) => JSON.stringify(e).includes(`"mapId":"${target}"`);
  const outer = M(project, FS2_FROST_ID).events.find((e) => String(e.id).startsWith("ev_gate_") && goesTo(FS2_FROST_INN_ID)(e));
  if (outer) {
    outer.x = FS2_FROST.innDoor.x; outer.y = FS2_FROST.innDoor.y;
    for (const pg of outer.pages ?? []) {
      pg.priority = "same"; (pg as unknown as Rec).overlapForbidden = true;
      for (const cmd of pg.commands ?? []) if ((cmd as unknown as Rec).kind === "transfer") (cmd as unknown as Rec).direction = "up";
    }
  }
  for (const e of M(project, FS2_FROST_INN_ID).events) if (goesTo(FS2_FROST_ID)(e)) for (const pg of e.pages ?? []) for (const cmd of pg.commands ?? []) {
    const t = cmd as unknown as Rec;
    if (t.kind === "transfer") { t.x = innFront.x; t.y = innFront.y; t.direction = "down"; }
  }
  exec(project, "set_map_properties", { mapId: FS2_FROST_INN_ID, bgm: { mode: "custom", resourceId: "cc0-bgm-rtp-rst-001" } });
  // 바깥 눈발이 실내까지 남지 않게 — 여관은 맑게(ambient 0 = 덮개 없음; ambient 는 덮는 색의 세기다).
  exec(project, "set_scene_mood", { mapId: FS2_FROST_INN_ID, applyMode: "map", weather: { kind: "none" }, lighting: { ambient: 0, color: "#000000" } });
  // 여관 주인 — 썰매를 되찾아 주면 공짜. 별빛 결정은 홀 안쪽.
  exec(project, "place_npc", {
    mapId: FS2_FROST_INN_ID, id: "ev_fs2_frost_innkeeper", name: "여관 주인 오사", x: FS2_FROST.innExit.x + 3, y: FS2_FROST.innExit.y - 4, movement: "fixed",
    graphic: { textureKey: "tex_easyrpg_charset_people2", characterIndex: 4 },
    pages: [
      { name: "기본", commands: [say("여관 주인 오사", "장작을 다 뺏겨서 방이 좀 차요.\n그래도 담요는 두툼해요. 하룻밤에 20골드."), { kind: "inn", price: 20 }] },
      { name: "썰매 뒤", conditions: [sw(SW_Q6_DONE)], commands: [say("여관 주인 오사", "썰매 찾아 준 손님한테 돈 받았다간\n하르마 할머니한테 혼나요. 그냥 주무세요."), { kind: "inn", price: 0 }] },
    ],
  });
  for (const [dx, dy] of [[-3, -3], [3, -3], [-4, -2], [4, -2], [0, -6]] as const) {
    try {
      exec(project, "place_savepoint", { mapId: FS2_FROST_INN_ID, x: FS2_FROST.innExit.x + dx, y: FS2_FROST.innExit.y + dy, id: "ev_fs2_frost_save", name: "별빛 결정", mode: "slot",
        objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2 });
      break;
    } catch { /* 가구 칸 — 다음 자리 */ }
  }

  // 집 셋은 들어갈 수 있다(계획 B8 실내 넷: 여관 + 등 만드는 집 · 어부 도윤의 집 · 하르마의 집). 나머지 문은 한 줄씩.
  const homes = FS2_FROST_HOMES;
  const lockedLines = ["「심문회 사람이면 돌아가요.」 …문은 안 열린다.", "빈집이다. 문고리에 얼음이 끼었다."];
  doors.filter((d) => d !== innFront).forEach((d, k) => {
    const at = { x: d.x, y: d.y - 1 };
    const home = homes[k];
    if (home) { frostHome(project, exec, hubId, d, at, home); return; }
    FS2_FROST.locked.push(at);
    addEv(project, FS2_FROST_ID, `ev_fs2_frost_door_${k}`, "닫힌 문", at, [
      page(`ev_fs2_frost_door_${k}_p`, "닫힌 문", [], [narrate(lockedLines[k % lockedLines.length]!)]),
    ]);
  });

  // 대답의 등 — 못 남쪽 기슭에 등 셋(설원 키트 등불). 못가 길을 막지 않는 자리만.
  const pond = FS2_FROST.holes.reduce((a, h) => ({ x: Math.max(a.x, h.x), y: Math.max(a.y, h.y) }), { x: 0, y: 0 });
  let lamps = 0;
  for (const [dx, dy] of [[-8, 3], [-5, 4], [-2, 4], [1, 3], [-11, 3], [3, 2]] as const) {
    if (lamps >= 3) break;
    const at = { x: pond.x + dx, y: pond.y + dy };
    try { exec(project, "stamp_tileset_object", { mapId: FS2_FROST_ID, objectId: "bd-pick-snowfield-lamp", at }); lamps += 1; FS2_FROST.lamps.push(at); } catch { /* 길·집 칸 */ }
  }

  // 하르마 — 얼음낚시터 곁.
  exec(project, "place_npc", {
    mapId: FS2_FROST_ID, id: "ev_fs2_harma", name: HARMA, x: work.x, y: work.y + 1, movement: "fixed",
    graphic: { query: "노인 여성" },
    pages: [
      { name: "처음", commands: [
        say(HARMA, "별지기 옷이네. 오랜만에 보는구먼."),
        say(HARMA, "우리 증조할미가 달에서 온 아이한테\n「잘 지내」 했대. 그 뒤로 이 못가에선\n얼어 죽는 사람이 없어."),
        say(KAEL, "…세린이라는 분을 아세요?"),
        say(HARMA, "세린이? 알지. 등을 제일 멀리 띄우던 애.\n…그 애 아들이 이번에 탑으로 올라갔어."),
        say(KAEL, "그 사람, 등을 띄우는 법은 안 잊었어요."),
        say(HARMA, "그럼 됐다. 밤에 얼음 위로 나가 봐.\n등이 하나 떠 있을 게다. 밤까진 못 동남쪽\n붉은 지붕 여관에서 오사한테 신세 지렴."),
        setSw(SW_HARMA),
        say(HARMA, "그 전에 부탁 하나 하자. 심문회가 썰매를\n죄다 끌어가서 고기 잡을 사람이 없어.\n저 구멍에서 은빛 송어 한 마리만 낚아 다오."),
        setSw(SW_Q5_TAKEN),
        narrate("잔 일 「첫째 아이의 고기」를 맡았다.\n얼음 구멍에서 은빛 송어를 낚아\n하르마에게 가져가자.", { context: "system" }),
      ] },
      { name: "송어 기다림", conditions: [sw(SW_Q5_TAKEN)], commands: [
        say(HARMA, "구멍 앞에 서서 줄을 내리면 돼.\n첫째 아이처럼 기다리는 게 요령이지."),
        say(HARMA, "밤까지 기다리려거든 못 동남쪽\n붉은 지붕 여관의 오사한테 가 보렴.\n송어는 나중에 갖고 와도 된다."),
      ] },
      { name: "송어", conditions: [sw(SW_Q5_FISH)], commands: [
        say(HARMA, "오, 은빛이구먼. 첫째 아이의 고기야.\n옛날에 대답을 들은 그 아이도\n이런 물고기를 한 마리 받았거든."),
        item(FS2_TROUT, -1),
        se("cc0-se-orp-inventory-cloth"),
        item(FS2_HARMA_OAR, 1),
        narrate("「하르마의 은빛 노」를 받았다.", { context: "system" }),
        say(HARMA, "우리 집 노다.\n얼음판에서 미끄러지지 말라고 주는 게야."),
        setSw(SW_Q5_DONE),
      ] },
      { name: "끝", conditions: [sw(SW_Q5_DONE)], commands: [
        say(HARMA, "밤에 얼음 위로 나가 봐. …그 애 아들,\n등 띄우는 손이 제 어미랑 똑같아."),
        say(HARMA, "밤까진 못 동남쪽 붉은 지붕 여관에서\n오사한테 신세 지렴."),
      ] },
    ],
  });
  FS2_FROST.harma = (() => { const e = M(project, FS2_FROST_ID).events.find((v) => v.id === "ev_fs2_harma"); return e ? { x: e.x, y: e.y } : { x: work.x, y: work.y + 1 }; })();

  // 얼음 구멍 — 부탁을 받은 뒤 줄을 내리면 송어가 문다.
  FS2_FROST.holes.forEach((h, k) => {
    addEv(project, FS2_FROST_ID, `ev_fs2_frost_hole_${k}`, "얼음 구멍", h, [
      page(`ev_fs2_frost_hole_${k}_idle`, "구멍", [], [narrate("얼음 구멍이다. 검은 물이 느릿느릿 출렁인다.")]),
      page(`ev_fs2_frost_hole_${k}_fish`, "낚는다", [sw(SW_Q5_TAKEN)], [
        narrate("줄을 내렸다. …얼음 밑에서 뭔가가 천천히 돈다."),
        wait(900),
        se("cc0-se-osx-splash-01"),
        emote("player", "exclamation", 700),
        narrate("입질이다! 줄이 팽팽해진다!"),
        item(FS2_TROUT, 1),
        narrate("「은빛 송어」를 낚았다.", { context: "system" }),
        setSw(SW_Q5_FISH),
      ]),
      page(`ev_fs2_frost_hole_${k}_done`, "끝", [sw(SW_Q5_FISH)], [narrate("물이 조용하다. 한 마리면 충분하다.")]),
    ]);
  });

  // Q6 징발된 장작 — 마을 북쪽 끝 장작 썰매 곁에 심문회 병사. 새라가 말하면 물러난다.
  const knight = hubChip(project, hubId, "ev_fs_knight");
  let sled: Cell | null = null;
  for (const at of [{ x: work.x + 4, y: work.y - 4 }, { x: work.x + 6, y: work.y - 2 }, { x: work.x + 8, y: work.y - 5 }, { x: work.x + 2, y: work.y - 6 }]) {
    try { exec(project, "stamp_tileset_object", { mapId: FS2_FROST_ID, objectId: "bd-pick-snowfield-sled", at }); sled = at; break; } catch { /* 다음 자리 */ }
  }
  if (!sled) throw new Error("[fallen-star act2] 장작 썰매 자리가 없다");
  try { exec(project, "stamp_tileset_object", { mapId: FS2_FROST_ID, objectId: "bd-pick-snowfield-firewood", at: { x: sled.x + 2, y: sled.y } }); } catch { /* 장식 */ }
  exec(project, "place_npc", {
    mapId: FS2_FROST_ID, id: "ev_fs2_frost_requisition", name: "징발대 병사", x: sled.x, y: sled.y + 2, movement: "fixed", graphic: knight,
    pages: [
      { name: "썰매 지킴", commands: [
        say("징발대 병사", "물러서. 이 썰매와 장작은 하늘탑 수비대 몫이다."),
        say(SARAH, "…북문 기사 새라다. 탑 수비대는\n장작이 남아돈다. 이건 마을에 돌려놔라.\n발렌 님께는 내가 말하겠다."),
        say("징발대 병사", "새, 새라 님…! 북문에 계신 줄만…\n…알겠습니다. 돌려놓겠습니다."),
        fadeOut(600),
        setSw(SW_Q6_DONE),
        { kind: "setVariable", variableId: VAR_BOND_SARAH, op: "+=", value: 1 } as unknown as Command,
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_check" } as unknown as Command,
        fadeIn(600),
        narrate("잔 일 「징발된 장작」 완료.\n장작 썰매가 마을로 돌아갔다.\n(여관 무료 · 새라 유대 +1)", { context: "system" }),
        say(SARAH, "…어릴 때 아버지 손 잡고 이 마을에 장작 사러 왔었지."),
      ] },
      { name: "물러남", conditions: [sw(SW_Q6_DONE)], commands: [] },
    ],
  });
  // 물러난 뒤 — 병사는 사라진다(투명·아래층, 길을 막지 않는다).
  const req = M(project, FS2_FROST_ID).events.find((e) => e.id === "ev_fs2_frost_requisition");
  const gone = req?.pages?.[1];
  if (gone) { gone.graphic = { transparent: true } as EventPage["graphic"]; gone.priority = "below"; (gone as unknown as Rec).overlapForbidden = false; }
  FS2_FROST.sled = sled;

  frostFestival(project, exec, hubId, work);
  // 들어서면 한 번.
  addEv(project, FS2_FROST_ID, "ev_fs2_frost_arrive", "서리나루", { x: 1, y: 0 }, [
    page("ev_fs2_frost_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_frost_arrive_run", "들어선다", [sw(SW_SARAH)], [
      wait(400),
      narrate("꽁꽁 언 못가의 나루 마을. 해가 지고 있다.\n굴뚝마다 연기가 가늘게 오른다."),
      say(SARAH, "서리나루다. 장작을 다 뺏겨서 연기가 저것뿐이야."),
      say(ELENA, "못가에 등이 줄지어 있어. …오늘 무슨 날인가?"),
      say(ELENA, "저기 못 위… 구멍 앞에 할머니가 서 있어.\n먼저 저 할머니께 탑으로 가는 길을 물어보자."),
      setSw(SW_FROST_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_frost_arrive_done", "끝", [sw(SW_FROST_ARRIVE)], [], { priority: "below" }),
  ]);
}

// ════════════════════════════════════════════════════════════════════
// 12. B9 얼음 위의 등 — 서리나루의 밤(duplicate_map). 못 위에서 혼자 등을 띄우는 발렌과 대화, 선택 2(칼 / 등).
//     얼음이 갈라지며 탑 쪽으로 빛기둥 — 제한 시간 탈출(make_timed_escape)로 갈라지는 얼음을 건너 북쪽 하늘탑 문으로.
// ════════════════════════════════════════════════════════════════════

/**
 * 판본이 끝나는 비트 — "B8" 이면 서리나루 여관에서 「제2막 계속 — 다음 업데이트」 카드와 저장 화면으로 멈추고, B9 밤 판으로 가는 이동을 만들지 않는다.
 * "B9"(1.24) 면 얼음 위의 밤·탈출까지 열고, 하늘탑 1층에 닿으면 같은 카드와 저장 화면, 위층 계단은 「다음 업데이트」.
 * B10 을 실제로 내보낼 때 null 로 바꾼다.
 */
export const FS2_RELEASE_STOP: "B8" | "B9" | null = "B9";
const SW_STOP_B9 = "sw_fs2_release_stop_b9";
export const FS2_FROST_NIGHT_ID = "fs2_frostford_night";
export const FS2_TOWER_ID = "fs2_sky_tower";
const SW_NIGHT = "sw_fs2_frost_night";
const SW_VALEN_SWORD = "sw_fs2_valen_sword";
const SW_VALEN_LANTERN = "sw_fs2_valen_lantern";
const SW_VALEN_SERIN = "sw_fs2_valen_serin";
const SW_VALEN_MET = "sw_fs2_valen_lake_met";
const SW_ICE_RUN = "sw_fs2_ice_run";
const SW_ICE_DONE = "sw_fs2_ice_crossed";
const VALEN = "발렌";
/** 갈라진 얼음 칸 — 강·운하 물 오토타일 몸통(검은 물). */
const OPEN_WATER = 23152;
export const FS2_LAKE: { valen: Cell; checkpoint: Cell; gate: Cell; ice: { minY: number; maxY: number; minX: number; maxX: number } } =
  { valen: { x: 0, y: 0 }, checkpoint: { x: 0, y: 0 }, gate: { x: 0, y: 0 }, ice: { minY: 0, maxY: 0, minX: 0, maxX: 0 } };

function lanternNight(project: Project, exec: Exec): void {
  for (const [id, name] of [[SW_NIGHT, "B9: 서리나루 밤"], [SW_VALEN_SWORD, "B9 선택2: 칼을 뽑았다"], [SW_VALEN_LANTERN, "B9 선택2: 등을 같이 띄웠다"],
    [SW_VALEN_SERIN, "B9: 발렌에게 세린 이름을 꺼냈다"], [SW_VALEN_MET, "B9: 얼음 위 발렌과 이야기"], [SW_ICE_RUN, "B9: 갈라지는 얼음 탈출 중"], [SW_ICE_DONE, "B9: 얼음을 건넜다"]] as const) ensureSwitch(project, id, name);
  // 밤 판 — 사람은 비우고 문은 잠근 채 남긴다(B2 통금 광장과 같은 일반 기능).
  exec(project, "duplicate_map", { mapId: FS2_FROST_ID, id: FS2_FROST_NIGHT_ID, name: "서리나루 · 얼음 위의 밤", events: "doors", lockedDoorText: "밤이다. 문이 안에서 잠겨 있다." });
  const night = M(project, FS2_FROST_NIGHT_ID);
  (night as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  // 못(얼음 바닥 「얼음」 칸)의 범위 — 발렌은 못 남쪽 가운데, 갈라짐은 남쪽부터.
  const ice: Cell[] = [];
  for (let i = 0; i < night.lowerTiles.length; i += 1) if (tileLabel(project, night, i, night.lowerTiles) === "버들항 장소 · 얼음") ice.push({ x: i % night.width, y: Math.floor(i / night.width) });
  if (ice.length < 20) throw new Error("[fallen-star act2] 서리나루 못이 없다");
  const box = { minX: Math.min(...ice.map((c) => c.x)), maxX: Math.max(...ice.map((c) => c.x)), minY: Math.min(...ice.map((c) => c.y)), maxY: Math.max(...ice.map((c) => c.y)) };
  FS2_LAKE.ice = box;
  const iceSet = new Set(ice.map((c) => `${c.x},${c.y}`));
  const cx = Math.round((box.minX + box.maxX) / 2);
  const freeIce = (c: Cell) => iceSet.has(`${c.x},${c.y}`) && night.upperTiles[c.y * night.width + c.x]! < 0;
  // 발렌 — 가운데 기둥 줄에서 못 남쪽 끝 가까운 빈 얼음 칸.
  let valen: Cell | null = null;
  for (let y = box.maxY - 1; y >= box.minY && !valen; y -= 1) for (const dx of [0, 1, -1, 2, -2, 3, -3]) {
    const c = { x: cx + dx, y };
    if (freeIce(c) && freeIce({ x: c.x, y: c.y + 1 })) { valen = c; break; }
  }
  if (!valen) throw new Error("[fallen-star act2] 발렌 자리가 없다");
  FS2_LAKE.valen = valen;
  // 되돌아올 칸 — 발렌 아래로 내려가 처음 나오는 얼음 아닌 칸.
  let back: Cell = { x: valen.x, y: box.maxY + 1 };
  for (let y = valen.y + 1; y < night.height; y += 1) if (!iceSet.has(`${valen.x},${y}`)) { back = { x: valen.x, y }; break; }
  FS2_LAKE.checkpoint = back;
  // 못 북쪽 맵 끝 — 하늘탑 문.
  FS2_LAKE.gate = { x: valen.x, y: 0 };
  exec(project, "set_lighting_volume", {
    mapId: FS2_FROST_NIGHT_ID, applyMode: "map", ambient: 0.62, color: "#0b1230",
    sources: [
      { id: "valen", at: { x: valen.x, y: valen.y }, radius: 3, intensity: 0.9, color: "#ffd27a", flicker: true },
      ...FS2_FROST.lamps.map((l, i) => ({ id: `lamp${i}`, at: { x: l.x, y: l.y }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true })),
      { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.35, color: "#9fb4ff" },
    ],
  });
  exec(project, "set_scene_mood", { mapId: FS2_FROST_NIGHT_ID, applyMode: "map", weather: { kind: "snow", intensity: 0.2 } });

  // 갈라지는 얼음 — 남쪽 줄부터 차례로 검은 물이 된다. 북쪽 기슭(못 바로 위 줄)에 닿으면 성공.
  const seconds = 20;
  const rows = box.maxY - box.minY + 1;
  // 줄마다 이어진 얼음 칸 묶음 하나가 한 단계 — 칸마다 단계를 두면 스위치·병렬 이벤트가 백 개를 넘는다. 발렌이 선 칸은 도구가 뺀다.
  const steps: { x: number; y: number; width: number; height: number; atSecond: number }[] = [];
  for (let y = box.minY; y <= box.maxY; y += 1) {
    let x = box.minX;
    while (x <= box.maxX) {
      if (!iceSet.has(`${x},${y}`)) { x += 1; continue; }
      const x0 = x;
      while (x <= box.maxX && iceSet.has(`${x},${y}`)) x += 1;
      steps.push({ x: x0, y, width: x - x0, height: 1, atSecond: Math.max(1, Math.min(seconds - 2, 1 + Math.floor(((box.maxY - y) * (seconds - 6)) / rows))) });
    }
  }

  // 발렌 — 등 하나를 든 채 못 위에 서 있다.
  const vc = hubChipAny(project, "ev_fs_valen");
  addEv(project, FS2_FROST_NIGHT_ID, "ev_fs2_lake_valen", VALEN, valen, [
    page("ev_fs2_lake_valen_p", "얼음 위의 발렌", [], [
      cutBegin(),
      narrate("얼음 위에 등 하나. 발렌이 혼자 그 등에 불을 붙이고 있다."),
      say(VALEN, "…기사들은 탑 아래에 두고 왔다.\n싸우러 왔으면 칼을 뽑아라."),
      say(KAEL, "등 띄우는 법, 여기서 배우셨죠?"),
      say(VALEN, "대답하면 또 시험이 온다.\n언젠가 또 문을 잠그는 마을이 생기지."),
      say(VALEN, "그러니 줄을 끊는다. 아이가 다시는\n떨어지지 않게. …그게 내 대답이다."),
      { kind: "choices", prompt: "어떻게 할까?", options: [
        { text: "칼을 뽑는다", branch: [
          say(KAEL, "그 대답은 이리스한테 물어보고 하세요."),
          say(VALEN, "…그래. 그게 맞다. 넌 그 아이 편이니까."),
          setSw(SW_VALEN_SWORD),
        ] },
        { text: "등을 같이 띄운다", branch: [
          narrate("카엘이 등 하나에 불을 붙여 발렌의 등 곁에 놓았다."),
          say(VALEN, "…둘이면 더 멀리 간다. 어머니가 그러셨지."),
          setSw(SW_VALEN_LANTERN),
          { kind: "fork", condition: { kind: "item", itemId: FS2_CERT_ITEM, present: true }, then: [
            say(KAEL, "세린 씨도 그렇게 대답했을까요?"),
            say(VALEN, "…그 이름을 어디서."),
            narrate("카엘이 반쯤 탄 정착 확인서를 내밀었다.\n발렌은 서명란에서 한참 눈을 떼지 못한다."),
            say(VALEN, "「엄마 문 열어」… 내 글씨다."),
            setSw(SW_VALEN_SERIN),
          ] },
        ] },
      ] } as unknown as Command,
      shake(6, 900),
      se("cc0-se-osx-metal-03"),
      m2("m2-202-screen-effect", { effect: "flash", value: "#ffffff", durationMs: 500 }),
      narrate("쩌억, 얼음 갈라지는 소리.\n북쪽 하늘탑 꼭대기로 빛기둥이 치솟았다!"),
      say(VALEN, "…렌즈가 벌써 열렸군. 늦었다."),
      route("ev_fs2_lake_valen", walk(["up", "up", "up", "up", "up", "up"]), true),
      setSw(SW_VALEN_MET),
      cutLabel(),
      cutEnd(),
      say(ELENA, "카엘, 발밑!"),
      setSw(SW_ICE_RUN),
    ], { graphic: chip(vc.textureKey, vc.characterIndex, "down"), priority: "same" }),
    page("ev_fs2_lake_valen_gone", "떠남", [sw(SW_VALEN_MET)], [], { graphic: { transparent: true }, priority: "below" }),
  ]);
  // 발렌을 먼저 세운 뒤에 탈출을 짓는다 — 도구가 발렌 칸을 무너질 칸에서 뺀다.
  exec(project, "make_timed_escape", {
    // 처음은 발렌 장면 끝(스위치), 실패한 뒤에는 기슭에서 얼음으로 한 걸음 내디디면 다시 시작한다.
    mapId: FS2_FROST_NIGHT_ID, escapeId: "fs2_ice", seconds, startSwitchId: SW_ICE_RUN, start: { x: back.x, y: back.y - 1, width: 1, height: 1 }, startCellsSwitchId: SW_VALEN_MET,
    exit: { x: box.minX, y: box.minY - 1, width: box.maxX - box.minX + 1, height: 1 },
    checkpoint: { x: back.x, y: back.y, direction: "up" },
    steps, layer: "lower", collapsedTile: OPEN_WATER,
    startText: "발밑 얼음이 갈라진다! 북쪽 기슭까지 달려!", successText: "기슭이다. 빛기둥이 탑 꼭대기에 꽂혀 있다.",
    failText: "…얼음물에 빠질 뻔했다. 기슭에서 다시.", fallText: "얼음이 꺼졌다!", successSwitchId: SW_ICE_DONE,
  });
}

function lanternNightEvents(project: Project): void {
  // 서리나루 여관 주인 — 하르마가 「밤에 얼음 위로 나가 봐」 한 뒤에는 몸을 녹이고 밤을 기다린다(밤 판이 생긴 뒤에 단다).
  const keeper = M(project, FS2_FROST_INN_ID).events.find((e) => e.id === "ev_fs2_frost_innkeeper");
  const look = keeper?.pages?.[0]?.graphic;
  if (!keeper || !look) throw new Error("[fallen-star act2] 서리나루 여관 주인이 없다");
  const front = { x: FS2_FROST.innDoor.x, y: FS2_FROST.innDoor.y + 1 };
  keeper.pages = [
    ...(keeper.pages ?? []),
    FS2_RELEASE_STOP === "B8"
      // 판본 끝(1.23) — 밤 판으로 가는 이동이 아예 없다(B9 지도·탑은 지어 두되 어디서도 이어지지 않는다). 다음 판본에서 이 페이지가 밤으로 잇는다.
      ? page("ev_fs2_frost_innkeeper_stop", "판본 끝", [sw(SW_HARMA)], [
        say("여관 주인 오사", "밤에 얼음 위로 나가시게요?\n…하르마 할머니가 등 얘기를 했나 보네.\n오늘은 눈보라가 세요. 불 앞에서 쉬었다 가요."),
        fadeOut(900),
        { kind: "recoverAll" } as unknown as Command,
        narrate("제2막 「빌린 불」 — 여기까지", { position: "center", context: "narration" }),
        narrate("얼음 위의 등, 하늘탑, 그리고 이리스는\n다음 업데이트에서 이어집니다.", { position: "center", context: "narration" }),
        fadeIn(700),
        narrate("지금 저장해 두면 다음 판본에서 이 여관부터 이어서 할 수 있다.", { context: "system" }),
        { kind: "openSaveMenu" } as unknown as Command,
      ], { graphic: look })
      : page("ev_fs2_frost_innkeeper_night", "밤을 기다림", [sw(SW_HARMA)], [
        say("여관 주인 오사", "밤에 얼음 위로 나가시게요?\n…하르마 할머니가 등 얘기를 했나 보네.\n그럼 불 앞에서 몸부터 녹여요."),
        // 여관의 밤 — 불 앞에서 한 사람과 이야기한다(유대 +1, 계획 4-4).
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_talk" } as unknown as Command,
        fadeOut(1000),
        setSw(SW_NIGHT),
        narrate("해가 지고, 못 위에 등 하나가 떴다."),
        transfer(FS2_FROST_NIGHT_ID, front, "down"),
      ], { graphic: look }),
    page("ev_fs2_frost_innkeeper_after", "탑 뒤", [sw(SW_VALEN_MET)], [
      say("여관 주인 오사", "탑에서 빛기둥 솟던 밤엔\n다들 한숨도 못 잤어요. 하룻밤에 20골드예요."), { kind: "inn", price: 20 } as unknown as Command,
    ], { graphic: look }),
  ];
  // 밤에 처음 나서면 한 번 — 못 위의 등 하나.
  addEv(project, FS2_FROST_NIGHT_ID, "ev_fs2_night_arrive", "얼음 위의 밤", { x: 1, y: 0 }, [
    page("ev_fs2_night_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_night_arrive_run", "나선다", [sw(SW_NIGHT)], [
      fadeIn(900),
      wait(300),
      say(SARAH, "…발렌 님이다. 혼자야."),
      say(ELENA, "기사들은? 아무도 없어."),
      say(KAEL, "가 보자. 칼은 넣어 두고."),
      setSw(SW_NIGHT, false),
    ], { trigger: { kind: "auto" }, priority: "below" }),
  ]);
}

/** B10 하늘탑 — 이번 비트에서는 문만(층·적·장치는 B10). 밤 서리나루 북쪽 끝에서 들어간다. */
function skyTower(project: Project, exec: Exec): void {
  exec(project, "author_dungeon", {
    // 위로 쌓는 탑: 1층 사방 곁방(기사와 기계의 싸움터, 마법진 한 쌍) · 2층 양 날개(파티가 갈라진다) · 3층 돌아 오르는 방(거울) · 4층 렌즈 대기실.
    type: "tower", adapter: "beodeul", genre: "rpg", name: "하늘탑", id: FS2_TOWER_ID, floors: 4, direction: "up",
    floorShapes: ["cross", "twin", "spiral", "ring"], floorGimmicks: ["teleporter", "none", "none"], gimmick: "none", populate: false,
    entrance: { fromMapId: FS2_FROST_NIGHT_ID, x: FS2_LAKE.gate.x, y: FS2_LAKE.gate.y }, seed: 91,
  });
  // 탑 문은 발렌과 이야기한 뒤에만 열린다(그 전에는 부딪혀도 한 줄만). 문 자리는 도구가 고른 칸.
  const gate = M(project, FS2_FROST_NIGHT_ID).events.find((e) => JSON.stringify(e).includes(`"mapId":"${FS2_TOWER_ID}`));
  if (!gate) throw new Error("[fallen-star act2] 하늘탑 문이 없다");
  FS2_LAKE.gate = { x: gate.x, y: gate.y };
  for (const pg of gate.pages ?? []) pg.conditions = [...(pg.conditions ?? []), sw(SW_VALEN_MET)];
  const first = gate.pages?.[0];
  gate.pages = [
    page(`${gate.id}_shut`, "닫힘", [], [narrate("하늘탑으로 가는 길이다.\n…얼음 위 등불이 자꾸 마음에 걸린다.")],
      { trigger: first?.trigger ?? { kind: "playerTouch" }, priority: first?.priority ?? "below" }),
    ...(gate.pages ?? []),
  ];
  if (FS2_RELEASE_STOP === "B9") towerReleaseStop(project);
}

/** 1.24 판본 끝 — 하늘탑 1층에 들어서면 막 카드·회복·저장, 위층으로 오르는 계단은 「다음 업데이트」(빈 위층을 걷지 않게). */
function towerReleaseStop(project: Project): void {
  ensureSwitch(project, SW_STOP_B9, "판본 끝(1.24): 하늘탑 1층");
  addEv(project, FS2_TOWER_ID, "ev_fs2_tower_stop", "판본 끝", { x: 0, y: 0 }, [
    page("ev_fs2_tower_stop_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_tower_stop_run", "판본 끝", [sw(SW_VALEN_MET)], [
      wait(400),
      say(SARAH, "…발렌 님은 벌써 위로 올라갔다.\n위에서 기계 소리가 나."),
      say(KAEL, "이리스가 이 위에 있어. 가자."),
      fadeOut(900),
      { kind: "recoverAll" } as unknown as Command,
      narrate("제2막 「빌린 불」 — 여기까지", { position: "center", context: "narration" }),
      narrate("하늘탑의 위층, 그리고 이리스는\n다음 업데이트에서 이어집니다.", { position: "center", context: "narration" }),
      fadeIn(700),
      setSw(SW_STOP_B9),
      narrate("지금 저장해 두면 다음 판본에서 하늘탑 1층부터 이어서 할 수 있다.", { context: "system" }),
      { kind: "openSaveMenu" } as unknown as Command,
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_tower_stop_done", "끝", [sw(SW_STOP_B9)], [], { priority: "below" }),
  ]);
  const up = M(project, FS2_TOWER_ID).events.filter((e) => JSON.stringify(e.pages ?? []).includes(`"mapId":"${FS2_TOWER_ID}_f2"`));
  if (!up.length) throw new Error("[fallen-star act2] 하늘탑 1층 위 계단을 못 찾음");
  for (const e of up) {
    e.pages = (e.pages ?? []).map((pg) => ({ ...pg, commands: [narrate("위층으로 가는 계단.\n멀리서 쇠 긁는 소리가 울린다.\n(다음 업데이트에서 이어집니다.)", { context: "system" })] }));
  }
}

// ════════════════════════════════════════════════════════════════════

export interface FallenAct2Ids { hub: string; observatory: string; smithy: string }

export function applyFallenAct2Opening(project: Project, exec: Exec, ids: FallenAct2Ids): void {
  database(project, exec);
  cellMap(project, exec);
  barracks(project, exec);
  hubNight(project, exec, ids.hub);
  curfewHub(project, exec, ids.hub);
  observatoryNight(project, exec, ids.observatory);
  northGate(project, exec, ids.smithy);
  dawnwell(project, exec);
  cellEvents(M(project, FS2_CELL_ID));
  bridge(project, exec);
  northGateEvents(project, exec, ids.hub);
  // 숲 그늘 줄(B4)이 정해진 뒤에 그 북쪽만 태운다.
  scorchAshFields(project, exec);
  dawnwellEvents(project);
  northFortress(project, exec, ids.hub);
  snowPass(project, exec);
  frostford(project, exec, ids.hub);
  lanternNight(project, exec);
  skyTower(project, exec);
  lanternNightEvents(project);
  fortressEvents(project);
  frostFoes(project, exec, FS2_SNOW_PLAN.maps, FS2_SNOW_PLAN.fire);
  detection(project, exec);
  widenEdgeGates(project);
  act2Quest(project, exec);
}

/**
 * 임무 일지 — 2막 줄기. 독립 판정 세 판 모두 「기록 → 임무」에 1막 「떨어진 별 완료」만 있고 지금 할 일이 없다고 했다.
 * 노드는 이미 있는 줄기 스위치로 찬다(새 플래그 없음). 첫 노드(리노의 빵)는 여는 장면에서 차서 처음부터 「진행 중」이다.
 */
function act2Quest(project: Project, exec: Exec): void {
  const steps: [string, string][] = [
    [SW_BREAD, "리노가 감방에 넣어 준 납작빵을 받는다"],
    [SW_CELL_OPEN, "감방 쇠살문을 연다. 유난히 무거운 빵이 수상하다"],
    [SW_OUT, "등불과 순찰을 피해 막사 금고에서 짐을 되찾고, 북동쪽 사다리로 광장에 오른다"],
    [SW_MIRE, "광장 서쪽 빵집에서 미레 아주머니를 찾는다"],
    [SW_HANEL, "광장 우물 사다리로 천문대에 숨어 들어가 하넬 선생님을 만난다"],
    [SW_ROHAN, "대장간 뒷문으로 들어가 로한을 만난다"],
    [SW_BRAM, "광장 북쪽 성벽 밑에서 브람 아저씨를 찾는다"],
    [SW_B4_EDGE, "개구멍으로 빠져나가 북쪽 숲 그늘까지 달아난다"],
    [SW_CERT, "재의 들판을 지나 북쪽 새벽샘 터에서 세린의 흔적을 찾는다"],
    [SW_SARAH, "북방 관문 요새를 뚫고 올라가 새라를 만난다"],
    [SW_FROST_ARRIVE, "요새 북문으로 나가 서리 가도를 넘어 서리나루에 닿는다"],
    [SW_VALEN_MET, "밤이 되면 얼어붙은 못 위에서 발렌을 만난다"],
    [SW_ICE_DONE, "갈라지는 얼음을 건넌다"],
    [SW_STOP_B9, "하늘탑에 들어선다"],
  ];
  const nodes = steps.map(([switchId, description], i) => ({ id: `fs2-${i + 1}`, description, completesWhen: { kind: "switch", switchId, value: true } }));
  exec(project, "define_quest", {
    id: "fs2_main", title: "빌린 불",
    summary: "제2막. 점령된 왕도를 빠져나가, 발렌이 데려간 이리스를 쫓아 북쪽 하늘탑으로 간다.",
    nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i]!.id, to: n.id })),
  });
}

/**
 * 맵 가장자리 출구가 한 칸뿐이면 길 폭 전체로 넓힌다 — 같은 가장자리에서 출구와 이어진(안쪽 칸에서 걸어 들어갈 수 있는) 칸마다
 * 출구 이벤트의 쌍둥이를 둔다. 독립 판정(2026-10-28): 재의 들판 북쪽 길은 x16~17 두 칸인데 출구 이벤트는 (15,0) 한 칸이라
 * 길 끝까지 걸어도 아무 일이 없었다(「북쪽 길이 막혔다」로 60걸음을 헤맸다).
 */
function widenEdgeGates(project: Project): void {
  const maps = Object.keys(project.maps).filter((id) => id.startsWith("fs2_") || FS2_NORTH_ROUTE.mapIds.includes(id) || FS2_SNOW.mapIds.includes(id));
  for (const mapId of maps) {
    const map = M(project, mapId);
    const gates = map.events.filter((e) => {
      const pg = e.pages?.[0];
      return pg?.trigger?.kind === "playerTouch" && (e.pages ?? []).length === 1 && pg.commands.some((c) => c.kind === "transfer")
        && (e.y === 0 || e.y === map.height - 1 || e.x === 0 || e.x === map.width - 1);
    });
    const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
    for (const gate of gates) {
      const horizontal = gate.y === 0 || gate.y === map.height - 1;
      const inward = horizontal ? { x: 0, y: gate.y === 0 ? 1 : -1 } : { x: gate.x === 0 ? 1 : -1, y: 0 };
      const enterable = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height
        && canMove(project, map, x + inward.x, y + inward.y, x, y);
      let n = 0;
      for (const sign of [1, -1]) {
        for (let k = 1; k < 6; k += 1) {
          const x = horizontal ? gate.x + sign * k : gate.x, y = horizontal ? gate.y : gate.y + sign * k;
          const prevX = horizontal ? x - sign : x, prevY = horizontal ? y : y - sign;
          if (!enterable(x, y) || !canMove(project, map, prevX, prevY, x, y)) break;
          if (taken.has(`${x},${y}`)) continue;
          map.events.push({ ...structuredClone(gate), id: `${gate.id}_w${sign > 0 ? "p" : "m"}${k}`, x, y });
          taken.add(`${x},${y}`);
          n += 1;
        }
      }
      void n;
    }
  }
}

/**
 * 알아채기·다가오기(set_field_detection) — v1.25 무리별 성격(난이도 곡선 VQA). 주인공 걷기는 칸당 160ms.
 * - 짐승(들개·재까마귀·요새 사냥개·서리 늑대): 시야 7, 놀람 0.15초, 네 칸 돌진(칸당 0.1초), 평소 160ms.
 * - 도깨비·박쥐: 놀람 0.2초, 세 칸 돌진(칸당 0.11초), 평소 170ms.
 * - 야경꾼(B2): 시야 6, 놀람 0.25초, 세 칸 돌진(0.11초), 평소 170ms — 약한 경비, 남북 길은 비워 둔다.
 * - 순찰 기사(B6 부터): 시야 7, 놀람 0.2초, 다섯 칸 돌진(0.1초), 평소 170ms.
 * - 재뱀·숯덩이 골렘: 느린 정예 — 돌진 없음, 뱀 300ms·골렘 400ms/칸, 골렘은 0.6초 늦게 알아챈다(피해 갈 수 있다).
 * 막사(시야 3 잠입 퍼즐)·B4 개구멍 기사·쇠뇌병(보초 값)은 놓을 때 정한 값을 그대로 쓴다. 닿으면 곧바로 전투다(place_field_enemy).
 */
const DETECTION_PROFILES: { troops: string[]; args: Rec }[] = [
  { troops: [FS2_PATROL_TROOP], args: { sightRange: 6, coneDegrees: 120, alertMs: 250, rush: true, rushSteps: 3, rushStepMs: 110, chaseStepMs: 170, searchMs: 4000, giveUpRange: 12 } },
  { troops: ["troop_fs2_starved_dogs", "troop_fs2_ash_crows", "troop_fs2_fort_dogs", "troop_fs2_frost_wolves", "troop_fs2_frost_mixed"], args: { sightRange: 7, coneDegrees: 110, alertMs: 150, rush: true, rushSteps: 4, rushStepMs: 100, chaseStepMs: 160 } },
  { troops: ["troop_fs2_ash_wisps", "troop_fs2_frost_bats"], args: { sightRange: 7, coneDegrees: 120, alertMs: 200, rush: true, rushSteps: 3, rushStepMs: 110, chaseStepMs: 170 } },
  { troops: [FS2_KNIGHT_TROOP, FS2_GATE_CAPTAIN_TROOP], args: { sightRange: 7, coneDegrees: 120, alertMs: 200, rush: true, rushSteps: 5, rushStepMs: 100, chaseStepMs: 170, searchMs: 5000, giveUpRange: 14 } },
  { troops: ["troop_fs2_ash_snakes"], args: { sightRange: 6, coneDegrees: 100, alertMs: 350, rush: false, chaseStepMs: 300 } },
  { troops: ["troop_fs2_cinder_golem"], args: { sightRange: 6, coneDegrees: 90, alertMs: 600, rush: false, chaseStepMs: 400, giveUpRange: 8 } },
];
function detection(project: Project, exec: Exec): void {
  const routeMaps = [...FS2_NORTH_ROUTE.mapIds, ...FS2_SNOW.mapIds];
  // 막사는 시야 3칸의 잠입 퍼즐이다. 야외 적 설정으로 덮으면 순찰에서 떨어진 동쪽 통로까지 감지한다.
  const act2Maps = Object.keys(project.maps).filter((id) => id !== FS2_BARRACKS_ID && (id.startsWith("fs2_") || routeMaps.includes(id)));
  const byTroop = new Map<string, string[]>();
  for (const id of act2Maps) for (const e of M(project, id).events) {
    const pages = e.pages ?? [];
    if (!pages.some((p) => p.movement?.type === "chase")) continue;
    const troop = JSON.stringify(pages).match(/"troopId":"([^"]+)"/)?.[1];
    if (!troop || troop === FS2_CROSSBOW_TROOP) continue;   // 쇠뇌병은 놓을 때 준 보초 값(좁은 부채꼴·긴 시야)을 그대로 쓴다
    byTroop.set(troop, [...(byTroop.get(troop) ?? []), e.id]);
  }
  for (const profile of DETECTION_PROFILES) {
    const ids = profile.troops.flatMap((t) => byTroop.get(t) ?? []);
    for (const t of profile.troops) byTroop.delete(t);
    if (ids.length) exec(project, "set_field_detection", { mapIds: act2Maps, eventIds: ids, ...profile.args });
  }
  // 목록에 없는 무리(새로 더한 적)는 짐승 기본값 — 빠뜨려도 느린 옛 추격으로 남지 않게.
  const rest = [...byTroop.values()].flat();
  if (rest.length) exec(project, "set_field_detection", { mapIds: act2Maps, eventIds: rest, ...DETECTION_PROFILES[1]!.args });
}
