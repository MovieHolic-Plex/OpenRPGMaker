// src/editor/tools/dungeonGimmicks.ts
// 던전 주제 장치(2026-10-23 dungeon-themes): author_dungeon 이 지은 층 위에 그 주제다운 장치 하나를 놓는다.
//   lever     — 보물 방(없으면 보스방) 통로를 쇠창살로 막고 먼 곁방 레버로 연다(dungeonTools.placeLeverGate, 기존).
//   bridge    — 다리 하나를 걷어 둔 채로 시작하고(그 칸은 물·용암·허공), 닿을 수 있는 방의 레버를 당기면 다리가 내려온다(changeTile).
//   teleporter— 입구 쪽 방과 깊은 방에 마법진(숲은 버섯 고리) 한 쌍: 밟으면 반대쪽 마법진으로 옮겨진다(양방향 지름길).
//   minecart  — 광산: 입구 쪽 정거장 광차와 깊은 쪽 정거장 광차 — 조사해 타면 반대 정거장으로 달린다.
//   iceslide  — 얼음 동굴: 얼어붙은 호수 가로 줄 양 끝에 미끄럼 칸 — 밟으면 맞은편 끝까지 멈추지 않고 미끄러진다.
//   sandpit   — 피라미드·묘지: 보스로 가는 길 밖 곁방 가운데 모래 구덩이(금 간 바닥) — 밟으면 무너져 입구로 떨어진다.
// 그림: 새 테마 그림(TK)이 구워져 있으면 그것, 없으면 기존 버들항 키트로 물러선다(아무 그림 없이 보이지 않는 장치를 두지 않는다).

import { isPassable } from "@/project/collision";
import { checkGroundSupportForStamp } from "@/project/groundSupport";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import type { DungeonType } from "../dungeonKit/types";
import { TK } from "../dungeonKit/beodeul/profiles";
import { upsertEventIntoMap } from "./eventTools";
import { ensureNamedSwitch } from "./flagHelpers";
import { asCell, field, list, text } from "./jrpgVolumeTools";
import { makePage, puzzleEvent, sfx, shake, flash, textCmd, choices, TRANSPARENT } from "./puzzleKit";
import { resolveGraphic } from "./eventCompile";
import { planTileGate, placeTileGate, type TileGateKits, type TileGatePlan } from "./tileGate";

export const DUNGEON_GIMMICKS = ["lever", "bridge", "teleporter", "minecart", "iceslide", "sandpit"] as const;
export type DungeonGimmick = (typeof DUNGEON_GIMMICKS)[number];

/** 주제마다 어울리는 장치(앞이 기본). 같은 주제 두 요청은 시드로 앞 둘 중 하나를 고른다(같은 장치 복사본이 안 되게). */
export const THEME_GIMMICKS: Readonly<Record<DungeonType, readonly DungeonGimmick[]>> = {
  catacomb: ["lever", "sandpit"],
  castle: ["lever", "sandpit"],
  labyrinth: ["teleporter", "lever"],
  sewer: ["lever", "bridge"],
  cave: ["bridge", "lever"],
  temple: ["lever", "teleporter"],
  mine: ["minecart", "lever"],
  volcano: ["bridge", "lever"],
  ice: ["iceslide", "bridge"],
  forest: ["teleporter", "bridge"],
  swamp: ["bridge", "teleporter"],
  pyramid: ["sandpit", "lever"],
  tower: ["teleporter", "lever"],
  otherworld: ["teleporter", "bridge"],
};

/** 자연 굴(blob 배치) — 벽 문틀이 없는 열린 흙길이라 쇠창살 칩이 맨땅에 선 창살로 읽혔다(2026-10-25 floor VQA r4 cave·volcano). 길은 바위로 막는다. */
export const NATURAL_TYPES: ReadonlySet<DungeonType> = new Set<DungeonType>(["cave", "volcano", "ice", "forest", "swamp", "otherworld"]);
/** 레버로 여는 길막이 그림: 자연 굴 = 바위(Object2 #5), 지은 던전 = 감옥 쇠창살 문(Object1 #5). */
export function chokeBlockGraphic(type: DungeonType | string | undefined) {
  return NATURAL_TYPES.has(type as DungeonType)
    ? resolveGraphic({ textureKey: "tex_easyrpg_charset_object2", characterIndex: 5 } as never)
    : resolveGraphic({ textureKey: "tex_easyrpg_charset_object1", characterIndex: 5 } as never);
}

/** 레버 관문 그림이 타일 키트인 종류(지은 던전) — 내리닫이 쇠창살문 3×2 닫힘·올림. 문 이벤트는 보이지 않고 막기만 한다(tileGate.ts). */
const PORTCULLIS_TYPES: ReadonlySet<DungeonType> = new Set<DungeonType>(["castle", "catacomb", "pyramid", "temple", "mine", "tower"]);
export const PORTCULLIS_KITS: TileGateKits = { closed: TK("portcullis"), open: TK("portcullis-open") };
/** 레버 관문 그림 방식: portcullis = 쇠창살문 타일 키트(문간 이벤트는 보이지 않음) · bars = 옛 캐릭터 쇠창살 · rock = 바위. */
export const LEVER_GATE_STYLES = ["portcullis", "bars", "rock"] as const;
export type LeverGateStyle = (typeof LEVER_GATE_STYLES)[number];
/** 종류 기본 방식(지은 던전 = portcullis, 자연 굴 = rock, 그 밖 = bars). 요청한 방식이 있으면 그것. */
export function leverGateStyle(type: DungeonType | string | undefined, asked?: unknown): LeverGateStyle {
  if (typeof asked === "string" && (LEVER_GATE_STYLES as readonly string[]).includes(asked)) return asked as LeverGateStyle;
  return PORTCULLIS_TYPES.has(type as DungeonType) ? "portcullis" : NATURAL_TYPES.has(type as DungeonType) ? "rock" : "bars";
}
/** 레버 관문 타일 키트 짝(portcullis 방식일 때). */
export function leverGateKits(type: DungeonType | string | undefined, asked?: unknown): TileGateKits | null {
  return leverGateStyle(type, asked) === "portcullis" ? PORTCULLIS_KITS : null;
}

/**
 * 레버 관문을 놓는다(두 레버 경로 공용): portcullis 방식이면 목에 키트를 칠하고 문간에 보이지 않는 문 이벤트,
 * 아니면 목 칸마다 그림 이벤트(바위·캐릭터 쇠창살). 반환한 openCommands 를 레버 당김 명령에 붙인다. 놓지 못하면 null.
 */
