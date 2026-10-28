/**
 * 『폴른 스타』 제2막 B8 서리나루 · B9 얼음 위의 밤 (2026-10-28 재시공 — 적대적 VQA 2차 REBUILD).
 *
 * 마을 그림은 frostfordMap.ts 가 직접 짓는다(세로형: 남쪽 어귀 → 광장 → 기슭·부두 → 언 호수·바위섬 사당 → 북쪽 돌계단·탑 문).
 * 이 파일은 사람·잔 일·실내·밤 장면·탈출을 도구(exec = runTool)로 얹는다.
 *   - B8: 하르마(세린 이야기, Q5 은빛 송어), 징발대 병사(Q6 썰매, 새라의 한마디), 여관 오사(별빛 결정), 집 셋(등 공방·어부 도윤·하르마),
 *         탑 문을 막은 기사 둘(낮), 마을 사람 넷, 해 질 녘 「대답의 등」.
 *   - B9: 밤 판(duplicate_map). 발렌은 섬 사당 앞. 대화 뒤 카메라가 북쪽 탑 문으로 올라가 빛기둥(광원 기둥·반짝이·섬광)을 보여 주고 돌아온다.
 *         탈출(make_timed_escape): 섬 → 미리 난 큰 균열 둘을 피해 세 번 꺾어 북쪽 돌계단. 뒤에서 금(1초 경고) → 검은 물로 쫓아오는 붕괴,
 *         앞쪽에 금으로 예고된 갈라짐 셋. 실패하면 사당 앞에서 다시(대화 없이). 계단에 오르면 뒤 얼음이 통째로 꺼진다.
 */
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { canMove } from "@/project/collision";
import { FS_NAMES } from "../fallenStarStory";
import { FS2_CERT_ITEM, FS2_SARAH_ACTOR, FS2_SNOW } from "./act2Opening";
import { FROST_WATER_GROUP, paintFrostford, type FrostHouse, type FrostLayout } from "./frostfordMap";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Rec = Record<string, unknown>;

const KAEL = FS_NAMES.hero;
const ELENA = FS_NAMES.mage;
const SARAH = "새라";
const SW_SARAH = "sw_fs2_sarah_joined";
const VAR_BOND_SARAH = "var_fs2_bond_sarah";
const SAVE_CRYSTAL = "kit:beodeul_city/bd-pick-dungeon-theme-crystal-pedestal";

// ── id ─────────────────────────────────────────────────────────────────
export const FS2_FROST_ID = "fs2_frostford";
export const FS2_FROST_INN_ID = "fs2_frostford_inn";
export const FS2_FROST_NIGHT_ID = "fs2_frostford_night";
export const FS2_TOWER_ID = "fs2_sky_tower";
const FS2_TROUT = "item_fs2_silver_trout";
const FS2_HARMA_OAR = "equip_fs2_harma_oar";
export const SW_FROST_ARRIVE = "sw_fs2_frost_arrived";
export const SW_HARMA = "sw_fs2_harma_told";
const SW_Q5_TAKEN = "sw_fs2_q5_trout_asked";
const SW_Q5_FISH = "sw_fs2_q5_trout_caught";
const SW_Q5_DONE = "sw_fs2_q5_trout_done";
const SW_Q6_DONE = "sw_fs2_q6_sled_back";
const SW_FROST_LAMP = "sw_fs2_frost_lamp_floated";
const SW_NIGHT = "sw_fs2_frost_night";
const SW_VALEN_SWORD = "sw_fs2_valen_sword";
const SW_VALEN_LANTERN = "sw_fs2_valen_lantern";
const SW_VALEN_SERIN = "sw_fs2_valen_serin";
export const SW_VALEN_MET = "sw_fs2_valen_lake_met";
const SW_ICE_RUN = "sw_fs2_ice_run";
export const SW_ICE_DONE = "sw_fs2_ice_crossed";
export const SW_STOP_B9 = "sw_fs2_release_stop_b9";
const HARMA = "나루지기 하르마";
const VALEN = "발렌";
const OSA = "여관 주인 오사";

/**
 * 판본이 끝나는 비트 — "B8" 이면 서리나루 여관에서 막 카드와 저장 화면으로 멈추고 B9 밤 판으로 가는 이동을 만들지 않는다.
 * "B9"(1.24~1.25) 면 얼음 위의 밤·탈출까지 열고, 하늘탑 1층에 닿으면 같은 카드와 저장 화면, 위층 계단은 「다음 업데이트」.
 * B10 을 실제로 내보낼 때 null 로 바꾼다.
 */
export const FS2_RELEASE_STOP: "B8" | "B9" | null = "B9";

/** 체크포인트·탐침이 읽는 좌표(지은 뒤 채워진다). */
export const FS2_FROST: { entry: Cell; harma: Cell; holes: Cell[]; innDoor: Cell; innExit: Cell; sled: Cell; locked: Cell[]; lamps: Cell[]; homes: Record<string, Cell>; gate: Cell[]; people: Record<string, Cell> } =
  { entry: { x: 0, y: 0 }, harma: { x: 0, y: 0 }, holes: [], innDoor: { x: 0, y: 0 }, innExit: { x: 0, y: 0 }, sled: { x: 0, y: 0 }, locked: [], lamps: [], homes: {}, gate: [], people: {} };
export const FS2_LAKE: { valen: Cell; checkpoint: Cell; gate: Cell; stairs: Cell[]; seconds: number; pathCells: number } =
  { valen: { x: 0, y: 0 }, checkpoint: { x: 0, y: 0 }, gate: { x: 0, y: 0 }, stairs: [], seconds: 0, pathCells: 0 };

// ── 명령 조각(act2Opening.ts 와 같은 꼴) ─────────────────────────────────
const say = (speaker: string, body: string, extra: Rec = {}): Command => ({ kind: "text", speaker, body, ...extra } as unknown as Command);
const narrate = (body: string, extra: Rec = {}): Command => ({ kind: "text", body, ...extra } as unknown as Command);
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const emote = (target: string, kind: string, durationMs = 800): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as unknown as Command);
const route = (eventId: string, moves: Rec[], waitFor = true): Command =>
  ({ kind: "moveEvent", eventId, route: { moves, repeat: false, wait: waitFor, skippable: true } } as unknown as Command);
const shake = (level = 3, durationMs = 500): Command =>
  m2("m2-048-shake-screen", { intensity: level <= 1 ? "1" : level <= 3 ? "3" : "6", durationMs, direction: "vertical" });
