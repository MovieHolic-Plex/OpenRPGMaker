// 조수 v2 실내 빌더 — 명세(방 구역·주인공 물건·층)를 손 도트 실내 도구(build_hand_interior_room)의 인자로 옮긴다.
//
// 1) 구역 → layout.rooms(방 종류). 방 배치·칸막이·문·출구·견본 가구는 도구의 결정론 배치기가 짠다(layout.ts).
// 2) 주인공 물건(anchors) → 부품 사전에서 찾아 그 방의 빈 자리에 놓는다. 놓을 때마다 다시 지어 도달 검사(unreachedFloor 0)를 통과한 자리만 남긴다.
// 3) 「계단」 앵커 → 위층을 따로 짓고 계단끼리 이동 이벤트로 잇는다(계단 입구 계약은 도구의 fitStairTransfers 가 맞춘다).
// 모델은 칸 좌표를 쓰지 않는다 — 비평가가 짚은 칸(near)은 「그 근처의 빈 자리」를 고르는 힌트로만 쓴다.
import { HAND_INTERIOR_TILESET_ID, MODERN_CITY_INTERIOR_TILESET_ID, SENGOKU_INTERIOR_TILESET_ID, WIZARDING_INTERIOR_TILESET_ID, roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import { INTERIOR_BARE_FLOOR_LIMIT, measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import type { BuildRun, PlaceBuilder, PlaceBuildResult, PlaceRecord, PlaceSpec, ZoneSpec } from "../types";

type Obj = { id: string; x: number; y: number };
type Room = { id: string; x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string };
interface Rebuild { rooms: Room[]; connect?: unknown[]; exit?: unknown; objects: Obj[]; tables?: { style: string; x: number; y: number; w: number; h: number }[]; goods?: Obj[]; lines?: unknown[]; daises?: unknown[] }
interface InteriorState { readonly tilesetId: string; readonly mapId: string; readonly args: Record<string, unknown>; readonly upperMapId?: string; readonly upperArgs?: Record<string, unknown>; readonly placed: readonly { zone: string; what: string; id: string }[] }

/** 화풍 낱말 → 실내 칩셋. 일본 현대 집은 jp 빌더(house)가 맡는다. */
function tilesetFor(style: string | undefined): string {
  const s = (style ?? "").toLowerCase();
  if (/wizard|마법\s*학교|hogwart/u.test(s)) return WIZARDING_INTERIOR_TILESET_ID;
  if (/sengoku|edo|전국|에도|사무라이/u.test(s)) return SENGOKU_INTERIOR_TILESET_ID;
  if (/modern|현대|city|도시/u.test(s)) return MODERN_CITY_INTERIOR_TILESET_ID;
  return HAND_INTERIOR_TILESET_ID;
}

/** 방 낱말 → 방 종류(그 칩셋에 견본이 있는 것). 없으면 가장 가까운 쓰임. */
const KIND_WORDS: readonly [RegExp, string[]][] = [
  [/선술집|주점|술집|tavern|pub|bar\b|홀/iu, ["tavern", "dining", "great_hall"]],
  [/부엌|주방|kitchen|조리/iu, ["kitchen", "prep"]],
  [/창고|저장|store ?room|pantry|식료/iu, ["storeroom", "pantry"]],
  [/지하|cellar|술 ?창고/iu, ["cellar", "storeroom"]],
  [/침실|bed ?room|잠|객실|여관 ?방|guest/iu, ["bedroom", "inn_room"]],
  [/서재|study|공부|연구/iu, ["study", "library"]],
  [/도서|서고|library|책/iu, ["library", "study"]],
  [/천문|관측|observ|별/iu, ["study", "library"]],
  [/거실|응접|living|lounge|휴게/iu, ["living", "dining"]],
  [/식당|dining/iu, ["dining", "tavern"]],
  [/대장|forge|smith/iu, ["forge", "workshop"]],
  [/작업|workshop|공방/iu, ["workshop", "forge"]],
  [/연금|alchem|약방|약제/iu, ["alchemy", "pharmacy_shop"]],
  [/예배|chapel|성당|교회/iu, ["chapel"]],
  [/보물|treasur|금고/iu, ["treasury"]],
  [/무기|armory|병기/iu, ["armory", "weapon_shop"]],
  [/알현|왕좌|throne/iu, ["throne_room", "great_hall"]],
  [/대청|대연회|great ?hall|연회/iu, ["great_hall"]],
  [/현관|입구|entrance|로비|lobby/iu, ["entrance", "corridor"]],
  [/복도|corridor|hall ?way/iu, ["corridor"]],
  [/욕실|화장실|bath/iu, ["bathroom"]],
  [/감옥|감방|cell|jail/iu, ["cell", "guard_room"]],
  [/경비|guard/iu, ["guard_room"]],
  [/가게|상점|shop/iu, ["bakery_shop", "tailor_shop", "weapon_shop"]],
  [/빵/iu, ["bakery_shop", "bakery_oven"]],
];

function resolveKind(tilesetId: string, zone: ZoneSpec, notes: string[]): string {
  const kinds = new Set(roomTemplates(tilesetId).map((t) => t.kind));
  const raw = zone.kind.trim();
  if (kinds.has(raw)) return raw;
  const text = `${raw} ${zone.purpose ?? ""}`;
  for (const [re, options] of KIND_WORDS) if (re.test(text)) { const hit = options.find((k) => kinds.has(k)); if (hit) return hit; }
  const fallback = kinds.has("living") ? "living" : [...kinds][0] ?? "living";
  notes.push(`방 종류 「${raw}」의 견본이 없어 ${fallback} 견본으로 지었다`);
  return fallback;
}

/** 크기 낱말 → 견본 크기 배율. */
const SCALE: Record<string, number> = { small: 0.85, medium: 1, large: 1.3 };

/** 부품 사전에서 낱말에 맞는 가구 하나. 「큰/커다란」이면 가장 큰 것, 아니면 이름이 가장 잘 맞는 것. */
export function findPart(spec: HandInteriorSpec, word: string): { id: string; kind: string; w: number; h: number; stairs?: "up" | "down" } | undefined {
  const w = word.trim().toLowerCase();
  const big = /큰|커다란|거대|great|large|big/iu.test(w);
  const core = w.replace(/큰|커다란|거대한?|great|large|big|작은|small/giu, "").trim();
  const tokens = core.split(/[\s,·/]+/u).filter((t) => t.length >= 1);
  const scored: { id: string; score: number; area: number }[] = [];
  for (const [id, o] of Object.entries(spec.objects)) {
    const hay = `${id} ${o.ko} ${(o.tags ?? []).join(" ")}`.toLowerCase();
    let score = 0;
    if (o.ko.toLowerCase() === core || id === core) score += 10;
    for (const t of tokens) if (hay.includes(t)) score += t.length >= 2 ? 3 : 1;
    if (o.ko.toLowerCase().startsWith(core) || id.startsWith(core)) score += 2;
    if (score > 0) scored.push({ id, score, area: o.w * Math.max(1, o.h) });
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => (b.score - a.score) || (big ? b.area - a.area : a.area - b.area));
  // 「큰」: 낱말이 맞는 것 중 가장 큰 것(이름이 똑같은 작은 것보다 큰 판을 고른다).
  const best = big ? scored.filter((s) => s.score >= 3).sort((a, b) => b.area - a.area)[0] ?? scored[0]! : scored[0]!;
  const o = spec.objects[best.id]!;
  return { id: best.id, kind: o.kind, w: o.w, h: o.h, ...(o.stairs ? { stairs: o.stairs } : {}) };
}

/** 칸 점유 — 방 바닥(벽면 두 줄 아래) 중 가구·탁자가 막은 칸. */
function occupancy(spec: HandInteriorSpec, rb: Rebuild): Set<string> {
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
function argsFromRebuild(base: Record<string, unknown>, rb: Rebuild): Record<string, unknown> {
  const first = rb.rooms[0];
  return { ...base, layout: undefined, rooms: rb.rooms, connect: rb.connect ?? [], exit: rb.exit, objects: rb.objects, tables: rb.tables ?? [], goods: rb.goods ?? [], lines: rb.lines ?? [], daises: rb.daises ?? [],
    ...(first?.floor ? { floor: first.floor } : {}), ...(first?.wall ? { wall: first.wall } : {}), replace: true };
}

function clean(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
}

interface Attempt { ok: boolean; data?: Record<string, unknown>; summary: string }
function build(run: BuildRun, args: Record<string, unknown>): Attempt {
  const r = run.call("build_hand_interior_room", clean(args));
  return { ok: r.ok, data: r.data as Record<string, unknown> | undefined, summary: String(r.summary ?? "") };
}
const reachOk = (a: Attempt) => a.ok && Array.isArray(a.data?.unreachedFloor) && (a.data!.unreachedFloor as unknown[]).length === 0;

/** 칸막이 문틈(위·아래 방 사이) 바로 아래·위 칸 — 벽 가구를 걸 벽면이 없다. */
function openingColumns(rb: Rebuild, data?: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const o of (data?.openings as { x: number; y: number; kind?: string }[] | undefined) ?? []) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 3; dy++) out.add(`${o.x + dx},${o.y + dy}`);
  void rb;
  return out;
}

/** 물건이 덮는 칸(앞 한 줄 포함). */
function footprint(spec: HandInteriorSpec, o: Obj): string[] {
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
function placeAnchor(run: BuildRun, spec: HandInteriorSpec, current: Record<string, unknown>, rb: Rebuild, roomId: string, part: NonNullable<ReturnType<typeof findPart>>, near?: { x: number; y: number }, evict = false, protectedIds: ReadonlySet<string> = new Set(), openings?: Set<string>): { args: Record<string, unknown>; rb: Rebuild } | undefined {
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
const SETS: readonly [RegExp, readonly Obj[]][] = [
  [/tavern|dining|great_hall|inn/u, [{ id: "dining 2x1", x: 0, y: 1 }, { id: "chair S", x: 0, y: 0 }, { id: "chair S", x: 1, y: 0 }, { id: "chair N", x: 0, y: 2 }, { id: "chair N", x: 1, y: 2 }]],
  [/library|study/u, [{ id: "desk 2x1", x: 0, y: 1 }, { id: "chair N", x: 0, y: 2 }, { id: "round rug", x: 0, y: 1 }]],
  [/bedroom|inn_room|living/u, [{ id: "round rug", x: 0, y: 0 }, { id: "armchair", x: 2, y: 0 }]],
  [/storeroom|cellar|pantry|kitchen/u, [{ id: "barrel", x: 0, y: 0 }, { id: "crate", x: 1, y: 0 }, { id: "barrel", x: 0, y: 1 }]],
  [/.*/u, [{ id: "rug red", x: 0, y: 0 }, { id: "armchair", x: 3, y: 0 }]],
];

/** 빈 바닥 덩이(1배 2×2 이상 맨바닥)를 그 방의 쓰임 한 벌로 메운다. 측정은 v1 의 보정된 자(bareFloor.ts). */
function fillBare(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, rb: Rebuild, roomKinds: Map<string, string>, limit: number): { args: Record<string, unknown>; rb: Rebuild; filled: number } {
  let filled = 0;
  for (let round = 0; round < 6; round++) {
    const map = run.ctx.project.maps[String(args.mapId)];
    if (!map) break;
    const bare = measureInteriorBareFloor(run.ctx.project, map);
    if (!bare || bare.pct <= limit) break;
    const region = [...bare.regions].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (!region || region.w < 2 || region.h < 2) break;
    const cx = region.x + Math.floor(region.w / 2) - 1, cy = region.y + Math.floor(region.h / 2) - 1;
    const room = rb.rooms.find((r) => cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1);
    if (!room) break;
    const kind = roomKinds.get(room.id) ?? room.id;
    const set = (SETS.find(([re]) => re.test(kind)) ?? SETS[SETS.length - 1]!)[1].filter((o) => spec.objects[o.id]);
    if (!set.length) break;
    let placed = false;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]] as const) {
      const objects = [...rb.objects, ...set.map((o) => ({ id: o.id, x: cx + dx + o.x, y: cy + dy + o.y }))];
      const next = { ...args, objects };
      const res = build(run, next);
      if (reachOk(res) && !(res.data?.warnings as string[] | undefined ?? []).some((w) => /겹|overlap/u.test(w))) { args = next; rb = { ...rb, objects }; filled++; placed = true; break; }
    }
    if (!placed) break;
  }
  // 마지막 시도가 실패했을 수 있다 — 지금 인자로 맵을 맞춘다.
  build(run, args);
  return { args, rb, filled };
}