export function placeLeverBlock(draft: Project, map: GameMap, type: DungeonType | string | undefined, cells: readonly Pt[], sw: string, plan?: TileGatePlan | null, asked?: unknown): { cells: Pt[]; openCommands: Command[]; tiles: boolean } | null {
  const style = leverGateStyle(type, asked);
  const kits = style === "portcullis" ? PORTCULLIS_KITS : null;
  if (kits) {
    const p = plan ?? planTileGate(draft, map, cells, kits);
    if (!p) return null;
    const r = placeTileGate(draft, map, p, { idPrefix: `ev_${map.id}_lever_gate`, name: "쇠창살문", switchId: sw, closedText: "굳게 닫힌 쇠창살문이다. 어딘가의 레버로 올리는 것 같다.", closedName: "닫힌 쇠창살문", openName: "올린 쇠창살문" });
    return { ...r, tiles: true };
  }
  // 닫힌 페이지는 겹침 금지(overlapForbidden) — 예전엔 false 라 런타임에서 바위·쇠창살을 그냥 지나갔다(2026-10-25 머리 없는 레버 검사).
  const rock = style === "rock";
  const bars = resolveGraphic({ textureKey: rock ? "tex_easyrpg_charset_object2" : "tex_easyrpg_charset_object1", characterIndex: 5 } as never);
  cells.forEach((p, k) => {
    const gid = k === 0 ? `ev_${map.id}_lever_gate` : `ev_${map.id}_lever_gate_${p.x}_${p.y}`;
    upsertEventIntoMap(map, { id: gid, name: rock ? "막힌 바위" : "쇠창살", x: p.x, y: p.y, trigger: { kind: "action" }, commands: [], pages: [
      { id: `${gid}_p1`, name: rock ? "길을 막은 바위" : "닫힌 쇠창살", conditions: [], graphic: bars, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: fixedMove, commands: [textCmd(rock ? "큰 바위가 길을 막고 있다. 어딘가의 레버로 치울 수 있을 것 같다." : "굳게 닫힌 쇠창살이다. 어딘가의 레버로 여는 것 같다.")] },
      { id: `${gid}_p2`, name: rock ? "치운 바위" : "열린 쇠창살", conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false, movement: fixedMove, commands: [] },
    ] } as GameEvent);
  });
  return { cells: [...cells], openCommands: [], tiles: false };
}

export const GIMMICK_LABEL: Readonly<Record<DungeonGimmick, string>> = {
  lever: "레버 쇠창살", bridge: "레버로 내리는 다리", teleporter: "순간이동 마법진 한 쌍", minecart: "광차 정거장 한 쌍", iceslide: "얼음 미끄럼길", sandpit: "모래 함정(떨어지면 입구로)",
};

type Pt = { x: number; y: number };
interface FloorRoom { id: string; kind: string; x: number; y: number; w: number; h: number; from: string | null; spots: Pt[] }

function roomsOf(data: Record<string, unknown>): FloorRoom[] {
  return list(data, "rooms").flatMap((v) => {
    const id = text(v, "id"), kind = text(v, "kind");
    if (!id || !kind) return [];
    const n = (k: string) => Number(field(v, k));
    return [{ id, kind, x: n("x"), y: n("y"), w: n("w"), h: n("h"), from: text(v, "from") ?? null, spots: list(v, "spots").map(asCell).filter((c): c is Pt => !!c) }];
  });
}

/** 입구 → 보스방 길 위 방 id(보스방 포함, 입구 포함). */
function routeRooms(rooms: FloorRoom[], bossId: string | undefined): Set<string> {
  const by = new Map(rooms.map((r) => [r.id, r] as const));
  const on = new Set<string>();
  for (let r: FloorRoom | undefined = by.get(bossId ?? "") ?? rooms[rooms.length - 1], g = 0; r && g < 50; r = by.get(r.from ?? ""), g += 1) on.add(r.id);
  if (rooms[0]) on.add(rooms[0].id);
  return on;
}

/** 입구에서 몇 번째 방인지(from 사슬 길이). */
function depthOf(rooms: FloorRoom[], id: string): number {
  const by = new Map(rooms.map((r) => [r.id, r] as const));
  let d = 0;
  for (let r = by.get(id), g = 0; r && r.from && g < 50; r = by.get(r.from), g += 1) d += 1;
  return d;
}

interface Ctx {
  /** 채우기(populate) 뒤에 할 맵 변경 — 다리를 걷는 일처럼, 미리 하면 채우기가 건너편 칸을 「닿지 않는 칸」으로 본다. */
  after?: (() => void)[];
  draft: Project; map: GameMap; ts: TilesetDef; data: Record<string, unknown>; rooms: FloorRoom[]; type: DungeonType; warnings: string[];
  start: Pt;
}

const hasKit = (ts: TilesetDef, id: string) => (ts.structureKits ?? []).some((k) => k.id === id);
const kitOf = (ts: TilesetDef, id: string) => (ts.structureKits ?? []).find((k) => k.id === id);
const firstKit = (ts: TilesetDef, ids: readonly string[]) => ids.find((id) => hasKit(ts, id));

const free = (c: Ctx, p: Pt) => isPassable(c.draft, c.map, p.x, p.y) && !c.map.events.some((e) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 1);
const occupiedAbove = (map: GameMap, i: number) => (map.upperTiles[i] ?? -1) >= 0 || ((map.lowerOverlayTiles ?? [])[i] ?? -1) >= 0 || ((map.upperOverlayTiles ?? [])[i] ?? -1) >= 0;

/** 입구 칸에서 걸어 닿는 칸(타일 통행만, 막을 칸 제외). */
function reach(c: Ctx, blocked: ReadonlySet<number> = new Set()): Uint8Array {
  const { map } = c, W = map.width, H = map.height;
  const seen = new Uint8Array(W * H);
  const q: number[] = [c.start.y * W + c.start.x]; seen[q[0]!] = 1;
  while (q.length) {
    const i = q.pop()!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, ni = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || blocked.has(ni) || !isPassable(c.draft, c.map, nx, ny)) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return seen;
}

/**
 * 키트를 바닥에 찍는다(그 칸들이 모두 걸을 수 있는 빈 바닥이고 위층이 비어 있을 때만). 키트의 아래 칸(tiles)은 1층, 위 칸(upperTiles)은 3층.
 * 찍은 왼쪽 위 칸, 실패면 null.
 */
