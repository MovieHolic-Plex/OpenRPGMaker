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
};
/** 광장(통금의 밤) — 사다리를 오르면 서는 칸: 광장 동쪽 초소 뒤 골목. */
const HUB_ARRIVE: Cell = { x: 52, y: 25 };

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

function database(project: Project, exec: Exec): void {
  for (const [id, name] of [
    [SW_ACT2, "제2막 시작"], [SW_BREAD, "B1: 리노가 빵을 넣어 줌"], [SW_KEY, "B1: 빵 속 열쇠"], [SW_CELL_OPEN, "B1: 감방 쇠살문 열림"],
    [SW_OUT, "B1: 초소를 빠져나옴"],
  ] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_item", { item: {
    id: FS2_BREAD_ITEM, name: "무거운 납작빵", type: "normalGoods", occasion: "never", consumable: false, price: 0,
    description: "토마 아저씨가 구운 납작빵. 하나만 유난히 무겁다.\n「꼭꼭 씹어라. 꼭.」",
  } });
  exec(project, "upsert_item", { item: {
    id: FS2_CELL_KEY_ITEM, name: "빵 속 감방 열쇠", type: "special", occasion: "never", consumable: false, price: 0,
    description: "납작빵 속에 구워져 있던 쇠 열쇠. 아직 따뜻하다.",
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
    page(`${rinoId}_wait`, "간수(빵 전)", [], [say(RINO, "조용히 있어라. …오늘 밤은.")], { graphic: rinoGraphic("left"), priority: "same" }),
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
      narrate("다음 날 밤. 심문회 초소 지하.", { position: "center", context: "narration" }),
      fadeIn(1200),
      se("cc0-se-osx-splash-01"),
      wait(500),
      emote("player", "ellipsis", 900),
      say(ELENA, "…이리스가 없어.\n발렌이 따로 데려갔어."),
      say(KAEL, "선생님도 천문대에 갇혔대.\n간수가 그러던데."),
      se("cc0-se-osx-door-open"),
      route(rinoId, [{ kind: "setThrough", enabled: true }, ...walk(toGate), { kind: "setThrough", enabled: false }, { kind: "turn", dir: "up" }]),
      say(RINO, "저녁이다. …토마 아저씨가 굽더군."),
      say(RINO, "딱딱하니까 꼭꼭 씹어라. 꼭."),
      se("cc0-se-orp-inventory-cloth"),
      item(FS2_BREAD_ITEM, 1),
      narrate("「무거운 납작빵」을 받았다.", { context: "system" }),
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
        narrate("침대 모서리에 납작빵을 대고 쪼갰다."),
        se("cc0-se-osx-wooded-box-open"),
        shake(1, 200),
        narrate("딱— 속에서 쇠붙이가 나왔다!"),
        item(FS2_BREAD_ITEM, -1),
        item(FS2_CELL_KEY_ITEM, 1),
        setSw(SW_KEY),
        narrate("「빵 속 감방 열쇠」를 얻었다.", { context: "system" }),
        say(ELENA, "토마 아저씨…!\n「꼭꼭 씹어라」가 이 뜻이었어."),
        say(KAEL, "작은 일들이 먼저 대답을 하네."),
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
    page(`${gateId}_key`, "열쇠로 연다", [sw(SW_KEY), sw(SW_CELL_OPEN, false)], [
      narrate("빵 속 열쇠를 꽂았다. 딸깍."),
      ...openGate(map, CELL.gate),
      setSw(SW_CELL_OPEN),
      item(FS2_CELL_KEY_ITEM, -1),
      say(ELENA, "열렸어. 조용히 가자.\n위층은 기사들 막사일 거야."),
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
    hintText: "근무표: 「붉은 초소는 붉은 깃발 종에, 푸른 초소는 푸른 깃발 종에 응답할 것.\n등불이 비추는 곳으로는 아무도 지나가지 말 것.」",
    reward: { itemId: FS2_GEAR_ITEM, itemName: "압수품 꾸러미", itemDescription: "초소에 빼앗겼던 짐. 카엘의 검과 엘레나의 책이 그대로 있다." },
  });
  // 북동 벽 사다리 — 광장 초소 뒷골목으로. 압수품을 되찾기 전엔 「짐부터」.
  exec(project, "stamp_object", { objectId: "kit:atlas_biome_interior/hand-interior:ship ladder", mapId: FS2_BARRACKS_ID, x: BARRACKS.ladder.x, y: BARRACKS.ladder.y });
  (M(project, FS2_BARRACKS_ID) as unknown as Rec).bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" };
  const ladderId = "ev_fs2_barracks_ladder";
  addEv(project, FS2_BARRACKS_ID, ladderId, "광장으로 오르는 사다리", { x: BARRACKS.ladder.x, y: BARRACKS.ladder.y + 2 }, [
    page(`${ladderId}_wait`, "짐부터", [], [
      narrate("위로 오르는 사다리다. 바깥 바람이 내려온다."),
      say(ELENA, "잠깐, 우리 짐. 저 금고에 있을 거야.\n빈손으로는 못 나가."),
    ]),
    page(`${ladderId}_go`, "오른다", [sw(SW_BARRACKS)], [
      se("cc0-se-osx-wooded-box-open"),
      narrate("사다리를 올라 뚜껑 문을 밀었다."),
      setSw(SW_OUT),
      transfer(FS2_HUB_NIGHT_ID, HUB_ARRIVE, "down"),
    ]),
  ]);
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
      narrate("광장은 캄캄했다. 등불이 하나도 켜져 있지 않다."),
      say(KAEL, "통금이야. 기사들이 돌고 있어."),
      say(ELENA, "들키면 끝이야. 그늘로만 가자."),
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
/** 순찰 기사 넷 — 광장 길목마다 하나. 앞쪽 부채꼴 시야라 등 뒤·그늘로 돌면 지나갈 수 있다. */
const PATROLS: { at: Cell; axis: "horizontal" | "vertical"; length: number }[] = [
  { at: { x: 44, y: 21 }, axis: "horizontal", length: 4 },
  { at: { x: 36, y: 33 }, axis: "horizontal", length: 4 },
  { at: { x: 27, y: 25 }, axis: "vertical", length: 3 },
  { at: { x: 14, y: 21 }, axis: "horizontal", length: 4 },
];
/** 창틈 주민 — 문간에 서서 길을 알려 준다(place_npc 가 통행 칸으로 옮긴 자리 그대로). */
const MIRE_AT: Cell = { x: 12, y: 12 };
const TOBY_AT: Cell = { x: 34, y: 25 };
const MARTA_AT: Cell = { x: 49, y: 32 };
const MARTA = "여관 주인 마르타";
const MIRE = "빵집 아주머니 미레";
const TOBY = "꼬마 토비";

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
    id: FS2_PATROL_TROOP, name: "통금 순찰대", enemyIds: ["enemy_fs_valen_soldier", "enemy_fs_valen_spearman", "enemy_fs_valen_soldier"],
  } });
  // 점령된 밤의 광장은 「필드」다 — 마을 판정이면 보이는 적을 거절한다(set_map_properties mapRole).
  exec(project, "set_map_properties", { mapId: FS2_HUB_NIGHT_ID, mapRole: "field" });
  const knight = hubChip(project, hubId, "ev_fs_knight");
  PATROLS.forEach((p, i) => {
    exec(project, "place_field_enemy", {
      mapId: FS2_HUB_NIGHT_ID, x: p.at.x, y: p.at.y, troopId: FS2_PATROL_TROOP, behavior: "chase",
      patrol: { length: p.length, axis: p.axis }, sightRange: 5, vision: "cone", pace: "normal", approachStyle: "dash",
      graphic: knight, alert: "exclamation", respawnSec: 45, clearSwitchId: `sw_fs2_patrol_${i}_down`,
    });
  });
  // 창틈 불빛 — 주민이 선 문간마다 작은 등잔(통금이라 다른 창은 다 어둡다).
  exec(project, "set_lighting_volume", {
    mapId: FS2_HUB_NIGHT_ID, applyMode: "map", ambient: 0.7, color: "#0a1024",
    sources: [
      { id: "lamp", at: { kind: "player" }, radius: 3, intensity: 0.45, color: "#9fb4ff" },
      ...[MIRE_AT, TOBY_AT, MARTA_AT].map((c, i) => ({ id: `crack${i}`, at: { x: c.x, y: c.y - 1 }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true })),
    ],
  });
  const mire = hubChip(project, hubId, "ev_fs_baker");
  const toby = hubChip(project, hubId, "ev_fs_kid");
  exec(project, "place_npc", {
    mapId: FS2_HUB_NIGHT_ID, id: "ev_fs2_night_mire", name: MIRE, x: MIRE_AT.x, y: MIRE_AT.y, movement: "fixed", graphic: mire,
    pages: [
      { name: "문틈", commands: [
        say(MIRE, "(문틈으로) 쉿— 너희구나.\n리노가 빵은 잘 넣어 줬니?"),
        say(KAEL, "꼭꼭 씹었어요. 덕분에요."),
        say(MIRE, "천문대 정문엔 기사가 서 있어.\n광장 우물로 가. 바닥 사다리가 서고 밑으로 이어져."),
        setSw(SW_MIRE),
      ] },
      { name: "문틈(다시)", conditions: [sw(SW_MIRE)], commands: [say(MIRE, "우물이야. 등불 든 기사 앞으론 가지 말고.")] },
    ],
  });
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
      { name: "여관 문간(다시)", conditions: [sw(SW_CARRIAGE)], commands: [say(MARTA, "북문 쪽은 오늘 밤 기사가 배로 섰어요.\n먼저 하넬 선생님을 찾아가 봐요.")] },
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
    sources: [{ id: "t1", at: { x: 5, y: 2 }, radius: 4, intensity: 0.85, color: "#ffb860", flicker: true }, { id: "t2", at: { x: 9, y: 2 }, radius: 4, intensity: 0.85, color: "#ffb860", flicker: true }],
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
    page("ev_fs2_shaft_ladder_p", "사다리", [], [narrate("사다리를 타고 우물 위로 올라갔다."), transfer(FS2_HUB_NIGHT_ID, WELL_FRONT, "down")]),
  ]);
  // 1막 지하 4층에서 탔던 승강 장치를 이번엔 서고 밑에서 탄다 — 오르면 천문대 서고, 내려오면 다시 여기.
  // 양쪽 다 도착 칸이 발판 위라, 밟으면 타는 방식이면 걸어 나가다 도로 탄다(QA 2026-10-26) — 발판 위에서 조사해야 탄다.
  exec(project, "place_lift", {
    mapId: FS2_SHAFT_ID, x: SHAFT.lift.x, y: SHAFT.lift.y, direction: "up", distance: 5, trigger: "action", text: "승강 장치에 올라탔다. 위는 천문대 서고다.",
    toMapId: FS2_OBS_NIGHT_ID, toX: OBS.lift.x, toY: OBS.lift.y, toDirection: "right",
  });
  exec(project, "place_lift", {
    mapId: FS2_OBS_NIGHT_ID, x: OBS.lift.x, y: OBS.lift.y, direction: "down", distance: 5, trigger: "action", text: "승강 장치로 서고 밑으로 내려간다.",
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
    say(HANEL, "…아래로 올 줄 알았다.\n정문으로 왔으면 혼냈을 게다."),
    say(ELENA, "선생님! 이리스가—"),
    say(HANEL, "안다. 발렌이 쇠 마차로 북쪽에 데려갔지."),
    say(HANEL, "서른 해 전, 둘째 아이에게 대답한 건\n숲의 젊은이 셋이었다. 나, 브람, 그리고 세린."),
    say(HANEL, "세린은 나보다 별 이름을 잘 외웠다.\n그리고 나보다 먼저, 대답하자고 했지."),
    say(KAEL, "그 다음엔요?"),
    emote("ev_fs2_obs_hanel", "ellipsis", 900),
    { kind: "fork", condition: { kind: "item", itemId: FS_KEEPER_SEAL, present: true }, then: [
      say(HANEL, "숲 지하에서 별지기 인장을 주웠다지.\n그게 하늘탑 두 번째 렌즈의 열쇠다."),
    ], else: [
      say(HANEL, "내 인장을 가져가라.\n하늘탑 두 번째 렌즈의 열쇠다."),
      se("cc0-se-orp-inventory-cloth"),
      item(FS_KEEPER_SEAL, 1),
      narrate("「별지기 인장」을 받았다.", { context: "system" }),
    ] } as unknown as Command,
    say(HANEL, "그 인장을 갖고 탑에 가거라.\n나머지는… 거기서, 내 입으로 하마."),
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
const ROHAN = "대장장이 로한";
const BRAM = "숲지기 브람";
/** 광장 → 대장간 문(1막 문 칸) · 대장간 안 문 칸·로한 자리. */
const SMITHY = { hubDoor: { x: 29, y: 42 } as Cell, hubFront: { x: 29, y: 43 } as Cell, door: { x: 7, y: 10 } as Cell, arrive: { x: 7, y: 9 } as Cell, rohan: { x: 10, y: 6 } as Cell };
/** 북쪽 성벽 개구멍 — 광장 북쪽 돌바닥(38,16)에서 위를 보고 조사. 브람이 그 곁(39,16)에 숨어 있다. */
const HOLE = { wall: { x: 38, y: 15 } as Cell, front: { x: 38, y: 16 } as Cell, bram: { x: 39, y: 16 } as Cell };

/** 북쪽 숲 어귀·재의 들판(B5 가 이어 짓는다). 만든 맵 id 는 결과에서 받는다. */
export const FS2_NORTH_ROUTE: { mapIds: string[]; entry: Cell; entries: Cell[] } = { mapIds: [], entry: { x: 0, y: 0 }, entries: [] };

function northGate(project: Project, exec: Exec, smithyId: string): void {
  for (const [id, name] of [[SW_ROHAN, "B4: 로한의 창"], [SW_BRAM, "B4: 브람 — 개구멍"]] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_equipment", { equipment: {
    id: FS2_ROHAN_SPEAR, name: "로한의 별쇠 창", slot: "weapon", price: 0, iconResourceId: "cc0-jetrel-bronze-sword", imageResourceId: "cc0-jetrel-bronze-sword",
    description: "로한이 「네가 쓸 몫」이라며 벼려 둔 창. 공격 40 · 회피 무시.\n자루에 별쇠를 한 줄 섞었다. 새라의 창과 같은 손잡이 무늬.",
    statBonuses: { attack: 40, defense: 0, mind: 0, agility: 2 }, equippableActorIds: ["actor_hero"], equippableClassIds: ["class_hero", "class_guardian"],
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

function northGateEvents(project: Project, hubId: string): void {
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
      narrate("카엘은 「로한의 별쇠 창」을 손에 쥐었다.", { context: "system" }),
      say(KAEL, "아저씨, 이거… 손잡이 무늬가 특이해요."),
      say(ROHAN, "딸년 창이랑 같은 무늬다.\n새라는 심문회 견습 창기사로 북방 관문 요새에 있어."),
      say(ROHAN, "…그리고 새라를 보거든, 고개 들라고 해라."),
      say(ROHAN, "북문은 막혔다. 광장 북쪽 성벽 밑에\n브람 영감이 기다린다더군."),
      setSw(SW_ROHAN),
      cutLabel(),
      cutEnd(),
    ], { graphic: chip(rohanChip.textureKey, rohanChip.characterIndex, "down") }),
    page("ev_fs2_smithy_rohan_after", "로한(뒤)", [sw(SW_ROHAN)], [say(ROHAN, "창끝은 내리지 마라. 사람한테 말고, 길한테.")], { graphic: chip(rohanChip.textureKey, rohanChip.characterIndex, "down") }),
  ]);
  // 브람 — 성벽 밑 그늘. 로한을 만난 뒤에만 나타나 개구멍을 연다.
  const bramChip = hubChipAny(project, "ev_fs_bram");
  addEv(project, FS2_HUB_NIGHT_ID, "ev_fs2_hub_bram", BRAM, HOLE.bram, [
    page("ev_fs2_hub_bram_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_hub_bram_p", "브람", [sw(SW_ROHAN)], [
      say(BRAM, "쉿. 여기다, 꼬마들."),
      say(BRAM, "이 돌 하나가 빠진다. 서른 해 전에\n내가 빼 둔 거지. 그때도 밤이었다."),
      say(BRAM, "그 가락 말이다. 쇠 긁는 소리.\n둘째 아이가 부르던 거다."),
      say(BRAM, "알았으면서 모른 척했다.\n늙으면 겁이 많아져."),
      setSw(SW_BRAM),
    ], { graphic: chip(bramChip.textureKey, bramChip.characterIndex, "left") }),
    page("ev_fs2_hub_bram_after", "브람(뒤)", [sw(SW_BRAM)], [say(BRAM, "가라. 여기서부턴 내 숲이 아니다.")], { graphic: chip(bramChip.textureKey, bramChip.characterIndex, "left") }),
  ]);
  const [first] = FS2_NORTH_ROUTE.mapIds;
  addEv(project, FS2_HUB_NIGHT_ID, "ev_fs2_hub_hole", "성벽 개구멍", HOLE.wall, [
    page("ev_fs2_hub_hole_p", "성벽", [], [narrate("두꺼운 성벽이다. 돌 하나가 조금 튀어나와 있다.")]),
    page("ev_fs2_hub_hole_open", "개구멍", [sw(SW_BRAM)], [
      se("cc0-se-osx-wooded-box-open"),
      narrate("브람이 돌을 빼자 몸 하나 빠질 구멍이 났다."),
      say(BRAM, "가라. 여기서부턴 내 숲이 아니다."),
      transfer(first!, { x: FS2_NORTH_ROUTE.entry.x, y: FS2_NORTH_ROUTE.entry.y - 1 }, "up"),
    ]),
  ]);
  addEv(project, first!, "ev_fs2_north_back", "성벽 개구멍으로", FS2_NORTH_ROUTE.entry, [
    page("ev_fs2_north_back_p", "돌아간다", [], [narrate("성벽 개구멍으로 광장에 돌아갔다."), transfer(FS2_HUB_NIGHT_ID, HOLE.front, "down")], { priority: "below", trigger: { kind: "playerTouch" } }),
  ]);
  void hubId;
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
/** 재의 들판 적 — 이미 있는 몬스터 도트를 쓴다(새 그림 없음; graphicHue 는 전투가 읽지 않아 색은 원래대로). */
const ASH_FOES: { id: string; name: string; art: string; hue: number; stats: Rec; style: string; elementRates?: Rec; skills: string[] }[] = [
  { id: "enemy_fs2_ash_wisp", name: "잿불 도깨비", art: "generated-enemy-spirit-fire", hue: 200, style: "float", stats: { maxHp: 180, maxMp: 40, attack: 74, defense: 24, mind: 80, agility: 52 }, elementRates: { fire: "E", ice: "A", water: "A" }, skills: ["skill_attack", "skill_mon_frost_orb"] },
  { id: "enemy_fs2_ash_crow", name: "재까마귀", art: "generated-enemy-bird-hawk", hue: 220, style: "swoop", stats: { maxHp: 120, maxMp: 0, attack: 70, defense: 18, mind: 20, agility: 70 }, skills: ["skill_attack"] },
  { id: "enemy_fs2_cinder_golem", name: "숯덩이 골렘", art: "generated-enemy-golem-clay", hue: 240, style: "lumber", stats: { maxHp: 420, maxMp: 0, attack: 82, defense: 80, mind: 20, agility: 18 }, elementRates: { fire: "E", water: "A" }, skills: ["skill_attack", "skill_earth"] },
  { id: "enemy_fs2_starved_dog", name: "굶은 들개", art: "generated-enemy-hound-hell", hue: 150, style: "dash", stats: { maxHp: 150, maxMp: 0, attack: 72, defense: 20, mind: 20, agility: 62 }, skills: ["skill_attack"] },
  { id: "enemy_fs2_ash_snake", name: "재뱀", art: "generated-enemy-snake-viper", hue: 210, style: "slither", stats: { maxHp: 160, maxMp: 0, attack: 70, defense: 26, mind: 30, agility: 48 }, skills: ["skill_attack"] },
];
const ASH_TROOPS: { id: string; name: string; members: string[] }[] = [
  { id: "troop_fs2_ash_wisps", name: "잿불 도깨비 떼", members: ["enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp"] },
  { id: "troop_fs2_ash_crows", name: "재까마귀 떼", members: ["enemy_fs2_ash_crow", "enemy_fs2_ash_crow", "enemy_fs2_ash_crow"] },
  { id: "troop_fs2_cinder_golem", name: "숯덩이 골렘", members: ["enemy_fs2_cinder_golem", "enemy_fs2_ash_wisp"] },
  { id: "troop_fs2_starved_dogs", name: "굶은 들개", members: ["enemy_fs2_starved_dog", "enemy_fs2_starved_dog"] },
  { id: "troop_fs2_ash_snakes", name: "재뱀", members: ["enemy_fs2_ash_snake", "enemy_fs2_ash_snake"] },
];

const ENEMY_TOOL_FIELDS = new Set(["id", "name", "speciesId", "monsterResourceId", "battleScalePercent", "collapseEffect", "hideHp", "damageTypeRates", "criticalHit", "attackOptions", "skillIds", "level", "stats", "rewards", "actions", "reactions", "stealItems", "stateRates", "elementRates"]);
function ashFoes(project: Project, exec: Exec): void {
  const base = project.database.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!base) throw new Error("[fallen-star act2] enemy_fs_wolf 가 없다");
  for (const f of ASH_FOES) {
    const rec = JSON.parse(JSON.stringify(base)) as Rec;
    Object.assign(rec, {
      id: f.id, name: f.name, level: 10, monsterResourceId: f.art, stats: f.stats, skillIds: f.skills,
      actions: f.skills.map((skillId, i) => ({ skillId, priority: i === 0 ? 7 : 8, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } })),
      rewards: { exp: 70, gold: 18, dropRatePercent: 0, drops: [{ itemId: "item_potion", ratePercent: 20, quantity: 1, condition: { kind: "always" } }] },
      ...(f.elementRates ? { elementRates: { ...(base as unknown as Rec).elementRates as Rec, ...f.elementRates } } : {}),
    });
    delete rec.lungeSpeedPercent;
    // upsert_enemy 가 받는 칸만 넘긴다(graphicHue·transparent·flying 은 도구 밖 — 전투가 읽지 않는다).
    for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
    exec(project, "upsert_enemy", { enemy: rec });
  }
  for (const t of ASH_TROOPS) exec(project, "upsert_troop", { troop: { id: t.id, name: t.name, enemyIds: t.members } });
}

