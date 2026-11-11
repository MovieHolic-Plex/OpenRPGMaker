// 실내 방 채우기 — 한 번 짓기(build)와 그 결과 읽기, 앵커 가구 놓기(placeAnchor), 빈 방 채우기(fillBare)·방 종류별 한 벌(SETS), 손 견본 고르기(pickTemplate).
import { type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates, templateStyle, type InteriorRoomTemplate } from "@/editor/handInterior/templates";
import { measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import type { BuildRun } from "../../shared/types";
import { purposeOf } from "../roomPurpose";
import { hashText, itemCharacters, itemsFitWords, roomCharacters } from "@/editor/handInterior/vignettes";
import { Obj, Room, Rebuild, findPart, GENERIC_HOME } from "./interiorKind";

/** 깔린 카펫 줄(lines: 사각 rect 또는 칸 목록)과 깔개(flat 물건)가 덮는 칸. */
function lineCells(rb: Rebuild, spec?: HandInteriorSpec): Set<string> {
  const out = new Set<string>();
  for (const raw of (rb.lines ?? []) as { cells?: { x: number; y: number }[]; rect?: { x0: number; y0: number; x1: number; y1: number } }[]) {
    for (const c of raw.cells ?? []) out.add(`${c.x},${c.y}`);
    const r = raw.rect;
    if (r) for (let y = Math.min(r.y0, r.y1); y <= Math.max(r.y0, r.y1); y++) for (let x = Math.min(r.x0, r.x1); x <= Math.max(r.x0, r.x1); x++) out.add(`${x},${y}`);
  }
  if (spec) for (const o of rb.objects) {
    const d = spec.objects[o.id.split(":")[0]!];
    if (d?.kind === "flat") for (let j = 0; j < Math.max(1, d.h); j++) for (let i = 0; i < d.w; i++) out.add(`${o.x + i},${o.y + j}`);
  }
  return out;
}

/** 칸 점유 — 방 바닥(벽면 두 줄 아래) 중 가구·탁자가 막은 칸. */
export function occupancy(spec: HandInteriorSpec, rb: Rebuild): Set<string> {
  const used = new Set<string>();
  const mark = (x: number, y: number, w: number, h: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add(`${x + i},${y + j}`); };
  for (const o of rb.objects) {
    const def = spec.objects[o.id.split(":")[0]!];
    if (!def || def.kind === "hang") continue;
    mark(o.x, o.y, def.w, Math.max(1, def.h));
    if (def.kind === "wall" || def.kind === "floor") mark(o.x, o.y + Math.max(1, def.h), def.w, 1); // 앞 한 줄은 쓰는 자리 — 비워 둔다
  }
  for (const t of rb.tables ?? []) mark(t.x - 1, t.y - 1, t.w + 2, t.h + 2);
  return used;
}

/** 놓을 자리 후보(좋은 것부터). wall = 북벽 아래 첫 바닥 줄, hang = 벽면 윗줄, 나머지 = 바닥. */
function spots(room: Room, part: { kind: string; w: number; h: number }, used: Set<string>, centre: boolean, near?: { x: number; y: number }, keepClear: Set<string> = new Set()): { x: number; y: number }[] {
  const out: { x: number; y: number; d: number }[] = [];
  const h = Math.max(1, part.h);
  const free = (x: number, y: number, w: number, hh: number) => {
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) { const k = `${x + i},${y + j}`; if (used.has(k) || keepClear.has(k)) return false; }
    return true;
  };
  const cx = (room.x0 + room.x1) / 2, cy = (room.y0 + 2 + room.y1) / 2;
  if (part.kind === "hang") {
    for (let x = room.x0; x + part.w - 1 <= room.x1; x++) if (!used.has(`hang:${x}`)) out.push({ x, y: room.y0, d: Math.abs(x + part.w / 2 - cx) });
  } else {
    const yTop = room.y0 + 2;
    const rows = part.kind === "wall" ? [yTop] : Array.from({ length: room.y1 - yTop - h + 2 }, (_, i) => yTop + i);
    for (const y of rows) for (let x = room.x0; x + part.w - 1 <= room.x1; x++) {
      if (!free(x, y, part.w, h + (part.kind === "flat" ? 0 : 1))) continue;
      const px = x + part.w / 2, py = y + h / 2;
      const wallDist = Math.min(px - room.x0, room.x1 + 1 - px, py - yTop, room.y1 + 1 - py);
      const d = near ? Math.abs(px - near.x) + Math.abs(py - near.y) : centre ? Math.abs(px - cx) + Math.abs(py - cy) : wallDist + Math.abs(px - cx) * 0.1;
      out.push({ x, y, d });
    }
  }
  return out.sort((a, b) => a.d - b.d).map(({ x, y }) => ({ x, y }));
}