function stampFlat(c: Ctx, kitId: string, cands: readonly Pt[], opts: { needPassable?: boolean } = {}): Pt | null {
  const kit = kitOf(c.ts, kitId);
  if (!kit) return null;
  const W = c.map.width;
  // 바닥 데칼(모자이크·카펫·석판)은 1층 칸이라 occupiedAbove 가 못 본다 — 그 위에 마법진을 겹쳐 찍었다(2026-10-25 floor VQA r3 유적).
  // 맵 바닥에서 가장 흔한 칸들(바탕 바닥)만 덮어쓸 수 있게 한다: 칸 빈도 상위가 아닌 1층 칸 = 다른 데칼.
  const freq = new Map<number, number>();
  for (const t of c.map.lowerTiles) freq.set(t, (freq.get(t) ?? 0) + 1);
  const plainMin = Math.max(6, Math.floor(c.map.lowerTiles.length * 0.004));
  const plain = (i: number) => (freq.get(c.map.lowerTiles[i]!) ?? 0) >= plainMin;
  for (const p of cands) {
    const x0 = p.x - Math.floor(kit.width / 2), y0 = p.y - Math.floor(kit.height / 2);
    let ok = true;
    for (let dy = 0; dy < kit.height && ok; dy += 1) for (let dx = 0; dx < kit.width && ok; dx += 1) {
      const x = x0 + dx, y = y0 + dy;
      if (!isPassable(c.draft, c.map, x, y) || occupiedAbove(c.map, y * W + x) || !plain(y * W + x) || c.map.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) ok = false;
    }
    if (!ok) continue;
    kit.rows.forEach((row, dy) => {
      row.tiles.forEach((t, dx) => { if (t >= 0) c.map.lowerTiles[(y0 + dy) * W + x0 + dx] = t; });
      (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) c.map.upperTiles[(y0 + dy) * W + x0 + dx] = t; });
    });
    if (opts.needPassable) {
      // 장치 칸(마법진·구덩이)은 밟는 칸이다 — 그림이 막힌 칸이면 되돌린다.
      let pass = true;
      for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) if (!isPassable(c.draft, c.map, x0 + dx, y0 + dy)) pass = false;
      if (!pass) return null;
    }
    return { x: x0, y: y0 };
  }
  return null;
}

/** 방 가운데에 가까운 순의 칸(이벤트 자리 먼저, 그다음 방 상자 안 모든 칸 — 큰 마법진은 자리 칸 하나로는 못 찾는다). */
function centerSpots(r: FloorRoom): Pt[] {
  const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
  const all: Pt[] = [...r.spots];
  for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) all.push({ x, y });
  return all.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
}

const fixedMove = { type: "fixed", speed: 3, frequency: 3 } as const;
const transferCmd = (mapId: string, p: Pt, dir: "up" | "down" | "left" | "right" = "down", fade: "black" | "white" = "black"): Command =>
  ({ kind: "transfer", mapId, x: p.x, y: p.y, direction: dir, fade } as Command);

/** 밟는 칸 곁의 내려설 칸(통행·이벤트 없음). */
function landingNear(c: Ctx, cells: readonly Pt[]): Pt | null {
  const inside = new Set(cells.map((p) => `${p.x},${p.y}`));
  for (const p of cells) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]] as const) {
    const q = { x: p.x + dx, y: p.y + dy };
    if (inside.has(`${q.x},${q.y}`) || !isPassable(c.draft, c.map, q.x, q.y) || c.map.events.some((e) => e.x === q.x && e.y === q.y)) continue;
    return q;
  }
  return null;
}

// ---------------------------------------------------------------- 벽 레버(gap 레버 그림, #3283)
/** 벽걸이 레버 키트 칸(위 칸 그림). 없으면 null(옛 캐릭터 레버로 물러선다). */
function leverTiles(ts: TilesetDef): { up: number; down: number } | null {
  const one = (id: string) => { const k = kitOf(ts, id); const r = k?.rows[0]; const t = r ? ((r.upperTiles ?? [])[0] ?? -1) >= 0 ? r.upperTiles![0]! : r.tiles[0]! : -1; return t >= 0 ? t : null; };
  const up = one("bd-dg-lever-up"), down = one("bd-dg-lever-down");
  return up !== null && down !== null ? { up, down } : null;
}

/**
 * 레버를 놓는다. gap 레버 그림이 있으면 바닥 후보 칸 바로 북쪽 **벽 앞면**(막힌 칸, 위층이 빈 칸)에 벽걸이 레버를 걸고 이벤트를 그 벽 칸에 둔다(벽을 보고 조사) —
 * 당기면 changeTile(upper) 로 내린 그림. 그림이 없거나 걸 벽이 없으면 바닥 칸에 옛 캐릭터 레버.
 * 반환: 이벤트 칸·레버 앞 바닥 칸.
 */
export function placeLever(draft: Project, map: GameMap, floorCands: readonly Pt[], id: string, name: string, sw: string, pull: readonly Command[], idleText: string, doneText: string): { at: Pt; floor: Pt; wall: boolean } | null {
  const ts = draft.tilesets[map.tilesetId]!;
  const W = map.width;
  const lv = leverTiles(ts);
  const evAt = (p: Pt) => map.events.some((e) => e.x === p.x && e.y === p.y);
  if (lv) for (const f of floorCands) {
    const w = { x: f.x, y: f.y - 1 };
    if (w.y < 0 || isPassable(draft, map, w.x, w.y) || !isPassable(draft, map, f.x, f.y) || evAt(w) || evAt(f)) continue;
    const i = w.y * W + w.x;
    if ((map.upperTiles[i] ?? -1) >= 0) continue;
    // 벽 앞면 칸만(천장·수관·물에 걸면 허공에 뜬다) — 받침 규칙(벽걸이 = 벽 칸)으로 확인한다
    if (checkGroundSupportForStamp(map, ts, kitOf(ts, "bd-dg-lever-up")!, w.x, w.y)) continue;
    map.upperTiles[i] = lv.up;
    upsertEventIntoMap(map, { id, name, x: w.x, y: w.y, trigger: { kind: "action" }, commands: [], pages: [
      { id: `${id}_p1`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false, movement: fixedMove,
        commands: [textCmd(idleText), sfx("switch-clack"), { kind: "changeTile", mapId: map.id, layer: "upper", x: w.x, y: w.y, tile: lv.down } as Command, { kind: "setSwitch", switchId: sw, value: true } as Command, ...pull] },
      { id: `${id}_p2`, name: `당긴 ${name}`, conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false, movement: fixedMove,
        commands: [textCmd(doneText)] },
    ] } as GameEvent);
    return { at: w, floor: f, wall: true };
  }
  const f = floorCands.find((p) => isPassable(draft, map, p.x, p.y) && !evAt(p));
  if (!f) return null;
  const lever = resolveGraphic({ textureKey: "tex_easyrpg_charset_object2", characterIndex: 0 } as never);
  upsertEventIntoMap(map, { id, name, x: f.x, y: f.y, trigger: { kind: "action" }, commands: [], pages: [
    { id: `${id}_p1`, name, conditions: [], graphic: { ...lever, direction: "down" }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false, movement: fixedMove,
      commands: [textCmd(idleText), sfx("switch-clack"), { kind: "setSwitch", switchId: sw, value: true } as Command, ...pull] },
    { id: `${id}_p2`, name: `당긴 ${name}`, conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { ...lever, direction: "up" }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false, movement: fixedMove,
      commands: [textCmd(doneText)] },
  ] } as GameEvent);
  return { at: f, floor: f, wall: false };
}

/** 북쪽 벽에 붙은 바닥 칸을 먼저(벽 레버 자리), 그다음 나머지. */
export function wallFirst(draft: Project, map: GameMap, cells: readonly Pt[]): Pt[] {
  // 안정 정렬: 북쪽이 막힌 칸이 먼저, 그 안에서는 받은 순서(가까운 순) 그대로
  return [...cells].sort((a, b) => Number(isPassable(draft, map, a.x, a.y - 1)) - Number(isPassable(draft, map, b.x, b.y - 1)));
}

