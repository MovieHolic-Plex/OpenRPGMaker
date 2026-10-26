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

type Exec = (project: Project, name: string, args: Record<string, unknown>) => void;
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
  return {
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: fixedMove, commands, ...extra,
  } as unknown as EventPage;
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
  exec(project, "place_lift", {
    mapId: FS2_SHAFT_ID, x: SHAFT.lift.x, y: SHAFT.lift.y, direction: "up", distance: 5, text: "승강 장치에 올라탔다. 위는 천문대 서고다.",
    toMapId: FS2_OBS_NIGHT_ID, toX: OBS.lift.x, toY: OBS.lift.y, toDirection: "right",
  });
  exec(project, "place_lift", {
    mapId: FS2_OBS_NIGHT_ID, x: OBS.lift.x, y: OBS.lift.y, direction: "down", distance: 5, text: "승강 장치로 서고 밑으로 내려간다.",
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

export interface FallenAct2Ids { hub: string; observatory: string }

export function applyFallenAct2Opening(project: Project, exec: Exec, ids: FallenAct2Ids): void {
  database(project, exec);
  cellMap(project, exec);
  barracks(project, exec);
  hubNight(project, exec, ids.hub);
  curfewHub(project, exec, ids.hub);
  observatoryNight(project, exec, ids.observatory);
  cellEvents(M(project, FS2_CELL_ID));
  bridge(project, exec);
}