const COSY = ["fur rug", "armchair", "potted plant", "candle stand", "round rug", "tall vase red", "bookshelf 1w", "firewood bundle"];

export const INTERIOR_CARD = `[실내 interior] make_place({type:"interior", name, style?, size?, zones:[{kind, purpose, anchors?}], floors?}).
- zones = 방 하나하나(칸막이로 나뉜 방). kind 낱말: tavern(선술집 홀)·kitchen·storeroom·cellar·bedroom·inn_room(객실)·study(서재)·library(서고)·living·dining·forge(대장간)·workshop·alchemy·chapel·treasury·armory·throne_room·great_hall·entrance·corridor·bathroom·cell. 한국어 낱말도 된다.
- anchors = 그 방의 주인공 물건(낱말): 「큰 망원경」「벽난로」「바 카운터」「책장」「별자리표」「올라가는 계단」. 크면 「큰」을 붙인다. 함수가 부품 사전에서 찾아 빈 자리에 놓고, 못 찾으면 없다고 알려 준다.
- 「2층·위층 계단」이 필요하면 anchors 에 "올라가는 계단"을 넣고 floors:2 — 위층을 짓고 계단끼리 이어 준다.
- style: fantasy(기본) · wizarding(마법 학교) · sengoku(전국·에도) · modern(현대 도시). 일본 현대 집은 type:"house".
- 천문대는 kind "study" 하나(size large) + anchors ["큰 망원경","별자리표","책장"] 처럼 쓴다.`;