// ---------------------------------------------------------------- teleporter
function placeTeleporter(c: Ctx): string {
  const bossId = text(field(c.data, "anchors"), "boss");
  const on = routeRooms(c.rooms, bossId);
  const deep = c.rooms.filter((r) => r.id !== bossId && r.kind !== "entrance" && r.kind !== "vault").sort((a, b) => depthOf(c.rooms, b.id) - depthOf(c.rooms, a.id));
  const near = c.rooms.filter((r) => r.kind !== "boss" && r.kind !== "vault").sort((a, b) => depthOf(c.rooms, a.id) - depthOf(c.rooms, b.id));
  const A = near.find((r) => r.kind !== "entrance") ?? near[0];
  const B = deep.find((r) => r.id !== A?.id && (on.has(r.id) || deep.length < 3)) ?? deep.find((r) => r.id !== A?.id);
  if (!A || !B) return "";
  const art = c.type === "forest" || c.type === "swamp" ? [TK("mushroom-ring"), TK("teleport-circle"), "bd-pick-temple-ruins-mosaic-medallion-5x5"]
    : c.type === "otherworld" ? [TK("portal-gate-floor"), TK("teleport-circle"), TK("arcane-circle"), "bd-pick-temple-ruins-mosaic-medallion-5x5"]
    : [TK("teleport-circle"), TK("arcane-circle"), "bd-pick-temple-ruins-mosaic-medallion-5x5"];
  const kitId = firstKit(c.ts, art);
  if (!kitId) return "";
  const pa = stampFlat(c, kitId, centerSpots(A), { needPassable: true });
  const pb = pa ? stampFlat(c, kitId, centerSpots(B), { needPassable: true }) : null;
  if (!pa || !pb) return "";
  const k = kitOf(c.ts, kitId)!;
  const mid = (p: Pt) => ({ x: p.x + Math.floor(k.width / 2), y: p.y + Math.floor(k.height / 2) });
  const ca = mid(pa), cb = mid(pb);
  const la = landingNear(c, [ca]) ?? ca, lb = landingNear(c, [cb]) ?? cb;
  const word = kitId.includes("mushroom-ring") ? "버섯 고리" : c.type === "otherworld" ? "차원의 문" : "마법진";
  // 순간이동 자리 2칸 안은 이벤트 자리에서 뺀다 — 채우기가 그 곁에 적을 세우려다 「출입구 곁」 경고를 냈다(2026-10-23 themes p9).
  const far = (s: Pt) => Math.max(Math.abs(s.x - ca.x), Math.abs(s.y - ca.y)) > 2 && Math.max(Math.abs(s.x - cb.x), Math.abs(s.y - cb.y)) > 2;
  for (const v of list(c.data, "rooms")) {
    const sp = (v as Record<string, unknown>)["spots"];
    if (!Array.isArray(sp)) continue;
    const keep = sp.filter((q) => { const p = asCell(q); return !p || far(p); });
    if (keep.length < sp.length) sp.splice(0, sp.length, ...keep);
  }
  for (const r of c.rooms) { const keep = r.spots.filter(far); r.spots.splice(0, r.spots.length, ...keep); }
  const pad = (id: string, at: Pt, to: Pt, name: string): GameEvent => puzzleEvent(id, name, at, [makePage({
    id: `${id}_p`, name, graphic: TRANSPARENT, trigger: "playerTouch", priority: "below",
    commands: [sfx("crystal-ping"), flash("purple", 260), textCmd(`${word}이 빛나며 몸이 떠오른다…`), transferCmd(c.map.id, to, "down", "white")],
  })]);
  upsertEventIntoMap(c.map, pad(`ev_${c.map.id}_warp_a`, ca, lb, `${word} (${A.id})`));
  upsertEventIntoMap(c.map, pad(`ev_${c.map.id}_warp_b`, cb, la, `${word} (${B.id})`));
  return `순간이동 ${word}: ${A.id}(${ca.x},${ca.y}) ↔ ${B.id}(${cb.x},${cb.y}) — 밟으면 반대쪽으로 옮겨진다(양방향 지름길).`;
}

// ---------------------------------------------------------------- minecart
function placeMinecart(c: Ctx): string {
  const bossId = text(field(c.data, "anchors"), "boss");
  const byDepth = c.rooms.filter((r) => r.kind !== "vault").sort((a, b) => depthOf(c.rooms, a.id) - depthOf(c.rooms, b.id));
  const A = byDepth[0];
  const B = [...byDepth].reverse().find((r) => r.id !== bossId && r.id !== A?.id) ?? byDepth[byDepth.length - 1];
  if (!A || !B || A.id === B.id) return "";
  const cartId = firstKit(c.ts, [TK("minecart"), "bd-pick-mining-valley-cart-h", "bd-pick-mining-valley-cart"]);
  if (!cartId) return "";
  const railId = firstKit(c.ts, [TK("rails-ew"), TK("rails-straight")]);
  // 주제 선로(rails-ew·끝막이)가 있으면 광차 아랫줄로 방 안을 가로지르는 선로를 깐다(양쪽 최대 8칸, 끝은 끝막이) — 걷는 칸 위 2층 데칼.
  const railTile = (id: string): number | undefined => { const k = kitOf(c.ts, id); const t = k?.rows[0]?.upperTiles?.[0]; return t !== undefined && t >= 0 ? t : undefined; };
  const layTrack = (r: FloorRoom, at: Pt, w: number, h: number): boolean => {
    const mid = railTile(TK("rails-ew"));
    if (mid === undefined) return false;
    const y = at.y + h - 1, W = c.map.width;
    const ok = (x: number) => x > r.x && x < r.x + r.w - 1 && isPassable(c.draft, c.map, x, y) && (c.map.upperTiles?.[y * W + x] ?? -1) < 0 && !c.map.events.some((e) => e.x === x && e.y === y);
    const run = (dx: number) => { const xs: number[] = []; for (let x = dx < 0 ? at.x - 1 : at.x + w; xs.length < 8 && ok(x); x += dx) xs.push(x); return xs; };
    const west = run(-1), east = run(1);
    if (west.length + east.length < 2) return false;
    const put = (x: number, t: number) => { if (c.map.upperTiles) c.map.upperTiles[y * W + x] = t; };
    for (const x of [...west, ...east]) put(x, mid);
    const endW = railTile(TK("rails-end-w")), endE = railTile(TK("rails-end-e"));
    if (west.length && endW !== undefined) put(west[west.length - 1]!, endW);
    if (east.length && endE !== undefined) put(east[east.length - 1]!, endE);
    return true;
  };
  const place = (r: FloorRoom): Pt | null => {
    const spots = centerSpots(r).filter((p) => free(c, p));
    for (const p of spots) {
      const at = stampFlat(c, cartId, [p]);
      if (!at) continue;
      const ck = kitOf(c.ts, cartId)!;
      if (!layTrack(r, at, ck.width, ck.height) && railId) stampFlat(c, railId, [{ x: at.x - 1, y: at.y + ck.height }]);
      return at;
    }
    return null;
  };
  const pa = place(A), pb = pa ? place(B) : null;
  if (!pa || !pb) return "";
  const k = kitOf(c.ts, cartId)!;
  const cellOf = (p: Pt) => ({ x: p.x, y: p.y + k.height - 1 });
  const ca = cellOf(pa), cb = cellOf(pb);
  const la = landingNear(c, [ca]) ?? { x: ca.x, y: ca.y + 1 }, lb = landingNear(c, [cb]) ?? { x: cb.x, y: cb.y + 1 };
  const cart = (id: string, at: Pt, to: Pt, toName: string): GameEvent => puzzleEvent(id, "광차", at, [makePage({
    id: `${id}_p`, name: "광차", graphic: TRANSPARENT, trigger: "action", priority: "same",
    commands: [choices(`녹슨 광차가 선로 위에 서 있다. ${toName} 쪽으로 타고 갈까?`, [
      { text: "탄다", branch: [sfx("stone-push"), shake(3, 700), textCmd("덜컹덜컹… 광차가 어두운 갱도를 달린다!"), transferCmd(c.map.id, to, "down", "black")] },
      { text: "그만둔다", branch: [] },
    ])],
  })]);
  upsertEventIntoMap(c.map, cart(`ev_${c.map.id}_cart_a`, ca, lb, B.id));
  upsertEventIntoMap(c.map, cart(`ev_${c.map.id}_cart_b`, cb, la, A.id));
  return `광차 정거장: ${A.id}(${ca.x},${ca.y}) ↔ ${B.id}(${cb.x},${cb.y}) — 조사해 타면 반대 정거장으로 간다.`;
}