/** 도구 결과의 data.rebuild 를 다시 지을 인자로. */
export function argsFromRebuild(base: Record<string, unknown>, rb: Rebuild): Record<string, unknown> {
  const first = rb.rooms[0];
  return { ...base, layout: undefined, rooms: rb.rooms, connect: rb.connect ?? [], exit: rb.exit, objects: rb.objects, tables: rb.tables ?? [], goods: rb.goods ?? [], lines: rb.lines ?? [], daises: rb.daises ?? [],
    ...(first?.floor ? { floor: first.floor } : {}), ...(first?.wall ? { wall: first.wall } : {}), replace: true };
}

export function clean(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
}

export interface Attempt { ok: boolean; data?: Record<string, unknown>; summary: string }

export function build(run: BuildRun, args: Record<string, unknown>): Attempt {
  const r = run.call("build_hand_interior_room", clean(args));
  return { ok: r.ok, data: r.data as Record<string, unknown> | undefined, summary: String(r.summary ?? "") };
}

export const reachOk = (a: Attempt) => a.ok && Array.isArray(a.data?.unreachedFloor) && (a.data!.unreachedFloor as unknown[]).length === 0;

/**
 * 짓기 경고 중 기물끼리 부딪힌 것의 수 — 같은 칸 조각 버림·「옆에 닿는 칸이 없다(쓸 수 없는 가구)」·겹침.
 * 빈 바닥 줄이기가 이걸 늘리면 받지 않는다(2026-10-29 room-vig6 horror-ward 76~78: modern_city 병동 견본을 10×11 로 줄이자
 * 침대 넷·모니터 셋이 서로 겹치고 협탁 둘이 못 쓰는 가구가 됐다 — 빈 바닥 0% 는 겹침으로 산 숫자였다).
 */
// 겹침(같은 칸 조각 버림·겹침)은 하나라도 늘면 안 받고, 벽 쪽 한 칸 소품이 「옆에 닿는 칸이 없다」가 되는 것은 둘까지 봐준다
// (×0.72 병동 15×17 → 13×15: 세면대·정수기 둘이 구석에 몰린 것뿐 — 맨바닥 44% → 31%).
const OVERLAP_WARNING = /조각 \d+개|버림|겹/u;

const UNUSABLE_WARNING = /닿는 칸이 없다|쓸 수 없는/u;

// 줄인 방에 견본 가구가 덜 들어가는 것(furniture.dropped)도 부딪힘으로 친다 — 두 점까지 봐준다. 겹침 경고는 같은 칸 조각만 보아서,
// 병동 견본을 ×0.62 로 줄이자 침대·커튼·모니터가 밀려 빠지고 남은 것끼리 붙었는데도 경고 0 이었다(2026-10-29 horror-ward).
const droppedOf = (a: Attempt) => (((a.data?.layout as { rooms?: { furniture?: { dropped?: number } }[] } | undefined)?.rooms) ?? []).reduce((n, r) => n + (r.furniture?.dropped ?? 0), 0);

export const crashesOf = (a: Attempt) => {
  const ws = (a.data?.warnings as string[] | undefined) ?? [];
  return ws.filter((w) => OVERLAP_WARNING.test(w)).length + ws.filter((w) => !OVERLAP_WARNING.test(w) && UNUSABLE_WARNING.test(w)).length / 3 + droppedOf(a) / 3;
};

/** 칸막이 문틈(위·아래 방 사이) 바로 아래·위 칸 — 벽 가구를 걸 벽면이 없다. */
export function openingColumns(rb: Rebuild, data?: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const o of (data?.openings as { x: number; y: number; kind?: string }[] | undefined) ?? []) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 3; dy++) out.add(`${o.x + dx},${o.y + dy}`);
  void rb;
  return out;
}