export const interiorBuilder: PlaceBuilder = {
  id: "interior",
  accepts: (spec) => spec.type === "interior",
  build(run, spec, previous) {
    const notes: string[] = [];
    const missing: string[] = [];
    const prev = previous?.result.state as InteriorState | undefined;
    const tilesetId = prev?.tilesetId ?? tilesetFor(spec.style);
    const roomSpec = roomSpecOf(run.ctx.project.tilesets[tilesetId]);
    if (!roomSpec) return { ok: false, mapIds: [], summary: `실내 칩셋 ${tilesetId} 이 이 프로젝트에 없다`, warnings: [], missingArt: [spec.name], calls: run.calls };
    const mapId = prev?.mapId ?? spec.mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
    const zones = spec.zones?.length ? spec.zones : [{ kind: spec.name, purpose: spec.name }];
    const scale = SCALE[spec.size ?? "medium"] ?? 1;
    const used = new Map<string, number>();
    const rooms = zones.filter((z) => !z.floor || z.floor === 1).map((zone) => {
      const kind = resolveKind(tilesetId, zone, notes);
      const n = (used.get(kind) ?? 0) + 1; used.set(kind, n);
      // 크기: small = 가장 작은 견본, medium = 가운데, large = 가장 큰 견본 × 1.3. 큰 주인공 물건이 들어갈 만큼은 넓힌다.
      const ts = roomTemplates(tilesetId).filter((tt) => tt.kind === kind).sort((a, b) => a.w * a.h - b.w * b.h);
      const t = spec.size === "small" ? ts[0] : spec.size === "large" ? ts[ts.length - 1] : ts[Math.floor((ts.length - 1) / 2)];
      const need = (zone.anchors ?? []).map((a) => findPart(roomSpec, a)).filter((p): p is NonNullable<typeof p> => !!p && p.kind !== "hang");
      const minW = Math.max(0, ...need.map((p) => p.w + 4)), minH = Math.max(0, ...need.map((p) => Math.max(1, p.h) + 6));
      const sized = t ? { w: Math.max(minW, Math.round(t.w * (spec.size === "large" ? scale : 1))), h: Math.max(minH, Math.round(t.h * (spec.size === "large" ? scale : 1))) } : minW ? { w: minW, h: minH } : {};
      return { id: zone.id ?? (n > 1 ? `${kind}${n}` : kind), kind, ...sized, zone };
    });
    const hints = spec.hints ?? {};
    const variant = typeof hints.variant === "number" ? hints.variant : 0;
    const seed = typeof hints.seed === "number" ? hints.seed : undefined;
    const base: Record<string, unknown> = { tileset: tilesetId, mapId, name: spec.name, replace: true,
      layout: { rooms: rooms.map(({ id, kind, w, h }) => clean({ id, kind, w, h })), ...(variant ? { variant } : {}), ...(seed ? { seed } : {}) } };
    let first = build(run, base);
    if (!first.ok) {
      // 맵이 다른 칩셋의 살아 있는 맵이면 새 맵으로 짓는다(덮어쓰지 않는다).
      const fresh = { ...base, mapId: undefined, replace: undefined };
      first = build(run, fresh);
      if (!first.ok) return { ok: false, mapIds: [], summary: `실내를 짓지 못했다: ${first.summary}`, warnings: notes, missingArt: missing, calls: run.calls };
    }
    const builtMapId = String(first.data?.mapId ?? mapId);
    let rb = first.data?.rebuild as Rebuild;
    let args = argsFromRebuild({ tileset: tilesetId, mapId: builtMapId, name: spec.name }, rb);
    const placed: { zone: string; what: string; id: string }[] = [];
    const openings = openingColumns(rb, first.data);
    const anchorKeys = new Set<string>();
    const protect = () => anchorKeys;
    let stairsUp: { id: string; x: number; y: number; w: number } | undefined;
    // 주인공 물건.
    for (const room of rooms) for (const what of room.zone.anchors ?? []) {
      const part = findPart(roomSpec, /계단|stair/iu.test(what) && /올라|위층|2층|up/iu.test(what) ? "stairs up wood" : what);
      if (!part) { missing.push(`${what}(${room.id}) — 부품 사전에 없다`); continue; }
      if (rb.objects.some((o) => o.id === part.id) && !/계단|stair/iu.test(what)) { placed.push({ zone: room.id, what, id: part.id }); continue; }
      const done = placeAnchor(run, roomSpec, args, rb, room.id, part, undefined, true, protect(), openings);
      if (!done) { missing.push(`${what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
      args = done.args; rb = done.rb; placed.push({ zone: room.id, what, id: part.id });
      const last = rb.objects[rb.objects.length - 1]!; anchorKeys.add(`${last.id}@${last.x},${last.y}`);
      if (part.stairs === "up" || /stairs up/u.test(part.id)) { const o = rb.objects[rb.objects.length - 1]!; stairsUp = { id: part.id, x: o.x, y: o.y, w: part.w }; }
    }
    // 꾸밈 정도(아늑하게): 방마다 빈 자리에 아늑한 소품을 한두 점.
    const dressing = typeof hints.dressing === "number" ? hints.dressing : 0;
    if (dressing > 0) for (const room of rooms) {
      let added = 0;
      for (const word of COSY) {
        if (added >= dressing * 2) break;
        const part = roomSpec.objects[word] ? { id: word, kind: roomSpec.objects[word]!.kind, w: roomSpec.objects[word]!.w, h: roomSpec.objects[word]!.h } : findPart(roomSpec, word);
        if (!part) continue;
        const done = placeAnchor(run, roomSpec, args, rb, room.id, part, undefined, false, protect(), openings);
        if (done) { args = done.args; rb = done.rb; added++; }
      }
    }
    // 빈 바닥 덩이 메우기(쓰임 한 벌) — 1배에서 「휑한 홀」이 v1 의 가장 흔한 major 였다.
    const kinds = new Map(rooms.map((r) => [r.id, r.kind] as const));
    build(run, args);
    const filled = fillBare(run, roomSpec, args, rb, kinds, INTERIOR_BARE_FLOOR_LIMIT);
    args = filled.args; rb = filled.rb;
    if (filled.filled) notes.push(`빈 바닥 덩이 ${filled.filled}곳을 방 쓰임에 맞는 가구 한 벌로 채웠다`);
    // 위층과 계단.
    const mapIds = [builtMapId];
    let upperMapId = prev?.upperMapId;
    let upperArgs: Record<string, unknown> | undefined;
    if (stairsUp) {
      const upperZones = (spec.zones ?? []).filter((z) => z.floor === 2);
      const upKinds = upperZones.length ? upperZones.map((z) => resolveKind(tilesetId, z, notes)) : ["inn_room", "inn_room", "corridor"].filter((k) => roomTemplates(tilesetId).some((t) => t.kind === k));
      const upBase: Record<string, unknown> = { tileset: tilesetId, ...(upperMapId ? { mapId: upperMapId, replace: true } : {}), name: `${spec.name} 2층`,
        layout: { rooms: (upKinds.length ? upKinds : ["bedroom"]).map((kind, i) => ({ id: `${kind}${i + 1}`, kind })) } };
      const up = build(run, upBase);
      if (up.ok) {
        upperMapId = String(up.data?.mapId);
        let urb = up.data?.rebuild as Rebuild;
        let uargs = argsFromRebuild({ tileset: tilesetId, mapId: upperMapId, name: `${spec.name} 2층` }, urb);
        const down = findPart(roomSpec, "stairwell down");
        const hub = urb.rooms.find((r) => /corridor|hall/u.test(r.id)) ?? urb.rooms[0]!;
        const placedDown = down ? placeAnchor(run, roomSpec, uargs, urb, hub.id, down, undefined, true, new Set(), openingColumns(urb, up.data)) : undefined;
        if (placedDown) {
          uargs = placedDown.args; urb = placedDown.rb;
          const d = urb.objects[urb.objects.length - 1]!;
          // 위층 계단통 → 아래층 계단 앞, 아래층 계단 → 위층 계단통 앞. 칸은 도구의 계단 계약(fitStairTransfers)이 맞춘다.
          uargs = { ...uargs, links: [{ x: d.x + 1, y: d.y, toMapId: builtMapId, toX: stairsUp.x + 1, toY: stairsUp.y + 1, direction: "down" }] };
          const upFinal = build(run, uargs);
          if (upFinal.ok) {
            args = { ...args, links: [{ x: stairsUp.x + 1, y: stairsUp.y, toMapId: upperMapId, toX: d.x + 1, toY: d.y + 2, direction: "up" }] };
            upperArgs = uargs;
            mapIds.push(upperMapId);
          } else missing.push(`위층 계단 잇기 실패: ${upFinal.summary.slice(0, 120)}`);
        } else missing.push("위층 내려가는 계단통 자리를 못 찾았다");
      } else missing.push(`위층을 짓지 못했다: ${up.summary.slice(0, 120)}`);
    }
    const final = build(run, args);
    if (!final.ok) return { ok: false, mapIds, summary: `마지막 짓기 실패: ${final.summary}`, warnings: notes, missingArt: missing, calls: run.calls };
    if (spec.exits?.some((e) => e !== "south")) missing.push(`${spec.exits.filter((e) => e !== "south").join("·")} 출구 — 손 도트 실내 도구는 남쪽 출구만 낸다(뒷문은 바깥 맵이 생긴 뒤 문 기물+이동 이벤트로 잇는다)`);
    const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
    const state: InteriorState = { tilesetId, mapId: builtMapId, args, ...(upperMapId ? { upperMapId } : {}), ...(upperArgs ? { upperArgs } : {}), placed };
    const result: PlaceBuildResult = {
      ok: true, mapIds,
      ...(entrance ? { entrance: { mapId: builtMapId, ...entrance } } : {}),
      summary: `${spec.name}: 방 ${rooms.length}개(${rooms.map((r) => r.kind).join("·")})${placed.length ? `, 주인공 물건 ${placed.map((p) => `${p.what}→${p.id}`).join(", ")}` : ""}${upperMapId && mapIds.includes(upperMapId) ? `, 위층 ${upperMapId} 계단으로 이음` : ""} — ${final.summary.slice(0, 200)}`,
      warnings: [...notes, ...((final.data?.warnings as string[] | undefined) ?? []).slice(0, 6)],
      missingArt: missing, calls: run.calls, state,
    };
    return result;
  },
};

/** 고치기: 앞 상태(마지막 인자)에서 출발해 주인공 물건만 더한다(방 배치는 그대로). */
export function interiorAddAnchors(run: BuildRun, record: PlaceRecord, adds: readonly { zone?: string; what: string; near?: { x: number; y: number } }[]): PlaceBuildResult {
  const state = record.result.state as InteriorState;
  const roomSpec = roomSpecOf(run.ctx.project.tilesets[state.tilesetId])!;
  let args = state.args;
  let rb: Rebuild = { rooms: args.rooms as Room[], connect: args.connect as unknown[], exit: args.exit, objects: [...(args.objects as Obj[])], tables: args.tables as Rebuild["tables"], goods: args.goods as Obj[], lines: args.lines as unknown[], daises: args.daises as unknown[] };
  const missing: string[] = [];
  const placed = [...state.placed];
  for (const add of adds) {
    const part = findPart(roomSpec, add.what);
    if (!part) { missing.push(`${add.what} — 부품 사전에 없다`); continue; }
    const room = rb.rooms.find((r) => r.id === add.zone || r.id.startsWith(add.zone ?? "\u0000")) ?? (add.near ? rb.rooms.find((r) => add.near!.x >= r.x0 && add.near!.x <= r.x1 && add.near!.y >= r.y0 && add.near!.y <= r.y1) : undefined) ?? rb.rooms[0]!;
    const done = placeAnchor(run, roomSpec, args, rb, room.id, part, add.near, true);
    if (!done) { missing.push(`${add.what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
    args = done.args; rb = done.rb; placed.push({ zone: room.id, what: add.what, id: part.id });
  }
  const final = build(run, args);
  return { ok: final.ok, mapIds: record.result.mapIds, ...(record.result.entrance ? { entrance: record.result.entrance } : {}),
    summary: `${record.spec.name}: 더한 물건 ${placed.slice(state.placed.length).map((p) => p.id).join(", ") || "없음"} — ${final.summary.slice(0, 160)}`,
    warnings: [], missingArt: missing, calls: run.calls, state: { ...state, args, placed } };
}