// ---------------------------------------------------------------- iceslide
function placeIceSlide(c: Ctx): string {
  const lake = c.rooms.find((r) => r.kind === "lake") ?? c.rooms.find((r) => r.kind === "cavern" && r.w >= 10);
  if (!lake) return "";
  const W = c.map.width;
  // 가장 긴 가로 통행 줄(이벤트 없음) — 8칸 이상
  let best: { y: number; x0: number; x1: number } | null = null;
  for (let y = lake.y + 1; y < lake.y + lake.h - 1; y += 1) {
    let run = 0;
    for (let x = lake.x; x <= lake.x + lake.w; x += 1) {
      const ok = x < lake.x + lake.w && isPassable(c.draft, c.map, x, y) && !c.map.events.some((e) => e.x === x && e.y === y);
      if (ok) run += 1;
      else { if (run >= 8 && (!best || run > best.x1 - best.x0 + 1)) best = { y, x0: x - run, x1: x - 1 }; run = 0; }
    }
  }
  if (!best) return "";
  // 얼음 줄: 미끄럼 칸 그림(새 그림이 없으면 설원 얼음 바닥)을 깐다
  // gap 빙판 오토타일이 이미 호수를 덮었으면(얼음굴 바닥) 덧칠하지 않는다 — 가장자리가 끊긴다.
  const sheet = (c.ts.autotileGroups ?? []).find((g) => g.id === "beodeul_dungeon_ice");
  const onSheet = !!sheet && Array.from({ length: best.x1 - best.x0 + 1 }, (_, k) => c.map.lowerTiles[best!.y * W + best!.x0 + k]!).some((t) => sheet.memberTileIds.includes(t) || (sheet.interiorVariants ?? []).some((v) => v.includes(t)));
  // 줄 일부라도 빙판 오토타일 위면 덧칠하지 않는다 — 반만 덧칠하면 빙판 가운데 글자 무늬 띠가 생겼다(2026-10-25 floor VQA r0 얼음굴 seed1).
  const ice = onSheet ? undefined : firstKit(c.ts, [TK("ice-floor"), "bd-pick-snowfield-ground-ice"]);
  if (ice) { const k = kitOf(c.ts, ice)!; for (let x = best.x0; x <= best.x1; x += 1) { const t = k.rows[best.y % k.height]!.tiles[x % k.width]!; if (t >= 0) c.map.lowerTiles[best.y * W + x] = t; } }
  const n = best.x1 - best.x0;
  const slide = (id: string, at: Pt, dir: "left" | "right", name: string): GameEvent => puzzleEvent(id, name, at, [makePage({
    id: `${id}_p`, name, graphic: TRANSPARENT, trigger: "playerTouch", priority: "below",
    commands: [textCmd("얼음 위에서 발이 미끄러진다!"),
      { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "setDirectionFix", enabled: true }, { kind: "changeSpeed", delta: 2 }, ...Array.from({ length: n - 1 }, () => ({ kind: "move", dir } as const)), { kind: "changeSpeed", delta: -2 }, { kind: "setDirectionFix", enabled: false }], repeat: false, wait: true, skippable: true } } as Command],
  })]);
  upsertEventIntoMap(c.map, slide(`ev_${c.map.id}_slide_w`, { x: best.x0, y: best.y }, "right", "얼음 미끄럼길(서)"));
  upsertEventIntoMap(c.map, slide(`ev_${c.map.id}_slide_e`, { x: best.x1, y: best.y }, "left", "얼음 미끄럼길(동)"));
  return `얼음 미끄럼길: ${lake.id} 의 (${best.x0},${best.y})~(${best.x1},${best.y}) — 한쪽 끝을 밟으면 맞은편 끝까지 미끄러진다.`;
}