/** 물건이 덮는 칸(앞 한 줄 포함). */
export function footprint(spec: HandInteriorSpec, o: Obj): string[] {
  const def = spec.objects[o.id.split(":")[0]!];
  if (!def || def.kind === "hang") return [];
  const out: string[] = [];
  for (let j = 0; j < Math.max(1, def.h) + (def.kind === "flat" ? 0 : 1); j++) for (let i = 0; i < def.w; i++) out.push(`${o.x + i},${o.y + j}`);
  return out;
}

/**
 * 주인공 물건 하나를 그 방에 놓는다 — 도달 검사를 통과하는 첫 자리. 빈 자리가 없으면(앵커는 evict) 견본 가구를 비켜 놓는다.
 * 못 놓으면 undefined.
 */
export function placeAnchor(run: BuildRun, spec: HandInteriorSpec, current: Record<string, unknown>, rb: Rebuild, roomId: string, part: NonNullable<ReturnType<typeof findPart>>, near?: { x: number; y: number }, evict = false, protectedIds: ReadonlySet<string> = new Set(), openings?: Set<string>): { args: Record<string, unknown>; rb: Rebuild } | undefined {
  const room = rb.rooms.find((r) => r.id === roomId) ?? rb.rooms[0];
  if (!room) return undefined;
  const keep = new Set<string>(openings ?? []);
  const bottom = Math.max(...rb.rooms.map((q) => q.y1));
  for (const r of rb.rooms) if (r.y1 === bottom) for (let x = r.x0; x <= r.x1; x++) { keep.add(`${x},${r.y1}`); keep.add(`${x},${r.y1 - 1}`); }
  const used = occupancy(spec, rb);
  const centre = part.w * Math.max(1, part.h) >= 4 && part.kind !== "wall";
  const attempt = (objects: Obj[], goods: Obj[] | undefined): { args: Record<string, unknown>; rb: Rebuild } | undefined => {
    const next = { ...current, objects, ...(goods ? { goods } : {}) };
    const res = build(run, next);
    return reachOk(res) ? { args: next, rb: { ...rb, objects, ...(goods ? { goods } : {}) } } : undefined;
  };
  let tries = 0;
  for (const at of spots(room, part, used, centre, near, keep)) {
    if (++tries > 12) break;
    const done = attempt([...rb.objects, { id: part.id, x: at.x, y: at.y }], undefined);
    if (done) return done;
  }
  if (!evict) return undefined;
  // 빈 자리가 없다 — 견본 가구를 비켜 자리를 만든다(주인공 물건이 견본보다 중요하다). 덜 비키는 자리부터.
  const all = spots(room, part, new Set(), centre, near, keep);
  const ranked = all.map((at) => {
    const cells = new Set(footprint(spec, { id: part.id, x: at.x, y: at.y }));
    if (part.kind === "hang") for (let i = 0; i < part.w; i++) cells.add(`hang:${at.x + i}`);
    const victims = rb.objects.filter((o) => !protectedIds.has(`${o.id}@${o.x},${o.y}`) && footprint(spec, o).some((c) => cells.has(c)));
    return { at, victims, cost: victims.length };
  }).filter((r) => !r.victims.some((v) => /stairs|stairwell|door/u.test(v.id))).sort((a, b) => a.cost - b.cost).slice(0, 5);
  for (const { at, victims } of ranked) {
    const gone = new Set(victims.map((v) => `${v.id}@${v.x},${v.y}`));
    const objects = rb.objects.filter((o) => !gone.has(`${o.id}@${o.x},${o.y}`));
    const goneCells = new Set(victims.flatMap((v) => footprint(spec, v)));
    const goods = (rb.goods ?? []).filter((g) => !goneCells.has(`${g.x},${g.y}`));
    const done = attempt([...objects, { id: part.id, x: at.x, y: at.y }], goods);
    if (done) return done;
  }
  return undefined;
}