function dawnwell(project: Project, exec: Exec): void {
  ensureSwitch(project, SW_CERT, "B5: 세린의 정착 확인서");
  SW_MEMS.forEach((id, i) => ensureSwitch(project, id, `B5: 새벽샘 기억 ${i + 1}`));
  exec(project, "upsert_item", { item: {
    id: FS2_CERT_ITEM, name: "반쯤 탄 정착 확인서", type: "special", occasion: "never", consumable: false, price: 0,
    description: "천문대 서랍의 양식과 같은 종이. 서명란: 「기록자 세린」.\n서명 아래 아이 글씨 — 「엄마 문 열어」.",
  } });
  ashFoes(project, exec);
  // 서른 해 전의 새벽샘 — 작은 강가 마을을 한 번 짓고(보이지 않는 원본), 불탄 모습으로 바꾼다. 북쪽 끝 집 한 채만 남는다.
  const town0 = exec(project, "author_beodeul_town", { id: FS2_DAWNWELL_BASE, name: "새벽샘 (서른 해 전)", houseCount: 5, theme: "river", form: "street", water: "none", seed: 31 }) as
    { doors?: { kit: string; x: number; y: number }[] } | undefined;
  const derived = exec(project, "derive_map_variant", {
    sourceMapId: FS2_DAWNWELL_BASE, variants: [{ id: FS2_DAWNWELL_ID, name: "새벽샘 터", look: "burned", keepIntact: "north" }],
  }) as { variants?: { look?: { keptIntact?: { kitId: string; x: number; y: number; w: number; h: number } } }[] } | undefined;
  const kept = derived?.variants?.[0]?.look?.keptIntact;
  if (!kept) throw new Error("[fallen-star act2] 새벽샘 남은 집이 없다");
  DAWN.kept = kept;
  // 남은 집의 문 앞 칸(author_beodeul_town data.doors = 문 앞 칸). 문 그림 칸은 그 바로 위.
  const front = town0?.doors?.find((d) => d.kit === `bd-house-${kept.kitId.replace(/^bd-house-/, "")}` || d.kit === kept.kitId);
  if (!front) throw new Error(`[fallen-star act2] 남은 집(${kept.kitId}) 문을 못 찾음`);
  DAWN.front = { x: front.x, y: front.y };
  exec(project, "set_map_properties", { mapId: FS2_DAWNWELL_ID, mapRole: "field" });
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
  // 보이는 적 — 숲 어귀엔 들개·까마귀, 들판엔 도깨비·뱀·골렘, 마을 터엔 도깨비·골렘.
  const foe = (mapId: string, troopId: string, x: number, y: number, style: string): void => {
    try {
      exec(project, "place_field_enemy", { mapId, x, y, troopId, behavior: "chase", patrol: { length: 2, axis: x % 2 ? "horizontal" : "vertical" },
        sightRange: 6, vision: "cone", pace: "normal", approachStyle: style, respawnSec: 60 });
    } catch { /* 그 칸은 도구가 거절(입구 곁·막힌 칸) — 건너뛴다 */ }
  };
  for (const mapId of [north1!, field!]) exec(project, "set_map_properties", { mapId, mapRole: "field" });
  const W = (id: string) => M(project, id).width, H = (id: string) => M(project, id).height;
  foe(north1!, "troop_fs2_starved_dogs", Math.floor(W(north1!) / 2), Math.floor(H(north1!) / 2), "dash");
  foe(north1!, "troop_fs2_ash_crows", Math.floor(W(north1!) / 2) + 4, Math.floor(H(north1!) / 3), "swoop");
  foe(field!, "troop_fs2_ash_wisps", Math.floor(W(field!) / 2), Math.floor(H(field!) / 2), "float");
  foe(field!, "troop_fs2_ash_snakes", Math.floor(W(field!) / 2) - 5, Math.floor(H(field!) * 2 / 3), "slither");
  foe(field!, "troop_fs2_cinder_golem", Math.floor(W(field!) / 2) + 4, Math.floor(H(field!) / 4), "lumber");
  // 마을 터 — 잠긴 집(서쪽) 앞을 비워 두고 동서 길목에.
  foe(FS2_DAWNWELL_ID, "troop_fs2_ash_wisps", 7, 22, "float");
  foe(FS2_DAWNWELL_ID, "troop_fs2_cinder_golem", 30, 22, "lumber");
  // 별빛 결정 — 마을 터 입구 곁.
  exec(project, "place_savepoint", { mapId: FS2_DAWNWELL_ID, x: b.x + 2, y: b.y - 3, id: "ev_fs2_dawnwell_save", name: "별빛 결정", mode: "slot",
    objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2 });
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
    { at: { x: Math.min(town.width - 3, k.x + k.w + 5), y: Math.min(town.height - 3, doorY + 3) }, lines: [["", "반쯤 묻힌 등 하나. 서리나루 사람들이 띄우는 그 등이다."], [KAEL, "대답의 등이야. 여기서도 띄웠구나."]] },
    { at: { x: door.x, y: Math.min(town.height - 3, doorY + 7) }, lines: [["", "길 한가운데 잿더미 속 장갑 한 짝. 안쪽에 실로 「ㅅ」."], [KAEL, "…발렌 장갑이랑 같은 실이야."]] },
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
      narrate("무너지지 않은 단 한 채. 문에 빗장이 바깥에서 걸려 있다."),
      narrate("문 아래쪽, 아이 키 높이에 작은 주먹 자국 셋."),
      say(ELENA, "문이 바깥에서 잠겨 있었어.\n안에 있던 사람이 못 나오게."),
      say(KAEL, "…이 마을을 먼저 둘러보자."),
    ]),
    page("ev_fs2_dawn_door_open", "빗장을 연다", [...allMems, sw(SW_CERT, false)], [
      cutBegin(),
      se("cc0-se-osx-door-open"),
      narrate("빗장을 들어 올렸다. 서른 해 만에 문이 열렸다."),
      narrate("안은 텅 비어 있다. 탁자 위에 반쯤 탄 종이 한 장."),
      se("cc0-se-orp-inventory-cloth"),
      item(FS2_CERT_ITEM, 1),
      narrate("「반쯤 탄 정착 확인서」를 얻었다.", { context: "system" }),
      say(ELENA, "천문대 서랍의 양식이랑 같아.\n서명란… 「기록자 세린」."),
      say(ELENA, "서명 아래 아이 글씨.\n「엄마 문 열어」."),
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
const FORT_ROOMS = [
  { id: "gate", kind: "entrance" }, { id: "yard", kind: "hall" }, { id: "cells", kind: "cell", from: "yard" },
  { id: "armory", kind: "storage", from: "yard" }, { id: "stair", kind: "hall" }, { id: "rampart", kind: "boss" },
];
/** 새벽샘 북쪽 맵 끝 요새 입구 칸(돌길 북쪽, 나무 덤불 서쪽). */
const FORT_GATE: Cell = { x: 24, y: 0 };
const FORT: { sarah: Cell; cell: Cell; rooms: { id: string; kind: string; x: number; y: number; w: number; h: number; spots: Cell[] }[] } = { sarah: { x: 0, y: 0 }, cell: { x: 0, y: 0 }, rooms: [] };

function northFortress(project: Project, exec: Exec, hubId: string): void {
  for (const [id, name] of [[SW_SARAH, "B6: 새라 합류"], [SW_SPEAR_BACK, "B6 선택1: 창을 돌려줬다"], [SW_SPEAR_KEPT, "B6 선택1: 창을 맡아 뒀다"], [SW_SARAH_LOST, "B6: 성벽 위에서 한 번 졌다"]] as const) ensureSwitch(project, id, name);
  exec(project, "upsert_item", { item: {
    id: FS2_STAR_IRON, name: "별쇠 조각", type: "special", occasion: "never", consumable: false, price: 0,
    description: "새라의 창끝에서 떼어 낸 별쇠. 로한이라면 창을 한 번 더 벼릴 수 있다.",
  } });
  // 새라 — 용기사 직업(꿰뚫기·도약), 도발·감싸기를 처음부터 안다.
  exec(project, "upsert_actor", { actor: {
    id: FS2_SARAH_ACTOR, name: SARAH, nickname: "북문의 창", classId: "class_dragoon", initialLevel: 10, maxLevel: 99,
    faceResourceId: "easyrpg-faceset-actor1-03", characterResourceId: "easyrpg-charset-actor1", characterIndex: 3,
    battleCharacterResourceId: "charset-battler-actor1-3",
    initialEquipment: { weapon: "equip_gen_spear_iron" },
    learnedSkills: [{ level: 1, skillId: "skill_dragoon_lance_thrust" }, { level: 1, skillId: "skill_fs_taunt" }, { level: 1, skillId: "skill_motion_cover" }, { level: 12, skillId: "skill_dragoon_jump" }],
  } });
  // 적 판 새라·요새 경비견 — 1막 창병·B5 들개 레코드를 복사해 그림·능력치만 바꾼다.
  const copyEnemy = (fromId: string, patch: Rec): void => {
    const base = project.database.enemies.find((e) => e.id === fromId);
    if (!base) throw new Error(`[fallen-star act2] ${fromId} 가 없다`);
    const rec = { ...(JSON.parse(JSON.stringify(base)) as Rec), ...patch };
    for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
    exec(project, "upsert_enemy", { enemy: rec });
  };
  const act = (skillId: string, priority: number) => ({ skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
  copyEnemy("enemy_fs_valen_spearman", {
    id: FS2_SARAH_ENEMY, name: SARAH, level: 12, monsterResourceId: "charset-battler-actor1-3",
    stats: { maxHp: 1300, maxMp: 60, attack: 86, defense: 46, mind: 30, agility: 64 },
    skillIds: ["skill_attack", "skill_dragoon_lance_thrust", "skill_fs_taunt"],
    actions: [act("skill_attack", 6), act("skill_dragoon_lance_thrust", 5), act("skill_fs_taunt", 3)],
    rewards: { exp: 420, gold: 0, dropRatePercent: 0, drops: [] },
  });
  copyEnemy("enemy_fs2_starved_dog", {
    id: FS2_FORT_DOG, name: "요새 경비견", level: 11, stats: { maxHp: 210, maxMp: 0, attack: 76, defense: 26, mind: 20, agility: 68 },
    rewards: { exp: 80, gold: 12, dropRatePercent: 0, drops: [{ itemId: "item_potion", ratePercent: 20, quantity: 1, condition: { kind: "always" } }] },
  });
  exec(project, "upsert_troop", { troop: { id: FS2_FORT_DOGS, name: "요새 경비견", enemyIds: [FS2_FORT_DOG, FS2_FORT_DOG] } });
  exec(project, "upsert_troop", { troop: { id: FS2_SARAH_TROOP, name: "성벽 위의 새라", enemyIds: [FS2_SARAH_ENEMY, FS2_FORT_DOG, FS2_FORT_DOG], uncapturable: true } });
  exec(project, "upsert_troop_battle_page", { troopId: FS2_SARAH_TROOP, page: {
    id: "fs2_sarah_open", name: "새라 — 시작", span: "battle", conditions: [{ kind: "onRound", round: 1 }],
    commands: [say(SARAH, "개들아, 물지는 마라. 넘어뜨리기만."), say(ELENA, "개부터 떼어 내자!\n새라 씨는 창을 길게 쓴다.")],
  } });
  exec(project, "upsert_troop_battle_page", { troopId: FS2_SARAH_TROOP, page: {
    id: "fs2_sarah_half", name: "새라 — 반", span: "battle", conditions: [{ kind: "enemyHpBelow", enemyId: FS2_SARAH_ENEMY, percent: 50 }],
    commands: [say(SARAH, "…그 창, 로한 아저씨 거지.\n손잡이 무늬가 우리 집 거랑 같아."), say(KAEL, "아저씨가 전해 달래요. 「고개 들어라」.")],
  } });
  // 새벽샘 북쪽 — 돌길에서 맵 끝까지 흙길을 내 요새 입구로 이끈다(풀밭 한가운데 출구로 보이지 않게).
  exec(project, "paint_road", { mapId: FS2_DAWNWELL_ID, points: [{ x: FORT_GATE.x, y: 6 }, { x: FORT_GATE.x, y: 0 }], style: "dirt", naturalness: 0 });
  // 요새 — 새벽샘 북쪽 길 끝. 방 문법으로 짓고, 보이는 적(경비견)·상자·쉼터는 도구가 채운다. 사람 순찰은 아래에서 칩을 주고 따로 놓는다.
  const d = exec(project, "author_dungeon", {
    type: "castle", adapter: "beodeul", genre: "rpg", name: "북방 관문 요새", id: FS2_FORTRESS_ID, rooms: FORT_ROOMS,
    populate: true, troops: { field: [FS2_FORT_DOGS], boss: FS2_FORT_DOGS }, gimmick: "none",
    entrance: { fromMapId: FS2_DAWNWELL_ID, x: FORT_GATE.x, y: FORT_GATE.y }, seed: 61,
  }) as { rooms?: { id: string; kind: string; x: number; y: number; w: number; h: number; spots: Cell[] }[] } | undefined;
  FORT.rooms = d?.rooms ?? [];
  const fort = M(project, FS2_FORTRESS_ID);
  // 도구가 보스방에 둔 경비견 보스 자리에 새라가 선다(보스 전투는 새라 이벤트가 연다).
  const boss = fort.events.find((e) => e.id === `ev_${FS2_FORTRESS_ID}_boss`);
  const rampart = FORT.rooms.find((r) => r.id === "rampart");
  if (!rampart) throw new Error("[fallen-star act2] 요새 성벽 방이 없다");
  FORT.sarah = boss ? { x: boss.x, y: boss.y } : rampart.spots[0]!;
  fort.events = fort.events.filter((e) => e.id !== `ev_${FS2_FORTRESS_ID}_boss`);
  const cells = FORT.rooms.find((r) => r.id === "cells");
  if (!cells) throw new Error("[fallen-star act2] 요새 감방이 없다");
  FORT.cell = { x: cells.x + 1, y: cells.y + cells.h - 2 };
  exec(project, "set_scene_mood", { mapId: FS2_FORTRESS_ID, applyMode: "map", lighting: { ambient: 0.55, color: "#40485a" } });
  // 돌 요새 안 싸움 — 풀밭 배경 대신 돌 배경(측면 전투 겹 배경 종류에 성채가 없어 동굴 돌벽이 가장 가깝다).
  exec(project, "set_map_properties", { mapId: FS2_FORTRESS_ID, battleBackground: "battle-scenery-cave" });
  // 순찰 기사 — 광장 통금 순찰대와 같은 칩·같은 무리. 안뜰·계단 홀에 하나씩.
  const knight = hubChip(project, hubId, "ev_fs_knight");
  let k = 0;
  for (const room of ["yard", "stair"]) {
    for (const at of FORT.rooms.find((r) => r.id === room)?.spots ?? []) {
      // 경비견·상자 곁(3칸 안)은 피한다 — 붙어 서면 한 무리로 읽힌다.
      if (M(project, FS2_FORTRESS_ID).events.some((e) => Math.max(Math.abs(e.x - at.x), Math.abs(e.y - at.y)) <= 3)) continue;
      try {
        exec(project, "place_field_enemy", {
          mapId: FS2_FORTRESS_ID, x: at.x, y: at.y, troopId: FS2_PATROL_TROOP, behavior: "chase", patrol: { length: 2, axis: k % 2 ? "vertical" : "horizontal" },
          sightRange: 5, vision: "cone", pace: "normal", approachStyle: "dash", graphic: knight, alert: "exclamation", respawnSec: 60, clearSwitchId: `sw_fs2_fort_knight_${k}_down`,
        });
        k += 1;
        break;
      } catch { /* 그 칸은 도구가 거절 — 다음 자리 */ }
    }
  }
}

function fortressEvents(project: Project): void {
  const fort = M(project, FS2_FORTRESS_ID);
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
    say(SARAH, "쇠 마차, 사흘 전에 여길 지났다.\n안에 있던 아이가… 계속 뭘 쓰고 있었어. 공책에."),
    say(ELENA, "이리스 일지예요."),
    say(SARAH, "창살 사이로 한 줄 보여 주더라.\n「오늘은 아무도 대답하지 않았다」."),
    emote("player", "ellipsis", 900),
    say(SARAH, "그 창, 로한 아저씨가 너한테 줬지.\n원래 내 아버지 창이었어."),
    { kind: "choices", prompt: "창을 어떻게 할까?", options: [
      { text: "창을 돌려준다", branch: [
        say(KAEL, "아저씨는 저한테 맡긴 거예요.\n주인은 따로 있다는 거 알았을걸요."),
        say(SARAH, "…고개 들어라. 아버지 말버릇이었지."),
        setSw(SW_SPEAR_BACK),
        { kind: "setVariable", variableId: VAR_BOND_SARAH, op: "+=", value: 1 } as unknown as Command,
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_check" } as unknown as Command,
      ] },
      { text: "창을 맡아 둔다", branch: [
        say(KAEL, "북쪽까지는 제가 들고 갈게요.\n돌려드리는 건 그다음에."),
        say(SARAH, "…그래. 대신 창끝 별쇠는 떼어 가라. 로한 아저씨가 쓸 거다."),
        se("cc0-se-orp-inventory-cloth"),
        item(FS2_STAR_IRON, 1),
        narrate("「별쇠 조각」을 받았다.", { context: "system" }),
        setSw(SW_SPEAR_KEPT),
      ] },
    ] } as unknown as Command,
    say(SARAH, "발렌 님한테 가는 길이면 나도 간다.\n물어볼 게 있어. …아버지 일로."),
    se("cc0-se-orp-inventory-cloth"),
    { kind: "changeParty", actorId: FS2_SARAH_ACTOR, action: "add" } as unknown as Command,
    narrate("새라가 동료가 되었다.", { context: "system" }),
    setSw(SW_SARAH),
    cutLabel(),
    cutEnd(),
    say(SARAH, "북문은 왕좌 뒤 계단이다. 따라와."),
    fadeOut(900),
    transfer(FS2_SNOW.mapIds[0]!, FS2_SNOW.entry, "up"),
  ];
  addEvent(fort, "ev_fs2_fort_sarah", SARAH, FORT.sarah, [
    page("ev_fs2_fort_sarah_p", "성벽 위의 새라", [], [
      cutBegin(),
      emote("ev_fs2_fort_sarah", "exclamation", 700),
      say(SARAH, "별지기 꼬마들. 여기서 돌아가라.\n명령이다. …내 명령이 아니라서 미안하다."),
      say(KAEL, "로한 아저씨가 전해 달래요.\n「고개 들어라」."),
      say(SARAH, "…그 말, 발렌 님이 늘 하던 말인데.\n아버지한테서 배운 거였구나."),
      say(SARAH, "그래도 길은 못 내준다. 창으로 말해라."),
      cutLabel(),
      cutEnd(),
      { kind: "battleProcessing", troopId: FS2_SARAH_TROOP, canEscape: false, canLose: true, branchOnResult: true, victoryBranch: win, defeatBranch: lose, escapeBranch: [] } as unknown as Command,
    ], { graphic: sarahChip }),
    // 합류 뒤 — 새라가 서 있던 자리(왕좌 앞)에서 조사하면 북문 계단으로 나간다.
    page("ev_fs2_fort_sarah_gone", "북문 계단", [sw(SW_SARAH)], [
      narrate("왕좌 뒤로 북문에 닿는 좁은 계단이 있다."),
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
const SW_SNOW_ARRIVE = "sw_fs2_snow_arrived";

function snowPass(project: Project, exec: Exec): void {
  ensureSwitch(project, SW_SNOW_ARRIVE, "B7: 서리 가도에 들어섰다");
  const d = exec(project, "author_snow_route", {
    fromMapId: FS2_FORTRESS_ID, side: "north", count: 2, names: ["서리 가도", "눈보라 고개"], moods: ["snow", "blizzard"],
    gapCount: 2, gapWidth: 1, paintGaps: true, linkFrom: false, openEnd: true, seed: 71,
  }) as { maps?: { mapId: string; entry: Cell; exit: Cell | null; clearing: Cell; gaps: { from: Cell; to: Cell; seals: boolean }[] }[] } | undefined;
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
      hint: "새라가 창을 얼음에 꽂았다. 「잡아. 뛴다.」", blockedText: "얼음이 길을 가로질러 갈라져 있다. 맨몸으로 뛰기엔 넓다.",
    });
  }));
  // 첫 맵 입구 — 요새 북문 계단으로 돌아간다(성벽 위 새라 자리 아래 칸).
  addEv(project, FS2_SNOW.mapIds[0]!, "ev_fs2_snow_back", "요새 북문", FS2_SNOW.back, [
    page("ev_fs2_snow_back_p", "요새로", [], [transfer(FS2_FORTRESS_ID, { x: FORT.sarah.x, y: FORT.sarah.y + 1 }, "down")], { trigger: { kind: "playerTouch" }, priority: "below" }),
  ]);
  // 들어서면 한 번 — 이리스 없는 눈길.
  addEv(project, FS2_SNOW.mapIds[0]!, "ev_fs2_snow_arrive", "서리 가도", { x: 1, y: 0 }, [
    page("ev_fs2_snow_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_snow_arrive_run", "들어선다", [sw(SW_SARAH)], [
      wait(500),
      say(SARAH, "이 바람엔 길이 안 보여."),
      say(KAEL, "그럼 별을 보고 가요. 저기, 북쪽 끝."),
      say(ELENA, "이리스가 있었으면 손끝에 불 켜 줬을 텐데."),
      say(KAEL, "그러니까 데리러 가는 거야."),
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
      { actorId: FS2_SARAH_ACTOR, variableId: VAR_BOND_SARAH, talk: ["아버지는 북문 기사였어. 쇠 마차가 처음 온 해에 돌아오지 않았지.", "발렌 님은 그 뒤로 날 북문에 세웠다. …고개 들라고."] },
    ],
    intro: ["바위 그늘에 불을 피웠다. 눈보라가 잠깐 잦아든다."],
    // 새라 유대 2 — 창 휘두르기(창을 돌려줬으면 B6 에서 1 이 먼저 쌓여 있다).
    unlocks: [{ actorId: FS2_SARAH_ACTOR, atLeast: 2, learn: [{ skillId: "skill_dragoon_sweeping_lance" }], message: "새라가 「창 휘두르기」를 떠올렸다." }],
    campfires: [{ mapId: FS2_SNOW.mapIds[1]!, x: fire.x, y: fire.y + 1, id: "ev_fs2_snow_fire", name: "모닥불" }],
  });
}

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
export const FS2_FROST: { entry: Cell; harma: Cell; holes: Cell[]; innDoor: Cell; innExit: Cell; sled: Cell; locked: Cell[] } =
  { entry: { x: 0, y: 0 }, harma: { x: 0, y: 0 }, holes: [], innDoor: { x: 0, y: 0 }, innExit: { x: 0, y: 0 }, sled: { x: 0, y: 0 }, locked: [] };

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
    description: "나루지기 집안에 내려오는 작은 은 노 모양 목걸이. 얼음 속성 피해를 막는다.\n「대답한 사람 집 물건이야. 달에도 닿는다더라.」",
    statBonuses: { attack: 0, defense: 6, mind: 6, agility: 0 }, equippableActorIds: wearers, equippableClassIds: actorClasses(wearers), elementalDefenseIds: ["ice"],
  } });

  // 마을 — 못(얼음낚시터)·나루 소품은 설원 마을 문법이 깐다. 문 앞 칸은 결과 data.doors.
  const town = exec(project, "author_beodeul_town", { id: FS2_FROST_ID, name: "서리나루", theme: "snow", houseCount: 5, seed: 81 }) as
    { doors?: { kit: string; x: number; y: number; reached?: boolean }[]; work?: Cell & { name?: string }; anchors?: string[] } | undefined;
  const doors = (town?.doors ?? []).filter((d) => d.reached !== false && !(town?.anchors ?? []).includes(d.kit));
  if (doors.length < 3) throw new Error("[fallen-star act2] 서리나루 집 문이 모자란다");
  const work = town?.work ?? { x: 16, y: 12 };
  exec(project, "set_scene_mood", { mapId: FS2_FROST_ID, applyMode: "map", weather: { kind: "snow", intensity: 0.35 }, lighting: { ambient: 0.85, color: "#c8d4ee" } });
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
  // 여관 주인 — 썰매를 되찾아 주면 공짜. 별빛 결정은 홀 안쪽.
  exec(project, "place_npc", {
    mapId: FS2_FROST_INN_ID, id: "ev_fs2_frost_innkeeper", name: "여관 주인 오사", x: FS2_FROST.innExit.x + 3, y: FS2_FROST.innExit.y - 4, movement: "fixed",
    graphic: { textureKey: "tex_easyrpg_charset_people2", characterIndex: 4 },
    pages: [
      { name: "기본", commands: [say("여관 주인 오사", "장작을 징발당해서 방이 차요.\n그래도 담요는 두꺼워요. 하룻밤에 20골드."), { kind: "inn", price: 20 }] },
      { name: "썰매 뒤", conditions: [sw(SW_Q6_DONE)], commands: [say("여관 주인 오사", "썰매를 찾아 준 손님한테 돈을 받으면\n하르마 할머니한테 혼나요. 그냥 자요."), { kind: "inn", price: 0 }] },
    ],
  });
  for (const [dx, dy] of [[-3, -3], [3, -3], [-4, -2], [4, -2], [0, -6]] as const) {
    try {
      exec(project, "place_savepoint", { mapId: FS2_FROST_INN_ID, x: FS2_FROST.innExit.x + dx, y: FS2_FROST.innExit.y + dy, id: "ev_fs2_frost_save", name: "별빛 결정", mode: "slot",
        objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2 });
      break;
    } catch { /* 가구 칸 — 다음 자리 */ }
  }

  // 나머지 집 문 — 가짜 문이 되지 않게 한 줄씩.
  const lockedLines = ["문틈으로 생선 굽는 냄새가 샌다. 「장작이 없어서 반만 익었어!」", "「심문회 사람이면 돌아가요.」 …문은 안 열린다.",
    "아이가 창에 입김을 불어 등 모양을 그린다. 문은 잠겨 있다.", "빈집이다. 문고리에 얼음이 끼었다."];
  doors.filter((d) => d !== innFront).forEach((d, k) => {
    const at = { x: d.x, y: d.y - 1 };
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
    try { exec(project, "stamp_tileset_object", { mapId: FS2_FROST_ID, objectId: "bd-pick-snowfield-lamp", at: { x: pond.x + dx, y: pond.y + dy } }); lamps += 1; } catch { /* 길·집 칸 */ }
  }
  // 등불 빛 — 낮이라 약하게.
  exec(project, "set_lighting_volume", { mapId: FS2_FROST_ID, applyMode: "map", ambient: 0.85, color: "#c8d4ee",
    sources: FS2_FROST.holes.map((h, i) => ({ id: `hole${i}`, at: { x: h.x, y: h.y }, radius: 2, intensity: 0.25, color: "#9fd0ff" })) });

  // 하르마 — 얼음낚시터 곁.
  exec(project, "place_npc", {
    mapId: FS2_FROST_ID, id: "ev_fs2_harma", name: HARMA, x: work.x, y: work.y + 1, movement: "fixed",
    graphic: { query: "노인 여성" },
    pages: [
      { name: "처음", commands: [
        say(HARMA, "별지기 옷이네. 오랜만에 보는구먼."),
        say(HARMA, "우리 증조할미가 달에서 온 아이한테\n「잘 지내」 했대. 그 뒤로 이 호수는 안 얼어 죽어."),
        say(KAEL, "…세린이라는 분을 아세요?"),
        say(HARMA, "세린이? 알지. 등을 제일 멀리 띄우던 애.\n…그 애 아들이 이번에 탑으로 올라갔어."),
        say(KAEL, "그 사람, 등을 띄우는 법은 안 잊었어요."),
        say(HARMA, "그럼 됐다. 밤에 얼음 위로 나가 봐. 등이 하나 떠 있을 게다."),
        setSw(SW_HARMA),
        say(HARMA, "그 전에 부탁 하나. 심문회가 썰매를 다 끌어가서\n고기 잡을 사람이 없어. 저 구멍에서 은빛 송어 한 마리만."),
        setSw(SW_Q5_TAKEN),
        narrate("잔 일 「첫째 아이의 고기」 — 얼음 구멍에서 은빛 송어를 낚아 하르마에게.", { context: "system" }),
      ] },
      { name: "송어 기다림", conditions: [sw(SW_Q5_TAKEN)], commands: [say(HARMA, "구멍 앞에 서서 줄을 내리면 돼.\n첫째 아이처럼 기다리는 게 요령이지.")] },
      { name: "송어", conditions: [sw(SW_Q5_FISH)], commands: [
        say(HARMA, "오, 은빛이구먼. 첫째 아이의 고기야.\n대답을 받은 아이는 물고기 한 마리를 받았거든."),
        item(FS2_TROUT, -1),
        se("cc0-se-orp-inventory-cloth"),
        item(FS2_HARMA_OAR, 1),
        narrate("「하르마의 은빛 노」를 받았다.", { context: "system" }),
        say(HARMA, "우리 집 노야. 얼음 위에서 미끄러지지 말라고."),
        setSw(SW_Q5_DONE),
      ] },
      { name: "끝", conditions: [sw(SW_Q5_DONE)], commands: [say(HARMA, "밤에 얼음 위로 나가 봐.\n…그 애 아들, 등 띄우는 손은 엄마랑 똑같아.")] },
    ],
  });
  FS2_FROST.harma = (() => { const e = M(project, FS2_FROST_ID).events.find((v) => v.id === "ev_fs2_harma"); return e ? { x: e.x, y: e.y } : { x: work.x, y: work.y + 1 }; })();

  // 얼음 구멍 — 부탁을 받은 뒤 줄을 내리면 송어가 문다.
  FS2_FROST.holes.forEach((h, k) => {
    addEv(project, FS2_FROST_ID, `ev_fs2_frost_hole_${k}`, "얼음 구멍", h, [
      page(`ev_fs2_frost_hole_${k}_idle`, "구멍", [], [narrate("얼음 구멍. 검은 물이 천천히 숨을 쉰다.")]),
      page(`ev_fs2_frost_hole_${k}_fish`, "낚는다", [sw(SW_Q5_TAKEN)], [
        narrate("줄을 내렸다. …얼음 밑에서 뭔가가 천천히 돈다."),
        wait(900),
        se("cc0-se-osx-splash-01"),
        emote("player", "exclamation", 700),
        narrate("손끝이 당긴다!"),
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
        say(SARAH, "…북문 기사 새라다. 탑 수비대는 장작이 남아돈다.\n이건 마을에 돌려놔라. 내가 발렌 님께 말한다."),
        say("징발대 병사", "새, 새라 님…! 북문에 계신 줄만…\n…알겠습니다. 돌려놓겠습니다."),
        fadeOut(600),
        setSw(SW_Q6_DONE),
        { kind: "setVariable", variableId: VAR_BOND_SARAH, op: "+=", value: 1 } as unknown as Command,
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_check" } as unknown as Command,
        fadeIn(600),
        narrate("잔 일 「징발된 장작」 — 장작 썰매가 마을로 돌아갔다. (여관 공짜 · 새라 유대 +1)", { context: "system" }),
        say(SARAH, "…이 마을 장작으로 내 아버지 장례 불을 땠었지."),
      ] },
      { name: "물러남", conditions: [sw(SW_Q6_DONE)], commands: [] },
    ],
  });
  // 물러난 뒤 — 병사는 사라진다(투명·아래층, 길을 막지 않는다).
  const req = M(project, FS2_FROST_ID).events.find((e) => e.id === "ev_fs2_frost_requisition");
  const gone = req?.pages?.[1];
  if (gone) { gone.graphic = { transparent: true } as EventPage["graphic"]; gone.priority = "below"; (gone as unknown as Rec).overlapForbidden = false; }
  FS2_FROST.sled = sled;

  // 들어서면 한 번.
  addEv(project, FS2_FROST_ID, "ev_fs2_frost_arrive", "서리나루", { x: 1, y: 0 }, [
    page("ev_fs2_frost_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_frost_arrive_run", "들어선다", [sw(SW_SARAH)], [
      wait(400),
      narrate("얼어붙은 못가의 나루 마을. 굴뚝마다 연기가 가늘다."),
      say(SARAH, "서리나루다. 장작을 다 뺏겨서 연기가 저것뿐이야."),
      say(ELENA, "저기 못 위… 구멍 앞에 할머니가 서 있어."),
      setSw(SW_FROST_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_frost_arrive_done", "끝", [sw(SW_FROST_ARRIVE)], [], { priority: "below" }),
  ]);
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
  northGateEvents(project, ids.hub);
  dawnwellEvents(project);
  northFortress(project, exec, ids.hub);
  snowPass(project, exec);
  frostford(project, exec, ids.hub);
  fortressEvents(project);
}