// ---------------------------------------------------------------- sandpit
function placeSandpit(c: Ctx): string {
  const bossId = text(field(c.data, "anchors"), "boss");
  const on = routeRooms(c.rooms, bossId);
  const side = c.rooms.filter((r) => !on.has(r.id) && r.kind !== "vault" && r.kind !== "entrance");
  const cands = [...side, ...c.rooms.filter((r) => on.has(r.id) && r.kind !== "entrance" && r.kind !== "boss")];
  // 모래 구덩이 그림은 모래 주제(피라미드·숲 모래땅)에만 — 성·묘지 돌바닥에 모래 소용돌이는 엉뚱했다(2026-10-23 themes p8).
  const art = firstKit(c.ts, c.type === "pyramid" || c.type === "forest" ? [TK("sand-pit"), TK("cracked-floor"), "bd-pick-temple-ruins-floor-trav"] : [TK("cracked-floor"), "bd-pick-temple-ruins-floor-trav"]);
  if (!art) return "";
  const entry = (field(c.data, "entryStair") ?? field(c.data, "entrance")) as Record<string, unknown> | undefined;
  const land = asCell(field(entry, "front")) ?? asCell(entry) ?? c.start;
  for (const r of cands) {
    // 길 위 방이면 방 가운데가 아니라 벽 쪽 구석에(돌아갈 길을 남긴다)
    const spots = on.has(r.id) ? [...r.spots].sort((a, b) => Math.min(a.x - r.x, r.x + r.w - a.x) - Math.min(b.x - r.x, r.x + r.w - b.x)) : centerSpots(r);
    const p = stampFlat(c, art, spots.filter((s) => free(c, s)), { needPassable: true });
    if (!p) continue;
    const k = kitOf(c.ts, art)!;
    const cells: Pt[] = [];
    for (let dy = 0; dy < k.height; dy += 1) for (let dx = 0; dx < k.width; dx += 1) cells.push({ x: p.x + dx, y: p.y + dy });
    // 길 위 방이면 구덩이를 피해 가는 길이 남는지 확인 — 없으면 이 방은 건너뛴다(되돌린다)
    const W = c.map.width;
    const seen = reach(c, new Set(cells.map((q) => q.y * W + q.x)));
    const bossRoom = c.rooms.find((rr) => rr.id === bossId);
    if (bossRoom && !bossRoom.spots.some((s) => seen[s.y * W + s.x])) continue;
    const word = c.type === "pyramid" || c.type === "forest" ? "모래" : "바닥";
    cells.forEach((q, i) => upsertEventIntoMap(c.map, puzzleEvent(`ev_${c.map.id}_pit_${i}`, "꺼지는 바닥", q, [makePage({
      id: `ev_${c.map.id}_pit_${i}_p`, name: "꺼지는 바닥", graphic: TRANSPARENT, trigger: "playerTouch", priority: "below",
      commands: [shake(6, 600), sfx("wrong"), textCmd(`${word}이 와르르 꺼졌다! 아래로 미끄러져 떨어진다…`), transferCmd(c.map.id, land, "up", "black"), textCmd("…입구까지 떠밀려 왔다. 저 금 간 자리는 피해 가자.")],
    })])));
    return `${word} 함정: ${r.id} (${p.x},${p.y}) ${k.width}×${k.height} — 밟으면 입구 (${land.x},${land.y}) 로 떨어진다(보스로 가는 길은 피해 갈 수 있다).`;
  }
  return "";
}

// ---------------------------------------------------------------- bridge
function placeBridge(c: Ctx): string {
  const W = c.map.width;
  const bridges = list(c.data, "bridges").map(asCell).filter((p): p is Pt => !!p);
  if (!bridges.length) return "";
  // 다리 칸 무리(4-이웃)
  const set = new Set(bridges.map((p) => p.y * W + p.x));
  const groups: number[][] = [];
  const seenB = new Set<number>();
  for (const i of set) {
    if (seenB.has(i)) continue;
    const g: number[] = [], st = [i]; seenB.add(i);
    while (st.length) { const j = st.pop()!; g.push(j); for (const d of [1, -1, W, -W]) { const n = j + d; if (set.has(n) && !seenB.has(n)) { seenB.add(n); st.push(n); } } }
    groups.push(g);
  }
  const bossId = text(field(c.data, "anchors"), "boss");
  const full = reach(c);
  let best: { g: number[]; cut: number; seen: Uint8Array } | null = null;
  for (const g of groups) {
    if (g.length > 12) continue;
    const seen = reach(c, new Set(g));
    const cutRooms = c.rooms.filter((r) => r.spots.some((s) => full[s.y * W + s.x]) && !r.spots.some((s) => seen[s.y * W + s.x]));
    const cut = cutRooms.length + (cutRooms.some((r) => r.id === bossId) ? 5 : 0);
    // 레버를 둘 방이 남아야 한다(입구 말고 닿는 방)
    const leverRooms = c.rooms.filter((r) => r.kind !== "entrance" && r.spots.some((s) => seen[s.y * W + s.x]));
    if (!leverRooms.length && cut) continue;
    if (!best || cut > best.cut) best = { g, cut, seen };
  }
  if (!best) return "";
  // 레버 = 다리를 건너지 않고 닿는 방 중 가장 깊은 방, 벽 앞 자리
  const reachable = c.rooms.filter((r) => r.spots.some((s) => best!.seen[s.y * W + s.x] && free(c, s)));
  const leverRoom = reachable.filter((r) => r.kind !== "entrance").sort((a, b) => depthOf(c.rooms, b.id) - depthOf(c.rooms, a.id))[0] ?? reachable[0];
  if (!leverRoom) return "";
  const leverAt = leverRoom.spots.filter((s) => best!.seen[s.y * W + s.x] && free(c, s)).sort((a, b) => a.y - b.y)[0];
  if (!leverAt) return "";
  // 다리 칸을 물(용암·허공)로: 이웃 액체 칸의 1층 그림을 빌린다. 다리 그림은 레버의 changeTile 이 되돌린다.
  const restore: Command[] = [];
  const swaps: [number, number][] = [];
  for (const i of best.g) {
    const x = i % W, y = (i - x) / W;
    const gset = new Set(best.g);
    const liquidTile = [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1].filter((n) => !gset.has(n)).map((n) => c.map.lowerTiles[n]!)
      .find((t) => t !== undefined && t >= 0 && !Object.values(c.ts.passability[t] ?? {}).some(Boolean)) ?? -1;
    const own = c.map.lowerTiles[i]!;
    if (liquidTile < 0) return "";
    restore.push({ kind: "changeTile", mapId: c.map.id, layer: "lower", x, y, tile: own } as Command);
    swaps.push([i, liquidTile]);
  }
  const sw = `sw_${c.map.id}_bridge`;
  ensureNamedSwitch(c.draft, sw, `${c.map.name}: 다리 내림`);
  const what = c.type === "volcano" ? "용암" : c.type === "otherworld" ? "허공" : c.type === "swamp" ? "늪" : "물";
  const roomCells: Pt[] = [];
  for (let yy = leverRoom.y; yy < leverRoom.y + leverRoom.h; yy += 1) for (let xx = leverRoom.x; xx < leverRoom.x + leverRoom.w; xx += 1) if (best.seen[yy * W + xx] && free(c, { x: xx, y: yy })) roomCells.push({ x: xx, y: yy });
  const placedLever = placeLever(c.draft, c.map, wallFirst(c.draft, c.map, roomCells.length ? roomCells : [leverAt]), `ev_${c.map.id}_bridge_lever`, "다리 레버", sw,
    [shake(3, 800), ...restore, sfx("stone-push"), textCmd(`쿠르릉… ${what} 위로 다리가 내려왔다!`)], `쇠사슬이 감긴 레버다. ${what} 건너편으로 다리를 내리는 장치 같다. 힘껏 당겼다!`, "레버는 이미 당겨져 있다. 다리가 내려와 있다.");
  if (!placedLever) return "";
  // 레버가 선 뒤에만 다리를 걷는다(못 놓으면 맵을 건드리지 않는다). 걷기는 채우기 뒤로 미룬다 — 미리 걷으면 건너편 적·상자가 「닿지 않는 칸」 경고를 받았다.
  const lift = () => { for (const [i, t] of swaps) c.map.lowerTiles[i] = t; };
  if (c.after) c.after.push(lift); else lift();
  const xs = best.g.map((i) => `(${i % W},${(i / W) | 0})`).join(" ");
  return `${what} 다리 장치: 다리 ${xs} 는 처음엔 걷혀 있고(${best.cut ? `건너편 방 ${best.cut > 5 ? "— 보스방 포함" : `${best.cut}곳`}` : "지름길"}) ${leverRoom.id}(${placedLever.at.x},${placedLever.at.y}) ${placedLever.wall ? "벽 " : ""}레버를 당기면 내려온다(스위치 ${sw}).`;
}

