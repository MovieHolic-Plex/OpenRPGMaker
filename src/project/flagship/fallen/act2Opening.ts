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
import { applyMapShift } from "@/editor/mapShiftActions";
import { canMove, isPassable } from "@/project/collision";
import { applyFallenAct2Tower } from "./act2Tower";
import { buildFrostford, FS2_RELEASE_STOP, SW_FROST_ARRIVE, SW_ICE_DONE, SW_STOP_B9, SW_VALEN_MET } from "./frostford";
import { paintPlace, paintFortApproach, ASH_FIELD_PLAN, ASH_FIELD_PROPS, DAWN_PLAN, DAWN_PROPS, DAWN_BURNT } from "./act2Places";

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

// ── 막사 평면(28×15) ─────────────────────────────────────────────────────
// 북벽에 알코브 넷(침상 셋 x1..4·8..11·15..18, 무기고 x22..26 — 알코브 바닥 y3·y4), 그 사이 벽 기둥(x5..7·12..14·19..21)의 앞면이 y3·y4.
// 홀 y5..13. 야경꾼 둘: 북쪽 통로 y7(6↔24, 10·24·6 에서 멈춰 고개를 돌림) · 남쪽 통로 y10(17↔4). 남벽 x3 이 감방으로 내려가는 계단.
const BARRACKS_PLAN = [
  "############################",
  "#....###....###....###.....#",
  "#....###....###....###.....#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "###.########################",
];
const BARRACKS = {
  entry: { x: 3, y: 13 } as Cell,
  exit: { x: 3, y: 14 } as Cell,
  /** 첫 침상 알코브 — 중간 지점(여기 닿은 뒤 붙잡히면 이 칸으로). */
  mid: { x: 2, y: 4 } as Cell,
  nooks: [
    { x0: 1, x1: 4, cells: [1, 2, 3, 4].map((x) => ({ x, y: 4 }) as Cell) },
    { x0: 8, x1: 11, cells: [] as Cell[] },
    { x0: 15, x1: 18, cells: [] as Cell[] },
    { x0: 22, x1: 26, cells: [] as Cell[] },
  ],
  /** 압수품 큰 상자(2칸, 발밑 줄 y3). */
  chest: { x: 23, y: 3 } as Cell,
  /** 사다리(벽 가구, 발밑 y3) — 앞 칸 (26,4)에서 조사. */
  ladder: { x: 26, y: 3 } as Cell,
  pillars: [{ x: 9, y: 9 }, { x: 18, y: 9 }] as Cell[],
  guards: [
    { id: "ev_fs2_barracks_watch_n", name: "야경꾼(북쪽 통로)", at: { x: 6, y: 7 }, sight: 5, waypoints: [{ x: 10, y: 7 }, { x: 24, y: 7 }, { x: 10, y: 7 }], pauseBeats: 5, lookAround: true, hides: true },
    { id: "ev_fs2_barracks_watch_s", name: "야경꾼(남쪽 통로)", at: { x: 17, y: 10 }, sight: 4, waypoints: [{ x: 4, y: 10 }], pauseBeats: 4, lookAround: false, hides: false },
  ],
};
const SW_BARRACKS_MID = "sw_fs2_barracks_mid";
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
  // 막사 안 — 북벽에 침상 알코브 넷(서쪽 셋 = 2층 침대, 동쪽 끝 = 무기고: 압수품 상자·사다리), 가운데 넓은 홀, 남쪽은 식탁·무기 걸이.
  // 알코브 사이 벽 기둥이 시야를 끊는다 — 홀을 가로지를 때만 등불에 걸린다.
  const built = exec(project, "build_hand_interior_room", {
    mapId: FS2_BARRACKS_ID, name: "심문회 초소 · 막사", tileset: "atlas_biome_interior",
    plan: BARRACKS_PLAN, floor: "flag", wall: "stone", ceiling: "dark",
    zones: BARRACKS.nooks.map((n) => ({ x0: n.x0, y0: 3, x1: n.x1, y1: 4, floor: "dplank" })),
    objects: [
      ...BARRACKS.nooks.slice(0, 3).flatMap((n) => [{ id: "bunk bed", x: n.x0, y: 3 }, { id: "bunk bed", x: n.x0 + 2, y: 3 }]),
      // 무기고 알코브: 칼 걸이 · 압수품 상자(불빛) · 창 걸이 · 사다리
      { id: "sword rack", x: 22, y: 3 },
      { id: "treasure chest big", x: BARRACKS.chest.x, y: BARRACKS.chest.y },
      { id: "staff rack", x: 25, y: 3 },
      { id: "ship ladder", x: BARRACKS.ladder.x, y: BARRACKS.ladder.y },
      // 알코브 사이 벽 기둥 앞면 — 무기 걸이·횃불·방패, 마지막 기둥엔 근무표
      ...[5, 12, 19].flatMap((x) => [{ id: "weapon rack", x, y: 3 }, { id: "wall torch", x: x + 1, y: 3 }, { id: x === 19 ? "notice board" : "shield", x: x + 2, y: 3 }]),
      // 홀 가운데 돌기둥·작전 탁자·짐 더미 — 등불을 가리는 그늘(두 순찰 길 y7·y10 사이)
      ...BARRACKS.pillars.map((c) => ({ id: "column stone", x: c.x, y: c.y })),
      { id: "war map table", x: 12, y: 8 },
      { id: "sack pile", x: 5, y: 9 }, { id: "crate stack", x: 21, y: 9 }, { id: "barrel", x: 25, y: 9 },
      // 무기고 앞 짐 더미(y6, x23..26) — 북쪽 야경꾼이 동쪽 끝(24,7)에서 고개를 들어도 무기고 안(상자·사다리)은 안 보인다.
      // 예전엔 상자 대사를 읽고 사다리로 걷는 사이 그 자리에서 붙잡혔다(목표를 손에 쥔 뒤의 억울한 실패, VQA 2026-10-30). 들어가는 길은 서쪽(22,5).
      { id: "crate", x: 23, y: 6 }, { id: "barrel", x: 24, y: 6 }, { id: "weapon crate", x: 25, y: 6 }, { id: "barrel", x: 26, y: 6 },
      // 남쪽: 식탁 둘과 걸상, 동쪽 훈련 구석
      { id: "stool", x: 6, y: 13 }, { id: "stool", x: 9, y: 13 }, { id: "stool", x: 14, y: 13 }, { id: "stool", x: 17, y: 13 },
      { id: "spear rack", x: 26, y: 11 }, { id: "armor stand", x: 26, y: 12 }, { id: "training dummy", x: 23, y: 13 },
      { id: "barrel stack", x: 20, y: 13 }, { id: "weapon crate", x: 26, y: 13 }, { id: "arrow barrel", x: 1, y: 13 },
    ],
    tables: [{ style: "dining", x: 6, y: 11, w: 4, h: 2 }, { style: "dining", x: 14, y: 11, w: 4, h: 2 }],
    // 두 순찰 길에 깐 긴 깔개 — 야경꾼이 오가는 길이 바닥에 보인다
    lines: [{ id: "rug blue", rect: { x0: 6, y0: 7, x1: 24, y1: 7 } }, { id: "rug brown", rect: { x0: 4, y0: 10, x1: 17, y1: 10 } }],
    goods: [{ id: "mug", x: 7, y: 11 }, { id: "bottle", x: 15, y: 11 }],
    start: [BARRACKS.entry],
  }) as { mapId?: string } | undefined;
  void built;
  // 남벽 틈 = 감방으로 내려가는 계단. links 로 주면 계단 맞춤(fitStairTransfers)이 이동을 무기고 사다리 칸으로 옮긴다 — 직접 단다.
  const back = "ev_fs2_barracks_down";
  addEv(project, FS2_BARRACKS_ID, back, "감방으로 내려가는 계단", BARRACKS.exit, [
    page(`${back}_p`, "계단", [], [transfer(FS2_CELL_ID, CELL.arrive, "down")], { priority: "below", trigger: { kind: "playerTouch" } }),
  ]);
  exec(project, "set_map_properties", { mapId: FS2_BARRACKS_ID, battleBackground: "battle-scenery-cave" });
  (M(project, FS2_BARRACKS_ID) as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  // 어둠 — 벽 횃불은 작게, 압수품 상자는 무기고에서 노랗게 빛난다(들어서자마자 목표가 보인다).
  exec(project, "set_lighting_volume", {
    mapId: FS2_BARRACKS_ID, ambient: 0.62, color: "#0a0e1c", applyMode: "map",
    sources: [
      ...[6, 13, 20].map((x, i) => ({ id: `torch${i}`, at: { x, y: 4 }, radius: 1.8, intensity: 0.55, color: "#ffb860", flicker: true })),
      { id: "gear", at: { x: BARRACKS.chest.x + 1, y: BARRACKS.chest.y }, radius: 2.6, intensity: 0.95, color: "#ffd780", flicker: true },
      { id: "ladder", at: { x: BARRACKS.ladder.x, y: 2 }, radius: 1.6, intensity: 0.5, color: "#9fb4ff" },
    ],
  });
  ensureItemRecord(project, exec);
  ensureSwitch(project, SW_BARRACKS, "B1: 막사에서 압수품을 되찾음");
  ensureSwitch(project, SW_BARRACKS_MID, "B1: 막사 첫 침상 알코브(중간 지점)");
  // 야경꾼 둘 — 정해진 길을 오가며 끝에서 멈춰 고개를 돌린다(규칙이 보이는 순찰). 들키면 「!」 뒤 곧장 덮친다.
  // 붙잡히면: 첫 알코브 전엔 지하 감방으로, 그 뒤엔 첫 알코브 침상 앞으로.
  const caught = {
    text: "야경꾼: 「거기 서! 탈옥이다!」",
    sendText: "붙잡혀 지하 감방으로 도로 끌려갔다.",
    sendTo: { mapId: FS2_CELL_ID, x: CELL.arrive.x, y: CELL.arrive.y },
    checkpoint: { switchId: SW_BARRACKS_MID, sendTo: { mapId: FS2_BARRACKS_ID, x: BARRACKS.mid.x, y: BARRACKS.mid.y }, text: "뻗어 오는 손을 뿌리치고 침상 밑으로 굴러 들어갔다.\n…발소리가 멀어진다." },
  };
  const guardChip = { selectionId: `charset:${WATCHMAN_CHIP.textureKey}:${WATCHMAN_CHIP.characterIndex}` };
  const guardIds: string[] = [];
  for (const g of BARRACKS.guards) {
    const made = exec(project, "make_chase_scene", {
      mapId: FS2_BARRACKS_ID, id: g.id,
      chaser: { at: g.at, graphic: guardChip, speed: 5, sightRange: g.sight },
      patrol: { waypoints: g.waypoints, pauseBeats: g.pauseBeats, lookAround: g.lookAround },
      pursuit: { scope: "map", doorDelayMs: 0, searchMs: 1800, onLost: "return" },
      caughtPenalty: caught,
      // 침상(2층 침대) 앞에서 조사하면 밑으로 숨는다 — 숨는 걸 못 본 야경꾼은 지나간다.
      ...(g.hides ? { hidingSpots: BARRACKS.nooks.slice(0, 3).flatMap((n) => [n.x0, n.x0 + 1, n.x0 + 2, n.x0 + 3].map((x) => ({ x, y: 3 }))) } : {}),
      checkpointOnEntry: false,
      mood: false,
    }) as { eventId?: string } | undefined;
    if (!made?.eventId) throw new Error("[fallen-star act2] 막사 야경꾼을 못 만듦");
    guardIds.push(made.eventId);
    const ev = M(project, FS2_BARRACKS_ID).events.find((e) => e.id === made.eventId);
    if (ev) (ev as unknown as Rec).name = g.name;
  }
  // 시야 = 앞쪽 90° 부채꼴. 바닥에 그 부채꼴 등불 빛이 깔려 어디가 위험한지 보인다(visionLight).
  exec(project, "set_field_detection", {
    mapIds: [FS2_BARRACKS_ID], eventIds: guardIds,
    coneDegrees: 90, alertMs: 450, rush: true, rushSteps: 5, rushStepMs: 90, chaseStepMs: 130, searchMs: 1800,
    visionLight: { color: "#ffd27a", intensity: 0.85 },
  });
  // 처음 들어서면 엘레나가 방의 규칙을 짚는다 — 등불 부채꼴·멈췄다 돌아서는 순찰·침상 밑·목표.
  const hintId = "ev_fs2_barracks_enter";
  addEv(project, FS2_BARRACKS_ID, hintId, "막사에 들어섬", { x: 0, y: 0 }, [
    page(`${hintId}_p`, "막사 규칙", [sw("sw_fs2_barracks_entered", false)], [
      setSw("sw_fs2_barracks_entered"),
      say(ELENA, "(속삭임) 저기, 오른쪽 위 무기고.\n불빛 새는 상자에 우리 짐이 있어. 사다리도 그 옆이야."),
      say(ELENA, "(속삭임) 야경꾼 둘이 돌아. 손등불이 비추는\n바닥은 밟지 마. 끝까지 가면 멈췄다가 돌아서."),
      say(ELENA, "(속삭임) 등 돌렸을 때 왼쪽 벽을 타고 올라가자.\n침상 앞에서 조사하면 밑으로 숨을 수 있어."),
    ], { trigger: { kind: "auto" } }),
  ]);
  ensureSwitch(project, "sw_fs2_barracks_entered", "B1: 막사에 처음 들어섬(규칙 귀띔)");
  // 중간 지점 — 첫 침상 알코브에 닿으면(한 번) 엘레나가 숨을 고른다. 그 뒤로 붙잡히면 여기서 다시 한다.
  BARRACKS.nooks[0]!.cells.forEach((c, i) => {
    const id = `ev_fs2_barracks_mid_${i}`;
    addEv(project, FS2_BARRACKS_ID, id, "첫 침상 알코브(중간 지점)", c, [
      page(`${id}_p`, "숨 고르기", [sw(SW_BARRACKS_MID, false)], [
        setSw(SW_BARRACKS_MID),
        se("cc0-se-orp-inventory-cloth"),
        say(ELENA, "(속삭임) …휴. 여기 침상 그늘이면 안 보여.\n이제 알코브에서 알코브로 건너가자."),
      ], { priority: "below", trigger: { kind: "playerTouch" } }),
    ]);
  });
  ensureSwitch(project, SW_MEDS, "B1: 되찾은 짐에서 약을 챙김");
  // 압수품 상자 — 열면 뚜껑이 젖혀지고(stage_map_reveal) 짐을 되찾는다. 두 칸 다 조사로 열린다.
  // 닫힌 큰 상자 그림 칸(6533..6536)을 열린 그림(6537..6540)으로 — 지은 맵에서 실제 자리·층을 찾아 stage_map_reveal tiles 로 넘긴다.
  const LAYER_OF = { lowerTiles: "lower", lowerOverlayTiles: "lower2", upperTiles: "upper", upperOverlayTiles: "upper2" } as const;
  const bm = M(project, FS2_BARRACKS_ID) as unknown as Record<string, number[] | undefined>;
  const openTiles: Rec[] = [];
  for (let y = BARRACKS.chest.y - 1; y <= BARRACKS.chest.y; y += 1) for (let x = BARRACKS.chest.x; x <= BARRACKS.chest.x + 1; x += 1) {
    for (const [key, layer] of Object.entries(LAYER_OF)) {
      const tile = bm[key]?.[y * M(project, FS2_BARRACKS_ID).width + x];
      if (tile !== undefined && tile >= 6533 && tile <= 6536) openTiles.push({ x, y, layer, tile: tile + 4 });
    }
  }
  if (openTiles.length !== 4) throw new Error(`[fallen-star act2] 막사 큰 상자 그림 칸을 못 찾음(${openTiles.length}/4)`);
  [0, 1].forEach((dx) => {
    const id = `ev_fs2_barracks_gear_${dx}`;
    addEv(project, FS2_BARRACKS_ID, id, "압수품 상자", { x: BARRACKS.chest.x + dx, y: BARRACKS.chest.y }, [
      page(`${id}_shut`, "닫힘", [sw(SW_BARRACKS, false)], [
        se("cc0-se-osx-wooded-box-open"),
        narrate("상자 뚜껑을 젖힌다."),
        item(FS2_GEAR_ITEM, 1),
        { kind: "changeGold", op: "+=", amount: 200 } as unknown as Command,
        se("cc0-se-orp-battle-sword-unsheathe"),
        narrate("「압수품 꾸러미」와 200G를 되찾았다.\n카엘의 검도, 엘레나의 책도 그대로다.", { context: "system" }),
        setSw(SW_BARRACKS),
        say(KAEL, "(속삭임) 찾았다. 손에 익은 게 제일이지."),
        say(ELENA, "(속삭임) 됐어. 사다리로!"),
      ]),
      page(`${id}_open`, "열림", [sw(SW_BARRACKS)], [narrate("빈 상자다.")]),
    ]);
    exec(project, "stage_map_reveal", {
      mapId: FS2_BARRACKS_ID, eventId: id, pageId: `${id}_shut`, tiles: openTiles,
      afterText: "상자 뚜껑을 젖힌다.", theme: "magic", camera: false,
    });
  });
  // 사다리 — 광장 초소 뒷골목으로. 압수품을 되찾기 전엔 「짐부터」.
  const ladderId = "ev_fs2_barracks_ladder";
  addEv(project, FS2_BARRACKS_ID, ladderId, "광장으로 오르는 사다리", BARRACKS.ladder, [
    page(`${ladderId}_wait`, "짐부터", [], [
      narrate("위로 난 사다리다. 바깥바람이 내려온다."),
      say(ELENA, "잠깐, 우리 짐. 옆 상자에 있을 거야.\n빈손으로는 못 나가."),
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
}

/** 압수품 꾸러미 — 막사 상자에서 되찾는 짐(upsert_item). */
function ensureItemRecord(project: Project, exec: Exec): void {
  exec(project, "upsert_item", { item: { id: FS2_GEAR_ITEM, name: "압수품 꾸러미", description: "초소에서 빼앗긴 짐. 카엘의 검도, 엘레나의 책도 그대로다.", price: 0, type: "special", occasion: "never", consumable: false } });
}

// ════════════════════════════════════════════════════════════════════
// 4. 통금의 밤 — 광장 판(B2 의 무대). B1 에서는 도착 칸·밤 분위기까지만.
// ════════════════════════════════════════════════════════════════════

function hubNight(project: Project, exec: Exec, hubId: string): void {
  // 같은 광장의 「통금의 밤」 판 — 사람·연출(1막 포위·군중·발렌)은 비우고 문만 남겨 잠근다(duplicate_map events:doors).
  // B2 가 순찰 기사·창틈 주민을, B3·B4 가 천문대 우물·대장간 문을 새로 연다.
  // 천문대 정문만 다른 문구 — 미레 말(기사가 지킨다)과 맞춘다(lockedDoorTexts: 그 맵으로 가는 문).
  const obsMapId = M(project, hubId).events
    .map((e) => JSON.stringify(e.pages ?? []).match(/"kind":"transfer","mapId":"([^"]+)"/)?.[1])
    .find((to) => to && project.maps[to]?.name.includes("천문대"));
  if (!obsMapId) throw new Error("[fallen-star act2] 광장에서 천문대로 가는 문을 못 찾음");
  exec(project, "duplicate_map", {
    mapId: hubId, id: FS2_HUB_NIGHT_ID, name: "왕도 아스텔 · 통금의 밤",
    events: "doors", lockedDoorText: "통금이다. 문이 안에서 굳게 잠겨 있다.",
    lockedDoorTexts: [{ mapId: obsMapId, text: "천문대 정문에 쇠사슬이 감겨 있다.\n문 너머에서 쇠 장화 소리가 오간다." }],
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
/** Q4 등 걸 세 집 — 실내로 이어진 잠긴 문 중 천문대·미레·마르타 곁·대장간을 뺀 셋(별지기·약방·리사네). */
function lampQuestPickDoors(project: Project, hubId: string): GameEvent[] {
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
  return picked;
}

function ensureLampQuestSwitches(project: Project): void {
  for (const [id, name] of [[SW_Q4_TAKEN, "B2 Q4: 꺼진 등을 맡았다"], [SW_Q4_DONE, "B2 Q4: 꺼진 등 — 보상"],
    [`${SW_Q4_LAMP}0`, "B2 Q4: 등 1"], [`${SW_Q4_LAMP}1`, "B2 Q4: 등 2"], [`${SW_Q4_LAMP}2`, "B2 Q4: 등 3"]] as const) ensureSwitch(project, id, name);
}

/** 등을 건 집 창에만 켜지는 작은 불(스위치 조건 광원) — 큰 원 하나는 벽 전체가 불난 것처럼 보였다(VQA 1·2차). */
function lampQuestGlowSources(doors: readonly GameEvent[]): Rec[] {
  return doors.flatMap((door, i) => (Q4_WINDOWS[`${door.x},${door.y}`] ?? [{ x: door.x, y: door.y - 1 }]).map((c, k) => ({
    id: `q4_glow_${i}_${k}`, at: c, radius: 1, intensity: 0.85, color: "#ffb050", flicker: true, when: { switchId: `${SW_Q4_LAMP}${i}` },
  })));
}

/** 등 걸기 — 잠긴 문에 퀘스트 페이지 둘을 덧붙인다(add_event_page: 문 그림·발동은 첫 페이지에서 물려받는다). */
function lampQuestDoors(project: Project, exec: Exec, doors: readonly GameEvent[], patrolIds: readonly string[]): void {
  const hub = M(project, FS2_HUB_NIGHT_ID);
  doors.forEach((door, i) => {
    const lamp = `${SW_Q4_LAMP}${i}`;
    // 가장 가까운 야경꾼이 문고리 소리에 고개를 든다 — 등을 거는 순간이 통금 속 짧은 긴장으로 읽히게(감독 검수: 야경꾼이 반응하지 않았다).
    const watcher = [...patrolIds].sort((a, b) => {
      const ea = hub.events.find((e) => e.id === a), eb = hub.events.find((e) => e.id === b);
      return (ea ? Math.abs(ea.x - door.x) + Math.abs(ea.y - door.y) : 999) - (eb ? Math.abs(eb.x - door.x) + Math.abs(eb.y - door.y) : 999);
    })[0];
    exec(project, "add_event_page", { mapId: FS2_HUB_NIGHT_ID, eventId: door.id, page: {
      id: `${door.id}_q4_hang`, name: "등 걸기", conditions: [sw(SW_Q4_TAKEN)], commands: [
        narrate("문고리에 꺼진 등을 건다."),
        item(FS2_UNLIT_LAMP, -1),
        setSw(lamp),
        se("cc0-se-ors-item-wood-01"),
        ...(watcher ? [emote(watcher, "question", 900), wait(500), narrate("…달그락. 멀리서 손등불 하나가 이쪽을 비추다 지나간다.")] : []),
        narrate("안에서 누가 가만히 두드린다. 똑, 똑, 똑.\n잠시 뒤, 창 안쪽에 작은 불이 켜진다."),
      ] } });
    exec(project, "add_event_page", { mapId: FS2_HUB_NIGHT_ID, eventId: door.id, page: {
      id: `${door.id}_q4_hung`, name: "등이 걸린 문", conditions: [sw(lamp)], commands: [narrate("문고리에 꺼진 등이 걸려 있다.\n창 안쪽에 촛불 하나가 켜져 있다.")] } });
  });
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
  ensureLampQuestSwitches(project);
  const lampDoors = lampQuestPickDoors(project, hubId);
  exec(project, "set_lighting_volume", {
    mapId: FS2_HUB_NIGHT_ID, applyMode: "map", ambient: 0.78, color: "#0f1a4c",
    sources: [
      { id: "lamp", at: { kind: "player" }, radius: 3, intensity: 0.45, color: "#9fb4ff" },
      ...[MIRE_AT, TOBY_AT, MARTA_AT].map((c, i) => ({ id: `crack${i}`, at: { x: c.x, y: c.y - 1 }, radius: 1.5, intensity: 0.7, color: "#ffc070", flicker: true })),
      ...HUB_WINDOWS.map((c, i) => ({ id: `window${i}`, at: c, radius: 1, intensity: 0.75, color: "#ffb050" })),
      ...patrolIds.map((eventId, i) => ({ id: `patrol_lamp${i}`, at: { eventId }, radius: 2.2, intensity: 0.75, color: "#ffc070", flicker: true })),
      // 뚜껑 문 골목의 출구 틈(한 칸) — 불빛이 새어 나와 보이게(엘레나가 도착 때 이 불빛을 짚는다).
      { id: "alley_gap", at: { x: HUB_ALLEY_GAP.x, y: HUB_ALLEY_GAP.y }, radius: 2, intensity: 0.75, color: "#ffc070", flicker: true },
      // 등을 건 집 창 — 그 집 스위치가 켜져야 켜진다(when).
      ...lampQuestGlowSources(lampDoors),
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
  lampQuestDoors(project, exec, lampDoors, patrolIds);
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
  // 오르는 거리 3칸 — 5칸이면 발판이 천장 벽을 다 넘어 맵 위 끝까지 솟았다(VQA: 승강기가 벽 위로 떠오른다). 짧게 올라가 어두워진다.
  exec(project, "place_lift", {
    mapId: FS2_SHAFT_ID, x: SHAFT.lift.x, y: SHAFT.lift.y, direction: "up", distance: 3, trigger: "action", text: "승강 장치에 올라탄다. 위는 천문대 서고다.",
    toMapId: FS2_OBS_NIGHT_ID, toX: OBS.lift.x, toY: OBS.lift.y, toDirection: "right",
    // 승강구 쪽에도 천문대 쪽 발판 그림을 칠한다 — 그림이 없어 「어디서 타는지」 몰랐다.
    copyPlate: true,
  });
  exec(project, "place_lift", {
    mapId: FS2_OBS_NIGHT_ID, x: OBS.lift.x, y: OBS.lift.y, direction: "down", distance: 3, trigger: "action", text: "승강 장치로 서고 밑으로 내려간다.",
    toMapId: FS2_SHAFT_ID, toX: SHAFT.lift.x, toY: SHAFT.lift.y, toDirection: "down",
  });
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
/** 브람이 개구멍으로 먼저 빠져나갔다(광장에서 사라진다). */
const SW_B4_BRAM_OUT = "sw_fs2_b4_bram_out";
/** 숲 가장자리에서 등불들이 멈춘 뒤 물러나 사라졌다. */
const SW_B4_GONE = "sw_fs2_b4_watch_gone";
const ROHAN = "대장장이 로한";
const BRAM = "숲지기 브람";
/** 광장 → 대장간 문(1막 문 칸) · 대장간 안 문 칸·로한 자리. */
const SMITHY = { hubDoor: { x: 29, y: 42 } as Cell, hubFront: { x: 29, y: 43 } as Cell, door: { x: 7, y: 10 } as Cell, arrive: { x: 7, y: 9 } as Cell, rohan: { x: 10, y: 6 } as Cell };
/** 북쪽 성벽 개구멍 — 광장 북쪽 돌바닥(38,16)에서 위를 보고 조사. 브람이 그 곁(39,16)에 숨어 있다. */
const HOLE = { wall: { x: 38, y: 15 } as Cell, front: { x: 38, y: 16 } as Cell, bram: { x: 39, y: 16 } as Cell, rubble: { x: 40, y: 16 } as Cell };
/** 버들항 장소 · 돌무더기 — 브람이 빼낸 돌을 내려놓는 자리. */
const HOLE_RUBBLE = 26720;
/** 버들항 장소 · 벽 아치(어두운 아치 윗부분) 왼쪽·오른쪽 칸 — 개구멍 그림. */
const HOLE_ARCH = [26572, 26573] as const;

/** 북쪽 숲 어귀·재의 들판(B5 가 이어 짓는다). 만든 맵 id 는 결과에서 받는다. */
export const FS2_NORTH_ROUTE: { mapIds: string[]; entry: Cell; entries: Cell[]; treeline: number } = { mapIds: [], entry: { x: 0, y: 0 }, entries: [], treeline: 0 };
/** B4 추격 장면 좌표(체크포인트·QA 용). */
export const FS2_B4: { edge: Cell[]; knights: Cell[]; bram: Cell } = { edge: [], knights: [], bram: { x: 0, y: 0 } };

function northGate(project: Project, exec: Exec, smithyId: string): void {
  for (const [id, name] of [[SW_ROHAN, "B4: 로한의 창"], [SW_BRAM, "B4: 브람 — 개구멍"], [SW_B4_ALARM, "B4: 개구멍 — 들켰다"], [SW_B4_EDGE, "B4: 숲 가장자리 — 브람의 고백"], [SW_B4_BRAM_OUT, "B4: 브람이 먼저 빠져나감"], [SW_B4_GONE, "B4: 등불들이 물러남"]] as const) ensureSwitch(project, id, name);
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
    // 첫 장은 숲 어귀(성벽 밑 풀밭 → 나무 벽 틈으로 숲길, B4 추격 무대), 둘째 장은 트인 들판(재의 들판, B5 가 다시 칠한다).
    fromMapId: FS2_HUB_NIGHT_ID, side: "north", count: 2, terrains: ["edge", "field"], linkFrom: false,
    names: ["북쪽 숲 어귀", "재의 들판"], moods: ["dark", "fog"], seed: 211,
  }) as { maps?: { mapId: string; entry: Cell; treeline?: number }[] } | undefined;
  const maps = route?.maps ?? [];
  if (maps.length !== 2) throw new Error("[fallen-star act2] 북쪽 들판이 두 장이 아니다");
  FS2_NORTH_ROUTE.mapIds = maps.map((m) => m.mapId);
  FS2_NORTH_ROUTE.entry = maps[0]!.entry;
  FS2_NORTH_ROUTE.entries = maps.map((m) => m.entry);
  FS2_NORTH_ROUTE.treeline = maps[0]!.treeline ?? maps[0]!.entry.y - 15;
}

function northGateEvents(project: Project, exec: Exec): void {
  // 광장 대장간 문 — 하넬을 만난 뒤엔 뒷문이 열려 있다.
  const hub = M(project, FS2_HUB_NIGHT_ID);
  const door = hub.events.find((e) => e.x === SMITHY.hubDoor.x && e.y === SMITHY.hubDoor.y);
  if (!door?.pages?.length) throw new Error("[fallen-star act2] 대장간 문이 없다");
  exec(project, "add_event_page", { mapId: FS2_HUB_NIGHT_ID, eventId: door.id, page: {
    id: `${door.id}_fs2_open`, name: "뒷문(열림)", conditions: [sw(SW_HANEL)],
    commands: [narrate("대장간 뒷문이 살짝 열려 있다."), transfer(FS2_SMITHY_ID, SMITHY.arrive, "up")] } });
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
    page("ev_fs2_hub_bram_gone", "브람(숲으로)", [sw(SW_B4_BRAM_OUT)], [], { priority: "below", graphic: { transparent: true } }),
  ]);
  const [first] = FS2_NORTH_ROUTE.mapIds;
  addEv(project, FS2_HUB_NIGHT_ID, "ev_fs2_hub_hole", "성벽 개구멍", HOLE.wall, [
    page("ev_fs2_hub_hole_p", "성벽", [], [narrate("두꺼운 성벽이다. 돌 하나가 조금 튀어나와 있다.")]),
    page("ev_fs2_hub_hole_open", "개구멍", [sw(SW_BRAM)], [
      // 브람이 직접 돌을 뺀다(사용자 지적 2026-10-29: 「성벽 돌 빼는 것도 이상함」 — 대사뿐, 화면에선 아무도 움직이지 않았다).
      // 브람이 제자리(카엘 오른쪽)에서 성벽을 보고 돌에 손을 걸고 두 번 버틴다(긁는 소리) → 카메라가 다가가 먼지와 함께 구멍이 열린다
      // → 브람이 빼낸 돌을 오른쪽에 내려놓는다(돌무더기) → 브람이 먼저 기어 나간다.
      // 예전 판은 카엘이 한 칸 내려서고 브람이 카엘 자리로 왔다 — 뒤따르던 엘레나가 그 칸으로 들어와 브람이 화면에서 가려졌다(VQA, 2026-10-30).
      cutBegin(),
      route("@player", [{ kind: "turn", dir: "up" }]),
      route("ev_fs2_hub_bram", [{ kind: "turn", dir: "up" }]),
      narrate("브람이 성벽 돌 틈에 손가락을 건다."),
      route("ev_fs2_hub_bram", [
        { kind: "setDirectionFix", enabled: true },
        // 제자리에서 두 번 버틴다 — jump 는 dx/dy 0 이면 바라보는 쪽으로 두 칸 뛴다(성벽 너머로 사라졌다, VQA 2026-10-30). dropIn 은 칸 이동이 없다.
        { kind: "dropIn", heightPx: 3, durationMs: 200, se: "cc0-se-ors-item-stone-02", impact: false },
        { kind: "wait" },
        { kind: "dropIn", heightPx: 4, durationMs: 220, se: "cc0-se-ors-item-stone-03", impact: false },
      ]),
      say(BRAM, "끄응……!"),
      narrate("돌이 끌려 나온다."),
      // ← 여기에 stage_map_reveal(가까이 ×2·먼지·흔들림·구멍 칸)이 들어간다.
      se("cc0-se-ors-stones-02"),
      { kind: "changeTile", mapId: FS2_HUB_NIGHT_ID, layer: "upper", x: HOLE.rubble.x, y: HOLE.rubble.y, tile: HOLE_RUBBLE } as unknown as Command,
      route("ev_fs2_hub_bram", [{ kind: "setDirectionFix", enabled: false }, { kind: "turn", dir: "down" }]),
      say(BRAM, "됐다. 내가 먼저 간다. 바로 따라붙어라."),
      se("cc0-se-orp-inventory-cloth"),
      route("ev_fs2_hub_bram", [{ kind: "turn", dir: "up" }, { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "changeOpacity", delta: -255 }]),
      setSw(SW_B4_BRAM_OUT),
      wait(300),
      // 광장 순찰 등불이 성벽 쪽으로 돈다 — 소리 나는 쪽에 손등불이 켜진다.
      se("cc0-se-osx-metal-01"),
      shake(2, 300),
      say("야경꾼", "거기, 성벽 밑! 누구냐!"),
      emote("player", "exclamation", 600),
      say(ELENA, "들켰어! 뛰어!"),
      setSw(SW_B4_ALARM),
      // 기어 나간다 — 구멍 칸으로 두 걸음(성벽을 통과해) 들어가며 화면이 어두워진다.
      se("cc0-se-orp-inventory-cloth"),
      { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: "up" }, { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "changeSpeed", delta: -1 }, { kind: "move", dir: "up" }, { kind: "changeSpeed", delta: 1 }, { kind: "setThrough", enabled: false }], repeat: false, wait: true, skippable: true } } as unknown as Command,
      cutLabel(),
      cutEnd(),
      transfer(first!, { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 }, "up"),
    ]),
    // 붙잡혀 도로 끌려온 뒤 — 구멍은 이미 뚫려 있다. 조사하면 곧장 다시 기어 나간다(돌 빼기 연출을 되풀이하지 않는다).
    page("ev_fs2_hub_hole_again", "개구멍(다시)", [sw(SW_B4_ALARM)], [
      narrate("등불이 아직 성벽 밖을 훑는다. 다시 기어 나간다."),
      se("cc0-se-orp-inventory-cloth"),
      { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: "up" }, { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "setThrough", enabled: false }], repeat: false, wait: true, skippable: true } } as unknown as Command,
      transfer(first!, { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 }, "up"),
    ]),
  ]);
  const holeMeta = project.tilesets[M(project, FS2_HUB_NIGHT_ID).tilesetId]?.tileMeta ?? [];
  if (HOLE_ARCH.some((t) => holeMeta[t]?.label !== "버들항 장소 · 벽 아치")) throw new Error("[fallen-star act2] 개구멍 아치 칸 번호가 칩셋과 어긋났다");
  if (holeMeta[HOLE_RUBBLE]?.label !== "버들항 장소 · 돌무더기") throw new Error("[fallen-star act2] 돌무더기 칸 번호가 칩셋과 어긋났다");
  // 돌을 빼면 성벽 밑에 어두운 구멍이 드러난다(공용 하수도 벽 아치 윗부분 둘 — 새 그림 없음). 카메라가 두 배로 다가가 먼지·흔들림과 함께.
  exec(project, "stage_map_reveal", {
    mapId: FS2_HUB_NIGHT_ID, eventId: "ev_fs2_hub_hole", pageId: "ev_fs2_hub_hole_open", afterText: "돌이 끌려 나온다.",
    tiles: [{ x: HOLE.wall.x, y: HOLE.wall.y, layer: "upper", tile: HOLE_ARCH[0] }, { x: HOLE.wall.x + 1, y: HOLE.wall.y, layer: "upper", tile: HOLE_ARCH[1] }],
    theme: "stone", camera: true, zoom: 2,
  });
  forestEdgeChase(project, exec, first!, bramChip, FS2_NORTH_ROUTE.treeline);
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
 * B4 숲 어귀 추격 — 개구멍을 빠지자 광장 순찰에 들켰다. 성벽 밑 풀밭(맵 남쪽 절반)을 가로질러 북쪽 숲 벽 틈까지 뛰는 장면.
 * 사용자 지적(2026-10-29): 「숲 그늘도 이상하고 … 추격씬도 이상함」 — 트인 들판 한복판에 그림자 띠만 칠해 「숲 그늘」이라 불렀고,
 * 기사 둘은 뒤에서 느리게 따라와 몇 초 만에 끝났다. 이제:
 *  · 맵 자체가 숲 어귀(author_forest_route terrain:'edge') — 남쪽 풀밭, 북쪽 들쭉날쭉한 나무 벽, 그 틈으로 숲길.
 *  · 틈 양옆에 숲 길돌(룬 선돌) 둘 + 브람의 등불 — 처음 화면 위쪽 끝에서부터 「저기까지」가 보인다.
 *  · 나무 벽 아래 풀밭에 수관 그늘(paint_shadow), 달빛은 풀밭에만 — 북쪽으로 갈수록 화면이 차츰 어두워진다.
 *  · 야경꾼 셋, 큰 손등불: 뒤 왼쪽·오른쪽 앞에서 둘이 깨어 몰아오고, 풀밭 가운데를 가로로 도는 하나는 앞쪽 부채꼴로 길목을 지킨다.
 *  · 틈에 닿으면 등불들이 멈칫 → 「숲지기 땅이다」 → 뒤로 물러나며 꺼진다. 브람의 고백.
 * 붙잡히면 전투 없이 개구멍 안쪽(광장)으로 도로 기어든다 — 개구멍을 다시 조사하면 곧장 다시 시작.
 */
function forestEdgeChase(project: Project, exec: Exec, mapId: string, bramChip: { textureKey: string; characterIndex: number }, treeline: number): void {
  const map = M(project, mapId);
  const arrive = { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 };
  const dist = walkSteps(project, map, arrive);
  const open = (x: number, y: number) => dist.has(`${x},${y}`);
  const row = (y: number) => [...dist.keys()].map((k) => { const [x, yy] = k.split(",").map(Number); return { x: x!, y: yy! }; }).filter((c) => c.y === y).sort((a, b) => a.x - b.x);
  // 도착선 — 풀밭 끝(treeline) 위로 처음 좁아지는 줄(나무 벽 틈). 그 줄 칸을 밟으면 숲지기 땅.
  let edgeY = -1;
  for (let y = treeline; y >= Math.max(1, treeline - 4); y -= 1) if (row(y).length && row(y).length <= 9) { edgeY = y; break; }
  if (edgeY < 0) throw new Error(`[fallen-star act2] 숲 어귀 나무 벽 틈을 못 찾았다(treeline ${treeline})`);
  const edge = row(edgeY);
  FS2_B4.edge = edge;
  const gapL = edge[0]!.x, gapR = edge[edge.length - 1]!.x, gapC = Math.round((gapL + gapR) / 2);
  // 수관 그늘 — 숲(못 가는 칸) 바로 아래 풀밭 칸은 위 절반~통째로, 두 칸 아래는 띄엄띄엄 1/4 칸. 나무 섬 아래도 같은 규칙.
  const shade: Rec[] = [];
  for (let y = edgeY; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    if (!open(x, y)) continue;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (!open(x, y - 1)) shade.push(h % 3 === 0 ? { x, y, bits: 15 } : { x, y, quarters: ["tl", "tr"] });
    else if (y >= 2 && !open(x, y - 2) && h % 2 === 0) shade.push({ x, y, quarters: [h % 4 < 2 ? "tl" : "tr"] });
  }
  // 틈 안쪽(숲지기 땅) — 도착선과 그 북쪽 두 줄은 통째로 그늘.
  for (let y = edgeY - 2; y <= edgeY; y += 1) for (const c of row(y)) shade.push({ x: c.x, y: c.y, bits: 15 });
  exec(project, "paint_shadow", { mapId, cells: shade, mode: "add" });
  // 숲 길돌 — 틈 어귀 양옆(풀밭 쪽 첫 줄). 서른 해 전 브람이 세운 「여기부터 숲지기 땅」 표지.
  const mouth = row(edgeY + 1);
  const stones: Cell[] = [];
  for (const want of [gapL - 1, gapR + 1]) {
    const at = mouth.filter((c) => c.y === edgeY + 1).sort((a, b) => Math.abs(a.x - want) - Math.abs(b.x - want))[0];
    if (!at || Math.abs(at.x - gapC) < 2) continue;
    try { exec(project, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-dungeon-theme-waystone", mapId, x: at.x, y: at.y - 1 }); stones.push(at); } catch { /* 그 칸 거절 — 길돌 하나만 */ }
  }
  // 야경꾼 셋 — 광장에서 본 은빛 갑옷 칩. 경보(SW_B4_ALARM)가 켜진 채 들어오므로 도착하자마자 움직인다.
  const knight = { selectionId: `charset:${WATCHMAN_CHIP.textureKey}:${WATCHMAN_CHIP.characterIndex}` };
  const meadowMid = Math.round((arrive.y + edgeY) / 2);
  const pick = (want: Cell, avoid: Cell[] = []): Cell | undefined =>
    [...dist.keys()].map((k) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; })
      .filter((c) => c.y > edgeY + 2 && !avoid.some((a) => Math.abs(a.x - c.x) + Math.abs(a.y - c.y) < 3))
      .sort((a, b) => Math.abs(a.x - want.x) + Math.abs(a.y - want.y) - (Math.abs(b.x - want.x) + Math.abs(b.y - want.y)))[0];
  const spots: { at: Cell; patrol?: Cell[] }[] = [];
  const behindL = pick({ x: arrive.x - 9, y: arrive.y - 1 });
  if (behindL) spots.push({ at: behindL });
  const aheadR = pick({ x: arrive.x + 13, y: arrive.y - 8 }, spots.map((s) => s.at));
  if (aheadR) spots.push({ at: aheadR });
  // 나무 벽 틈 어귀 앞(도착선 네 줄 아래)을 가로로 도는 야경꾼 — 좌우 끝에서 멈춰 둘러본다. 서쪽 끝에서 출발해 동쪽으로.
  // 곧장 틈으로 내달리면 등 뒤를 스치고 지나가지만, 서쪽으로 돌아가면 그 부채꼴에 걸린다(추격 시뮬레이션 /tmp/fs2front/sim, 2026-10-29).
  const sweepY = edgeY + 4;
  const sweepRow = row(sweepY);
  const sweepL = sweepRow.find((c) => c.x >= 4), sweepR = [...sweepRow].reverse().find((c) => c.x <= map.width - 6);
  if (sweepL && sweepR) spots.push({ at: { x: sweepL.x, y: sweepY }, patrol: [{ x: sweepR.x, y: sweepY }] });
  const knightIds: string[] = [];
  const sweeperIds: string[] = [];
  let why = "후보 없음";
  for (const s of spots) {
    try {
      const made = exec(project, "make_chase_scene", {
        mapId,
        chaser: { at: s.at, graphic: knight, speed: 5, sightRange: s.patrol ? 6 : 10 },
        ...(s.patrol ? { patrol: { waypoints: s.patrol, pauseBeats: 3, lookAround: true } } : {}),
        pursuit: { scope: "map", doorDelayMs: 0, searchMs: 3000, onLost: s.patrol ? "return" : "wait" },
        // 끌려가는 곳(광장 개구멍 앞)은 아래에서 직접 잇는다 — 도구의 통행 검사가 그 칸(돌아가는 이벤트와 같은 칸)을 막힌 칸으로 본다.
        caughtPenalty: { text: "야경꾼: 「잡았다, 이 쥐새끼들!」\n카엘은 손을 뿌리치고\n개구멍 안으로 도로 기어들었다." },
        activateSwitch: SW_B4_ALARM,
        checkpointOnEntry: false,
        mood: false,
      }) as { eventId?: string } | undefined;
      if (!made?.eventId) continue;
      const ev = M(project, mapId).events.find((e) => e.id === made.eventId);
      if (ev) {
        (ev as unknown as Rec).name = "야경꾼";
        const look = (dir: Dir): Rec => ({ graphic: chip(WATCHMAN_CHIP.textureKey, WATCHMAN_CHIP.characterIndex, dir) });
        // 숲지기 땅에 닿으면 멈칫(그 자리에 서서 숲을 본다) → 물러나며 사라진다.
        ev.pages = [...(ev.pages ?? []),
          page(`${made.eventId}_halt`, "멈칫", [sw(SW_B4_EDGE)], [], { priority: "same", ...look("up") }) as EventPage,
          page(`${made.eventId}_gone`, "물러남", [sw(SW_B4_GONE)], [], { priority: "below", graphic: { transparent: true } }) as EventPage];
        FS2_B4.knights.push({ x: ev.x, y: ev.y });
      }
      (s.patrol ? sweeperIds : knightIds).push(made.eventId);
    } catch (e) { why = String((e as Error).message).slice(0, 300); /* 그 칸은 도구가 거절 — 다음 자리 */ }
  }
  if (knightIds.length + sweeperIds.length < 2) throw new Error(`[fallen-star act2] 숲 어귀에 야경꾼을 못 세웠다: ${why}`);
  const allIds = [...knightIds, ...sweeperIds];
  // 브람 — 틈 안쪽 한 걸음. 경보 뒤에만 나타나 등을 든다.
  const beyond = [...row(edgeY - 1), ...row(edgeY - 2)];
  const bramAt = beyond.sort((a, b) => Math.abs(a.x - gapC) - Math.abs(b.x - gapC))[0];
  if (!bramAt) throw new Error("[fallen-star act2] 숲 가장자리 브람 자리가 없다");
  FS2_B4.bram = bramAt;
  const bramPage = (dir: Dir): Rec => ({ graphic: chip(bramChip.textureKey, bramChip.characterIndex, dir) });
  addEv(project, mapId, "ev_fs2_edge_bram", BRAM, bramAt, [
    page("ev_fs2_edge_bram_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_edge_bram_wait", "숲 그늘", [sw(SW_B4_ALARM)], [say(BRAM, "이리 와라. 길돌 안쪽으로.")], bramPage("down")),
    page("ev_fs2_edge_bram_after", "브람(뒤)", [sw(SW_B4_EDGE)], [say(BRAM, "가라. 여기서부턴 내 숲이 아니다.")], bramPage("down")),
  ]);
  // 밤 숲 조명 — 짙은 밤(0.82). 달빛은 성벽 밑 풀밭에만 셋으로 고르게 깔리고 나무 벽 쪽으로 옅어진다 — 북쪽으로 갈수록 화면이 차츰 어두워진다.
  // 야경꾼 손등불은 크게(반지름 4) — 다가오는 게 멀리서도 보인다. 브람의 등은 틈 안에서 작게 깜빡인다(가야 할 곳).
  const moonY = Math.min(map.height - 2, meadowMid + 3);
  const moonR = Math.max(6, Math.round((arrive.y - edgeY) / 2) + 2);
  exec(project, "set_lighting_volume", {
    mapId, applyMode: "map", ambient: 0.82, color: "#0a1024",
    sources: [
      ...[0.2, 0.5, 0.8].map((f, i) => ({ id: `moon${i}`, at: { x: Math.round(map.width * f), y: moonY }, radius: moonR, intensity: 0.5, color: "#c4d2ff" })),
      { id: "player", at: { kind: "player" }, radius: 2.5, intensity: 0.3, color: "#9fb4ff" },
      ...knightIds.map((eventId, i) => ({ id: `knight_lamp${i}`, at: { eventId }, radius: 4, intensity: 1, color: "#ffb050", flicker: true })),
      { id: "bram_lamp", at: { eventId: "ev_fs2_edge_bram" }, radius: 2.5, intensity: 0.75, color: "#ffe08a", flicker: true, when: { switchId: SW_B4_ALARM } },
    ],
  });
  // 조명 뒤에 감지 — visionLight(부채꼴 손등불)는 지금 맵 조명에 덧붙는다(먼저 걸면 위 조명이 덮어쓴다).
  // 몰아오는 둘 — 「거기 서라!」 0.3초 뒤 움직이고, 칸당 0.127초(추격 엔진 개편 #3907 의 「빠름」 — 주인공 걷기 0.16초보다 빠르다, 12칸마다 숨 고름), 네 칸 안이면 0.09초로 덮친다.
  if (knightIds.length) exec(project, "set_field_detection", { mapIds: [mapId], eventIds: knightIds, sightRange: 10, alertMs: 300, chaseStepMs: 127, rush: true, rushSteps: 4, rushStepMs: 90, searchMs: 3000, giveUpRange: 20 });
  // 가로로 도는 하나 — 앞쪽 90° 부채꼴만 본다. 그 부채꼴이 손등불 빛으로 바닥에 깔린다. 틈 어귀를 막는 몫이라 덮치지 않고 칸당 0.15초(주인공과 거의 같은 빠르기) —
  // 곧장 뛰는 주인공을 틈 바로 앞에서 덮치던 판(브라우저 녹화, 2026-10-30)은 「성공 길」이 없었다. 돌아가는 길(서쪽)에선 여전히 부채꼴에 걸린다.
  if (sweeperIds.length) exec(project, "set_field_detection", { mapIds: [mapId], eventIds: sweeperIds, sightRange: 6, coneDegrees: 90, alertMs: 300, chaseStepMs: 150, rush: false, searchMs: 2500, visionLight: { color: "#ffc070", intensity: 0.9 } });
  // 붙잡히면 개구멍 앞(광장)으로 — 도구 검사 뒤에 직접 붙인다(위 caughtPenalty 주석).
  for (const id of allIds) {
    const chasePage = M(project, mapId).events.find((e) => e.id === id)?.pages?.[0];
    if (chasePage) chasePage.commands = [...(chasePage.commands ?? []), transfer(FS2_HUB_NIGHT_ID, HOLE.front, "down")];
  }
  const confess: Command[] = [
    cutBegin(),
    setSw(SW_B4_EDGE),
    // 등불들이 그 자리에 멈칫 — 숲 쪽을 보고 서서 머뭇거린다.
    ...allIds.map((id) => emote(id, "question", 700)),
    { kind: "setLighting", ambient: 0.9, color: "#070b18", transitionMs: 1200 } as unknown as Command,
    narrate("길돌을 지나 나무 그늘로 들어서자\n뒤쫓던 등불들이 멈춘다."),
    say("야경꾼", "…숲지기 땅이다. 더는 못 들어가. 돌아가자."),
    // 물러나며 꺼진다 — 세 걸음 뒷걸음질(얼굴은 숲 쪽) 동안 흐려진다.
    ...allIds.map((id, i) => route(id, [{ kind: "setDirectionFix", enabled: true }, { kind: "setThrough", enabled: true },
      ...[0, 1, 2].flatMap(() => [{ kind: "move", dir: "down" }, { kind: "changeOpacity", delta: -80 }])], i === allIds.length - 1)),
    setSw(SW_B4_GONE),
    wait(400),
    say(BRAM, "야경꾼 놈들은 숲에 못 들어온다.\n여기까진 아직 내 숲이니까."),
    say(BRAM, "…그 가락 말이다. 쇠 긁는 소리.\n둘째 아이가 부르던 거다."),
    say(BRAM, "서른 해 전 그 밤에도 들었다.\n알았으면서 모른 척했다. 늙으면 겁이 많아져."),
    say(KAEL, "…이번엔 모른 척 안 하셨잖아요."),
    say(BRAM, "그러느라 숨이 턱에 찼다. 가거라.\n여기서부턴 내 숲이 아니다."),
    cutLabel(),
    cutEnd(),
  ];
  edge.forEach((c, i) => {
    addEv(project, mapId, `ev_fs2_edge_${i}`, "숲지기 땅", c, [
      page(`ev_fs2_edge_${i}_idle`, "대기", [], [], { priority: "below" }),
      page(`ev_fs2_edge_${i}_run`, "숲지기 땅", [sw(SW_B4_ALARM)], confess, { priority: "below", trigger: { kind: "playerTouch" } }),
      page(`ev_fs2_edge_${i}_done`, "끝", [sw(SW_B4_EDGE)], [], { priority: "below" }),
    ]);
  });
  void stones;
}

// ════════════════════════════════════════════════════════════════════
// 8. B5 새벽샘 터 — 재의 들판의 적(잿불 도깨비·재까마귀·숯덩이 골렘·굶은 들개·재뱀), 불탄 마을, 잠긴 집, 정착 확인서
// ════════════════════════════════════════════════════════════════════

export const FS2_DAWNWELL_ID = "fs2_dawnwell";
export const FS2_CERT_ITEM = "item_fs2_serin_form";
const SW_CERT = "sw_fs2_serin_form";
const SW_MEMS = ["sw_fs2_dawn_mem_0", "sw_fs2_dawn_mem_1", "sw_fs2_dawn_mem_2"] as const;
const SAVE_CRYSTAL = "kit:beodeul_city/bd-pick-dungeon-theme-crystal-pedestal";
/** 새벽샘 터 칸(평면도 DAWN_PLAN 기준) — 남은 집(북동쪽 통나무집), 문 앞, 도깨비, 별빛 결정, 기억 셋. */
const DAWN_SPOTS = {
  kept: { x: 27, y: 2, w: 5, h: 6 }, front: { x: 29, y: 8 },
  wisps: { x: 10, y: 20 }, save: { x: 20, y: 26 },
  mems: [{ x: 18, y: 14 }, { x: 27, y: 19 }, { x: 17, y: 24 }] as Cell[],
};
/** 재의 들판 칸(평면도 ASH_FIELD_PLAN 기준). */
const FS2_ASH = {
  wisps: { x: 18, y: 23 }, snakes: { x: 4, y: 11 }, golem: { x: 24, y: 7 }, chest: { x: 28, y: 7 },
};
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
  // 새벽샘 터 — 참고 지도 「폐허 마을」의 배치(위 가운데 무너진 예배당, 우물 광장, 빙 둘러 선 집)를 빌린 불탄 마을.
  // 집은 지붕이 반쯤 내려앉은 통나무집 넷, 멀쩡한 집은 북동쪽 끝 한 채(빗장이 바깥에 걸린 집). 칸 평면도는 act2Places.ts.
  exec(project, "create_map", { id: FS2_DAWNWELL_ID, name: "새벽샘 터", width: DAWN_PLAN[0]!.length, height: DAWN_PLAN.length, tilesetId: "beodeul_city" });
  paintPlace(project, M(project, FS2_DAWNWELL_ID), { plan: DAWN_PLAN, props: DAWN_PROPS, burnt: DAWN_BURNT, rockLine: "C", seed: 31 });
  DAWN.kept = { ...DAWN_SPOTS.kept };
  DAWN.front = { ...DAWN_SPOTS.front };
  exec(project, "set_map_properties", { mapId: FS2_DAWNWELL_ID, mapRole: "field" });
  exec(project, "set_scene_mood", {
    mapId: FS2_DAWNWELL_ID, applyMode: "map",
    lighting: { ambient: 0.45, color: "#4a4050" }, weather: { kind: "fog", intensity: 0.22 },
  });
  // 재의 들판(두 번째 들판) — 숲길 맵을 참고 지도 「화산 지대 필드」 결(잿빛 땅·마른 고목·뼈 무더기·검푸른 바위 능선)로 통째로 다시 칠한다.
  const [north1, field] = FS2_NORTH_ROUTE.mapIds;
  paintPlace(project, M(project, field!), { plan: ASH_FIELD_PLAN, props: ASH_FIELD_PROPS, rockLine: "C", seed: 12 });
  // 재의 들판 북쪽 끝 → 마을 터 남쪽.
  const town = M(project, FS2_DAWNWELL_ID);
  const fieldEntry = FS2_NORTH_ROUTE.entries[1]!;
  const a = originEdge(project, M(project, field!), "north", { x: fieldEntry.x, y: fieldEntry.y - 1 });
  const b = originEdge(project, town, "south");
  exec(project, "create_transfer_pair", { a: { mapId: field!, ...a }, b: { mapId: FS2_DAWNWELL_ID, ...b } });
  DAWN.entry = b;
  // 보이는 적 — 난이도는 들판 남쪽(도깨비 Lv7) → 북쪽 고원(재뱀 Lv7, 비켜 가도 되는 골렘 Lv8 정예가 짐 상자를 지킨다) → 마을 터(도깨비).
  // 알아채기·돌진은 detection() 이 종류별로 정한다(들짐승·도깨비는 보면 달려와 덮치고, 뱀·골렘은 느린 정예).
  const foe = (mapId: string, troopId: string, x: number, y: number, style: string, respawnSec = 90): void => {
    exec(project, "place_field_enemy", { mapId, x, y, troopId, behavior: "chase", patrol: { length: 2, axis: x % 2 ? "horizontal" : "vertical" },
      sightRange: 6, vision: "cone", pace: "normal", approachStyle: style, respawnSec, checkpointOnEntry: true });
  };
  for (const mapId of [north1!, field!]) exec(project, "set_map_properties", { mapId, mapRole: "field" });
  // 전투 배경 — 밤 숲 어귀는 숲, 재의 들판·마을 터는 바위 그림(황무지·화산지대와 같은 갈래 — 들판 그림은 초록 풀이라 잿빛 땅과 어긋났다).
  // 무리마다 밤·잿빛 연기·불티 겹이 덮는다.
  exec(project, "set_map_properties", { mapId: north1!, battleBackground: "battle-scenery-forest" });
  for (const mapId of [field!, FS2_DAWNWELL_ID]) exec(project, "set_map_properties", { mapId, battleBackground: "battle-scenery-cave" });
  // 재의 들판 — 숲길 도구가 깐 짙은 안개(0.55)가 잿빛 땅을 하얗게 덮어 버렸다. 옅은 연기 + 해 질 녘 잿빛 빛으로.
  exec(project, "set_scene_mood", { mapId: field!, applyMode: "map", weather: { kind: "fog", intensity: 0.22 }, lighting: { ambient: 0.4, color: "#5a4650" } });
  const W = (id: string) => M(project, id).width, H = (id: string) => M(project, id).height;
  // 숲 어귀 — 숲지기 땅(B4 도착선) 너머 숲길에. 맵이 숲 어귀(남쪽 풀밭·북쪽 숲)라 맵 가운데 칸은 나무일 수 있다 — 걸어 닿는 가장 가까운 칸으로.
  const northOpen = walkSteps(project, M(project, north1!), { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 });
  const near1 = (x: number, y: number): Cell => [...northOpen.keys()].map((k) => { const [cx, cy] = k.split(",").map(Number); return { x: cx!, y: cy! }; })
    .filter((c) => c.y < (FS2_B4.edge[0]?.y ?? H(north1!)) - 4)
    .sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)))[0] ?? { x, y };
  const dogs = near1(Math.floor(W(north1!) / 2), Math.floor(H(north1!) * 0.4)), crows = near1(Math.floor(W(north1!) / 2) - 2, Math.floor(H(north1!) / 6));
  try { foe(north1!, "troop_fs2_starved_dogs", dogs.x, dogs.y, "dash"); } catch { /* 그 칸 거절 */ }
  try { foe(north1!, "troop_fs2_ash_crows", crows.x, crows.y, "swoop"); } catch { /* 그 칸 거절 */ }
  foe(field!, "troop_fs2_ash_wisps", FS2_ASH.wisps.x, FS2_ASH.wisps.y, "float");
  foe(field!, "troop_fs2_ash_snakes", FS2_ASH.snakes.x, FS2_ASH.snakes.y, "slither");
  // 골렘은 하나 — 이기면 다시 안 나온다. 피해 갈 수 있는 정예(느리고 돌진 없음). 북동쪽 바위 주머니의 짐 상자 앞에 선다.
  foe(field!, "troop_fs2_cinder_golem", FS2_ASH.golem.x, FS2_ASH.golem.y, "lumber", 0);
  exec(project, "place_chest", { mapId: field!, x: FS2_ASH.chest.x, y: FS2_ASH.chest.y, contents: { itemId: "item_hi_potion", gold: 150 }, name: "타다 남은 짐 상자", id: "ev_fs2_ash_chest" });
  // 마을 터 — 서쪽 무너진 집 곁 길목에 도깨비 한 무리.
  foe(FS2_DAWNWELL_ID, "troop_fs2_ash_wisps", DAWN_SPOTS.wisps.x, DAWN_SPOTS.wisps.y, "float");
  // 별빛 결정 — 마을 터 입구 곁.
  exec(project, "place_savepoint", { mapId: FS2_DAWNWELL_ID, x: DAWN_SPOTS.save.x, y: DAWN_SPOTS.save.y, id: "ev_fs2_dawnwell_save", name: "별빛 결정", mode: "slot",
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
  // 재의 들판(field)은 dawnwell() 이 참고 지도 결로 통째 다시 칠한다 — 여기는 숲 어귀(north1)만.
  for (const [mapId, seed] of [[north1!, 11]] as const) {
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
  // 남은 집의 문 — 문 앞 칸 바로 위(문 그림 칸). 그 칸에 원본 이벤트가 있으면 대신한다.
  const door: Cell = { x: DAWN.front.x, y: DAWN.front.y - 1 };
  town.events = town.events.filter((e) => !(e.x === door.x && e.y === door.y));
  // 기억 셋(Q7) — 마을 터 세 곳. 다 보면 잠긴 문을 연다.
  const mems: { at: Cell; lines: [string, string][] }[] = [
    { at: DAWN_SPOTS.mems[0]!, lines: [["", "그을린 우물 둘레에 작은 손자국이 찍혀 있다."], [ELENA, "아이가… 여기서 물을 마셨나 봐."]] },
    { at: DAWN_SPOTS.mems[1]!, lines: [["", "잿더미에 반쯤 묻힌 종이 등.\n물에 띄우는 등이다."], [KAEL, "대답의 등이야. 여기서도 띄웠구나."]] },
    { at: DAWN_SPOTS.mems[2]!, lines: [["", "길 한가운데 잿더미에 장갑 한 짝.\n안쪽에 실로 「ㅅ」을 떠 놓았다."], [KAEL, "…발렌 장갑이랑 같은 실이야."]] },
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
      narrate("이 집만 무너지지 않았다.\n빗장이 바깥에 걸려 있다."),
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
/** 안뜰(바깥 눈밭) 무리 — 요새 안 무리와 적은 같고 전투 배경만 눈밭. */
const FS2_FORT_DOGS_OUT = "troop_fs2_fort_dogs_out";
const FS2_KNIGHT_TROOP_OUT = "troop_fs2_fort_knights_out";
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

/**
 * 북방 관문 요새 바깥 — 눈 덮인 성벽 안뜰(재설계 2026-10-29: 참고 지도 「눈 덮인 산 요새」·「요새 성문」).
 * author_beodeul_town 설원 성벽 마을(남북 성문루·망루·성벽 계단)을 짓고 COURT_PAD 줄 아래로 민 뒤,
 * 비운 북쪽은 북문 밖 눈길과 서리 벼랑으로 칠한다 — 성벽 위(새라 결투장)에서 바깥 하늘·눈·벼랑이 보인다.
 * 마을 장식(얼음 연못·눈사람·썰매)은 걷고 훈련장(무기 시렁·장작)·교단 깃발·봉화대로 요새답게 꾸민다.
 * 남문 = 새벽샘 북쪽 길, 본채 문 = 요새 안(성 던전 2층), 2층 홀의 문 = 북쪽 성벽 위, 북문 = 서리 가도.
 */
export const FS2_FORT_COURT_ID = "fs2_fort_court";
const COURT_PAD = 8;
const COURT: {
  gate: number; south: number; stair: number; walk: number; keep: Cell; arrive: Cell; sarah: Cell; north: Cell;
} = { gate: 17, south: 17, stair: 29, walk: 10, keep: { x: 0, y: 0 }, arrive: { x: 0, y: 0 }, sarah: { x: 0, y: 0 }, north: { x: 17, y: 1 } };

function fortCourt(project: Project, exec: Exec): void {
  const d = exec(project, "author_beodeul_town", {
    id: FS2_FORT_COURT_ID, name: "북방 관문 요새", theme: "snow", walls: true, houseCount: 3, wallGate: "NS", width: 38, height: 36, seed: 65,
  }) as { walls?: { gates?: { side: string; x: number }[]; stairs?: number[]; towers?: { side: string; x: number; corner?: boolean }[] }; doors?: { kit: string; x: number; y: number }[] } | undefined;
  const gateN = d?.walls?.gates?.find((g) => g.side === "N")?.x, gateS = d?.walls?.gates?.find((g) => g.side === "S")?.x;
  const stair = d?.walls?.stairs?.[0];
  const keepDoor = d?.doors?.find((door) => door.kit === "bd-pick-snowfield-bath");
  if (gateN === undefined || gateS === undefined || stair === undefined || !keepDoor) throw new Error(`[fallen-star act2] 요새 안뜰 모양이 바뀌었다(seed 65): ${JSON.stringify(d?.walls)}`);
  const H0 = M(project, FS2_FORT_COURT_ID).height;
  exec(project, "resize_map", { mapId: FS2_FORT_COURT_ID, width: M(project, FS2_FORT_COURT_ID).width, height: H0 + COURT_PAD });
  // shift_map 도구는 완성된 집 보호 영역을 못 건드린다 — 편집기의 내용 밀기를 직접 부르고, 집 자리 기록도 같이 민다.
  if (!applyMapShift(project, FS2_FORT_COURT_ID, { dx: 0, dy: COURT_PAD })) throw new Error("[fallen-star act2] 요새 안뜰을 밀지 못했다");
  const court = M(project, FS2_FORT_COURT_ID);
  for (const sp of (court as unknown as { structurePlacements?: { y: number }[] }).structurePlacements ?? []) sp.y += COURT_PAD;
  paintFortApproach(project, court, COURT_PAD, [gateN, gateN + 1], 65);
  COURT.gate = gateN;
  COURT.south = gateS;
  COURT.stair = stair;
  COURT.walk = COURT_PAD + 2;
  COURT.keep = { x: keepDoor.x, y: keepDoor.y + COURT_PAD };
  COURT.north = { x: gateN, y: 1 };
  // 마을 장식을 걷는다 — 얼음 연못(얼음 바닥)은 눈 바닥, 눈사람·썰매는 지운다.
  const ts = project.tilesets[court.tilesetId];
  const meta = ts?.tileMeta ?? [];
  const lab = (t: number | undefined) => (t === undefined || t < 0 ? "" : meta[t]?.label ?? "");
  const snowKit = ts?.structureKits?.find((k) => k.id === "bd-pick-snowfield-ground-snow") as { rows: { tiles: number[] }[] } | undefined;
  const snowTiles = (snowKit?.rows ?? []).flatMap((r) => r.tiles).filter((t) => t >= 0);
  if (!snowTiles.length) throw new Error("[fallen-star act2] 눈 바닥 조각이 없다");
  let ice = { x0: court.width, y0: court.height, x1: -1, y1: -1 };
  for (let i = COURT_PAD * court.width; i < court.width * court.height; i += 1) {
    if (/· 얼음/.test(lab(court.lowerTiles[i]))) {
      court.lowerTiles[i] = snowTiles[(i * 7 + 3) % snowTiles.length]!;
      const x = i % court.width, y = Math.floor(i / court.width);
      ice = { x0: Math.min(ice.x0, x), y0: Math.min(ice.y0, y), x1: Math.max(ice.x1, x), y1: Math.max(ice.y1, y) };
    }
    for (const layer of [court.upperTiles, court.lowerOverlayTiles]) if (layer && /눈사람|썰매|얼음 구멍/.test(lab(layer[i]))) layer[i] = -1;
  }
  // 연못 둘레 물가 테두리는 덧댄 그림(이식 칸)이 2층에 깔려 있다 — 연못 상자 한 칸 바깥까지 걷는다(성벽 그림자는 남긴다).
  if (court.lowerOverlayTiles) for (let y = ice.y0 - 1; y <= ice.y1 + 1; y += 1) for (let x = ice.x0 - 1; x <= ice.x1 + 1; x += 1) {
    const i = y * court.width + x;
    if (x >= 0 && y >= 0 && x < court.width && y < court.height && !/성벽/.test(lab(court.lowerOverlayTiles[i]))) court.lowerOverlayTiles[i] = -1;
  }
  // 성벽 앞면 깃발·횃불 — 성벽 앞면 그림은 위층이라 겹 위층에 건다.
  const wallArt = (kitId: string, x: number, y: number): void => {
    const kit = ts?.structureKits?.find((k) => k.id === kitId) as { rows: { upperTiles?: number[] }[] } | undefined;
    if (!kit) throw new Error(`[fallen-star act2] 키트 ${kitId} 가 없다`);
    if (!court.upperOverlayTiles) court.upperOverlayTiles = new Array<number>(court.width * court.height).fill(-1);
    kit.rows.forEach((row, dy) => (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) court.upperOverlayTiles![(y + dy) * court.width + x + dx] = t; }));
  };
  const faceTop = COURT_PAD + 5;   // 북벽 앞면(4줄) 가운데 두 줄
  for (const x of [6, 12, 23, 33]) wallArt("bd-pick-aqueduct-sewer-banner-cult", x, faceTop);
  const southFace = court.height - 5;   // 남벽 바깥 앞면 — 남문으로 다가오며 교단 깃발을 본다
  for (const x of [gateS - 3, gateS + 4]) wallArt("bd-pick-aqueduct-sewer-banner-cult", x, southFace);
  // 안뜰 — 북문 안쪽 봉화대 둘, 본채 문 양옆 깃대, 옛 연못 자리는 훈련장(무기 시렁·장작·통).
  const put = (kitId: string, x: number, y: number): void => {
    try { exec(project, "stamp_object", { objectId: `kit:beodeul_city/${kitId}`, mapId: FS2_FORT_COURT_ID, x, y }); } catch { /* 자리 없음 — 건너뛴다 */ }
  };
  for (const [kitId, x, y] of [
    ["bd-pick-mountain-pass-brazier", gateN - 2, COURT_PAD + 8], ["bd-pick-mountain-pass-brazier", gateN + 3, COURT_PAD + 8],
    ["bd-pick-mountain-pass-brazier", COURT.keep.x - 2, COURT.keep.y - 1], ["bd-pick-walled-market-banner-red", COURT.keep.x + 5, COURT.keep.y - 3],
    ["bd-pick-mining-valley-rack", 4, COURT_PAD + 10], ["bd-pick-mining-valley-rack", 7, COURT_PAD + 10], ["bd-pick-mining-valley-rack", 10, COURT_PAD + 10],
    ["bd-pick-snowfield-firewood", 12, COURT_PAD + 12], ["bd-pick-aqueduct-sewer-barrel", 3, COURT_PAD + 14], ["bd-pick-mining-valley-crates", 4, COURT_PAD + 14],
    ["bd-pick-mountain-pass-brazier", gateS - 2, court.height - 13], ["bd-pick-mountain-pass-brazier", gateS + 4, court.height - 13],
    // 남서 망루 곁 보급 더미, 동쪽 마당 무기 시렁 — 빈 눈밭이 넓게 남지 않게.
    ["bd-pick-snowfield-firewood", 4, court.height - 13], ["bd-pick-snowfield-pile", 7, court.height - 12], ["bd-pick-aqueduct-sewer-barrel", 3, court.height - 12],
    ["bd-pick-mining-valley-rack", 32, court.height - 12], ["bd-pick-mining-valley-crates", 34, court.height - 14],
  ] as const) put(kitId, x, y);
  // 깃대·봉화대(마을 소품)를 다 세운 뒤에 필드 맵으로 — 필드 맵에는 마을 소품 도장이 막힌다.
  exec(project, "set_map_properties", { mapId: FS2_FORT_COURT_ID, mapRole: "field", battleBackground: "battle-scenery-snow" });
  exec(project, "set_scene_mood", { mapId: FS2_FORT_COURT_ID, applyMode: "map", weather: { kind: "snow", intensity: 0.35 }, lighting: { ambient: 0.35, color: "#5a6478" } });
  // 새벽샘 북쪽 길 ↔ 남문 밖.
  const a = originEdge(project, M(project, FS2_DAWNWELL_ID), "north", DAWN.entry);
  const b = originEdge(project, M(project, FS2_FORT_COURT_ID), "south", { x: gateS, y: H0 + COURT_PAD - 3 });
  exec(project, "create_transfer_pair", { a: { mapId: FS2_DAWNWELL_ID, ...a }, b: { mapId: FS2_FORT_COURT_ID, ...b } });
  // 성벽 위 — 계단 꼭대기 서쪽 성벽 길. 새라는 북망루 서쪽에, 2층 홀 문으로 나오면 망루 동쪽에 선다.
  const court2 = M(project, FS2_FORT_COURT_ID);
  const walkable = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => canMove(project, court2, x + dx!, y + dy!, x, y));
  const row = COURT.walk + 1;
  const spots: number[] = [];
  for (let x = gateN + 3; x < court2.width - 1; x += 1) if (walkable(x, row) && walkable(x, row - 1)) spots.push(x);
  if (spots.length < 6) throw new Error(`[fallen-star act2] 성벽 위 길이 짧다: ${spots.join(",")}`);
  COURT.sarah = { x: spots[1]!, y: row - 1 };
  // 2층 홀 문으로 나오면 — 북쪽 망루(성벽 위로 솟은 3칸 탑) 바로 서쪽 칸. 망루 칸은 탑 그림에 가려 주인공이 안 보였다.
  const tower = d?.walls?.towers?.filter((t) => t.side === "N" && !t.corner && t.x > gateN + 2).sort((a, b) => a.x - b.x)[0];
  const arriveX = tower ? tower.x - 1 : spots[spots.length - 1]!;
  if (!spots.includes(arriveX) || arriveX - COURT.sarah.x < 2) throw new Error(`[fallen-star act2] 성벽 위 도착 칸이 이상하다: ${arriveX} (새라 ${COURT.sarah.x}, 길 ${spots.join(",")})`);
  COURT.arrive = { x: arriveX, y: row };
  // 개 무리 — 훈련장 앞. 순찰 기사 — 본채 앞 마당(보면 바로 달려든다).
  const foe = (troopId: string, x: number, y: number, style: string, extra: Rec = {}): void => {
    exec(project, "place_field_enemy", { mapId: FS2_FORT_COURT_ID, x, y, troopId, behavior: "chase", patrol: { length: 2, axis: "horizontal" },
      sightRange: 6, vision: "cone", pace: "normal", approachStyle: style, respawnSec: 90, checkpointOnEntry: true, ...extra });
  };
  foe(FS2_FORT_DOGS_OUT, 8, COURT_PAD + 16, "dash");
  void foe;
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
  const snowField = { previewBackgroundResourceId: "battle-scenery-snow", backdropLayers: [{ preset: "clouds", opacity: 40 }] };
  exec(project, "upsert_troop", { troop: { id: FS2_FORT_DOGS_OUT, name: "요새 경비견", enemyIds: [FS2_FORT_DOG, FS2_FORT_DOG], ...snowField } });
  exec(project, "upsert_troop", { troop: { id: FS2_KNIGHT_TROOP_OUT, name: "순찰 기사", enemyIds: [FS2_FORT_KNIGHT, FS2_FORT_KNIGHT], ...snowField } });
  // 성벽 위 결투 — 바깥 하늘 아래 눈 덮인 성벽(눈밭 그림 + 밤 겹). 새라 + 경비견 하나(VQA 2차: 개 둘이면 Lv8 파티가 전멸).
  exec(project, "upsert_troop", { troop: { id: FS2_SARAH_TROOP, name: "성벽 위의 새라", enemyIds: [FS2_SARAH_ENEMY, FS2_FORT_DOG], uncapturable: true,
    previewBackgroundResourceId: "battle-scenery-snow", backdropLayers: [{ preset: "night", opacity: 65 }, { preset: "clouds", opacity: 45 }] } });
  exec(project, "upsert_troop_battle_page", { troopId: FS2_SARAH_TROOP, page: {
    id: "fs2_sarah_open", name: "새라 — 시작", span: "battle", conditions: [{ kind: "onRound", round: 1 }],
    commands: [say(SARAH, "물지는 마라. 넘어뜨리기만 해."), say(ELENA, "개부터 떼어 놓자!\n새라 씨 창은 길어. 너무 붙지 마!")],
  } });
  exec(project, "upsert_troop_battle_page", { troopId: FS2_SARAH_TROOP, page: {
    id: "fs2_sarah_half", name: "새라 — 반", span: "battle", conditions: [{ kind: "enemyHpBelow", enemyId: FS2_SARAH_ENEMY, percent: 50 }],
    commands: [say(SARAH, "…그 창, 아버지가 벼린 거지.\n손잡이 무늬가 내 창이랑 같아."), say(KAEL, "네. 아저씨가 새라 씨 걱정을 많이 하셨어요.")],
  } });
  // 요새 바깥 안뜰(새벽샘 북쪽 길 → 남문) — 본채 문이 요새 안(아래 성 던전)으로 들어간다.
  fortCourt(project, exec);
  // 요새 안 — 안뜰 본채 문으로 들어간다. 2층으로 짓고(층마다 방 목록), 2층 성주 홀(성벽으로 나가는 문) 앞을 레버 쇠창살로 막는다.
  // 보이는 적(경비견)·상자·쉼터·1층 수문장(경비 병사+창병)은 도구가 채운다. 사람 순찰·쇠뇌병은 아래에서 칩을 주고 따로 놓는다.
  const d = exec(project, "author_dungeon", {
    type: "castle", adapter: "beodeul", genre: "rpg", name: "북방 관문 요새", id: FS2_FORTRESS_ID, floors: 2, direction: "up", floorRooms: FORT_FLOORS,
    populate: true, troops: { field: [FS2_FORT_DOGS], midBoss: FS2_GATE_CAPTAIN_TROOP, boss: FS2_FORT_DOGS }, gimmick: "lever", gateStyle: "portcullis",
    entrance: { fromMapId: FS2_FORT_COURT_ID, x: COURT.keep.x, y: COURT.keep.y }, seed: 61,
  }) as { floors?: string[]; floorData?: { rooms?: FortRoom[] }[] } | undefined;
  if (d?.floors?.[1] !== FS2_FORT_TOP_ID) throw new Error(`[fallen-star act2] 요새 2층 id 가 ${FS2_FORT_TOP_ID} 가 아니다(${d?.floors?.join(",")})`);
  FORT.rooms = d.floorData?.[0]?.rooms ?? [];
  FORT.top = d.floorData?.[1]?.rooms ?? [];
  const top = M(project, FS2_FORT_TOP_ID);
  // 마지막 방(성주 홀)의 보스 자리는 비우고, 북쪽 벽 가운데에 성벽으로 나가는 문을 단다(결투는 바깥 성벽 위 — fortressEvents).
  const rampart = FORT.top.find((r) => r.id === "rampart");
  if (!rampart) throw new Error("[fallen-star act2] 요새 성주 홀이 없다");
  top.events = top.events.filter((e) => e.id !== `ev_${FS2_FORT_TOP_ID}_boss`);
  {
    const door = (project.tilesets[top.tilesetId]?.structureKits ?? []).find((k) => k.id === "bd-dg-door-closed") as { rows: { upperTiles?: number[] }[] } | undefined;
    if (!door) throw new Error("[fallen-star act2] 던전 문 조각이 없다");
    const cx = rampart.x + Math.floor(rampart.w / 2);
    const xs = [0, 1, -1, 2, -2, 3, -3].map((d) => cx + d);
    // 문 칸 = 방 윗줄 바로 위 벽 앞면 두 줄, 문 앞 칸 = 방 윗줄(걸을 수 있고 위층이 비어야).
    const x = xs.find((xx) => isPassable(project, top, xx, rampart.y) && (top.upperTiles[rampart.y * top.width + xx] ?? -1) < 0
      && !isPassable(project, top, xx, rampart.y - 1) && !top.events.some((e) => e.x === xx && e.y === rampart.y));
    if (x === undefined) throw new Error("[fallen-star act2] 성주 홀 북쪽 벽에 문 자리가 없다");
    door.rows.forEach((row, dy) => { const t = row.upperTiles?.[0] ?? -1; if (t >= 0) top.upperTiles[(rampart.y - 2 + dy) * top.width + x] = t; });
    FORT.sarah = { x, y: rampart.y };
  }
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
  // 안뜰 순찰 기사 — 본채 문 앞 마당을 가로로 오간다. 남문으로 들어서 본채로 가려면 이 기사를 지나야 한다.
  exec(project, "place_field_enemy", { mapId: FS2_FORT_COURT_ID, x: COURT.keep.x - 9, y: COURT.keep.y + 4, graphic: knight, troopId: FS2_KNIGHT_TROOP_OUT, behavior: "chase",
    patrol: { length: 3, axis: "horizontal" }, sightRange: 5, vision: "cone", pace: "normal", approachStyle: "dash", alert: "exclamation",
    respawnSec: 0, clearSwitchId: "sw_fs2_fort_knight_court_down", checkpointOnEntry: true });
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
  const rampart = FORT.top.find((r) => r.id === "rampart");
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
  // 성주 홀(2층 마지막 방) — 도구가 깐 옥좌·붉은 융단은 그대로 두고, 성벽으로 나가는 문 양옆에 봉화대, 북벽에 붉은 깃발.
  // 1층 안뜰 홀도 북벽에 붉은 깃발 — 교단이 차지한 요새(참고 지도 「요새 홀」).
  const wallBanners = (map: GameMap, room: FortRoom | undefined, every: number): void => {
    if (!room) return;
    const kit = kits.get("bd-pick-dungeon-theme-royal-banner");
    if (!kit) return;
    for (let x = room.x + 1; x < room.x + room.w - 1; x += every) {
      const cells = [room.y - 2, room.y - 1].map((y) => y * map.width + x);
      if (cells.some((i) => i < 0 || (map.upperTiles[i] ?? -1) >= 0) || isPassable(project, map, x, room.y - 1) || isPassable(project, map, x, room.y - 2)) continue;
      if (Math.abs(x - FORT.sarah.x) <= 1 && map.id === FS2_FORT_TOP_ID) continue;
      kit.rows.forEach((row, dy) => { const t = row.upperTiles?.[0] ?? -1; if (t >= 0) map.upperTiles[(room.y - 2 + dy) * map.width + x] = t; });
    }
  };
  if (rampart) {
    for (const dx of [-2, 2]) stampAt(FS2_FORT_TOP_ID, "bd-pick-mountain-pass-brazier", FORT.sarah.x + dx, FORT.sarah.y);
    wallBanners(M(project, FS2_FORT_TOP_ID), rampart, 4);
  }
  wallBanners(M(project, FS2_FORTRESS_ID), FORT.rooms.find((r) => r.id === "yard"), 5);
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
  const court = M(project, FS2_FORT_COURT_ID);
  // 성 던전 도구가 요새 안 두 층에 구름 바다 배경을 깔았다 — 돌방 벽 너머로 하늘이 보여 공중 성처럼 읽혔다. 요새 안은 벽 너머가 어둡다.
  for (const map of [fort, top]) delete (map as unknown as Rec).background;
  // 2층 성주 홀 북쪽 문 → 바깥 성벽 위. 성벽 위 같은 자리(망루 곁)에서 다시 들어간다.
  addEvent(top, "ev_fs2_fort_wall_door", "성벽으로 나가는 문", FORT.sarah, [
    page("ev_fs2_fort_wall_door_p", "성벽으로", [], [se("cc0-se-osx-door-open"), transfer(FS2_FORT_COURT_ID, COURT.arrive, "left")], { trigger: { kind: "playerTouch" }, priority: "below" }),
  ]);
  addEvent(court, "ev_fs2_fort_wall_back", "망루 안으로", { x: COURT.arrive.x + 1, y: COURT.arrive.y }, [
    page("ev_fs2_fort_wall_back_p", "요새 안으로", [], [transfer(FS2_FORT_TOP_ID, { x: FORT.sarah.x, y: FORT.sarah.y + 1 }, "down")], { trigger: { kind: "playerTouch" }, priority: "below" }),
  ]);
  // 성벽 계단 밑 — 쇠창살이 내려져 있다(안뜰에서 바로 성벽 위로 못 오른다 — 요새 안을 지나야 한다).
  {
    const ts = project.tilesets[court.tilesetId];
    const closed = (ts?.structureKits ?? []).find((k) => k.id === "bd-pick-dungeon-theme-portcullis") as { rows: { upperTiles?: number[] }[] } | undefined;
    if (!closed) throw new Error("[fallen-star act2] 쇠창살문 조각이 없다");
    const footY = COURT.walk + 6;   // 계단(성벽 앞면 네 줄) 바로 아래 칸
    if (!court.upperOverlayTiles) court.upperOverlayTiles = new Array<number>(court.width * court.height).fill(-1);
    closed.rows.forEach((row, dy) => (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) court.upperOverlayTiles![(footY - 1 + dy) * court.width + COURT.stair + dx] = t; }));
    for (let dx = 0; dx < 3; dx += 1) {
      addEvent(court, `ev_fs2_fort_stair_gate_${dx}`, "계단 쇠창살", { x: COURT.stair + dx, y: footY }, [
        page(`ev_fs2_fort_stair_gate_${dx}_p`, "잠김", [], [narrate("성벽 계단을 쇠창살이 막고 있다.\n도르래는 성벽 위에 있다.")]),
      ]);
    }
  }
  // 북문 — 새라와 결판나기 전엔 쇠창살이 내려져 있다. 합류 뒤에는 열려 서리 가도로 나간다.
  for (const dx of [0, 1]) {
    addEvent(court, `ev_fs2_fort_north_gate_${dx}`, "북문 쇠창살", { x: COURT.gate + dx, y: COURT_PAD + 5 }, [
      page(`ev_fs2_fort_north_gate_${dx}_p`, "잠김", [], [narrate("북문 쇠창살이 내려져 있다.\n성벽 위 도르래로만 올릴 수 있다.")]),
      page(`ev_fs2_fort_north_gate_${dx}_open`, "열림", [sw(SW_SARAH)], [], { priority: "below" }),
    ]);
  }
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
    say(SARAH, "북문 쇠창살은 내가 올리지. 따라와."),
    fadeOut(900),
    transfer(FS2_SNOW.mapIds[0]!, FS2_SNOW.entry, "up"),
  ];
  addEvent(court, "ev_fs2_fort_sarah", SARAH, COURT.sarah, [
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
    // 합류 뒤 — 새라가 서 있던 자리는 빈 성벽 길(북문은 열렸다 — 안뜰로 내려가 북문으로 나간다).
    page("ev_fs2_fort_sarah_gone", "빈 성벽", [sw(SW_SARAH)], [], { graphic: { transparent: true }, priority: "below" }),
  ]);
  // 졌을 때 — 요새 감방에서 깬다(게임 오버 아님). 창살 문은 새라가 열어 두었다.
  addEvent(fort, "ev_fs2_fort_cell_wake", "감방에서 깬다", { x: 0, y: 0 }, [
    page("ev_fs2_fort_cell_wait", "대기", [], [], { priority: "below" }),
    page("ev_fs2_fort_cell_run", "깬다", [sw(SW_SARAH_LOST)], [
      fadeIn(900),
      narrate("차가운 돌바닥. 요새 감방이다."),
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
    fromMapId: FS2_FORT_COURT_ID, side: "north", count: 2, names: ["서리 가도", "눈보라 고개"], moods: ["snow", "blizzard"],
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
        // 녹이는 연출 — 불티·김이 오르고 잠시 뒤 얼음이 걷힌다(순간 교체였다, 감독 검수).
        openEffect: { particles: ["fire", "smoke"], se: "cc0-se-ors-spell-fire-03", durationMs: 1600, text: "엘레나의 손바닥에서 불씨가 번진다.\n얼음이 김을 뿜으며 녹아내린다." },
      });
      iced = true;
      break;
    } catch (e) { if (step === 3) throw e; }
  }
  if (!iced) throw new Error("[fallen-star act2] 얼음 덩이 자리가 없다");
  // 첫 맵 입구 — 요새 북문 밖 눈길로 돌아간다. 요새 북쪽 끝 길은 서리 가도로 나간다(북문은 새라 합류 뒤에 열린다).
  addEv(project, FS2_SNOW.mapIds[0]!, "ev_fs2_snow_back", "요새 북문", FS2_SNOW.back, [
    page("ev_fs2_snow_back_p", "요새로", [], [transfer(FS2_FORT_COURT_ID, COURT.north, "down")], { trigger: { kind: "playerTouch" }, priority: "below" }),
  ]);
  for (const dx of [0, 1]) addEv(project, FS2_FORT_COURT_ID, `ev_fs2_fort_to_snow_${dx}`, "서리 가도", { x: COURT.gate + dx, y: 0 }, [
    page(`ev_fs2_fort_to_snow_${dx}_p`, "서리 가도로", [], [transfer(FS2_SNOW.mapIds[0]!, FS2_SNOW.entry, "up")], { trigger: { kind: "playerTouch" }, priority: "below" }),
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
// 11~12. B8 서리나루 · B9 얼음 위의 밤 — frostford.ts(마을 그림은 frostfordMap.ts)가 짓는다.
// ════════════════════════════════════════════════════════════════════

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
  northGateEvents(project, exec);
  // 숲 그늘 줄(B4)이 정해진 뒤에 그 북쪽만 태운다.
  scorchAshFields(project, exec);
  dawnwellEvents(project);
  northFortress(project, exec, ids.hub);
  snowPass(project, exec);
  buildFrostford(project, exec, ids.hub);
  fortressEvents(project);
  frostFoes(project, exec, FS2_SNOW_PLAN.maps, FS2_SNOW_PLAN.fire);
  detection(project, exec);
  widenEdgeGates(project);
  act2Quest(project, exec);
  applyFallenAct2Tower(project, exec);
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
    [SW_VALEN_MET, "밤이 되면 얼어붙은 호수 섬 사당에서 발렌을 만난다"],
    [SW_ICE_DONE, "갈라지는 얼음을 건너 북쪽 돌계단에 오른다"],
    ...(FS2_RELEASE_STOP === "B9" ? [[SW_STOP_B9, "하늘탑에 들어선다"] as [string, string]] : []),
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
  { troops: [FS2_KNIGHT_TROOP, FS2_KNIGHT_TROOP_OUT, FS2_GATE_CAPTAIN_TROOP], args: { sightRange: 7, coneDegrees: 120, alertMs: 200, rush: true, rushSteps: 5, rushStepMs: 100, chaseStepMs: 170, searchMs: 5000, giveUpRange: 14 } },
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