/** 방 종류별 「쓰임 한 벌」 — 빈 바닥 덩이를 메울 때 놓는 가구 묶음(가운데 칸 기준 상대 좌표). */
const SETS: readonly [RegExp, readonly (readonly Obj[])[]][] = [
  // 같은 한 벌을 줄지어 찍으면 급식실처럼 읽혔다(2026-10-23 1배) — 바퀴마다 다른 벌을 돌려 쓴다.
  [/tavern|dining|great_hall|inn/u, [
    [{ id: "dining 2x1", x: 0, y: 1 }, { id: "chair S", x: 0, y: 0 }, { id: "chair S", x: 1, y: 0 }, { id: "chair N", x: 0, y: 2 }, { id: "chair N", x: 1, y: 2 }],
    [{ id: "roundtable", x: 1, y: 1 }, { id: "chair E", x: 0, y: 1 }, { id: "chair W", x: 2, y: 1 }, { id: "barrel", x: 3, y: 0 }],
    [{ id: "fur rug", x: 0, y: 0 }, { id: "armchair", x: 2, y: 0 }, { id: "candelabra", x: 3, y: 1 }],
  ]],
  [/library|study/u, [
    [{ id: "desk 2x1", x: 0, y: 1 }, { id: "chair N", x: 0, y: 2 }, { id: "round rug", x: 0, y: 1 }],
    [{ id: "armchair", x: 0, y: 0 }, { id: "book pile", x: 1, y: 0 }, { id: "candelabra", x: 2, y: 0 }],
    [{ id: "globe", x: 0, y: 0 }, { id: "orrery", x: 1, y: 0 }, { id: "round rug", x: 0, y: 1 }],
  ]],
  [/bedroom|inn_room|living/u, [
    [{ id: "round rug", x: 0, y: 0 }, { id: "armchair", x: 2, y: 0 }],
    [{ id: "tea 2x2", x: 0, y: 0 }, { id: "chair E", x: 2, y: 0 }],
  ]],
  [/corridor|hall|landing/u, [
    // 위층 계단참이 휑한 맨바닥이었다(2026-10-23 눈가림 2차: 「아래 절반이 넓은 맨 널마루」) — 쉬는 자리 한 벌(깔개·안락의자·탁자)부터.
    [{ id: "rug red", x: 0, y: 0 }, { id: "armchair", x: 0, y: 0 }, { id: "roundtable", x: 1, y: 0 }, { id: "armchair", x: 2, y: 0 }],
    [{ id: "potted fern", x: 0, y: 0 }, { id: "candelabra", x: 2, y: 0 }],
    [{ id: "bench 2", x: 0, y: 0 }, { id: "potted fern", x: 3, y: 0 }],
  ]],
  [/storeroom|cellar|pantry|kitchen/u, [
    [{ id: "barrel", x: 0, y: 0 }, { id: "crate", x: 1, y: 0 }, { id: "barrel", x: 0, y: 1 }],
    [{ id: "crate", x: 0, y: 0 }, { id: "crate", x: 1, y: 0 }, { id: "barrel", x: 2, y: 0 }],
  ]],
  // 가게·예배당·공방은 방 종류 낱말로도 쓰임 한 벌을 준다(쓰임 낱말이 없을 때).
  [/_shop$|^shop$/u, [[{ id: "display 2x1", x: 0, y: 0 }, { id: "crate", x: 3, y: 0 }], [{ id: "display 1x1", x: 0, y: 0 }, { id: "barrel", x: 2, y: 0 }, { id: "display 1x1", x: 3, y: 0 }]]],
  [/chapel|vestry/u, [[{ id: "pew", x: 0, y: 0 }, { id: "pew", x: 0, y: 2 }], [{ id: "votive stand", x: 0, y: 0 }, { id: "candelabra", x: 2, y: 0 }]]],
  [/workshop|forge|tailor_work|alchemy/u, [[{ id: "work 2x1", x: 0, y: 0 }, { id: "stool", x: 0, y: 1 }, { id: "crate", x: 3, y: 0 }], [{ id: "crate", x: 0, y: 0 }, { id: "barrel", x: 1, y: 0 }, { id: "sack", x: 2, y: 0 }]]],
];

/** 쓰임을 모르는 방의 한 벌 — 어느 방에 있어도 어색하지 않은 것만(거실 안락의자·양탄자는 집 방에만). 2026-10-25 J42: 예배당·가게까지 이 거실 한 벌을 받았다. */
const NEUTRAL_SETS: readonly (readonly Obj[])[] = [[{ id: "tall vase red", x: 0, y: 0 }, { id: "candelabra", x: 2, y: 0 }], [{ id: "crate", x: 0, y: 0 }, { id: "barrel", x: 1, y: 0 }]];