// ---------------------------------------------------------------- lever at a chokepoint (blob·미로 배치 — 방+통로 문법의 잠긴 통로가 없을 때)
function placeChokeLever(c: Ctx, entranceOk = true): string {
  const W = c.map.width, H = c.map.height;
  const bossId = text(field(c.data, "anchors"), "boss") ?? text(field(c.data, "anchors"), "treasure");
  const target = c.rooms.find((r) => r.id === bossId) ?? c.rooms[c.rooms.length - 1];
  if (!target) return "";
  const inRoom = (x: number, y: number, r: FloorRoom) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const full = reach(c);
  const tgtCells = target.spots.filter((s) => full[s.y * W + s.x]);
  if (!tgtCells.length) return "";
  // 입구 → 목표 최단 길
  const prev = new Int32Array(W * H).fill(-2);
  const s0 = c.start.y * W + c.start.x; prev[s0] = -1;
  const q = [s0]; let hit = -1;
  const goal = new Set(tgtCells.map((p) => p.y * W + p.x));
  for (let qi = 0; qi < q.length && hit < 0; qi += 1) {
    const i = q[qi]!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, ni = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[ni] !== -2 || !isPassable(c.draft, c.map, nx, ny)) continue;
      prev[ni] = i; q.push(ni); if (goal.has(ni)) { hit = ni; break; }
    }
  }
  if (hit < 0) return "";
  const path: number[] = [];
  for (let i = hit; i >= 0; i = prev[i]!) path.push(i);   // 목표 → 입구 순
  // 목표 방 바깥에서, 목표에 가까운 순으로 좁은 목(가로 또는 세로 단면 ≤4칸)을 찾는다
  // 레버가 입구 방에 서는 목은 마지막 후보(들어서자마자 당기는 레버는 퍼즐이 아니다) — 먼저 레버가 더 깊은 방에 서는 목을 찾는다.
  for (const allowEntrance of entranceOk ? [false, true] : [false]) for (const i of path) {
    const x = i % W, y = (i - x) / W;
    if (inRoom(x, y, target) || c.map.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) continue;
    for (const horiz of [true, false]) {
      const cells: Pt[] = [{ x, y }];
      for (const d of [-1, 1]) for (let k = 1; k <= 4; k += 1) {
        const px = horiz ? x + d * k : x, py = horiz ? y : y + d * k;
        if (!isPassable(c.draft, c.map, px, py)) break;
        cells.push({ x: px, y: py });
      }
      if (cells.length > 4) continue;
      // 지은 던전의 쇠창살 문은 문틀 그림이라 양옆이 벽인 목에만 — 트인 바닥 한가운데 선 창살이 「허공에 걸린 사슬·창살」로 읽혔다(2026-10-25 floor VQA r4·r5 catacomb·pyramid).
      if (leverGateStyle(c.type, field(c.data, "gateStyle")) !== "rock") {
        const ends = horiz ? [{ x: Math.min(...cells.map((p) => p.x)) - 1, y }, { x: Math.max(...cells.map((p) => p.x)) + 1, y }] : [{ x, y: Math.min(...cells.map((p) => p.y)) - 1 }, { x, y: Math.max(...cells.map((p) => p.y)) + 1 }];
        if (ends.some((p) => isPassable(c.draft, c.map, p.x, p.y))) continue;
        if (!horiz) continue;   // 세로 단면(가로 통로를 막는 세로 창살 줄)은 정면 그림이 옆으로 늘어서 문으로 안 읽힌다
      }
      const askedStyle = field(c.data, "gateStyle");
      const kits = leverGateKits(c.type, askedStyle);
      const gatePlan = kits ? planTileGate(c.draft, c.map, cells, kits) : null;
      // 문틀 키트가 안 들어가는 목(위층이 찬 칸 등)은 그 목을 버리지 않고 옛 쇠창살 이벤트로 — 버리면 탑 레버가 6/10 → 3/10 으로 줄었다(2026-10-25).
      const gateStyle = kits && !gatePlan ? "bars" : askedStyle;
      const blocked = new Set(cells.map((p) => p.y * W + p.x));
      const seen = reach(c, blocked);
      if (tgtCells.some((p) => seen[p.y * W + p.x])) continue;   // 옆으로 돌아간다 — 목이 아니다
      if (cells.some((p) => c.map.events.some((e) => e.x === p.x && e.y === p.y))) continue;
      // 레버: 막힌 쪽이 아닌, 닿는 방 중 가장 깊은 방의 북쪽 자리
      const leverRoom = c.rooms.filter((r) => r.kind !== "entrance" && r.id !== target.id && r.spots.some((s) => seen[s.y * W + s.x] && free(c, s)))
        .sort((a, b) => depthOf(c.rooms, b.id) - depthOf(c.rooms, a.id))[0] ?? c.rooms[0];
      if (!leverRoom) continue;
      if (leverRoom.kind === "entrance" && !allowEntrance) continue;
      const roomCells: Pt[] = [];
      for (let yy = leverRoom.y; yy < leverRoom.y + leverRoom.h; yy += 1) for (let xx = leverRoom.x; xx < leverRoom.x + leverRoom.w; xx += 1) if (seen[yy * W + xx] && !blocked.has(yy * W + xx) && free(c, { x: xx, y: yy })) roomCells.push({ x: xx, y: yy });
      if (!roomCells.length) continue;
      const sw = `sw_${c.map.id}_lever`;
      const rock = leverGateStyle(c.type, gateStyle) === "rock";
      ensureNamedSwitch(c.draft, sw, `${c.map.name}: 레버 당김(${rock ? "바위 치움" : "쇠창살 열림"})`);
      const gate = placeLeverBlock(c.draft, c.map, c.type, cells, sw, gatePlan, gateStyle)!;
      const placed = placeLever(c.draft, c.map, wallFirst(c.draft, c.map, roomCells), `ev_${c.map.id}_lever`, "레버", sw,
        [shake(3, 500), ...gate.openCommands, textCmd(rock ? "쿠르릉… 어디선가 바위가 굴러가는 소리가 울렸다." : "어디선가 쇠창살이 올라가는 소리가 울렸다.")], "녹슨 레버가 있다. 힘껏 당겼다!", "레버는 이미 당겨져 있다.");
      if (!placed) return "";
      const leverAt = placed.at;
      return `레버 퍼즐: 레버 ${leverRoom.id}(${leverAt.x},${leverAt.y}) → ${target.id} 앞 좁은 목 ${gate.tiles ? "쇠창살문(타일 키트, 문간 이벤트" : "쇠창살"} ${gate.cells.map((p) => `(${p.x},${p.y})`).join(" ")}${gate.tiles ? ")" : ""} 스위치 ${sw}.`;
    }
  }
  return "";
}