const flash = (color: string, ms: number): Command => m2("m2-202-screen-effect", { effect: "flash", value: color, durationMs: ms });
const fadeOut = (ms = 1200): Command => m2("m2-202-screen-effect", { effect: "fadeOut", value: "", durationMs: ms });
const fadeIn = (ms = 900): Command => m2("m2-202-screen-effect", { effect: "fadeIn", value: "", durationMs: ms });
const sparkle = (x: number, y: number, ms: number): Command => m2("m2-224-particle-effect", { preset: "sparkle", target: "tile", x, y, durationMs: ms, wait: false });
const scroll = (direction: Dir, distance: number, ms: number): Command => m2("m2-049-scroll-map", { direction, distance: String(distance), durationMs: String(ms), wait: "true" });
const scrollBack = (ms: number): Command => m2("m2-049-scroll-map", { mode: "return", durationMs: String(ms), wait: "true" });
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
  const g = out.graphic as { transparent?: boolean; sprite?: unknown } | undefined;
  if (!("overlapForbidden" in extra) && out.priority === "same" && g?.sprite && !g.transparent) out.overlapForbidden = true;
  return out as unknown as EventPage;
}
const chip = (sprite: string, characterIndex: number, direction: Dir): Rec => ({
  sprite: { type: "bundled", id: sprite }, direction, pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
});
function M(project: Project, id: string): GameMap {
  const map = project.maps[id];
  if (!map) throw new Error(`[fallen-star frostford] 맵이 없다: ${id}`);
  return map;
}
/** 도구를 부를 때마다 맵 객체가 새로 바뀐다 — 이벤트는 그때그때 맵을 다시 찾아 붙인다. */
function addEv(project: Project, mapId: string, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  const map = M(project, mapId);
  map.events = map.events.filter((e) => e.id !== id);
  const event = { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent;
  map.events.push(event);
  return event;
}
function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function chipOf(project: Project, eventId: string, mapId?: string): { textureKey: string; characterIndex: number } {
  const events = mapId ? M(project, mapId).events : Object.values(project.maps).flatMap((m) => m.events);
  const ev = events.find((e) => e.id === eventId);
  const g = ev?.pages?.find((pg) => (pg.graphic as { sprite?: unknown } | undefined)?.sprite)?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
  if (!g?.sprite?.id || typeof g.pattern !== "number") throw new Error(`[fallen-star frostford] 칩을 못 찾음: ${eventId}`);
  return { textureKey: g.sprite.id, characterIndex: decodeCharsetFrameIndex(g.pattern).characterIndex };
}
const goesTo = (target: string) => (e: GameEvent) => JSON.stringify(e).includes(`"mapId":"${target}"`);

// ════════════════════════════════════════════════════════════════════
// 실내 — 손 도트 실내 v5 방 사각형으로 직접 짠다(옷가게 마네킹·생선 진열대·현대 부엌이 끼던 예제 구성 대신).
// ════════════════════════════════════════════════════════════════════

type Room = { name: string; args: Rec; npc?: { id: string; name: string; chip: string; at: Cell; lines: string[] } };

const LAMP_HOUSE: Room = {
  name: "서리나루 · 등 공방",
  args: {
    floor: "boards", wall: "log", ceiling: "wood",
    rooms: [
      { id: "work", x0: 1, y0: 1, x1: 10, y1: 9, floor: "boards", wall: "log" },
      { id: "bed", x0: 12, y0: 1, x1: 16, y1: 7, floor: "dplank", wall: "log" },
    ],
    connect: [{ a: "work", b: "bed" }],
    exit: { room: "work", x: 5 },
    objects: [
      { id: "stove", x: 2, y: 3 }, { id: "firewood rack", x: 3, y: 3 }, { id: "bookshelf 1w", x: 9, y: 3 },
      { id: "hanging lantern", x: 5, y: 1 }, { id: "hanging lantern", x: 7, y: 1 }, { id: "window", x: 3, y: 1 },
      { id: "chair N", x: 6, y: 7 }, { id: "crate", x: 9, y: 8 }, { id: "sack", x: 2, y: 8 }, { id: "firewood bundle", x: 2, y: 6 },
      { id: "bed green", x: 13, y: 3 }, { id: "nightstand", x: 14, y: 3 }, { id: "chest", x: 16, y: 6 }, { id: "window", x: 15, y: 1 }, { id: "coat rack", x: 16, y: 3 },
    ],
    tables: [{ style: "work", x: 5, y: 5, w: 3, h: 2 }],
    goods: [{ id: "papers", x: 5, y: 5 }, { id: "lamp", x: 6, y: 5 }, { id: "scissors", x: 7, y: 5 }, { id: "candle", x: 5, y: 6 }, { id: "lamp", x: 7, y: 6 }],
  },
  npc: { id: "ev_fs2_frost_lampmaker", name: "등 만드는 소이", chip: "ev_fs_crowd_b", at: { x: 6, y: 4 }, lines: [
    "오늘이 「대답의 등」 띄우는 밤이에요.\n기름이 모자라서 아껴야 하지만\n등은 띄워야죠.",
    "등마다 한 줄씩 적어요. 받을 사람이\n누군지 몰라도 돼요.\n「잘 지내」 한마디면 충분해요.",
    "세린 언니가 그랬어요. 대답은 받는\n사람보다 하는 사람을 살린다고.",
  ] },
};
const FISHER_HOUSE: Room = {
  name: "서리나루 · 어부 도윤의 집",
  args: {
    floor: "boards", wall: "logdark", ceiling: "wood",
    rooms: [
      { id: "main", x0: 1, y0: 1, x1: 10, y1: 9, floor: "boards", wall: "logdark" },
      { id: "bed", x0: 12, y0: 1, x1: 15, y1: 7, floor: "dplank", wall: "logdark" },
    ],
    connect: [{ a: "main", b: "bed" }],
    exit: { room: "main", x: 5 },
    objects: [
      { id: "stove", x: 2, y: 3 }, { id: "firewood rack", x: 3, y: 3 }, { id: "fishing net", x: 5, y: 1 }, { id: "hang:fish", x: 9, y: 1 },
      { id: "barrel", x: 9, y: 3 }, { id: "water jar", x: 10, y: 3 }, { id: "chopping block", x: 9, y: 8 }, { id: "stool", x: 4, y: 7 },
      { id: "firewood bundle", x: 2, y: 8 },
      { id: "straw bed", x: 13, y: 3 }, { id: "chest", x: 15, y: 3 }, { id: "hang:fishr", x: 14, y: 1 },
    ],
    tables: [{ style: "dining", x: 5, y: 5, w: 2, h: 1 }],
    goods: [{ id: "fishplate", x: 5, y: 5 }, { id: "mug", x: 6, y: 5 }],
  },
  npc: { id: "ev_fs2_frost_fisher", name: "어부 도윤", chip: "ev_fs_crowd_f", at: { x: 7, y: 7 }, lines: [
    "썰매를 다 끌어가니 얼음 위로 나갈 수가\n있나. 구멍 하나에 매달려 사는 거지.",
    "밤에 섬 사당에 등 하나가 뜨면\n그건 세린네 아들이야. 해마다 몰래 와.",
    "심문회 옷을 입고서도\n등 띄우는 손은 안 떨더라.",
  ] },
};
const HARMA_HOUSE: Room = {
  name: "서리나루 · 하르마의 집",
  args: {
    floor: "plank", wall: "log", ceiling: "wood",
    rooms: [
      { id: "living", x0: 1, y0: 1, x1: 10, y1: 9, floor: "plank", wall: "log" },
      { id: "bed", x0: 12, y0: 1, x1: 16, y1: 7, floor: "plank", wall: "log" },
    ],
    connect: [{ a: "living", b: "bed" }],
    exit: { room: "living", x: 6 },
    objects: [
      { id: "fireplace", x: 3, y: 3 }, { id: "armchair", x: 2, y: 5 }, { id: "fur rug", x: 3, y: 5 }, { id: "firewood bundle", x: 5, y: 3 },
      { id: "fishing net", x: 7, y: 1 }, { id: "window", x: 5, y: 1 }, { id: "water jar", x: 10, y: 3 }, { id: "barrel", x: 9, y: 3 },
      { id: "stool", x: 8, y: 6 },
      { id: "bed blue", x: 13, y: 3 }, { id: "child bed", x: 15, y: 3 }, { id: "chest", x: 16, y: 6 },
    ],
    tables: [{ style: "dining", x: 8, y: 7, w: 2, h: 1 }],
    goods: [{ id: "teapot", x: 8, y: 7 }, { id: "cup", x: 9, y: 7 }],
  },
  npc: { id: "ev_fs2_frost_child", name: "하르마네 손주 나래", chip: "ev_fs_crowd_a", at: { x: 5, y: 7 }, lines: [
    "할머니는 부두에 나가 있어.\n난 등 접는 중이야. 이거 봐, 별 모양!",
    "옛날에 우리 할머니의 할머니가\n달에서 온 아이한테 「잘 지내」 했대.",
    "오늘 밤엔 나도 등 띄울 거야.\n형도 같이 띄워!",
  ] },
};
const INN: Room = {
  name: "서리나루 · 얼음등 여관",
  args: {
    floor: "boards", wall: "log", ceiling: "wood",
    rooms: [
      { id: "hall", x0: 1, y0: 1, x1: 13, y1: 12, floor: "boards", wall: "log" },
      { id: "room_a", x0: 15, y0: 1, x1: 20, y1: 5, floor: "dplank", wall: "log" },
      { id: "room_b", x0: 15, y0: 7, x1: 20, y1: 12, floor: "dplank", wall: "log" },
    ],
    connect: [{ a: "hall", b: "room_a" }, { a: "hall", b: "room_b" }],
    exit: { room: "hall", x: 7 },
    objects: [
      { id: "fireplace", x: 2, y: 3 }, { id: "fur rug", x: 2, y: 5 }, { id: "armchair", x: 1, y: 5 }, { id: "armchair", x: 4, y: 5 },
      { id: "firewood rack", x: 4, y: 3 }, { id: "deer trophy", x: 2, y: 1 }, { id: "hanging lantern", x: 6, y: 1 }, { id: "hanging lantern", x: 12, y: 1 },
      { id: "bottles", x: 9, y: 1 }, { id: "barrel", x: 12, y: 3 }, { id: "barrel", x: 13, y: 3 },
      { id: "chair S", x: 3, y: 8 }, { id: "chair N", x: 3, y: 10 }, { id: "chair S", x: 10, y: 8 }, { id: "chair N", x: 10, y: 10 },
      { id: "coat rack", x: 13, y: 11 },
      { id: "bed green", x: 16, y: 3 }, { id: "nightstand", x: 17, y: 3 }, { id: "bed green", x: 19, y: 3 }, { id: "window", x: 18, y: 1 },
      { id: "bed blue", x: 16, y: 9 }, { id: "nightstand", x: 17, y: 9 }, { id: "bed blue", x: 19, y: 9 }, { id: "chest", x: 20, y: 12 },
    ],
    tables: [{ style: "counter", x: 8, y: 5, w: 4, h: 1 }, { style: "dining", x: 3, y: 9, w: 2, h: 1 }, { style: "dining", x: 10, y: 9, w: 2, h: 1 }],
    goods: [{ id: "mug", x: 3, y: 9 }, { id: "breadplate", x: 4, y: 9 }, { id: "soup", x: 10, y: 9 }, { id: "beer", x: 9, y: 5 }],
  },
};

/** 방을 짓고 남쪽 출구 칸을 돌려준다. 실패하면 짓기 인자를 보고와 함께 던진다. */
function buildRoom(project: Project, exec: Exec, mapId: string, room: Room): Cell {
  const res = exec(project, "build_hand_interior_room", { mapId, name: room.name, ...room.args }) as { exits?: { x: number; y: number; width?: number }[] } | undefined;
  const ex = res?.exits?.[0];
  if (!ex) throw new Error(`[fallen-star frostford] ${room.name} 출구가 없다`);
  exec(project, "set_map_properties", { mapId, bgm: { mode: "custom", resourceId: "cc0-bgm-rtp-rst-001" } });
  // 바깥 눈발이 실내까지 남지 않게(날씨는 맵을 넘어 남는다).
  exec(project, "set_scene_mood", { mapId, applyMode: "map", weather: { kind: "none" }, lighting: { ambient: 0, color: "#000000" } });
  return { x: ex.x + Math.floor(((ex.width ?? 1) - 1) / 2), y: ex.y };
}

/** 바깥 집 문 ↔ 실내 출구. 바깥은 문 그림 칸의 부딪힘 문(들어가면 위를 본다), 나오면 문 앞 칸에 아래를 보고 선다. */
function linkDoor(project: Project, exec: Exec, house: FrostHouse, interiorId: string, exit: Cell): void {
  exec(project, "create_transfer_pair", { a: { mapId: FS2_FROST_ID, x: house.front.x, y: house.front.y, doorAt: house.door }, b: { mapId: interiorId, x: exit.x, y: exit.y } });
  const outer = M(project, FS2_FROST_ID).events.find((e) => String(e.id).startsWith("ev_gate_") && goesTo(interiorId)(e));
  if (outer) {
    outer.x = house.door.x; outer.y = house.door.y;
    for (const pg of outer.pages ?? []) {
      pg.priority = "same"; (pg as unknown as Rec).overlapForbidden = true;
      for (const cmd of pg.commands ?? []) if ((cmd as unknown as Rec).kind === "transfer") (cmd as unknown as Rec).direction = "up";
    }
  }
  for (const e of M(project, interiorId).events) if (goesTo(FS2_FROST_ID)(e)) for (const pg of e.pages ?? []) for (const cmd of pg.commands ?? []) {
    const t = cmd as unknown as Rec;
    if (t.kind === "transfer") { t.x = house.front.x; t.y = house.front.y; t.direction = "down"; }
  }
}

function placeNpc(project: Project, exec: Exec, mapId: string, at: Cell, args: Rec): Cell {
  const offsets: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]];
  for (const [dx, dy] of offsets) {
    try {
      exec(project, "place_npc", { mapId, x: at.x + dx, y: at.y + dy, movement: "fixed", ...args });
      const e = M(project, mapId).events.find((v) => v.id === args.id);
      return e ? { x: e.x, y: e.y } : { x: at.x + dx, y: at.y + dy };
    } catch { /* 막힌 칸 — 다음 자리 */ }
  }
  throw new Error(`[fallen-star frostford] ${String(args.name)} 자리가 없다 (${at.x},${at.y})`);
}