/**
 * 방의 「쓰임 한 벌」 후보들(덧찍기 고치기도 쓴다). 쓰임(방 이름·장소 이름의 낱말: 예배당·장난감 가게·공방·교실)이 먼저,
 * 그다음 방 종류, 둘 다 모르면 중립 한 벌. 쓰임은 알지만 한 벌이 없으면(병원·학교 — 현대 칩셋 부품이 v5 와 다르다) 빈 배열 = 메우지 않는다.
 */
export function roomSetsFor(kind: string, context = ""): readonly (readonly Obj[])[] {
  const purpose = purposeOf(`${kind.replace(/[_-]/gu, " ")} ${context}`);
  if (purpose && !GENERIC_HOME.test(kind)) return purpose.sets ?? [];
  const byKind = SETS.find(([re]) => re.test(kind));
  if (byKind) return byKind[1];
  return purpose ? purpose.sets ?? [] : NEUTRAL_SETS;
}

/** 빈 바닥 덩이(1배 2×2 이상 맨바닥)를 그 방의 쓰임 한 벌로 메운다. 측정은 v1 의 보정된 자(bareFloor.ts). */
export function fillBare(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, rb: Rebuild, roomKinds: Map<string, string>, limit: number, context = ""): { args: Record<string, unknown>; rb: Rebuild; filled: number } {
  let filled = 0;
  // 한 덩이에 한 벌이 안 들어가면(길 막힘·겹침) 다른 벌·다른 자리를 시험하고, 그래도 안 되면 그 덩이는 건너뛰고 다음 덩이로(2026-10-23: 첫 덩이 실패로 멈춰 위층 맨바닥 45%).
  const tried = new Set<string>();
  // 같은 한 벌을 한 방에 줄지어 찍지 않는다 — 상자·통 한 벌과 꽃병·촛대 한 벌이 벽마다 되풀이됐다(2026-10-28 마법학교 홀).
  // 탁자 한 벌(식탁·책상)은 방에 셋까지, 나머지 한 벌은 방에 하나.
  const usedSets = new Map<string, number>();
  for (let round = 0; round < 16; round++) {
    const map = run.ctx.project.maps[String(args.mapId)];
    if (!map) break;
    const bare = measureInteriorBareFloor(run.ctx.project, map);
    if (!bare || bare.pct <= limit) break;
    const region = [...bare.regions].filter((r) => !tried.has(`${r.x},${r.y},${r.w},${r.h},${r.cells}`)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (!region || region.w < 2 || region.h < 2) break;
    const key = `${region.x},${region.y},${region.w},${region.h},${region.cells}`;
    tried.add(key);
    const cx = region.x + Math.floor(region.w / 2) - 1, cy = region.y + Math.floor(region.h / 2) - 1;
    const room = rb.rooms.find((r) => cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1);
    if (!room) continue;
    const kind = roomKinds.get(room.id) ?? room.id;
    const sets = roomSetsFor(kind, roomKinds.size === 1 ? context : "");
    let placed = false;
    for (let k = 0; k < sets.length && !placed; k++) {
      const setIndex = (filled + k) % sets.length;
      const set = sets[setIndex]!.filter((o) => spec.objects[o.id]);
      if (!set.length) continue;
      // 덩이 가운데부터 덩이 안 모든 자리(가까운 순 24곳) — 가운데에 계단통·주인공 물건이 있으면 가장자리 쪽에 앉힌다.
      const spots: [number, number][] = [];
      for (let y = region.y; y < region.y + region.h; y++) for (let x = region.x; x < region.x + region.w; x++) spots.push([x - cx, y - cy]);
      spots.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
      const occupied = (x: number, y: number) => rb.objects.some((o) => { const d = spec.objects[o.id.split(":")[0]!]; return !!d && x >= o.x && x < o.x + d.w && y >= o.y - 1 && y < o.y + Math.max(1, d.h) + 1; });
      // 깔개(flat)는 깔린 양탄자·카펫 줄(lines) 위에 겹쳐 깔지 않는다 — 파란 둥근 깔개가 초록 사각 깔개 밑에 반쯤 묻혔다(2026-10-28 할머니 집).
      const carpet = lineCells(rb, spec);
      const flatClash = (dx: number, dy: number) => set.some((o) => {
        const d = spec.objects[o.id]!;
        if (d.kind !== "flat") return false;
        for (let j = 0; j < Math.max(1, d.h); j++) for (let i = 0; i < d.w; i++) if (carpet.has(`${cx + dx + o.x + i},${cy + dy + o.y + j}`)) return true;
        return false;
      });
      // 한 벌의 가구가 모두 이 방 바닥(벽면 두 줄 아래 ~ 남쪽 끝 줄) 안에 든다 — 남쪽 끝의 2×2 양탄자가 벽·허공으로 넘쳤다(2026-10-25 J42).
      const inside = (dx: number, dy: number) => set.every((o) => {
        const d = spec.objects[o.id]!, x = cx + dx + o.x, y = cy + dy + o.y;
        return x >= room.x0 && x + d.w - 1 <= room.x1 && y >= room.y0 + 2 && y + Math.max(1, d.h) - 1 <= room.y1;
      });
      // 탁자 없는 한 벌(화분·촛대·꽃병·상자·통·벤치)은 벽을 등진 자리에만 — 홀 가운데 덩이마다 상자·통·꽃병을 흩어 놓아
      // 「타일 견본을 펼친 임시 맵」으로 읽혔다(2026-10-28 마법학교 홀). 탁자 한 벌(식탁·책상·찻상)만 가운데에 둔다.
      const centrePiece = set.some((o) => /dining|table|desk|tea|work|pew|roundtable|counter/u.test(o.id));
      const setKey = `${room.id}#${setIndex}`;
      // 깔개가 든 한 벌은 방마다 한 번(깔개+안락의자 한 벌이 홀에 세 번 찍혀 견본처럼 보였다), 책상·장의자 줄은 세 번, 다른 탁자 한 벌은 두 번.
      const hasRug = set.some((o) => spec.objects[o.id]?.kind === "flat");
      const cap = hasRug ? 1 : set.some((o) => /desk|pew/u.test(o.id)) ? 3 : centrePiece ? 2 : 1;
      if ((usedSets.get(setKey) ?? 0) >= cap) continue;
      const byWall = (dx: number, dy: number) => {
        const xs = set.map((o) => cx + dx + o.x), ys = set.map((o) => cy + dy + o.y);
        const x0 = Math.min(...xs), x1 = Math.max(...set.map((o, i) => xs[i]! + spec.objects[o.id]!.w - 1)), y0 = Math.min(...ys);
        return y0 === room.y0 + 2 || x0 === room.x0 || x1 === room.x1;
      };
      // 옆 가구와 한 칸은 띄운다(좌우) — 장작 더미가 안락의자 등받이에 얹힌 듯 맞붙었다.
      const crowded = (dx: number, dy: number) => set.some((o) => { const d = spec.objects[o.id]!, x = cx + dx + o.x, y = cy + dy + o.y; return occupied(x - 1, y) || occupied(x + d.w, y); });
      for (const [dx, dy] of spots.filter(([dx, dy]) => inside(dx, dy) && set.every((o) => !occupied(cx + dx + o.x, cy + dy + o.y)) && (centrePiece || byWall(dx, dy)) && !crowded(dx, dy) && !flatClash(dx, dy)).slice(0, 24)) {
        const objects = [...rb.objects, ...set.map((o) => ({ id: o.id, x: cx + dx + o.x, y: cy + dy + o.y }))];
        const next = { ...args, objects };
        const res = build(run, next);
        if (reachOk(res) && !(res.data?.warnings as string[] | undefined ?? []).some((w) => /겹|overlap/u.test(w))) { args = next; rb = { ...rb, objects }; filled++; placed = true; usedSets.set(setKey, (usedSets.get(setKey) ?? 0) + 1); break; }
      }
    }
  }
  // 마지막 시도가 실패했을 수 있다 — 지금 인자로 맵을 맞춘다.
  build(run, args);
  return { args, rb, filled };
}

/** 견본 고르기에서 피할 예제 맵 — 그 건물에만 맞는 재질·소품이라 일반 요청에 섞으면 어색하다
 *  (2026-10-23 v1 비교: 「선술집」이 자오자 뒷골목(zozo) 견본을 골라 푸른 얼룩 돌바닥 선술집이 됐다 — 눈가림 검수 「던전 같다」). */
const EXOTIC_MAPS = new Set(["zozo", "narshe", "casino", "magitek", "opera", "mine", "dungeon", "arena", "ship", "ship_hold", "museum", "museum-gallery"]);

/** 방 종류의 견본 하나: 같은 이름의 예제 건물(선술집 → tavern 예제) → 평범한 예제 → 아무거나. 크기 낱말로 작은·가운데·큰 것. */
/** 같은 게임에서 이미 쓴 방 견본 — 맵 위치 태그 `template:<id>`(build_hand_interior_room 이 방마다 남긴다). 다시 짓는 맵은 뺀다. */
export function usedTemplates(project: { maps: Record<string, { locations?: readonly { tags?: readonly string[] }[] }> }, exceptMapId: string | undefined): Map<string, number> {
  const used = new Map<string, number>();
  for (const [id, m] of Object.entries(project.maps)) {
    if (id === exceptMapId) continue;
    for (const l of m.locations ?? []) for (const tag of l.tags ?? []) if (tag.startsWith("template:")) used.set(tag.slice(9), (used.get(tag.slice(9)) ?? 0) + 1);
  }
  return used;
}

/**
 * 한 게임 안 반복 금지(2026-10-29): 같은 용도의 방이 이미 이 게임에 있으면(다른 맵이나 이번 짓기의 앞 방) 덜 쓴 견본 변형을 돌려 쓴다 —
 * 추리 여관 판에서 객실·홀이 모두 같은 견본이라 같은 방이 되풀이됐다. 결정적: 쓴 횟수가 적은 것, 같으면 크기 말(small/medium/large)이 고르는 견본에 넓이가 가까운 것.
 * 그 용도의 견본을 아직 하나도 안 썼으면 undefined(원래 고르기 그대로).
 */
export function rotateTemplate(tilesetId: string, kind: string, size: string | undefined, used: ReadonlyMap<string, number>, pick: TemplatePick = {}): InteriorRoomTemplate | undefined {
  const pool = templatePool(tilesetId, kind, pick.single);
  if (pool.length < 2 || !pool.some((t) => used.has(t.id))) return undefined;
  const pref = pickTemplate(tilesetId, kind, size, pick)!;
  const area = (t: InteriorRoomTemplate) => t.w * t.h;
  // 같은 설계의 크기 변형은 같은 방으로 읽힌다 — 덜 쓴 «설계»를 먼저(2026-10-29 서재 다섯 견본이 모두 귀족 서재 한 설계의 크기 변형).
  const designUse = new Map<string, number>();
  for (const t of pool) if (used.has(t.id)) designUse.set(templateDesign(t), (designUse.get(templateDesign(t)) ?? 0) + used.get(t.id)!);
  return [...pool].sort((a, b) => (designUse.get(templateDesign(a)) ?? 0) - (designUse.get(templateDesign(b)) ?? 0) || (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || Math.abs(area(a) - area(pref)) - Math.abs(area(b) - area(pref)) || a.id.localeCompare(b.id))[0];
}

/** 견본의 «설계» — 손 견본은 크기 변형(-xs·-s·-sq·-m·-l·-l2…)을 한 설계로 친다. */
function templateDesign(t: Pick<InteriorRoomTemplate, "map">): string { return t.map.startsWith("authored-") ? t.map.replace(/-(xs|s|sq|m|l|xl|t)\d?$/u, "") : t.map; }

/**
 * 방 종류의 견본 후보: 그 종류의 손 견본 + 같은 종류의 평범한(EXOTIC 아닌) 예제 견본(2026-10-29 「서재가 늘 같은 방」 — 손 견본이 있으면 그것만 써서
 * 서재가 귀족 서재 한 설계(크기 변형 다섯)뿐이었다). 밀도 필터는 그대로. single(한 방짜리 장소)이면 4×5 같은 곁방 크기 견본은 뺀다(있으면).
 */
function templatePool(tilesetId: string, kind: string, single = false): InteriorRoomTemplate[] {
  const ts = roomTemplates(tilesetId).filter((t) => t.kind === kind);
  const own = ts.filter((t) => t.map === kind || t.map.startsWith("authored-"));
  const plain = ts.filter((t) => !EXOTIC_MAPS.has(t.map));
  const merged = [...new Map([...own, ...plain].map((t) => [t.id, t] as const)).values()];
  const base = merged.length ? merged : ts;
  // 가구 한 점당 바닥 12칸을 넘는 성긴 견본은 빼고 고른다(있으면) — 큰 학교의 입학 홀이 manor_1f 23×19(가구 16점, 점당 27칸)를 골라
  // 맨바닥 60% 의 빈 광장이 됐다(2026-10-28 interior 장부 56·57 후속). 빈 바닥은 메우지 말고 방을 줄인다.
  const dense = base.filter((t) => t.w * t.h <= 12 * Math.max(1, t.items?.length ?? 0));
  const list = dense.length ? dense : base;
  const roomy = single ? list.filter((t) => Math.min(t.w, t.h) >= 5 && t.w * t.h >= 30) : list;
  return [...(roomy.length ? roomy : list)].sort((a, b) => a.w * a.h - b.w * b.h || a.id.localeCompare(b.id));
}

export interface TemplatePick { readonly key?: string; readonly style?: string; readonly single?: boolean; readonly text?: string }

/**
 * 견본 고르기. key(게임 열쇠·장소·구역 글)가 있으면 크기 낱말에 맞는 띠 안에서 «설계»를 씨앗으로 고르고 그 설계의 크기 변형 중 목표 넓이에 가까운 것 —
 * 같은 입력이면 같은 견본, 다른 게임이면 다른 설계. style 이 있으면(여러 방 건물의 앞 방 화풍) 그 화풍·두루 견본을 먼저.
 * key 가 없으면 옛 동작(넓이순 작은·가운데·큰 것).
 */
export function pickTemplate(tilesetId: string, kind: string, size: string | undefined, pick: TemplatePick = {}) {
  const pool = templatePool(tilesetId, kind, pick.single);
  if (!pool.length) return undefined;
  if (pick.key === undefined) return size === "small" ? pool[0] : size === "large" ? pool[pool.length - 1] : pool[Math.floor((pool.length - 1) / 2)];
  const area = (t: InteriorRoomTemplate) => t.w * t.h;
  const median = area(pool[Math.floor((pool.length - 1) / 2)]!);
  const half = Math.ceil(pool.length / 2);
  const band = size === "small" ? pool.slice(0, half) : size === "large" ? pool.slice(pool.length - half) : pool.filter((t) => area(t) >= median * 0.5 && area(t) <= median * 1.8);
  // 성격이 다른 설계는 빼고(평범한 서재·귀족 서재에 엘프 잎 벽·마법진 견본이 오지 않게), 그다음 앞 방 화풍.
  const ids = (t: InteriorRoomTemplate) => [...t.items.map((it) => it.id), t.floor, t.wall];
  // 마법·엘프처럼 드문 성격 낱말이면 그 성격 견본을 크기 띠 밖에서라도 먼저(마법사의 서재 → 탑 서재).
  const rare = roomCharacters(pick.text ?? "").filter((c) => c === "arcane" || c === "elf");
  const themed = rare.length ? pool.filter((t) => rare.some((c) => itemCharacters(ids(t)).has(c)) && itemsFitWords(ids(t), pick.text ?? "")) : [];
  const fits = themed.length ? themed : band.filter((t) => itemsFitWords(ids(t), pick.text ?? ""));
  const fit = fits.length ? fits : band;
  const styled = pick.style ? fit.filter((t) => templateStyle(t) === pick.style || templateStyle(t) === "any") : fit;
  const cands = styled.length ? styled : fit.length ? fit : pool;
  const designs = [...new Set(cands.map(templateDesign))].sort();
  const design = designs[hashText(`${pick.key}|${kind}`) % designs.length]!;
  const target = median * (size === "small" ? 0.75 : size === "large" ? 1.4 : 1);
  return cands.filter((t) => templateDesign(t) === design).sort((a, b) => Math.abs(area(a) - target) - Math.abs(area(b) - target) || a.id.localeCompare(b.id))[0]!;
}