/** 주제 장치 하나를 놓는다. 고른 장치를 못 놓으면 그 주제의 다음 장치로. 놓은 장치와 요약 한 줄. lever 는 호출자가 placeLeverGate 로 놓는다. */
/**
 * 탑의 층 건너 마법진(2026-10-23 dungeon-themes): 1층 계단참 마법진은 봉인돼 있고, 꼭대기 계단참 마법진을 밟으면 봉인이 풀리며 1층으로 내려간다.
 * 그 뒤로는 1층 ↔ 꼭대기를 오간다(되돌아가는 지름길). 꼭대기 층은 방이 둘뿐이라 한 층 안 마법진 쌍은 자리가 없었다(tower-b).
 */
export function placeTowerWarp(draft: Project, bottom: GameMap, bottomData: Record<string, unknown>, top: GameMap, topData: Record<string, unknown>, type: DungeonType): string {
  const mk = (map: GameMap, data: Record<string, unknown>): Ctx => ({ draft, map, ts: draft.tilesets[map.tilesetId]!, data, rooms: roomsOf(data), type, warnings: [], start: { x: 0, y: 0 } });
  const a = mk(bottom, bottomData), b = mk(top, topData);
  const kitId = firstKit(a.ts, [TK("teleport-circle"), TK("arcane-circle"), "bd-pick-temple-ruins-mosaic-medallion-5x5"]);
  if (!kitId) return "";
  const roomA = a.rooms.find((r) => r.kind !== "entrance" && r.kind !== "boss") ?? a.rooms.find((r) => r.kind === "entrance");
  const roomB = b.rooms.find((r) => r.kind === "entrance") ?? b.rooms[0];
  if (!roomA || !roomB) return "";
  const pa = stampFlat(a, kitId, centerSpots(roomA), { needPassable: true });
  if (!pa) return "";
  const pb = stampFlat(b, kitId, centerSpots(roomB), { needPassable: true });
  if (!pb) return "";
  const k = kitOf(a.ts, kitId)!;
  const mid = (p: Pt) => ({ x: p.x + Math.floor(k.width / 2), y: p.y + Math.floor(k.height / 2) });
  const ca = mid(pa), cb = mid(pb);
  const la = landingNear(a, [ca]) ?? ca, lb = landingNear(b, [cb]) ?? cb;
  const sw = `sw_${bottom.id}_tower_warp`;
  ensureNamedSwitch(draft, sw, `${bottom.name}: 꼭대기 마법진 봉인 풀림`);
  upsertEventIntoMap(bottom, puzzleEvent(`ev_${bottom.id}_warp_up`, "봉인된 마법진", ca, [
    makePage({ id: `ev_${bottom.id}_warp_up_p1`, name: "봉인된 마법진", graphic: TRANSPARENT, trigger: "action", priority: "below",
      commands: [textCmd("희미하게 빛나는 마법진이다. 위쪽 어딘가에서 봉인을 풀어야 움직일 것 같다.")] }),
    makePage({ id: `ev_${bottom.id}_warp_up_p2`, name: "꼭대기로 가는 마법진", conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: TRANSPARENT, trigger: "playerTouch", priority: "below",
      commands: [sfx("crystal-ping"), flash("purple", 260), textCmd("마법진이 빛나며 몸이 떠오른다… 탑 꼭대기로!"), transferCmd(top.id, lb, "down", "white")] }),
  ]));
  upsertEventIntoMap(top, puzzleEvent(`ev_${top.id}_warp_down`, "1층으로 가는 마법진", cb, [
    makePage({ id: `ev_${top.id}_warp_down_p1`, name: "1층으로 가는 마법진", graphic: TRANSPARENT, trigger: "playerTouch", priority: "below",
      commands: [{ kind: "setSwitch", switchId: sw, value: true } as Command, sfx("crystal-ping"), flash("purple", 260), textCmd("마법진의 봉인이 풀렸다! 1층 마법진과 이어졌다."), transferCmd(bottom.id, la, "down", "white")] }),
  ]));
  return `층 건너 마법진: ${bottom.name} ${roomA.id}(${ca.x},${ca.y}) 봉인 ↔ ${top.name} ${roomB.id}(${cb.x},${cb.y}) — 꼭대기 마법진을 밟으면 봉인이 풀리고 1층으로 내려간다(스위치 ${sw}). 그 뒤로 두 마법진이 오간다.`;
}

export function placeThemeGimmick(draft: Project, map: GameMap, data: Record<string, unknown>, type: DungeonType, want: DungeonGimmick | undefined, seed: number,
  warnings: string[], leverFallback: () => string): { gimmick: DungeonGimmick | null; line: string; after: () => void } {
  const ts = draft.tilesets[map.tilesetId]!;
  const entry = asCell(field(field(data, "entryStair"), "front")) ?? asCell(field(data, "entrance")) ?? { x: 0, y: 0 };
  const later: (() => void)[] = [];
  const after = () => { for (const f of later.splice(0)) f(); };
  const c: Ctx = { draft, map, ts, data, rooms: roomsOf(data), type, warnings, start: entry, after: later };
  const theme = THEME_GIMMICKS[type] ?? ["lever"];
  const order: DungeonGimmick[] = want ? [want, ...theme.filter((g) => g !== want)] : [theme[seed % Math.min(2, theme.length)]!, ...theme];
  if (!order.includes("lever")) order.push("lever");
  const tried = new Set<DungeonGimmick>();
  for (const g of order) {
    if (tried.has(g)) continue;
    tried.add(g);
    const line = g === "lever" ? (leverFallback() || placeChokeLever(c, false)) : g === "bridge" ? placeBridge(c) : g === "teleporter" ? placeTeleporter(c) : g === "minecart" ? placeMinecart(c) : g === "iceslide" ? placeIceSlide(c) : placeSandpit(c);
    if (line) {
      if (want && g !== want) warnings.push(`${map.name}: ${GIMMICK_LABEL[want]} 자리가 없어 ${GIMMICK_LABEL[g]}(으)로 바꿨다.`);
      return { gimmick: g, line, after };
    }
  }
  // 마지막: 입구 방에 서는 레버(들어서자마자 당기는 레버) — 다른 장치가 다 안 될 때만(dt r2 cave-a 는 다리 자리가 있는데도 입구 레버였다).
  const last = placeChokeLever(c, true);
  if (last) { if (want && want !== "lever") warnings.push(`${map.name}: ${GIMMICK_LABEL[want]} 자리가 없어 ${GIMMICK_LABEL.lever}(으)로 바꿨다.`); return { gimmick: "lever", line: last, after }; }
  warnings.push(`${map.name}: 주제 장치를 둘 자리가 없었다.`);
  return { gimmick: null, line: "", after };
}