// ════════════════════════════════════════════════════════════════════
// B8 서리나루(낮·해 질 녘)
// ════════════════════════════════════════════════════════════════════

let LAYOUT: FrostLayout | null = null;

function frostford(project: Project, exec: Exec, hubId: string): void {
  for (const [id, name] of [[SW_FROST_ARRIVE, "B8: 서리나루 도착"], [SW_HARMA, "B8: 하르마 — 세린 이야기"], [SW_Q5_TAKEN, "B8 Q5: 은빛 송어 부탁"],
    [SW_Q5_FISH, "B8 Q5: 은빛 송어를 낚았다"], [SW_Q5_DONE, "B8 Q5: 하르마에게 송어를 줬다"], [SW_Q6_DONE, "B8 Q6: 장작 썰매를 되찾았다"],
    [SW_FROST_LAMP, "B8: 대답의 등을 띄웠다"]] as const) ensureSwitch(project, id, name);
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

  // 마을 그림.
  const L = paintFrostford(project, exec, FS2_FROST_ID, "서리나루");
  if (L.problems.length) throw new Error(`[fallen-star frostford] 마을 짓기 겹침: ${L.problems.join(" / ")}`);
  LAYOUT = L;
  const town = M(project, FS2_FROST_ID);
  town.bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-ihp-004" } as GameMap["bgm"];
  exec(project, "set_scene_mood", { mapId: FS2_FROST_ID, applyMode: "map", weather: { kind: "snow", intensity: 0.2 } });
  // 설원 길 두 번째 맵 북쪽 끝 → 마을 남쪽 어귀.
  if (!FS2_SNOW.exit) throw new Error("[fallen-star frostford] 설원 길 출구가 없다");
  exec(project, "create_transfer_pair", { a: { mapId: FS2_SNOW.mapIds[1]!, ...FS2_SNOW.exit }, b: { mapId: FS2_FROST_ID, x: L.entry.x, y: L.entry.y } });
  FS2_FROST.entry = L.entry;
  FS2_FROST.holes = L.holes;
  FS2_FROST.lamps = L.lamps;
  FS2_FROST.gate = L.gateFront;
  const H = (role: string) => { const h = L.houses.find((v) => v.role === role); if (!h) throw new Error(`[fallen-star frostford] 집이 없다: ${role}`); return h; };

  // 여관(광장 동쪽).
  const inn = H("inn");
  FS2_FROST.innDoor = inn.door;
  FS2_FROST.innExit = buildRoom(project, exec, FS2_FROST_INN_ID, INN);
  linkDoor(project, exec, inn, FS2_FROST_INN_ID, FS2_FROST.innExit);
  placeNpc(project, exec, FS2_FROST_INN_ID, { x: 9, y: 4 }, {
    id: "ev_fs2_frost_innkeeper", name: OSA, graphic: { textureKey: "tex_easyrpg_charset_people2", characterIndex: 4 },
    pages: [
      { name: "기본", commands: [say(OSA, "장작을 다 뺏겨서 방이 좀 차요.\n대신 담요는 두툼해요. 하룻밤에 20골드."), { kind: "inn", price: 20 }] },
      { name: "썰매 뒤", conditions: [sw(SW_Q6_DONE)], commands: [say(OSA, "썰매 찾아 준 손님한테 돈 받았다간\n하르마 할머니한테 혼나요. 그냥 주무세요."), { kind: "inn", price: 0 }] },
    ],
  });
  for (const at of [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 12, y: 7 }]) {
    try {
      exec(project, "place_savepoint", { mapId: FS2_FROST_INN_ID, x: at.x, y: at.y, id: "ev_fs2_frost_save", name: "별빛 결정", mode: "slot", objectId: SAVE_CRYSTAL, prompt: "기록할까요?", sparkleRadius: 2 });
      break;
    } catch { /* 가구 칸 — 다음 자리 */ }
  }

  // 집 셋(등 공방·어부 도윤·하르마) — 들어갈 수 있다. 나머지는 잠긴 문 한 줄.
  for (const [role, mapId, room] of [["lamp", "fs2_frostford_lamp", LAMP_HOUSE], ["fisher", "fs2_frostford_fisher", FISHER_HOUSE], ["harma", "fs2_frostford_harma", HARMA_HOUSE]] as const) {
    const h = H(role);
    const exit = buildRoom(project, exec, mapId, room);
    linkDoor(project, exec, h, mapId, exit);
    FS2_FROST.homes[role] = h.front;
    if (room.npc) {
      const c = chipOf(project, room.npc.chip, hubId);
      placeNpc(project, exec, mapId, room.npc.at, { id: room.npc.id, name: room.npc.name, graphic: c,
        pages: [{ name: "이야기", commands: room.npc.lines.map((line) => say(room.npc!.name, line)) }] });
    }
  }
  const lockedLines: Record<string, string> = {
    warehouse: "징발 창고다. 문에 심문회 봉인이 붙어 있다.",
    smoke: "훈제막이다. 안에서 연기 냄새만 난다. 문은 잠겨 있다.",
    east: "「심문회 사람이면 돌아가요.」 …문이 안 열린다.",
    west: "빈집이다. 문고리에 얼음이 끼었다.",
  };
  for (const h of L.houses) {
    const line = lockedLines[h.role];
    if (!line) continue;
    FS2_FROST.locked.push(h.door);
    addEv(project, FS2_FROST_ID, `ev_fs2_frost_door_${h.role}`, "닫힌 문", h.door, [page(`ev_fs2_frost_door_${h.role}_p`, "닫힌 문", [], [narrate(line)])]);
  }

  // 하르마 — 큰 부두 끝.
  FS2_FROST.harma = placeNpc(project, exec, FS2_FROST_ID, L.pierHead, {
    id: "ev_fs2_harma", name: HARMA, graphic: { query: "노인 여성" },
    pages: [
      { name: "처음", commands: [
        say(HARMA, "별지기 옷이구먼. 오랜만에 보는 옷이야."),
        say(HARMA, "우리 증조할미가 달에서 온 아이한테\n「잘 지내」 했대. 그 뒤로 이 호숫가에선\n얼어 죽는 사람이 없어."),
        say(KAEL, "…세린이라는 분을 아세요?"),
        say(HARMA, "세린이? 알지. 등을 제일 멀리 띄우던 애야.\n…그 애 아들이 이번에 탑으로 올라갔어."),
        say(KAEL, "그 사람, 등 띄우는 법은 안 잊었어요."),
        say(HARMA, "그럼 됐다. 밤에 얼음 위로 나가 보렴.\n섬 사당 앞에 등이 하나 떠 있을 게다."),
        say(ELENA, "호수 건너 탑 문은 기사들이 막고 있던데요."),
        say(HARMA, "지난달부터 심문회가 막았지.\n낮엔 아무도 못 들여. 밤이 되면\n기사들이 탑 안으로 들어가 버린단다."),
        say(HARMA, "밤까진 광장 동쪽 여관에서\n오사한테 신세 지렴."),
        setSw(SW_HARMA),
        say(HARMA, "그 전에 부탁 하나 하자. 심문회가 썰매를\n죄다 끌어가서 고기 잡을 사람이 없어.\n동쪽 얼음 구멍에서 송어 한 마리만 낚아 다오."),
        setSw(SW_Q5_TAKEN),
        narrate("잔 일 「첫째 아이의 고기」를 맡았다.\n동쪽 낚시터 얼음 구멍에서 송어를 낚아\n하르마에게 가져가자.", { context: "system" }),
      ] },
      { name: "송어 기다림", conditions: [sw(SW_Q5_TAKEN)], commands: [
        say(HARMA, "구멍 앞에 서서 줄을 내리면 돼.\n급하게 당기면 놓친다. 기다리는 게 요령이지."),
        say(HARMA, "밤을 기다리려거든 광장 동쪽 여관으로 가렴.\n송어는 나중에 갖고 와도 된다."),
      ] },
      { name: "송어", conditions: [sw(SW_Q5_FISH)], commands: [
        say(HARMA, "오, 은빛이구먼. 첫째 아이의 고기야.\n옛날에 대답을 들은 그 아이도\n이런 물고기를 한 마리 받았단다."),
        item(FS2_TROUT, -1),
        se("cc0-se-orp-inventory-cloth"),
        item(FS2_HARMA_OAR, 1),
        narrate("「하르마의 은빛 노」를 받았다.", { context: "system" }),
        say(HARMA, "우리 집 노다.\n얼음판에서 미끄러지지 말라고 주는 게야."),
        setSw(SW_Q5_DONE),
      ] },
      { name: "끝", conditions: [sw(SW_Q5_DONE)], commands: [
        say(HARMA, "밤에 얼음 위로 나가 보렴. 그 애 아들,\n등 띄우는 손이 제 어미랑 똑같다."),
        say(HARMA, "밤까진 광장 동쪽 여관에서 쉬렴."),
      ] },
    ],
  });

  // 얼음 구멍 — 부탁을 받은 뒤 줄을 내리면 송어가 문다.
  L.holes.forEach((h, k) => {
    addEv(project, FS2_FROST_ID, `ev_fs2_frost_hole_${k}`, "얼음 구멍", h, [
      page(`ev_fs2_frost_hole_${k}_idle`, "구멍", [], [narrate("얼음 구멍이다. 검은 물이 천천히 출렁인다.")]),
      page(`ev_fs2_frost_hole_${k}_fish`, "낚는다", [sw(SW_Q5_TAKEN)], [
        narrate("줄을 내렸다. …얼음 밑에서 뭔가 천천히 돈다."),
        wait(900),
        se("cc0-se-osx-splash-01"),
        emote("player", "exclamation", 700),
        narrate("입질이다! 줄이 팽팽해진다!"),
        item(FS2_TROUT, 1),
        narrate("「은빛 송어」를 낚았다.", { context: "system" }),
        setSw(SW_Q5_FISH),
      ]),
      page(`ev_fs2_frost_hole_${k}_done`, "끝", [sw(SW_Q5_FISH)], [narrate("물이 잠잠하다. 한 마리면 충분하다.")]),
    ]);
  });

  // Q6 징발된 장작 — 징발 창고 앞 썰매 곁 병사. 새라가 말하면 물러난다.
  const knight = chipOf(project, "ev_fs_knight", hubId);
  FS2_FROST.sled = L.sled;
  placeNpc(project, exec, FS2_FROST_ID, L.soldier, {
    id: "ev_fs2_frost_requisition", name: "징발대 병사", graphic: knight,
    pages: [
      { name: "썰매 지킴", commands: [
        say("징발대 병사", "물러서. 이 썰매와 장작은\n하늘탑 수비대 몫이다."),
        say(SARAH, "북문 기사 새라다. 탑 수비대는\n장작이 남아돈다. 이건 마을에 돌려놔라.\n발렌 님께는 내가 말하겠다."),
        say("징발대 병사", "새, 새라 님…! 북문에 계신 줄만 알았는데…\n알겠습니다. 바로 돌려놓겠습니다."),
        fadeOut(600),
        setSw(SW_Q6_DONE),
        { kind: "setVariable", variableId: VAR_BOND_SARAH, op: "+=", value: 1 } as unknown as Command,
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_check" } as unknown as Command,
        fadeIn(600),
        narrate("잔 일 「징발된 장작」 완료.\n장작 썰매가 마을로 돌아갔다.\n(여관 무료 · 새라 유대 +1)", { context: "system" }),
        say(SARAH, "어릴 때 아버지 손 잡고\n이 마을에 장작 사러 왔었지."),
      ] },
      { name: "물러남", conditions: [sw(SW_Q6_DONE)], commands: [] },
    ],
  });
  const req = M(project, FS2_FROST_ID).events.find((e) => e.id === "ev_fs2_frost_requisition");
  const gone = req?.pages?.[1];
  if (gone) { gone.graphic = { transparent: true } as EventPage["graphic"]; gone.priority = "below"; (gone as unknown as Rec).overlapForbidden = false; }

  // 탑 문 — 낮엔 심문회 기사 둘이 막는다.
  for (const [k, at] of L.gateFront.entries()) {
    placeNpc(project, exec, FS2_FROST_ID, at, {
      id: `ev_fs2_frost_gate_knight_${k}`, name: "탑 문 기사", graphic: knight,
      pages: [{ name: "막음", commands: k === 0 ? [
        say("탑 문 기사", "여기부터 하늘탑이다. 심문회 명령으로\n해 지기 전엔 아무도 못 들인다."),
        say("탑 문 기사", "얼음 위로 여기까지 왔나? 미끄러지기 전에\n마을로 돌아가라."),
      ] : [
        say("탑 문 기사", "발렌 님 명령이다. 돌아가."),
        say(SARAH, "…발렌 님은 탑 안에 계신가?"),
        say("탑 문 기사", "새라 님…? 그건 말씀드릴 수 없습니다."),
      ] }],
    });
  }

  // 마을 사람 — 1막 광장 칩.
  const people: [string, string, string, string[]][] = [
    ["well", "ev_fs_crowd_d", "우물가 아낙", ["우물물도 얼어서 아침마다 깨야 해요.", "썰매를 다 뺏겨서 장작을 못 해 와요.\n오늘 밤엔 등이라도 띄워야죠."]],
    ["child", "ev_fs_crowd_e", "눈사람 만드는 아이", ["이 눈사람, 탑 문 기사 아저씨야.\n코가 빨개!", "밤에 등 띄우는 거 보러 갈 거야.\n할머니가 같이 가 준댔어."]],
    ["net", "ev_fs_crowd_c", "그물 깁는 어부", ["썰매가 없으니 그물만 기워.\n고기는 구멍에서 한 마리씩 낚고.", "섬까지는 장대를 따라가.\n장대 밖 얼음은 믿지 마."]],
    ["wood", "ev_fs_crowd_f", "장작 패는 청년", ["남은 통나무는 이게 다예요.\n징발대가 창고째 잠갔거든요."]],
    ["icefisher", "ev_fs_crowd_c", "얼음낚시 노인", ["쉿, 고기 놀란다.\n…오늘 등 띄우는 날인 거 알지?", "띄운 등은 섬 사당까지 흘러가.\n거기서 누가 꼭 받아 주더라고."]],
  ];
  for (const [spot, chipId, name, lines] of people) {
    const at = L.people[spot];
    if (!at) continue;
    let c: { textureKey: string; characterIndex: number };
    try { c = chipOf(project, chipId, hubId); } catch { c = chipOf(project, "ev_fs_crowd_a", hubId); }
    FS2_FROST.people[spot] = placeNpc(project, exec, FS2_FROST_ID, at, { id: `ev_fs2_frost_${spot}`, name, graphic: c,
      pages: [{ name: "이야기", commands: lines.map((l) => say(name, l)) }] });
  }

  frostFestival(project, exec, L);
  // 들어서면 한 번.
  addEv(project, FS2_FROST_ID, "ev_fs2_frost_arrive", "서리나루", { x: 1, y: 0 }, [
    page("ev_fs2_frost_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_frost_arrive_run", "들어선다", [sw(SW_SARAH)], [
      wait(400),
      narrate("얼어붙은 호숫가 나루 마을. 해가 기운다.\n굴뚝마다 연기가 가늘게 오른다."),
      say(SARAH, "서리나루다. 장작을 다 뺏겨서\n연기가 저것뿐이야."),
      say(ELENA, "호수 건너 절벽 위에… 저게 하늘탑 문이야?"),
      say(SARAH, "문 앞은 심문회 기사들이 지킨다.\n그냥은 못 들어가."),
      say(ELENA, "광장 지나 부두 끝에 할머니가 서 있대.\n먼저 그분한테 물어보자."),
      setSw(SW_FROST_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_frost_arrive_done", "끝", [sw(SW_FROST_ARRIVE)], [], { priority: "below" }),
  ]);
}

/** 「대답의 등」 — 해 질 녘 기슭 등불. 첫 등에서 한 줄을 적어 띄운다(B9 밤 장면의 예고). */
function frostFestival(project: Project, exec: Exec, L: FrostLayout): void {
  exec(project, "set_lighting_volume", {
    mapId: FS2_FROST_ID, applyMode: "map", ambient: 0.4, color: "#2a1838",
    sources: [
      ...L.lamps.map((c, i) => ({ id: `answer_lamp_${i}`, at: { x: c.x, y: c.y - 2 }, radius: 3, intensity: 0.9, color: "#ffc070", flicker: true })),
      { id: "bonfire", at: { x: 21, y: 46 }, radius: 4, intensity: 0.9, color: "#ffb060", flicker: true },
      { id: "gate_l", at: { x: 18, y: 5 }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true },
      { id: "gate_r", at: { x: 25, y: 5 }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true },
      { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.3, color: "#ffd8a0" },
    ],
  });
  const first = L.lamps[0];
  if (!first) return;
  addEv(project, FS2_FROST_ID, "ev_fs2_frost_answer_lamp", "대답의 등", { x: first.x, y: first.y + 1 }, [
    page("ev_fs2_frost_answer_lamp_p", "대답의 등", [], [
      narrate("기슭에 종이 등이 줄지어 있다. 등마다\n한 줄씩 글씨가 적혀 있다.\n「잘 지내」「밥 먹었니」「오늘은 별이 많다」"),
      { kind: "choices", prompt: "등 하나에 한 줄을 적어 띄울까?", options: [
        { text: "「잘 지내」라고 적는다", branch: [
          se("cc0-se-orp-inventory-cloth"),
          narrate("카엘이 등에 「잘 지내」라고 적어 불을 붙인다.\n등이 바람을 타고 호수 위로 떠오른다."),
          flash("#ffc070", 700),
          say(ELENA, "…이리스한테 닿으면 좋겠다."),
          say(KAEL, "닿을 거야. 대답은 늦게라도 꼭 닿았어."),
          setSw(SW_FROST_LAMP),
        ] },
        { text: "그냥 본다", branch: [] },
      ] } as unknown as Command,
    ], { priority: "below", trigger: { kind: "action" } }),
    page("ev_fs2_frost_answer_lamp_done", "띄운 뒤", [sw(SW_FROST_LAMP)], [narrate("우리가 띄운 등이 호수 위를 천천히 건너간다.")], { priority: "below", trigger: { kind: "action" } }),
  ]);
}

// ════════════════════════════════════════════════════════════════════
// B9 얼음 위의 밤
// ════════════════════════════════════════════════════════════════════

const PILLAR: Cell[] = [];

function lanternNight(project: Project, exec: Exec): void {
  const L = LAYOUT;
  if (!L) throw new Error("[fallen-star frostford] 낮 판을 먼저 지어야 한다");
  for (const [id, name] of [[SW_NIGHT, "B9: 서리나루 밤"], [SW_VALEN_SWORD, "B9 선택2: 칼을 뽑았다"], [SW_VALEN_LANTERN, "B9 선택2: 등을 같이 띄웠다"],
    [SW_VALEN_SERIN, "B9: 발렌에게 세린 이름을 꺼냈다"], [SW_VALEN_MET, "B9: 얼음 위 발렌과 이야기"], [SW_ICE_RUN, "B9: 갈라지는 얼음 탈출 중"], [SW_ICE_DONE, "B9: 얼음을 건넜다"]] as const) ensureSwitch(project, id, name);
  // 밤 판 — 사람은 비우고 문은 잠근 채 남긴다.
  exec(project, "duplicate_map", { mapId: FS2_FROST_ID, id: FS2_FROST_NIGHT_ID, name: "서리나루 · 얼음 위의 밤", events: "doors", lockedDoorText: "밤이다. 문이 안에서 잠겨 있다." });
  const night = M(project, FS2_FROST_NIGHT_ID);
  night.bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-mys-002" } as GameMap["bgm"];
  const W = night.width;
  const key = (c: Cell) => c.y * W + c.x;
  // 앞쪽 갈라짐 — 처음부터 굵은 금이 보인다.
  const crackAt = (c: Cell) => L.crackTiles[((c.x % 3) + 3 * (c.y % 3)) % L.crackTiles.length]!;
  for (const p of L.preCracks) for (const c of p.cells) night.lowerTiles[key(c)] = crackAt(c);

  FS2_LAKE.valen = L.valen;
  FS2_LAKE.checkpoint = L.shrineFront;
  FS2_LAKE.stairs = L.stairsBottom;
  PILLAR.length = 0;
  for (let y = 0; y <= 6; y += 1) for (const x of [L.gateDoor[0]!.x, L.gateDoor[1]!.x]) PILLAR.push({ x, y });
  const pillarLights: Command[] = PILLAR.map((c, i) => ({ kind: "addLight", source: { id: `pillar_${i}`, at: { x: c.x, y: c.y }, radius: 2, intensity: 1, color: "#cfe8ff" } } as unknown as Command));

  exec(project, "set_lighting_volume", {
    mapId: FS2_FROST_NIGHT_ID, applyMode: "map", ambient: 0.62, color: "#0b1230",
    sources: [
      { id: "valen", at: { x: L.valen.x, y: L.valen.y }, radius: 3, intensity: 0.9, color: "#ffd27a", flicker: true },
      { id: "shrine_l", at: { x: 18, y: 22 }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true },
      { id: "shrine_r", at: { x: 23, y: 22 }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true },
      ...L.lamps.map((l, i) => ({ id: `lamp${i}`, at: { x: l.x, y: l.y - 2 }, radius: 2, intensity: 0.7, color: "#ffc070", flicker: true })),
      { id: "gate_l", at: { x: 18, y: 5 }, radius: 2, intensity: 0.8, color: "#ffc070", flicker: true },
      { id: "gate_r", at: { x: 25, y: 5 }, radius: 2, intensity: 0.8, color: "#ffc070", flicker: true },
      { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.35, color: "#9fb4ff" },
    ],
  });
  exec(project, "set_scene_mood", { mapId: FS2_FROST_NIGHT_ID, applyMode: "map", weather: { kind: "snow", intensity: 0.2 } });

  // 발렌 — 섬 사당 앞, 등 하나를 든 채.
  const vc = chipOf(project, "ev_fs_valen");
  const scrollUp = Math.max(0, L.shrineFront.y - 7);
  addEv(project, FS2_FROST_NIGHT_ID, "ev_fs2_lake_valen", VALEN, L.valen, [
    page("ev_fs2_lake_valen_p", "얼음 위의 발렌", [], [
      cutBegin(),
      narrate("사당 앞에 등 하나. 발렌이 혼자\n그 등에 불을 붙이고 있다."),
      say(VALEN, "…기사들은 탑에 두고 왔다.\n싸우러 왔으면 칼을 뽑아라."),
      say(KAEL, "등 띄우는 법, 여기서 배우셨죠?"),
      say(VALEN, "대답하면 또 시험이 온다.\n언젠가 또 문을 잠그는 마을이 생기지."),
      say(VALEN, "그러니 줄을 끊는다. 아이가 다시는\n떨어지지 않게. 그게 내 대답이다."),
      { kind: "choices", prompt: "어떻게 할까?", options: [
        { text: "칼을 뽑는다", branch: [
          say(KAEL, "그 대답은 이리스한테 물어보고 하세요."),
          say(VALEN, "…그래. 넌 그 아이 편이니까."),
          setSw(SW_VALEN_SWORD),
        ] },
        { text: "등을 같이 띄운다", branch: [
          narrate("카엘이 등 하나에 불을 붙여\n발렌의 등 곁에 놓는다."),
          say(VALEN, "…둘이면 더 멀리 간다.\n어머니가 그러셨지."),
          setSw(SW_VALEN_LANTERN),
          { kind: "fork", condition: { kind: "item", itemId: FS2_CERT_ITEM, present: true }, then: [
            say(KAEL, "세린 씨도 그렇게 대답했을까요?"),
            say(VALEN, "…그 이름을 어디서 들었지."),
            narrate("카엘이 반쯤 탄 정착 확인서를 내민다.\n발렌은 서명란에서 한참 눈을 떼지 못한다."),
            say(VALEN, "「엄마 문 열어」… 내 글씨다."),
            setSw(SW_VALEN_SERIN),
          ] },
        ] },
      ] } as unknown as Command,
      // 쩌억 — 카메라가 북쪽 탑 문으로 올라가 빛기둥을 보여 주고 돌아온다.
      shake(6, 900),
      se("easyrpg-sound-ice2"),
      narrate("쩌억— 발밑 깊은 데서 얼음 우는 소리."),
      scroll("up", scrollUp, 1800),
      se("easyrpg-sound-holy3"),
      flash("#dff2ff", 900),
      ...pillarLights,
      sparkle(L.gateDoor[0]!.x, 2, 2600), sparkle(L.gateDoor[1]!.x, 4, 2600), sparkle(L.gateDoor[0]!.x, 6, 2600),
      wait(700),
      narrate("절벽 위 탑 문 너머로 빛기둥이 솟는다!"),
      wait(500),
      scrollBack(1300),
      say(VALEN, "…렌즈가 벌써 열렸군. 늦었다."),
      route("ev_fs2_lake_valen", ["left", "left", "up", "up", "up", "up"].map((dir) => ({ kind: "move", dir })), true),
      setSw(SW_VALEN_MET),
      cutLabel(),
      cutEnd(),
      say(ELENA, "카엘, 발밑!"),
      say(SARAH, "큰 금은 못 건넌다! 서쪽으로 돌아서\n동쪽 끝으로, 다시 계단까지 달려!"),
      setSw(SW_ICE_RUN),
    ], { graphic: chip(vc.textureKey, vc.characterIndex, "down"), priority: "same" }),
    page("ev_fs2_lake_valen_gone", "떠남", [sw(SW_VALEN_MET)], [], { graphic: { transparent: true }, priority: "below" }),
  ]);
  // 실패해서 다시 들어오면 빛기둥이 그대로 보이게(광원은 맵을 다시 읽으면 기본값으로 돌아간다).
  addEv(project, FS2_FROST_NIGHT_ID, "ev_fs2_lake_pillar", "빛기둥", { x: 2, y: 0 }, [
    page("ev_fs2_lake_pillar_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_lake_pillar_on", "켜짐", [sw(SW_VALEN_MET)], [...pillarLights, wait(600000)], { trigger: { kind: "parallel" }, priority: "below" }),
  ]);

  // 탈출 — 뒤에서 쫓아오는 붕괴. 사당 앞에서 걸어 닿는 거리(BFS) 순으로 초마다 한 묶음, 1초 전에 금.
  const start = L.shrineFront;
  const preSet = new Set(L.preCracks.flatMap((p) => p.cells.map(key)));
  // 다시 하기 = 섬 바로 위 얼음 줄을 밟으면(섬 둘레 얼음과 그 줄은 무너지지 않는다 — 뒤에서 쫓는 붕괴는 갈래길부터).
  const islandTop = Math.min(...[...L.island].map((c) => Math.floor(c / W)));
  const startRow = { x: 12, y: islandTop - 1, width: 19, height: 1 };
  const inStartRow = (c: Cell) => c.y === startRow.y && c.x >= startRow.x && c.x < startRow.x + startRow.width;
  const dist = new Map<number, number>([[key(start), 0]]);
  const q: Cell[] = [start];
  for (let h = 0; h < q.length; h += 1) {
    const c = q[h]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= night.height || dist.has(key(n))) continue;
      if (!(L.ice.has(key(n)) || L.island.has(key(n))) || !canMove(project, night, c.x, c.y, n.x, n.y)) continue;
      dist.set(key(n), dist.get(key(c))! + 1); q.push(n);
    }
  }
  const stairsD = Math.min(...L.stairsBottom.map((s) => {
    let best = Infinity;
    for (const [dx, dy] of [[0, 1]] as const) { const d = dist.get(key({ x: s.x + dx, y: s.y + dy })); if (d !== undefined) best = Math.min(best, d + 1); }
    return best;
  }));
  if (!Number.isFinite(stairsD)) throw new Error("[fallen-star frostford] 섬에서 북쪽 계단까지 얼음길이 없다");
  FS2_LAKE.pathCells = stairsD;
  const SPEED = 5.4, LEAD = 2;
  const atOf = (d: number) => LEAD + Math.floor(d / SPEED);
  const seconds = atOf(stairsD) + 3;
  FS2_LAKE.seconds = seconds;
  const bySecond = new Map<number, Cell[]>();
  for (const [c, d] of dist) {
    const cell = { x: c % W, y: Math.floor(c / W) };
    if (!L.ice.has(c) || cell.y >= islandTop - 1 || preSet.has(c) || inStartRow(cell)) continue;
    const s = Math.min(seconds - 1, atOf(d));
    bySecond.set(s, [...(bySecond.get(s) ?? []), cell]);
  }
  const steps = [
    ...[...bySecond.entries()].map(([atSecond, cells]) => ({ cells, atSecond })),
    ...L.preCracks.map((p) => ({ cells: p.cells, atSecond: p.atSecond })),
  ];
  exec(project, "make_timed_escape", {
    mapId: FS2_FROST_NIGHT_ID, escapeId: "fs2_ice", seconds, startSwitchId: SW_ICE_RUN, startCellsSwitchId: SW_VALEN_MET,
    start: startRow,
    exit: { x: L.stairsBottom[0]!.x, y: L.stairsBottom[0]!.y, width: L.stairsBottom.length, height: 1 },
    checkpoint: { x: L.shrineFront.x, y: L.shrineFront.y, direction: "up" },
    steps, layer: "lower", collapsedAutotile: FROST_WATER_GROUP, warnSeconds: 1, warnTiles: L.crackTiles, collapseRestOnSuccess: true,
    startText: "", successText: "",
    failText: "…얼음물에 빠질 뻔했다. 사당 앞에서 다시.", fallText: "발밑 얼음이 꺼졌다!", successSwitchId: SW_ICE_DONE,
  });
  // 계단에 오른 뒤 — 뒤 얼음이 통째로 꺼진 걸 돌아본다(도구가 남은 칸을 무너뜨린다).
  addEv(project, FS2_FROST_NIGHT_ID, "ev_fs2_lake_crossed", "건넜다", { x: 3, y: 0 }, [
    page("ev_fs2_lake_crossed_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_lake_crossed_run", "건넘", [sw(SW_ICE_DONE)], [
      wait(500),
      narrate("돌아보니 호수 얼음이 통째로 꺼져 있다.\n검은 물 위로 등 하나가 떠간다."),
      say(ELENA, "…조금만 늦었어도 저 밑이었어."),
      say(SARAH, "탑 문이 열려 있다. 발렌 님은 벌써 위로 갔어."),
      { kind: "setSelfSwitch", key: "A", value: true } as unknown as Command,
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_lake_crossed_done", "끝", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], [], { priority: "below" }),
  ]);
}

function lanternNightEvents(project: Project): void {
  // 여관 주인 — 하르마가 「밤에 얼음 위로 나가 보렴」 한 뒤에는 몸을 녹이고 밤을 기다린다.
  const keeper = M(project, FS2_FROST_INN_ID).events.find((e) => e.id === "ev_fs2_frost_innkeeper");
  const look = keeper?.pages?.[0]?.graphic;
  if (!keeper || !look) throw new Error("[fallen-star frostford] 서리나루 여관 주인이 없다");
  const front = { x: FS2_FROST.innDoor.x, y: FS2_FROST.innDoor.y + 1 };
  keeper.pages = [
    ...(keeper.pages ?? []),
    FS2_RELEASE_STOP === "B8"
      ? page("ev_fs2_frost_innkeeper_stop", "판본 끝", [sw(SW_HARMA)], [
        say(OSA, "밤에 얼음 위로 나가시게요?\n오늘은 눈보라가 세요. 불 앞에서 쉬었다 가요."),
        fadeOut(900),
        { kind: "recoverAll" } as unknown as Command,
        narrate("제2막 「빌린 불」 — 여기까지", { position: "center", context: "narration" }),
        narrate("얼음 위의 등, 하늘탑, 그리고 이리스는\n다음 업데이트에서 이어집니다.", { position: "center", context: "narration" }),
        fadeIn(700),
        narrate("지금 저장해 두면 다음 판본에서 이 여관부터 이어서 할 수 있다.", { context: "system" }),
        { kind: "openSaveMenu" } as unknown as Command,
      ], { graphic: look })
      : page("ev_fs2_frost_innkeeper_night", "밤을 기다림", [sw(SW_HARMA)], [
        say(OSA, "밤에 얼음 위로 나가시게요?\n하르마 할머니가 등 얘기를 했나 보네.\n그럼 불 앞에서 몸부터 녹이고 가요."),
        { kind: "callCommonEvent", commonEventId: "ce_party_bond_talk" } as unknown as Command,
        fadeOut(1000),
        setSw(SW_NIGHT),
        narrate("해가 지고, 섬 사당 앞에 등 하나가 떴다."),
        transfer(FS2_FROST_NIGHT_ID, front, "down"),
      ], { graphic: look }),
    page("ev_fs2_frost_innkeeper_after", "탑 뒤", [sw(SW_VALEN_MET)], [
      say(OSA, "탑에서 빛기둥 솟던 밤엔\n다들 한숨도 못 잤어요. 하룻밤에 20골드예요."), { kind: "inn", price: 20 } as unknown as Command,
    ], { graphic: look }),
  ];
  // 밤에 처음 나서면 한 번 — 섬 사당 앞 등 하나.
  addEv(project, FS2_FROST_NIGHT_ID, "ev_fs2_night_arrive", "얼음 위의 밤", { x: 1, y: 0 }, [
    page("ev_fs2_night_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_night_arrive_run", "나선다", [sw(SW_NIGHT)], [
      fadeIn(900),
      wait(300),
      say(SARAH, "…발렌 님이다. 섬 사당 앞에 혼자 있어."),
      say(ELENA, "탑 문 앞 기사들도 안 보여."),
      say(KAEL, "부두에서 장대를 따라가자. 칼은 넣어 두고."),
      setSw(SW_NIGHT, false),
    ], { trigger: { kind: "auto" }, priority: "below" }),
  ]);
}

/** B10 하늘탑 — 이번 판본에서는 문과 1층까지. 밤 서리나루 북쪽 성문루에서 들어간다. */
function skyTower(project: Project, exec: Exec): void {
  const L = LAYOUT!;
  const gateCell = L.gateFront[0]!;
  exec(project, "author_dungeon", {
    type: "tower", adapter: "beodeul", genre: "rpg", name: "하늘탑", id: FS2_TOWER_ID, floors: 4, direction: "up",
    floorShapes: ["cross", "twin", "spiral", "ring"], floorGimmicks: ["teleporter", "none", "none"], gimmick: "none", populate: false,
    entrance: { fromMapId: FS2_FROST_NIGHT_ID, x: gateCell.x, y: gateCell.y }, seed: 91,
  });
  // 탑 문은 발렌과 이야기한 뒤에만 열린다(그 전에는 부딪혀도 한 줄만). 성문 앞 두 칸 모두 문.
  const night = M(project, FS2_FROST_NIGHT_ID);
  const gate = night.events.find((e) => JSON.stringify(e).includes(`"mapId":"${FS2_TOWER_ID}`));
  if (!gate) throw new Error("[fallen-star frostford] 하늘탑 문이 없다");
  FS2_LAKE.gate = { x: gate.x, y: gate.y };
  for (const pg of gate.pages ?? []) pg.conditions = [...(pg.conditions ?? []), sw(SW_VALEN_MET)];
  const first = gate.pages?.[0];
  gate.pages = [
    page(`${gate.id}_shut`, "닫힘", [], [narrate("하늘탑 성문이다. 굳게 닫혀 있다.\n…섬 사당 앞 등불이 자꾸 마음에 걸린다.")],
      { trigger: first?.trigger ?? { kind: "playerTouch" }, priority: first?.priority ?? "below" }),
    ...(gate.pages ?? []),
  ];
  for (const c of L.gateFront.slice(1)) if (!night.events.some((e) => e.x === c.x && e.y === c.y)) night.events.push({ ...structuredClone(gate), id: `${gate.id}_b`, x: c.x, y: c.y });
  if (FS2_RELEASE_STOP === "B9") towerReleaseStop(project);
}

/** 판본 끝 — 하늘탑 1층에 들어서면 막 카드·회복·저장, 위층으로 오르는 계단은 「다음 업데이트」. */
function towerReleaseStop(project: Project): void {
  ensureSwitch(project, SW_STOP_B9, "판본 끝: 하늘탑 1층");
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
  if (!up.length) throw new Error("[fallen-star frostford] 하늘탑 1층 위 계단을 못 찾음");
  for (const e of up) {
    e.pages = (e.pages ?? []).map((pg) => ({ ...pg, commands: [narrate("위층으로 가는 계단.\n멀리서 쇠 긁는 소리가 울린다.\n(다음 업데이트에서 이어집니다.)", { context: "system" })] }));
  }
}

/** B8·B9 를 한 번에 — 낮 마을 → 밤 판·탈출 → 하늘탑 문 → 여관 주인 밤 페이지. */
export function buildFrostford(project: Project, exec: Exec, hubId: string): void {
  frostford(project, exec, hubId);
  lanternNight(project, exec);
  skyTower(project, exec);
  lanternNightEvents(project);
}
