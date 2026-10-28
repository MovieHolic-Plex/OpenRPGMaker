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
import { interiorVenues, type InteriorVenue, type VenueStamp } from "./interiorVenues";
import { kindServesPurpose, purposeOf, purposeSwap } from "../roomPurpose";

type Obj = { id: string; x: number; y: number };
type Room = { id: string; x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string };
interface Rebuild { rooms: Room[]; connect?: unknown[]; exit?: unknown; objects: Obj[]; tables?: { style: string; x: number; y: number; w: number; h: number }[]; goods?: Obj[]; lines?: unknown[]; daises?: unknown[] }
interface InteriorState { readonly tilesetId: string; readonly mapId: string; readonly args: Record<string, unknown>; readonly upperMapId?: string; readonly upperArgs?: Record<string, unknown>; readonly placed: readonly { zone: string; what: string; id: string }[]; readonly stamps?: readonly VenueStamp[]; readonly venue?: string; readonly backDoor?: { readonly mapId: string; readonly args: Record<string, unknown> }; readonly adopted?: { readonly tilesetId: string; readonly args: Record<string, unknown>; readonly rooms: readonly { id: string; kind: string }[] } }

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

/** 쓰임 안의 방 낱말 → 방 종류 id 조각(학교의 교무실 → school-staffroom, 병원의 진료실 → cl-exam). */
const SUBKIND_WORDS: readonly [RegExp, string][] = [
  [/교무실|staff ?room/iu, "staff"], [/보건실|양호실|infirmary/iu, "infirmary"], [/음악실|밴드|band|music/iu, "band"], [/과학실|실험실|science|lab/iu, "sci"],
  [/교실|classroom/iu, "class"], [/현관|신발장|genkan/iu, "genkan"], [/계단|stair/iu, "stair"], [/복도|corridor|hall ?way/iu, "corridor"],
  [/병실|병동|ward/iu, "ward"], [/간호|nurse/iu, "nurse"], [/응급|emergency|er/iu, "er"], [/진료|진찰|exam/iu, "exam"], [/대기|waiting|lobby/iu, "wait"],
  [/제의실|vestry/iu, "vestry"], [/서재|study/iu, "study"],
];
/** 목적 문장이 집 방 자체를 말하는가(「주인 침실」「뒤쪽 부엌」) — 그러면 집 방 kind 를 그대로 둔다. */
const HOME_ROOM_WORDS = /침실|침대|잠자|부엌|주방|창고|광|지하실|욕실|화장실|식당|bed ?room|kitchen|storage|store ?room|cellar|bath|dining/iu;
/** 집 방 종류 중 «어느 건물에나 있는» 것 — 구역 목적 낱말이 다른 쓰임(가게·교실·예배당)을 말하면 그 쓰임이 이긴다. 침실·부엌·창고는 그대로 둔다. */
const GENERIC_KINDS = /^(entrance|living|hall|corridor|study|dining|great_hall|lobby|waiting_room|room|main|common)$/u;

function resolveKind(tilesetId: string, zone: ZoneSpec, notes: string[], placeName = "", single = false): string {
  const kinds = new Set(roomTemplates(tilesetId).map((t) => t.kind));
  const raw = zone.kind.trim();
  // 쓰임 낱말이 집 방 종류보다 먼저다 — 장난감 가게 홀이 «entrance», 교실이 «study» 로 와서 그 방의 견본 가구와 거실 한 벌을 받았고,
  // 현대 학교는 방 다섯이 living·bedroom 이 됐다(2026-10-25 J31·J42·J64).
  //  · 구역 kind·id 의 낱말이 쓰임이면 언제나 그 쓰임 견본.
  //  · 구역 목적(purpose) 문장이 쓰임이면 kind 가 일반 방(현관·거실·복도·서재…)이거나 이 칩셋에 없을 때만(«가게 뒤 침실»은 침실).
  //  · 구역에 쓰임이 없으면 장소 이름의 쓰임(학교 본관의 «복도» → school-corridor) — kind 가 이 칩셋에 없을 때만.
  //  · kind 가 일반 방(study·hall…)이면 목적 문장이 kind 낱말보다 먼저다 — 「study / 교무실」이 서고가 됐다.
  //  · kind 가 집 방(bedroom·kitchen…)이어도 목적 문장이 그 집 방을 말하지 않으면(「bedroom / 보건실」) 목적 문장의 쓰임 — 학교에 더블 침대가 깔렸다(J64).
  const sentence = purposeOf(zone.purpose ?? "");
  const named = purposeOf(`${raw} ${zone.id ?? ""}`.replace(/[_-]/gu, " "));
  const homeSaid = HOME_ROOM_WORDS.test(zone.purpose ?? "");
  const sentenceWins = !!sentence && (GENERIC_KINDS.test(raw) || !kinds.has(raw) || (GENERIC_HOME.test(raw) && !homeSaid));
  const told = sentenceWins ? sentence : named ?? (sentence && !GENERIC_HOME.test(raw) ? sentence : undefined);
  const ctx = told ? undefined : purposeOf(placeName);
  const purpose = told ?? (ctx && (!kinds.has(raw) || (single && GENERIC_KINDS.test(raw))) ? ctx : undefined);
  if (purpose && !kindServesPurpose(raw, purpose, tilesetId)) {
    const list = (purpose.kinds[tilesetId] ?? []).filter((k) => kinds.has(k));
    const token = raw.toLowerCase().replace(/[^a-z]/gu, "");
    const said = `${zone.purpose ?? ""} ${zone.id ?? ""} ${raw}`;
    const sub = SUBKIND_WORDS.filter(([re]) => re.test(said)).map(([, t]) => t);
    const hit = sub.map((t) => list.find((k) => k.includes(t))).find(Boolean)
      ?? (token.length >= 4 ? list.find((k) => k.replace(/[^a-z]/gu, "").includes(token)) : undefined) ?? list[0];
    if (hit) { if (hit !== raw) notes.push(`구역 「${zone.id ?? raw}」은 ${purpose.ko} 쓰임이라 방 종류 ${raw} 대신 ${hit} 견본으로 지었다`); return hit; }
  }
  if (kinds.has(raw)) return raw;
  const text = `${raw} ${zone.purpose ?? ""}`;
  for (const [re, options] of KIND_WORDS) if (re.test(text)) { const hit = options.find((k) => kinds.has(k)); if (hit) return hit; }
  // 쓰임을 아는데 이 칩셋에 그 견본이 없으면 거실로 떨어지지 않게 가장 덜 «집» 같은 방(현관·복도)으로 — 거실 견본은 소파·냉장고를 깐다.
  const known = told ?? ctx;
  const neutral = known ? ["entrance", "corridor", "hall", "lobby", "waiting_room", "storeroom"].find((k) => kinds.has(k)) : undefined;
  const fallback = neutral ?? (kinds.has("living") ? "living" : [...kinds][0] ?? "living");
  notes.push(`방 종류 「${raw}」의 견본이 없어 ${fallback} 견본으로 지었다${known ? ` — ${known.ko} 견본이 이 칩셋에 없다` : ""}`);
  return fallback;
}

/** 견본 가구만 놓인 첫 짓기의 맨바닥이 이보다 넓으면 큰 방을 줄여 다시 짓는다(빈 바닥 메우기 전에). */
const SHRINK_BARE_PCT = 35;
/** 짓기가 쓰임 한 벌로 메우는 목표 — 끝맺음 검사(checks.ts bare-floor)가 문제 삼는 선(기준 15 + 여유 5)까지만. 그 아래로 메우면 과밀해진다. */
const FILL_BARE_PCT = INTERIOR_BARE_FLOOR_LIMIT + 5;

/** 크기 낱말 → 견본 크기 배율. */
const SCALE: Record<string, number> = { small: 0.85, medium: 1, large: 1.3 };

/** 사람이 흔히 쓰는 말 → 부품 사전의 말(ko 이름은 「깔개」「발깔개」처럼 쓴다). */
const SYNONYMS: readonly [RegExp, string][] = [
  [/발\s*매트|도어\s*매트|현관\s*매트/u, "발깔개"], [/러그|카펫|양탄자/u, "깔개 rug"], [/촛불|양초/u, "촛대"],
  [/테이블/u, "탁자"], [/소파/u, "안락의자"], [/책꽂이/u, "책장"],
];

/** 부품 사전에서 낱말에 맞는 가구 하나. 「큰/커다란」이면 가장 큰 것, 아니면 이름이 가장 잘 맞는 것. */
export function findPart(spec: HandInteriorSpec, word: string): { id: string; kind: string; w: number; h: number; stairs?: "up" | "down" } | undefined {
  let w = word.trim().toLowerCase();
  // 출입문은 가구가 아니다(손 도트 실내는 남쪽 틈이 문) — 「문」이 「문장 방패」에 걸려 방패가 놓였다(2026-10-23 v2 고치기).
  if (/^(뒷|앞|옆|나무 |작은 )?문$|^door$|back ?door|뒷문|출입문/u.test(w)) return undefined;
  for (const [re, to] of SYNONYMS) w = w.replace(re, to);
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
  // 한 글자 낱말만 맞은 것(점수 1~2)은 우연이다 — 버린다.
  for (let i = scored.length - 1; i >= 0; i--) if (scored[i]!.score < 3) scored.splice(i, 1);
  if (!scored.length) return undefined;
  scored.sort((a, b) => (b.score - a.score) || (big ? b.area - a.area : a.area - b.area));
  // 「큰」: 낱말이 맞는 것 중 가장 큰 것(이름이 똑같은 작은 것보다 큰 판을 고른다).
  const best = big ? scored.filter((s) => s.score >= 3).sort((a, b) => b.area - a.area)[0] ?? scored[0]! : scored[0]!;
  const o = spec.objects[best.id]!;
  return { id: best.id, kind: o.kind, w: o.w, h: o.h, ...(o.stairs ? { stairs: o.stairs } : {}) };
}

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
/** 집 방 — 그 방 종류의 한 벌(침실은 침실 한 벌)을 쓴다. 가게 건물 안 침실이 가게 한 벌을 받지 않게. */
const GENERIC_HOME = /^(bedroom|inn_room|master_bedroom|kitchen|pantry|storeroom|cellar|bathroom|dining)$/u;

/** 빈 바닥 덩이(1배 2×2 이상 맨바닥)를 그 방의 쓰임 한 벌로 메운다. 측정은 v1 의 보정된 자(bareFloor.ts). */
function fillBare(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, rb: Rebuild, roomKinds: Map<string, string>, limit: number, context = ""): { args: Record<string, unknown>; rb: Rebuild; filled: number } {
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
function pickTemplate(tilesetId: string, kind: string, size: string | undefined) {
  const ts = roomTemplates(tilesetId).filter((t) => t.kind === kind);
  const own = ts.filter((t) => t.map === kind);
  const plain = ts.filter((t) => !EXOTIC_MAPS.has(t.map));
  const pool = [...(own.length ? own : plain.length ? plain : ts)].sort((a, b) => a.w * a.h - b.w * b.h);
  if (!pool.length) return undefined;
  return size === "small" ? pool[0] : size === "large" ? pool[pool.length - 1] : pool[Math.floor((pool.length - 1) / 2)];
}

/** 이미 지어진 맵의 바닥·벽면 재질 id(칩셋 사양의 타일 목록에서 찾는다) — 고치기가 원래 재질을 지키게. */
function materialAt(spec: HandInteriorSpec, tiles: readonly (number | null | undefined)[], width: number, x: number, y: number, family: "floors" | "walls"): string | undefined {
  const t = tiles[y * width + x];
  if (t === undefined || t === null || t < 0) return undefined;
  for (const [id, def] of Object.entries((spec as unknown as Record<string, Record<string, { tiles?: number[] }>>)[family] ?? {})) if (def.tiles?.includes(t)) return id;
  return undefined;
}
export function roomMaterials(spec: HandInteriorSpec, map: { width: number; lowerTiles: readonly (number | null | undefined)[] }, rect: { x: number; y: number; w: number; h: number }): { floor?: string; wall?: string } {
  const cx = rect.x + Math.floor(rect.w / 2);
  const floor = materialAt(spec, map.lowerTiles, map.width, cx, rect.y + Math.min(rect.h - 1, 3), "floors") ?? materialAt(spec, map.lowerTiles, map.width, cx, rect.y + rect.h - 1, "floors");
  const wall = materialAt(spec, map.lowerTiles, map.width, cx, rect.y + 1, "walls") ?? materialAt(spec, map.lowerTiles, map.width, cx, rect.y, "walls");
  return { ...(floor ? { floor } : {}), ...(wall ? { wall } : {}) };
}

/** 평면(plan) 견본 위에 물건 하나 — '.' 칸 중 비어 있고 앞 한 줄이 빈 자리(출구 줄·출구 열은 피한다), 도달 검사를 통과하는 첫 자리. */
function placeInPlan(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, part: NonNullable<ReturnType<typeof findPart>>): Record<string, unknown> | undefined {
  const plan = args.plan as string[];
  const used = occupancy(spec, { rooms: [], objects: (args.objects as Obj[]) ?? [], tables: args.tables as Rebuild["tables"] });
  const floorAt = (x: number, y: number) => plan[y]?.[x] === ".";
  const exitXs = new Set<number>(); plan[plan.length - 1]!.split("").forEach((c, x) => { if (c === ".") exitXs.add(x); });
  const h = Math.max(1, part.h);
  const cands: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < plan.length - 2; y++) for (let x = 0; x < plan[0]!.length; x++) {
    let ok = true;
    for (let j = 0; j < h + (part.kind === "flat" ? 0 : 1) && ok; j++) for (let i = 0; i < part.w && ok; i++) {
      const X = x + i, Y = y + j;
      if (!floorAt(X, Y) || used.has(`${X},${Y}`) || exitXs.has(X) && Y >= plan.length - 4) ok = false;
    }
    if (!ok) continue;
    const wallAbove = !floorAt(x, y - 1) || !floorAt(x + part.w - 1, y - 1);
    cands.push({ x, y, d: (wallAbove ? 0 : 3) + Math.abs(x - plan[0]!.length / 2) * 0.05 });
  }
  cands.sort((a, b) => a.d - b.d);
  for (const at of cands.slice(0, 14)) {
    const next = { ...args, objects: [...((args.objects as Obj[]) ?? []), { id: part.id, x: at.x, y: at.y }] };
    if (reachOk(build(run, next))) return next;
  }
  return undefined;
}

/** 장소 견본 위에 물건 하나 — 평면 견본은 평면 빈 자리, 방 사각형 견본은 첫 방의 빈 자리. */
function placeInVenue(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, part: NonNullable<ReturnType<typeof findPart>>): Record<string, unknown> | undefined {
  if (Array.isArray(args.plan)) return placeInPlan(run, spec, args, part);
  const rooms = args.rooms as Room[] | undefined;
  if (!rooms?.length) return undefined;
  const rb: Rebuild = { rooms, connect: args.connect as unknown[], exit: args.exit, objects: [...((args.objects as Obj[]) ?? [])], tables: args.tables as Rebuild["tables"], goods: args.goods as Obj[], lines: args.lines as unknown[], daises: args.daises as unknown[] };
  return placeAnchor(run, spec, args, rb, rooms[0]!.id, part, undefined, false)?.args;
}

/** 견본 위에 덧찍는 그림(둥근 지붕·관측 틈) — 짓기마다 다시 찍는다(짓기가 맵을 새로 그린다). */
function applyStamps(run: BuildRun, tilesetId: string, mapId: string, stamps: readonly VenueStamp[] | undefined): void {
  for (const s of stamps ?? []) run.call("stamp_object", { objectId: `kit:${tilesetId}/hand-interior:${s.part}`, mapId, x: s.x, y: s.y });
}

/** 장소 견본(천문대 등)으로 짓기. 요청 앵커 중 견본이 갖춘 것은 그대로, 없는 것은 평면 빈 자리에 더한다. */
function buildVenue(run: BuildRun, spec: PlaceSpec, venue: InteriorVenue, roomSpec: HandInteriorSpec, tilesetId: string, mapId: string | undefined, prev: InteriorState | undefined): PlaceBuildResult | undefined {
  const variant = typeof spec.hints?.variant === "number" ? spec.hints.variant : (spec.salt ?? 0) % 4;
  const words = (spec.zones ?? []).flatMap((z) => z.anchors ?? []);
  const withStairs = !!venue.stairs && ((spec.floors ?? 1) >= 2 || words.some((w) => /계단|stair|2층|위층/iu.test(w)) || (spec.zones ?? []).some((z) => z.floor === 2));
  const vb = venue.build(variant, withStairs);
  let args: Record<string, unknown> = { tileset: tilesetId, mapId: prev?.mapId ?? mapId, name: spec.name, replace: (prev?.mapId ?? mapId) ? true : undefined, ...vb.args };
  let res = build(run, args);
  if (!res.ok) { args = { ...args, mapId: undefined, replace: undefined }; res = build(run, args); }
  if (!res.ok) return undefined;
  const builtMapId = String(res.data?.mapId ?? mapId);
  args = { ...args, mapId: builtMapId, replace: true };
  const placed: { zone: string; what: string; id: string }[] = [];
  const missing: string[] = [];
  for (const zone of (spec.zones ?? []).filter((z) => (z.floor ?? 1) === 1)) for (const what of zone.anchors ?? []) {
    if (venue.provides.some((re) => re.test(what))) { placed.push({ zone: venue.id, what, id: `(견본) ${what}` }); continue; }
    const part = findPart(roomSpec, what);
    if (!part) { missing.push(`${what} — 부품 사전에 없다`); continue; }
    const next = placeInVenue(run, roomSpec, args, part);
    if (next) { args = next; placed.push({ zone: venue.id, what, id: part.id }); } else missing.push(`${what} — 놓을 빈 자리가 없다`);
  }
  // 계단이 든 견본이면 위층을 짓고 잇는다(어디로도 안 가는 계단은 그리지 않는다).
  const mapIds = [builtMapId];
  let upperMapId: string | undefined, upperArgs: Record<string, unknown> | undefined;
  const notes: string[] = [];
  if (vb.stairs) {
    const up = buildUpperFloor(run, roomSpec, tilesetId, spec, builtMapId, vb.stairs, prev?.upperMapId, missing, notes, placed);
    if (up.lowerLink && up.upperMapId) { args = { ...args, links: [up.lowerLink] }; upperMapId = up.upperMapId; upperArgs = up.upperArgs; mapIds.push(up.upperMapId); }
  }
  const final = build(run, args);
  if (!final.ok) return undefined;
  applyStamps(run, tilesetId, builtMapId, vb.stamps);
  const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
  if (spec.exits?.some((e) => e !== "south")) missing.push(`${spec.exits.filter((e) => e !== "south").join("·")} 출구 — 이 장소 견본은 남쪽 출구 하나다`);
  const state: InteriorState = { tilesetId, mapId: builtMapId, args, placed, stamps: vb.stamps, venue: venue.id, ...(upperMapId ? { upperMapId } : {}), ...(upperArgs ? { upperArgs } : {}) };
  return { ok: true, mapIds, ...(entrance ? { entrance: { mapId: builtMapId, ...entrance } } : {}),
    summary: `${spec.name}: 장소 견본 「${venue.id}」(검증된 제작자 구성${variant % 2 ? ", 좌우 뒤집음" : ""})으로 지었다 — 주인공 물건 ${placed.map((p) => p.what).join("·") || "없음"} — ${final.summary.slice(0, 160)}`,
    warnings: [...notes, ...((final.data?.warnings as string[] | undefined) ?? []).filter((w) => !/허공|천장 띠|ㅁ자/u.test(w)).slice(0, 4)], missingArt: missing, calls: run.calls, state };
}

/** 북쪽 뒷문: 맨 북쪽 바깥 벽 방의 벽면에 아치 문틀을 걸고, 그 아래 칸을 작은 뒷방 맵으로 잇는다(뒷방 남쪽 출구는 다시 이 문 앞으로).
 *  칩셋에 북벽 «문» 그림이 없어서 아치 문틀(round arch, 3칸)을 쓴다 — 계단·문 계약처럼 문 그림 + 그 아래 이동 칸 한 쌍이다. */
function addBackDoor(run: BuildRun, roomSpec: HandInteriorSpec, tilesetId: string, args: Record<string, unknown>, rb: Rebuild, mapId: string, name: string, prevBack: InteriorState["backDoor"], prefer: RegExp): { args: Record<string, unknown>; backDoor?: NonNullable<InteriorState["backDoor"]>; note: string } {
  // 문 그림: 벽 발치에 서는 나무 문(locked door, 쇠띠 두른 나무 문 1칸) > 아치 문틀. 1배 견본 비교(2026-10-23): 둥근 문은 술통 뚜껑으로, 아치는 벽 속 장식으로 읽혔다.
  const arch = roomSpec.objects["locked door"] ? "locked door" : roomSpec.objects["round arch"] ? "round arch" : undefined;
  if (!arch) return { args, note: "북쪽 뒷문 — 칩셋에 벽에 거는 문·아치 그림이 없다" };
  const standing = roomSpec.objects[arch]!.kind !== "hang";
  const part = { id: arch, kind: roomSpec.objects[arch]!.kind, w: roomSpec.objects[arch]!.w, h: roomSpec.objects[arch]!.h };
  const top = Math.min(...rb.rooms.map((r) => r.y0));
  const hosts = rb.rooms.filter((r) => r.y0 === top).sort((a, b) => Number(prefer.test(b.id)) - Number(prefer.test(a.id)) || (b.x1 - b.x0) - (a.x1 - a.x0));
  const hangUsed = new Set<string>();
  for (const o of rb.objects) { const d = roomSpec.objects[o.id.split(":")[0]!]; if (d?.kind === "hang") for (let i = 0; i < d.w; i++) hangUsed.add(`${o.x + i},${o.y}`); }
  // 뒷방(작은 창고) — 남쪽 출구가 이 문으로 돌아온다.
  const back = build(run, { tileset: tilesetId, ...(prevBack ? { mapId: prevBack.mapId, replace: true } : {}), name: `${name} 뒷방`, layout: { rooms: [{ kind: "storeroom", w: 7, h: 6 }] } });
  if (!back.ok) return { args, note: `북쪽 뒷문 — 뒷방을 짓지 못했다: ${back.summary.slice(0, 100)}` };
  const backId = String(back.data?.mapId);
  const backEnt = Array.isArray(back.data?.entrance) ? (back.data!.entrance as { x: number; y: number }[])[0] : undefined;
  if (!backEnt) return { args, note: "북쪽 뒷문 — 뒷방 출입구를 찾지 못했다" };
  for (const room of hosts) {
    const cx = Math.floor((room.x0 + room.x1) / 2);
    const xs = Array.from({ length: room.x1 - room.x0 - part.w + 2 }, (_, i) => room.x0 + i);
    // 문 앞 두 칸(문 아래 바닥 첫 줄·둘째 줄)을 막는 가구는 비켜 낸다(벽 가구 하나 정도) — 덜 비키는 자리, 가운데 가까운 자리부터.
    const ranked = xs.map((x) => {
      const doorX = x + Math.floor(part.w / 2), doorY = room.y0 + 2 + (standing ? 1 : 0);
      const blocks = new Set([`${doorX},${room.y0 + 2}`, `${doorX},${room.y0 + 3}`, `${doorX},${room.y0 + 4}`]);
      const victims = rb.objects.filter((o) => footprint(roomSpec, o).some((c) => blocks.has(c)) || (roomSpec.objects[o.id.split(":")[0]!]?.kind === "hang" && o.y === room.y0 && o.x <= x + part.w - 1 && x <= o.x + (roomSpec.objects[o.id.split(":")[0]!]?.w ?? 1) - 1));
      return { x, doorX, doorY, victims, cost: victims.length * 10 + Math.abs(doorX - cx) };
    }).filter((r) => !r.victims.some((v) => /stairs|stairwell/u.test(v.id))).sort((a, b) => a.cost - b.cost);
    void hangUsed;
    for (const { x, doorX, doorY, victims } of ranked.slice(0, 6)) {
      const gone = new Set(victims.map((v) => `${v.id}@${v.x},${v.y}`));
      const kept = ((args.objects as Obj[]) ?? []).filter((o) => !gone.has(`${o.id}@${o.x},${o.y}`));
      const links = [...((args.links as unknown[]) ?? []).filter((l) => (l as { toMapId?: string }).toMapId !== backId),
        { x: doorX, y: doorY, toMapId: backId, toX: backEnt.x, toY: backEnt.y - 1, direction: "up" }];
      // 서 있는 문은 바닥에 선 벽장처럼 읽혔다(눈가림 2차) — 벽면에 아치 문틀을 같이 걸어 「벽에 난 문」으로 읽히게(문틀이 안 들어가면 문만).
      const framed = standing && roomSpec.objects["round arch"] && x - 1 >= room.x0 ? [{ id: "round arch", x: x - 1, y: room.y0 }] : [];
      let next = { ...args, objects: [...kept.filter((o) => !(roomSpec.objects[o.id.split(":")[0]!]?.kind === "hang" && o.y === room.y0 && o.x <= x + 1 && o.x + (roomSpec.objects[o.id.split(":")[0]!]?.w ?? 1) - 1 >= x - 1) || !framed.length), ...framed, { id: arch, x, y: standing ? room.y0 + 2 : room.y0 }], links };
      let tryBuild = build(run, next);
      if (framed.length && !reachOk(tryBuild)) { next = { ...args, objects: [...kept, { id: arch, x, y: standing ? room.y0 + 2 : room.y0 }], links }; tryBuild = build(run, next); }
      if (!reachOk(tryBuild)) continue;
      let backArgs: Record<string, unknown> = { ...argsFromRebuild({ tileset: tilesetId, mapId: backId, name: `${name} 뒷방` }, back.data?.rebuild as Rebuild), links: [{ x: backEnt.x, y: backEnt.y, toMapId: mapId, toX: doorX, toY: doorY + 1, direction: "down" }] };
      const backFinal = build(run, backArgs);
      if (!backFinal.ok) continue;
      // 뒷방이 휑하지 않게 창고 쓰임 한 벌로 채운다.
      const backRb = { ...(back.data?.rebuild as Rebuild), objects: backArgs.objects as Obj[] };
      backArgs = fillBare(run, roomSpec, backArgs, backRb, new Map(backRb.rooms.map((r) => [r.id, "storeroom"] as const)), INTERIOR_BARE_FLOOR_LIMIT).args;
      build(run, next);
      return { args: next, backDoor: { mapId: backId, args: backArgs }, note: `북쪽 뒷문: ${room.id} 북벽 발치 (${x},${standing ? room.y0 + 2 : room.y0})에 ${arch}, 문 앞 (${doorX},${doorY})에서 뒷방 ${backId} 로 잇는다(뒷방 남쪽 출구로 돌아온다)` };
    }
  }
  return { args, note: "북쪽 뒷문 — 맨 북쪽 방 북벽에 문을 낼 자리가 없다" };
}

/** 위층 맵 이름 — 「저택 1층」이면 「저택 2층」(「저택 1층 2층」이 되지 않게). */
function upperName(name: string): string {
  return /\s*(1층|일층|1F|1st floor)\s*$/iu.test(name) ? name.replace(/\s*(1층|일층|1F|1st floor)\s*$/iu, " 2층") : `${name} 2층`;
}

/** 위층: 올라가는 계단이 놓인 아래층(builtMapId)에 위층을 짓고 계단끼리 잇는다. 아래층에 붙일 이동(lowerLink)을 돌려준다. */
function buildUpperFloor(run: BuildRun, roomSpec: HandInteriorSpec, tilesetId: string, spec: PlaceSpec, builtMapId: string, stairsUp: { id: string; x: number; y: number; w: number }, prevUpper: string | undefined, missing: string[], notes: string[], placed: { zone: string; what: string; id: string }[]): { upperMapId?: string; upperArgs?: Record<string, unknown>; lowerLink?: Record<string, unknown> } {
  let upperMapId = prevUpper;
  let upperArgs: Record<string, unknown> | undefined;
  let lowerLink: Record<string, unknown> | undefined;
    const upperZones = (spec.zones ?? []).filter((z) => z.floor === 2);
    const known = (k: string) => roomTemplates(tilesetId).some((t) => t.kind === k);
    let upKinds = upperZones.length ? upperZones.map((z) => resolveKind(tilesetId, z, notes, spec.name)) : ["inn_room", "inn_room", "corridor"].filter(known);
    // 위층에는 계단통을 놓을 복도·홀이 있어야 한다 — 방 하나(객실)만 달라고 해도 복도를 붙인다(2026-10-23 실조수: 객실 하나뿐이라 내려가는 계단 자리가 없었다).
    if (!upKinds.some((k) => /corridor|hall|landing/u.test(k)) && known("corridor")) {
      // 방 하나 + 복도면 견본이 2칸 폭 복도를 골라 계단통이 안 들어간다 — 방을 둘 이상으로 채워 넓은 복도 견본을 받는다.
      while (upKinds.length < 2) upKinds = [...upKinds, upKinds[0] ?? "inn_room"];
      upKinds = [...upKinds, "corridor"];
    }
    const upBase: Record<string, unknown> = { tileset: tilesetId, ...(upperMapId ? { mapId: upperMapId, replace: true } : {}), name: upperName(spec.name),
      // 복도는 방 수에 맞춘 작은 계단참(방마다 4칸 + 1, 높이 5) — 견본 크기 그대로면 38칸짜리 빈 홀이 됐다.
      layout: { rooms: (upKinds.length ? upKinds : ["bedroom"]).map((kind, i, all) => ({ id: `${kind}${i + 1}`, kind, ...(/corridor/u.test(kind) ? { w: Math.max(9, 4 * (all.length - 1) + 1), h: 5 } : {}) })) } };
    // 위층은 배치 후보 넷 중 맵 틀 안 검은 바깥이 가장 적은 것(방 넓이 ÷ 맵 넓이 최대) — 객실 둘 + 긴 복도가 ㄱ자로 앉아 왼쪽 위가 통째로 검었다(비평 major).
    let up = build(run, upBase);
    const fill = (a: Attempt) => {
      const rr = (a.data?.rebuild as Rebuild | undefined)?.rooms ?? [];
      const m = run.ctx.project.maps[String(a.data?.mapId)];
      return m ? rr.reduce((n, r) => n + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 3), 0) / (m.width * m.height) : 0;
    };
    if (up.ok) {
      let best = { v: 0, f: fill(up) };
      for (let v = 1; v <= 3; v++) {
        const alt = build(run, { ...upBase, mapId: String(up.data?.mapId), replace: true, layout: { ...(upBase.layout as object), variant: v } });
        if (alt.ok && fill(alt) > best.f + 0.02) best = { v, f: fill(alt) };
      }
      up = build(run, { ...upBase, mapId: String(up.data?.mapId), replace: true, layout: { ...(upBase.layout as object), ...(best.v ? { variant: best.v } : {}) } });
    }
    if (up.ok) {
      upperMapId = String(up.data?.mapId);
      let urb = up.data?.rebuild as Rebuild;
      // 위층은 바깥으로 나가는 남쪽 문이 없다(계단으로만 오간다).
      let uargs: Record<string, unknown> = { ...argsFromRebuild({ tileset: tilesetId, mapId: upperMapId, name: upperName(spec.name) }, urb), exitWidth: 0, exit: { ...(urb.exit as object), width: 0 } };
      urb = { ...urb, exit: uargs.exit, objects: urb.objects.filter((o) => !/doormat|door mat/u.test(o.id)) };
      uargs = { ...uargs, objects: urb.objects };
      const down = findPart(roomSpec, "stairwell down");
      const hubs = [...urb.rooms].sort((a, b) => Number(/corridor|hall/u.test(b.id)) - Number(/corridor|hall/u.test(a.id)) || (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
      let placedDown: ReturnType<typeof placeAnchor> | undefined;
      for (const hub of hubs) { placedDown = down ? placeAnchor(run, roomSpec, uargs, urb, hub.id, down, undefined, true, new Set(), openingColumns(urb, up.data)) : undefined; if (placedDown) break; }
      if (placedDown) {
        uargs = placedDown.args; urb = placedDown.rb;
        const d = urb.objects[urb.objects.length - 1]!;
        // 계단통 바로 둘레(위 한 줄·양옆)의 견본 의자·벤치는 치운다 — 「계단 앞을 벤치가 막고 있다」(눈가림 2차).
        const near = (o: Obj) => o !== d && o.x >= d.x - 1 && o.x <= d.x + 3 && o.y >= d.y - 1 && o.y <= d.y + 2 && /bench|chair|stool/u.test(o.id);
        if (urb.objects.some(near)) { urb = { ...urb, objects: urb.objects.filter((o) => !near(o)) }; uargs = { ...uargs, objects: urb.objects }; }
        // 위층 계단통 → 아래층 계단 앞, 아래층 계단 → 위층 계단통 앞. 칸은 도구의 계단 계약(fitStairTransfers)이 맞춘다.
        uargs = { ...uargs, links: [{ x: d.x + 1, y: d.y, toMapId: builtMapId, toX: stairsUp.x + 1, toY: stairsUp.y + 1, direction: "down" }] };
        // 위층 구역의 주인공 물건(침대·옷장…) — 계단 낱말은 이미 계단통으로 놓았다.
        for (const zone of upperZones) for (const what of zone.anchors ?? []) {
          if (/계단|stair/iu.test(what)) continue;
          const part = findPart(roomSpec, what);
          if (!part) { missing.push(`${what}(위층) — 부품 사전에 없다`); continue; }
          const host = urb.rooms.find((r) => r.id.startsWith(resolveKind(tilesetId, zone, [], spec.name))) ?? urb.rooms[0]!;
          const done = placeAnchor(run, roomSpec, uargs, urb, host.id, part, undefined, true, new Set(), openingColumns(urb, up.data));
          if (done) { uargs = done.args; urb = done.rb; placed.push({ zone: `2층 ${host.id}`, what, id: part.id }); }
          else missing.push(`${what}(위층 ${host.id}) — 놓을 빈 자리가 없다`);
        }
        build(run, uargs);
        // 위층은 기준보다 낮게(8%) 메운다 — 객실 벽면이 분모를 키워 15% 안이어도 계단참 아래 절반이 비어 보였다.
        const ufill = fillBare(run, roomSpec, uargs, urb, new Map(urb.rooms.map((r) => [r.id, r.id.replace(/\d+$/u, "")] as const)), 8, spec.name);
        uargs = ufill.args; urb = ufill.rb;
        const upFinal = build(run, uargs);
        if (upFinal.ok) {
          lowerLink = { x: stairsUp.x + 1, y: stairsUp.y, toMapId: upperMapId, toX: d.x + 1, toY: d.y + 2, direction: "up" };
          upperArgs = uargs;
          
        } else missing.push(`위층 계단 잇기 실패: ${upFinal.summary.slice(0, 120)}`);
      } else missing.push("위층 내려가는 계단통 자리를 못 찾았다");
    } else missing.push(`위층을 짓지 못했다: ${up.summary.slice(0, 120)}`);
  return { ...(lowerLink ? { upperMapId, upperArgs, lowerLink } : {}) };
}

/**
 * 이미 지어진 layout 방을 «똑같이» 다시 지을 인자를 찾는다 — 같은 방 구성(종류만 / 종류+크기)으로 지어 네 층 타일이 원래와 같으면 그 인자를 쓴다.
 * 찾으면 고치기가 원래 그림에서 출발한다(견본 가구 비키기·뒷문 자리 만들기가 된다). 못 찾으면 undefined(덧찍기로 고친다). 맵은 원래대로 둔다.
 */
export function adoptExactInterior(run: BuildRun, mapId: string): { tilesetId: string; args: Record<string, unknown>; rooms: { id: string; kind: string }[] } | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return undefined;
  const locs = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room"));
  if (!locs.length) return undefined;
  const sig = (m: typeof map) => JSON.stringify([m.width, m.height, m.lowerTiles, m.lowerOverlayTiles ?? [], m.upperTiles, m.upperOverlayTiles ?? []]);
  const want = sig(map);
  const tries = [locs.map((l) => ({ kind: l.name })), locs.map((l) => ({ kind: l.name, w: l.w, h: l.h }))];
  try {
    for (const rooms of tries) {
      const res = build(run, { tileset: map.tilesetId, mapId, name: map.name, replace: true, layout: { rooms } });
      const now = run.ctx.project.maps[mapId];
      if (!res.ok || !now || sig(now) !== want) { run.ctx.project = project; continue; }
      const rb = res.data?.rebuild as Rebuild | undefined;
      if (!rb) { run.ctx.project = project; continue; }
      const args = argsFromRebuild({ tileset: map.tilesetId, mapId, name: map.name }, rb);
      const again = build(run, args);
      const ok = again.ok && sig(run.ctx.project.maps[mapId]!) === want;
      run.ctx.project = project;
      if (ok) return { tilesetId: map.tilesetId, args, rooms: rb.rooms.map((r, i) => ({ id: r.id, kind: locs[i]?.name ?? r.id })) };
    }
  } catch { run.ctx.project = project; }
  run.ctx.project = project;
  return undefined;
}

/** 똑같이 다시 지은 인자에서 고치기 — 아늑하게(빈 자리 소품·빈 바닥 한 벌), 주인공 물건 더하기, 북쪽 뒷문. 방 배치는 그대로. */
export function interiorEditFromArgs(run: BuildRun, spec: PlaceSpec, base: { tilesetId: string; args: Record<string, unknown>; rooms: readonly { id: string; kind: string }[] }, req: { dressing: number; adds: readonly { zone?: string; what: string; near?: { x: number; y: number } }[]; north: boolean }, prev?: InteriorState): PlaceBuildResult {
  const roomSpec = roomSpecOf(run.ctx.project.tilesets[base.tilesetId])!;
  let args = prev?.args ?? base.args;
  const mapId = String(args.mapId);
  let rb: Rebuild = { rooms: args.rooms as Room[], connect: args.connect as unknown[], exit: args.exit, objects: [...(args.objects as Obj[])], tables: args.tables as Rebuild["tables"], goods: args.goods as Obj[], lines: args.lines as unknown[], daises: args.daises as unknown[] };
  const notes: string[] = [];
  const missing: string[] = [];
  const placed = [...(prev?.placed ?? [])];
  for (const add of req.adds) {
    const part = findPart(roomSpec, add.what);
    if (!part) { missing.push(`${add.what} — 부품 사전에 없다`); continue; }
    const room = rb.rooms.find((r) => r.id === add.zone || r.id.startsWith(add.zone ?? "\u0000")) ?? (add.near ? rb.rooms.find((r) => add.near!.x >= r.x0 && add.near!.x <= r.x1 && add.near!.y >= r.y0 && add.near!.y <= r.y1) : undefined) ?? rb.rooms[0]!;
    const done = placeAnchor(run, roomSpec, args, rb, room.id, part, add.near, true);
    if (!done) { missing.push(`${add.what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
    args = done.args; rb = done.rb; placed.push({ zone: room.id, what: add.what, id: part.id });
  }
  if (req.dressing > 0) {
    let added = 0;
    const kindOf = new Map(base.rooms.map((r) => [r.id, r.kind] as const));
    for (const room of [...rb.rooms].sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))) for (const word of cosyFor(kindOf.get(room.id) ?? room.id, base.rooms.length === 1 ? spec.name : "")) {
      if (added >= req.dressing * 3) break;
      const part = roomSpec.objects[word] ? { id: word, kind: roomSpec.objects[word]!.kind, w: roomSpec.objects[word]!.w, h: roomSpec.objects[word]!.h } : findPart(roomSpec, word);
      if (!part) continue;
      const done = placeAnchor(run, roomSpec, args, rb, room.id, part, undefined, false);
      if (done) { args = done.args; rb = done.rb; added++; }
    }
    const kinds = new Map(base.rooms.map((r) => [r.id, r.kind] as const));
    build(run, args);
    const filled = fillBare(run, roomSpec, args, rb, kinds, FILL_BARE_PCT, spec.name);
    args = filled.args; rb = filled.rb;
    notes.push(`원래 방 배치·바닥은 그대로 두고 아늑한 소품 ${added}점${filled.filled ? `, 빈 바닥 ${filled.filled}곳에 쓰임 한 벌` : ""}을 더했다`);
  }
  let backDoor = prev?.backDoor;
  const mapIds = [mapId];
  if (req.north && !backDoor) {
    const door = addBackDoor(run, roomSpec, base.tilesetId, args, rb, mapId, spec.name, undefined, /kitchen|storeroom|pantry|cellar|corridor|hall/u);
    args = door.args; notes.push(door.note);
    if (door.backDoor) backDoor = door.backDoor; else missing.push(door.note);
  }
  if (backDoor) mapIds.push(backDoor.mapId);
  const final = build(run, args);
  const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
  const state: InteriorState = { tilesetId: base.tilesetId, mapId, args, placed, ...(backDoor ? { backDoor } : {}), adopted: base };
  return { ok: final.ok, mapIds, ...(entrance ? { entrance: { mapId, ...entrance } } : {}), summary: `${spec.name}: 원래 방을 똑같이 다시 짓고 고쳤다 — ${notes.join(" / ") || "바꾼 것 없음"} — ${final.summary.slice(0, 160)}`,
    warnings: [...notes, ...((final.data?.warnings as string[] | undefined) ?? []).slice(0, 3)], missingArt: missing, calls: run.calls, state };
}

const COSY = ["fur rug", "armchair", "potted plant", "candle stand", "round rug", "tall vase red", "bookshelf 1w", "firewood bundle"];
/** 「아늑하게」 소품 — 집 방은 위 거실 소품, 쓰임이 있는 방은 그 쓰임에 맞는 소품만(예배당 안락의자·장난감 가게 모피 깔개 금지, J42). */
const COSY_BY_PURPOSE: Readonly<Record<string, readonly string[]>> = {
  chapel: ["votive stand", "candelabra", "holy water font", "tall stained window"],
  toyshop: ["shelf:toy", "cabinet:toy", "rocking horse", "music box", "wall clock"],
  shop: ["cabinet:candle", "shelf:jar+jarb+jarg", "crate", "wall clock"],
  weaponshop: ["weapon rack", "shield", "armor stand", "weapon barrel"],
  workshop: ["tool wall", "crate", "barrel", "sack"],
  library: ["bookshelf 1w", "candelabra", "globe", "book pile"],
};
/** 방마다 그 쓰임의 swaps 표로 견본 가구를 바꾼다 — 같은 크기·같은 종류(벽·바닥·걸이) 부품만(배치가 그대로 맞는다). */
function swapForPurpose(spec: HandInteriorSpec, rb: Rebuild, kinds: ReadonlyMap<string, string>, context: string, zoneOf: (roomId: string) => ZoneSpec | undefined): { rb: Rebuild; count: number } {
  let count = 0;
  const turn = new Map<string, number>();
  const objects = rb.objects.map((o) => {
    const room = rb.rooms.find((r) => o.x >= r.x0 && o.x <= r.x1 && o.y >= r.y0 && o.y <= r.y1);
    if (!room) return o;
    const kind = kinds.get(room.id) ?? room.id;
    if (GENERIC_HOME.test(kind)) return o;
    const zone = zoneOf(room.id);
    const purpose = purposeOf(`${kind.replace(/[_-]/gu, " ")} ${zone?.id ?? ""} ${zone?.purpose ?? ""} ${context}`);
    if (!purpose?.swaps) return o;
    const base = o.id.split("@")[0]!;
    const from = spec.objects[base];
    if (!from) return o;
    const n = turn.get(base) ?? 0;
    const to = purposeSwap(purpose, base, n, (id) => { const d = spec.objects[id]; return !!d && d.kind === from.kind && d.w === from.w && d.h === from.h; });
    if (!to || to === base) return o;
    turn.set(base, n + 1);
    count++;
    return { ...o, id: to };
  });
  return { rb: { ...rb, objects }, count };
}
function cosyFor(kind: string, context: string): readonly string[] {
  const purpose = GENERIC_HOME.test(kind) ? undefined : purposeOf(`${kind.replace(/[_-]/gu, " ")} ${context}`);
  return purpose ? COSY_BY_PURPOSE[purpose.id] ?? [] : COSY;
}

export const INTERIOR_CARD = `[실내 interior] make_place({type:"interior", name, style?, size?, zones:[{kind, purpose, anchors?}], floors?}).
- zones = 방 하나하나(칸막이로 나뉜 방). kind 낱말: tavern(선술집 홀)·kitchen·storeroom·cellar·bedroom·inn_room(객실)·study(서재)·library(서고)·living·dining·forge(대장간)·workshop·alchemy·chapel·treasury·armory·throne_room·great_hall·entrance·corridor·bathroom·cell. 한국어 낱말도 된다.
- anchors = 그 방의 주인공 물건(낱말): 「큰 망원경」「벽난로」「바 카운터」「책장」「별자리표」「올라가는 계단」. 크면 「큰」을 붙인다. 함수가 부품 사전에서 찾아 빈 자리에 놓고, 못 찾으면 없다고 알려 준다.
- 「2층·위층 계단」이 필요하면 anchors 에 "올라가는 계단"을 넣고 floors:2 — 위층을 짓고 계단끼리 이어 준다.
- style: fantasy(기본 — 마법사의 탑·연금술 공방·천문대 같은 판타지도 여기, 망원경·연금술 부품이 이 칩셋에 있다) · wizarding(호그와트풍 마법 «학교» 건물만) · sengoku(전국·에도) · modern(현대 도시). 일본 현대 집은 type:"house".
- 장소 견본: 이름이 천문대·관측소면 둥근 지붕 관측 홀, 선술집·주점·여관이면 바 카운터·벽난로·식탁이 갖춰진 통나무 홀로 짓는다(name 에 그 낱말을 넣으면 된다). 천문대는 zones [{kind:"study", anchors:["큰 망원경","별자리표","책장"]}].
- 이미 있는 방 고치기: edit_place({mapId, patch:{dressing:1}}) = 원래 방 배치·바닥은 그대로 두고 소품을 더한다. 북쪽 뒷문은 patch.set.exits:["north"] 또는 addAnchors:[{what:"북쪽 뒷문"}] — 북벽에 문을 달고 뒷방을 지어 잇는다. 바닥·벽 재질은 원래 것을 지킨다.`;

export const interiorBuilder: PlaceBuilder = {
  id: "interior",
  accepts: (spec) => spec.type === "interior",
  build(run, spec, previous) {
    const notes: string[] = [];
    const missing: string[] = [];
    const prev = previous?.result.state as InteriorState | undefined;
    let tilesetId = prev?.tilesetId ?? tilesetFor(spec.style);
    // 주인공 물건이 고른 칩셋에 없고 기본 판타지 실내(v5)에는 있으면 v5 로 — 「마법사의 천문대」를 마법 학교 칩셋으로 지어 망원경·책장이 하나도 없었다(2026-10-23 v2 실조수).
    if (!prev && tilesetId !== HAND_INTERIOR_TILESET_ID) {
      const own = roomSpecOf(run.ctx.project.tilesets[tilesetId]);
      const base = roomSpecOf(run.ctx.project.tilesets[HAND_INTERIOR_TILESET_ID]);
      const words = (spec.zones ?? []).flatMap((z) => z.anchors ?? []);
      const hits = (rs: typeof own) => (rs ? words.filter((w) => findPart(rs, w)).length : -1);
      if (base && words.length && hits(base) > hits(own)) { notes.push(`주인공 물건(${words.join("·")})이 ${tilesetId} 에 ${Math.max(0, hits(own))}개, 기본 판타지 실내에 ${hits(base)}개 있어 기본 판타지 실내로 지었다`); tilesetId = HAND_INTERIOR_TILESET_ID; }
    }
    const roomSpec = roomSpecOf(run.ctx.project.tilesets[tilesetId]);
    if (!roomSpec) return { ok: false, mapIds: [], summary: `실내 칩셋 ${tilesetId} 이 이 프로젝트에 없다`, warnings: [], missingArt: [spec.name], calls: run.calls };
    // hints.newMap: make_place 가 「이번에 지은 다른 장소」를 덮지 않게 새 맵을 요구했다(2026-10-25 G27: 지하 예배당을 지은 맵에 저택을 다시 지어 예배당이 사라졌다).
    const mapId: string | undefined = prev?.mapId ?? spec.mapId ?? (spec.hints?.newMap === true ? undefined : run.ctx.currentMapId ?? run.ctx.project.startMapId);
    // 장소 견본(천문대 등) — 방 종류 견본으로는 주인공 물건이 방을 정하지 못한다(2026-10-23 비교: 천문대가 평범한 서재로 읽혀 v1 8 · v2 3.5).
    const venueText = `${spec.name} ${spec.theme ?? ""} ${(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""}`).join(" ")}`;
    const venue = tilesetId === HAND_INTERIOR_TILESET_ID && (spec.zones ?? []).filter((z) => (z.floor ?? 1) === 1).length <= 1 && (!prev || prev.venue)
      ? interiorVenues(roomSpec).find((v) => v.words.test(venueText) && (!(spec.floors && spec.floors > 1) || (spec.floors === 2 && !!v.stairs))) : undefined;
    if (venue) {
      const done = buildVenue(run, spec, venue, roomSpec, tilesetId, mapId, prev);
      if (done) return done;
      notes.push(`장소 견본 「${venue.id}」으로 짓지 못해 방 종류 견본으로 지었다`);
    }
    const zones = spec.zones?.length ? spec.zones : [{ kind: spec.name, purpose: spec.name }];
    const scale = SCALE[spec.size ?? "medium"] ?? 1;
    const used = new Map<string, number>();
    const firstFloor = zones.filter((z) => !z.floor || z.floor === 1);
    const rooms = firstFloor.map((zone) => {
      const kind = resolveKind(tilesetId, zone, notes, `${spec.name} ${spec.theme ?? ""}`, firstFloor.length === 1);
      const n = (used.get(kind) ?? 0) + 1; used.set(kind, n);
      // 크기: small = 가장 작은 견본, medium = 가운데, large = 가장 큰 견본 × 1.3. 큰 주인공 물건이 들어갈 만큼은 넓힌다.
      const t = zone.keep?.w && zone.keep.h ? { w: zone.keep.w, h: zone.keep.h } : pickTemplate(tilesetId, kind, zone.size ?? spec.size);
      const need = (zone.anchors ?? []).map((a) => findPart(roomSpec, a)).filter((p): p is NonNullable<typeof p> => !!p && p.kind !== "hang");
      const minW = Math.max(0, ...need.map((p) => p.w + 4)), minH = Math.max(0, ...need.map((p) => Math.max(1, p.h) + 6));
      const grow = spec.size === "large" && !zone.keep ? scale : 1;
      const sized = t ? { w: Math.max(minW, Math.round(t.w * grow)), h: Math.max(minH, Math.round(t.h * grow)) } : minW ? { w: minW, h: minH } : {};
      return { id: zone.id ?? (n > 1 ? `${kind}${n}` : kind), kind, ...sized, min: { w: Math.max(5, minW), h: Math.max(6, minH) }, ...(zone.keep?.floor ? { floor: zone.keep.floor } : {}), ...(zone.keep?.wall ? { wall: zone.keep.wall } : {}), zone };
    });
    const hints = spec.hints ?? {};
    const variant = typeof hints.variant === "number" ? hints.variant : (spec.salt ?? 0) % 4;
    const seed = typeof hints.seed === "number" ? hints.seed : undefined;
    const layoutSeed = seed ?? (spec.salt ? 1 + (spec.salt % 99991) : undefined);
    let base: Record<string, unknown> = { tileset: tilesetId, mapId, name: spec.name, replace: mapId ? true : undefined,
      layout: { rooms: rooms.map((r) => clean({ id: r.id, kind: r.kind, w: r.w, h: r.h, floor: (r as { floor?: string }).floor, wall: (r as { wall?: string }).wall })), ...(variant ? { variant } : {}), ...(layoutSeed ? { seed: layoutSeed } : {}) } };
    let first = build(run, base);
    if (!first.ok) {
      // 맵이 다른 칩셋의 살아 있는 맵이면 새 맵으로 짓는다(덮어쓰지 않는다).
      const fresh = { ...base, mapId: undefined, replace: undefined };
      first = build(run, fresh);
      if (!first.ok) return { ok: false, mapIds: [], summary: `실내를 짓지 못했다: ${first.summary}`, warnings: notes, missingArt: missing, calls: run.calls };
    }
    // 방 크기를 내용에 맞춘다 — 빈 바닥이 넓으면 메우지 말고 방을 줄인다(2026-10-28 interior 장부: 중간 크기 여관 홀이 견본 그대로 16×15,
    // 견본 가구만으로 맨바닥 60% → fillBare·dress_room 이 식탁 열 벌·바 의자·벤치를 빈 곳마다 메워 「가구를 늘어놓은 전시장」이 됐다).
    // 큰 방(견본 넓이 48칸 이상)만 0.85 → 0.72 → 0.62 배로 줄여 다시 지어 보고, 맨바닥이 줄어든 만큼만 받는다. 주인공 물건 자리(min)는 지킨다.
    // 「large」도 줄인다 — 큰 학교를 견본 × 1.3 으로 지어 입학 홀이 맨바닥 60% 의 빈 광장이 됐다(2026-10-28 마법학교). 넓이는 요청보다 내용이 정한다.
    if (!rooms.some((r) => r.zone.keep)) {
      const builtId = String(first.data?.mapId ?? mapId);
      const bareOf = () => { const m = run.ctx.project.maps[builtId]; return m ? measureInteriorBareFloor(run.ctx.project, m)?.pct ?? 0 : 0; };
      let pct = bareOf();
      let kept = base;
      // 줄인 크기로는 다른 견본이 골라져 재질이 바뀐다(통나무 여관 홀이 푸른 얼룩 돌바닥이 됐다) — 첫 짓기의 바닥·벽면 재질을 물려준다.
      const firstRooms = ((first.data?.rebuild as Rebuild | undefined)?.rooms ?? []);
      for (const f of [0.85, 0.72, 0.62]) {
        if (pct <= SHRINK_BARE_PCT) break;
        const layout = base.layout as { rooms: { w?: number; h?: number }[] };
        const shrunk = layout.rooms.map((r, i) => {
          const want = rooms[i]!;
          const mat = firstRooms.find((q) => q.id === want.id) ?? firstRooms[i];
          const keepMat = { ...(mat?.floor ? { floor: mat.floor } : {}), ...(mat?.wall ? { wall: mat.wall } : {}), ...r };
          if (!r.w || !r.h || r.w * r.h < 48) return keepMat;
          return { ...keepMat, w: Math.max(want.min.w, Math.round(r.w * f)), h: Math.max(want.min.h, Math.round(r.h * f)) };
        });
        if (shrunk.every((r, i) => r.w === layout.rooms[i]!.w && r.h === layout.rooms[i]!.h)) break;
        const next = { ...base, mapId: builtId, replace: true, layout: { ...layout, rooms: shrunk } };
        const attempt = build(run, next);
        const now = attempt.ok ? bareOf() : Infinity;
        // 배율마다 배치가 달라져 맨바닥이 들쭉날쭉하다 — 한 번 나빠졌다고 멈추지 않고 셋 다 재 보고 가장 덜 빈 것을 받는다(5칸 넘게 줄어야).
        if (attempt.ok && now <= pct - 5) { first = attempt; kept = next; pct = now; }
      }
      // 한 방만 텅 빈 경우(마법학교: 입학 홀만 맨바닥 60%, 서고·교실은 꽉 참) — 전체를 같은 배율로 줄이면 꽉 찬 방이 같이 줄어 자리가 없어
      // 받지 못한다. 가장 빈 방 하나씩 0.7 배로 줄여 보고, 맨바닥 칸 수가 줄면 받는다(최대 다섯 번, 못 줄인 방은 건너뛴다). 비율로 재면 다른 빈 방들에 묻혀
      // 한 방을 줄여도 숫자가 안 움직인다(입학 홀 22×18 → 15×13 이 전체 64% → 65%).
      const bareCellsOf = () => { const m = run.ctx.project.maps[builtId]; return m ? measureInteriorBareFloor(run.ctx.project, m)?.bareCells ?? 0 : 0; };
      let cells = bareCellsOf();
      const stuck = new Set<string>();
      for (let k = 0; k < 5 && pct > SHRINK_BARE_PCT; k++) {
        const m = run.ctx.project.maps[builtId];
        const builtRooms = ((first.data?.rebuild as Rebuild | undefined)?.rooms ?? []);
        if (!m) break;
        const layout = kept.layout as { rooms: { id?: string; w?: number; h?: number }[] };
        const share = (r: Room) => {
          let floor = 0, bare = 0;
          for (let y = r.y0 + 2; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
            const i = y * m.width + x;
            if ((m.lowerTiles[i] ?? -1) < 0) continue;
            floor++;
            if ((m.lowerOverlayTiles?.[i] ?? -1) < 0 && (m.upperTiles[i] ?? -1) < 0 && (m.upperOverlayTiles?.[i] ?? -1) < 0) bare++;
          }
          return floor ? bare / floor : 0;
        };
        const worst = builtRooms.filter((r) => !stuck.has(r.id)).map((r) => ({ r, s: share(r) })).sort((a, b) => b.s - a.s)[0];
        const li = worst ? layout.rooms.findIndex((q) => q.id === worst.r.id) : -1;
        const target = li >= 0 ? layout.rooms[li]! : undefined;
        const want = li >= 0 ? rooms[li] : undefined;
        if (!worst || worst.s < 0.45 || !target?.w || !target.h || !want || target.w * target.h < 80) break;
        const w = Math.max(want.min.w, Math.round(target.w * 0.7)), h = Math.max(want.min.h, Math.round(target.h * 0.7));
        if (w === target.w && h === target.h) { stuck.add(worst.r.id); continue; }
        const mat = builtRooms.find((q) => q.id === want.id);
        const shrunk = layout.rooms.map((q, i) => {
          const fm = builtRooms.find((b) => b.id === rooms[i]!.id);
          const withMat = { ...(fm?.floor ? { floor: fm.floor } : {}), ...(fm?.wall ? { wall: fm.wall } : {}), ...q };
          return i === li ? { ...withMat, ...(mat?.floor ? { floor: mat.floor } : {}), w, h } : withMat;
        });
        const next = { ...kept, mapId: builtId, replace: true, layout: { ...layout, rooms: shrunk } };
        const attempt = build(run, next);
        const nowCells = attempt.ok && reachOk(attempt) ? bareCellsOf() : Infinity;
        if (nowCells < cells - 8) { first = attempt; kept = next; pct = bareOf(); cells = nowCells; }
        else { build(run, kept); stuck.add(worst.r.id); }
      }
      if (kept !== base || pct > SHRINK_BARE_PCT) build(run, kept);
      if (kept !== base) { notes.push(`빈 바닥이 넓어 큰 방을 줄여 지었다(맨바닥 ${pct}%) — 빈 바닥은 가구로 메우지 않고 방 크기로 맞춘다`); base = kept; }
    }
    // 올라가는 계단이 든 방은 건물 맨 북쪽 바깥 벽에 붙어야 한다(칸막이 속 계단 경고) — 그런 배치 후보를 고른다.
    const stairZone = rooms.find((r) => (r.zone.anchors ?? []).some((a) => /계단|stair/iu.test(a) && /올라|위층|2층|up/iu.test(a)));
    const northmost = (a: Attempt) => {
      const rr = (a.data?.rebuild as Rebuild | undefined)?.rooms ?? [];
      const top = Math.min(...rr.map((r) => r.y0));
      return rr.find((r) => r.id === stairZone?.id)?.y0 === top;
    };
    if (stairZone && first.ok && !northmost(first) && !seed) {
      for (let v = 1; v <= 3; v++) {
        const alt = build(run, { ...base, mapId: String(first.data?.mapId ?? mapId), replace: true, layout: { ...(base.layout as object), variant: (variant + v) % 4 } });
        if (alt.ok && northmost(alt)) { first = alt; break; }
      }
      if (!northmost(first)) first = build(run, { ...base, mapId: String(first.data?.mapId ?? mapId), replace: true });
    }
    const builtMapId = String(first.data?.mapId ?? mapId);
    let rb = first.data?.rebuild as Rebuild;
    // 빌린 견본의 가구를 그 방 쓰임의 가구로(장난감 가게가 빌린 재봉 가게 견본의 옷감 선반·마네킹 → 인형 진열장·흔들 목마, J31).
    {
      const swapped = swapForPurpose(roomSpec, rb, new Map(rooms.map((r) => [r.id, r.kind] as const)), rooms.length === 1 ? `${spec.name} ${spec.theme ?? ""}` : "", (id) => rooms.find((r) => r.id === id)?.zone);
      if (swapped.count) {
        const next = build(run, argsFromRebuild({ tileset: tilesetId, mapId: builtMapId, name: spec.name }, swapped.rb));
        if (next.ok && reachOk(next)) { first = next; rb = (next.data?.rebuild as Rebuild | undefined) ?? swapped.rb; notes.push(`빌린 견본 가구 ${swapped.count}점을 방 쓰임 가구로 바꿨다`); }
        else build(run, argsFromRebuild({ tileset: tilesetId, mapId: builtMapId, name: spec.name }, rb));
      }
    }
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
      // 올라가는 계단: 이 방이 맨 북쪽 바깥 벽에 닿지 않으면(위에 다른 방) 맨 북쪽 방 벽에 단다 — 칸막이 속으로 오르는 계단은 틀린 그림이다.
      const isUp = part.stairs === "up" || /stairs up/u.test(part.id);
      const top = Math.min(...rb.rooms.map((r) => r.y0));
      const hostId = isUp && rb.rooms.find((r) => r.id === room.id)?.y0 !== top ? (rb.rooms.find((r) => r.y0 === top)?.id ?? room.id) : room.id;
      if (hostId !== room.id) notes.push(`${what}: ${room.id} 위에 다른 방이 있어 맨 북쪽 ${hostId} 벽에 달았다`);
      const done = placeAnchor(run, roomSpec, args, rb, hostId, part, undefined, true, protect(), openings);
      if (!done) { missing.push(`${what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
      args = done.args; rb = done.rb; placed.push({ zone: hostId, what, id: part.id });
      const last = rb.objects[rb.objects.length - 1]!; anchorKeys.add(`${last.id}@${last.x},${last.y}`);
      if (part.stairs === "up" || /stairs up/u.test(part.id)) { const o = rb.objects[rb.objects.length - 1]!; stairsUp = { id: part.id, x: o.x, y: o.y, w: part.w }; }
    }
    // 꾸밈 정도(아늑하게): 방마다 빈 자리에 아늑한 소품을 한두 점.
    const dressing = typeof hints.dressing === "number" ? hints.dressing : 0;
    if (dressing > 0) for (const room of rooms) {
      let added = 0;
      for (const word of cosyFor(room.kind, rooms.length === 1 ? `${spec.name} ${spec.theme ?? ""}` : "")) {
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
    const filled = fillBare(run, roomSpec, args, rb, kinds, FILL_BARE_PCT, `${spec.name} ${spec.theme ?? ""}`);
    args = filled.args; rb = filled.rb;
    if (filled.filled) notes.push(`빈 바닥 덩이 ${filled.filled}곳을 방 쓰임에 맞는 가구 한 벌로 채웠다`);
    // 위층과 계단.
    const mapIds = [builtMapId];
    let upperMapId = prev?.upperMapId;
    let upperArgs: Record<string, unknown> | undefined;
    if (stairsUp) {
      const up = buildUpperFloor(run, roomSpec, tilesetId, spec, builtMapId, stairsUp, upperMapId, missing, notes, placed);
      if (up.lowerLink && up.upperMapId) { args = { ...args, links: [up.lowerLink] }; upperMapId = up.upperMapId; upperArgs = up.upperArgs; mapIds.push(up.upperMapId); }
    }

    // 북쪽 뒷문(「뒤쪽 벽에 뒷문」) — 아치 문틀 + 뒷방 맵 한 쌍.
    let backDoor = prev?.backDoor;
    if (spec.exits?.includes("north")) {
      const door = addBackDoor(run, roomSpec, tilesetId, args, rb, builtMapId, spec.name, prev?.backDoor, /kitchen|storeroom|pantry|cellar|corridor|hall/u);
      args = door.args; notes.push(door.note);
      if (door.backDoor) { backDoor = door.backDoor; mapIds.push(door.backDoor.mapId); } else missing.push(door.note);
    }
    const final = build(run, args);
    if (!final.ok) return { ok: false, mapIds, summary: `마지막 짓기 실패: ${final.summary}`, warnings: notes, missingArt: missing, calls: run.calls };
    if (spec.exits?.some((e) => e === "east" || e === "west")) missing.push(`${spec.exits.filter((e) => e === "east" || e === "west").join("·")} 출구 — 손 도트 실내는 남쪽 출구와 북쪽 뒷문(아치 문틀)만 낸다`);
    // 요청한 주인공 물건이 끝까지 남았는지 — 크기 줄이기·다시 짓기에서 「큰 망원경」이 빠진 채 끝났다(2026-10-23 비교).
    const finalIds = new Set(((args.objects as Obj[]) ?? []).map((o) => o.id));
    for (const p of placed) if (!/계단|stair/iu.test(p.what) && !finalIds.has(p.id) && !p.zone.startsWith("2층")) missing.push(`${p.what}(${p.zone}) — 최종 맵에 없다(놓은 뒤 밀려났다)`);
    const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
    const state: InteriorState = { tilesetId, mapId: builtMapId, args, ...(upperMapId ? { upperMapId } : {}), ...(upperArgs ? { upperArgs } : {}), placed, ...(backDoor ? { backDoor } : {}) };
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
  if (state.venue) {
    // 장소 견본(평면) 위에 더하기 — 방 사각형이 없으니 평면 빈 자리에.
    const missingV: string[] = [];
    const placedV = [...state.placed];
    for (const add of adds) {
      const part = findPart(roomSpec, add.what);
      if (!part) { missingV.push(`${add.what} — 부품 사전에 없다`); continue; }
      const next = placeInVenue(run, roomSpec, args, part);
      if (next) { args = next; placedV.push({ zone: state.venue, what: add.what, id: part.id }); } else missingV.push(`${add.what} — 놓을 빈 자리가 없다`);
    }
    const fin = build(run, args);
    applyStamps(run, state.tilesetId, state.mapId, state.stamps);
    return { ok: fin.ok, mapIds: record.result.mapIds, ...(record.result.entrance ? { entrance: record.result.entrance } : {}),
      summary: `${record.spec.name}: 더한 물건 ${placedV.slice(state.placed.length).map((p) => p.id).join(", ") || "없음"} — ${fin.summary.slice(0, 160)}`,
      warnings: [], missingArt: missingV, calls: run.calls, state: { ...state, args, placed: placedV } };
  }
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

// ───── 놓인 가구 하나 옮기기·돌리기·빼기(move_object) ─────
// 비평(VQA)이 「침대가 문을 막는다」「의자가 벽을 본다」를 짚어도 고칠 길이 다시 짓기뿐이었다 — 다시 지으면 견본 가구가 다시 나와
// 같은 결함이 남았다(2026-10-25 빌더 보고: VQA 결함 6건이 끝까지 그대로). 마지막 도구 인자(args.objects)에서 그 물건만 바꿔 다시 짓는다.

export interface ObjectEdit {
  /** 그 물건이 덮는 칸 하나(비평이 짚은 칸). */
  readonly at: { readonly x: number; readonly y: number };
  /** 옮길 칸 — at 이 가리킨 칸이 이 칸으로 가게 통째로 민다. */
  readonly to?: { readonly x: number; readonly y: number };
  /** 바라보는 쪽 — 같은 물건의 다른 방향 그림으로 바꾼다(그림이 있을 때만). */
  readonly face?: "N" | "S" | "E" | "W";
  readonly remove?: boolean;
}

const FACE_WORD = /\s+(?:N|S|E|W|north|south|east|west)$/iu;

/** 그 칸을 덮는 물건(원점이 같으면 그것, 아니면 몸체가 덮는 것). */
function objectAt(spec: HandInteriorSpec, objects: readonly Obj[], at: { x: number; y: number }): number {
  const exact = objects.findIndex((o) => o.x === at.x && o.y === at.y);
  if (exact >= 0) return exact;
  return objects.findIndex((o) => {
    const def = spec.objects[o.id.split(":")[0]!];
    const w = Math.max(1, def?.w ?? 1), h = Math.max(1, def?.h ?? 1);
    return at.x >= o.x && at.x < o.x + w && at.y >= o.y && at.y < o.y + h;
  });
}

/** 같은 물건의 다른 방향 그림 id(「chair S」 → 「chair E」). 없으면 undefined. */
function facedPart(spec: HandInteriorSpec, id: string, face: string): string | undefined {
  const [base, ...rest] = id.split(":");
  const family = base!.replace(FACE_WORD, "");
  const hit = Object.keys(spec.objects).find((k) => k !== base && k.replace(FACE_WORD, "") === family && (spec.objects[k] as { facing?: string }).facing === face);
  return hit ? [hit, ...rest].join(":") : undefined;
}

export function interiorMoveObjects(run: BuildRun, spec: PlaceSpec, base: { tilesetId: string; args: Record<string, unknown> }, edits: readonly ObjectEdit[], prev?: InteriorState): PlaceBuildResult {
  const roomSpec = roomSpecOf(run.ctx.project.tilesets[base.tilesetId]);
  const mapId = String(base.args.mapId ?? spec.mapId ?? "");
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: [mapId], summary, warnings: [], missingArt: [], calls: run.calls });
  if (!roomSpec) return fail("이 맵의 칩셋에는 손 도트 실내 부품 사전이 없다 — 가구 옮기기는 손 도트 실내만 된다");
  const objects: Obj[] = [...((base.args.objects as Obj[] | undefined) ?? [])];
  const done: string[] = [];
  const problems: string[] = [];
  for (const edit of edits) {
    const i = objectAt(roomSpec, objects, edit.at);
    if (i < 0) {
      const near = objects.filter((o) => Math.abs(o.x - edit.at.x) <= 3 && Math.abs(o.y - edit.at.y) <= 3).slice(0, 6).map((o) => `${o.id}(${o.x},${o.y})`);
      problems.push(`(${edit.at.x},${edit.at.y}) 에 놓인 가구가 없다${near.length ? ` — 가까운 가구: ${near.join(", ")}` : ""}(탁자·상품·단상은 이 동사로 못 옮긴다)`);
      continue;
    }
    const o = objects[i]!;
    const name = `${roomSpec.objects[o.id.split(":")[0]!]?.ko ?? o.id}(${o.x},${o.y})`;
    if (edit.remove) { objects.splice(i, 1); done.push(`${name} 뺌`); continue; }
    let next: Obj = o;
    if (edit.face) {
      const turned = facedPart(roomSpec, o.id, edit.face);
      if (turned) next = { ...next, id: turned };
      else problems.push(`${name} — ${edit.face} 쪽을 보는 그림이 없다(그대로 둠)`);
    }
    if (edit.to) next = { ...next, x: o.x + edit.to.x - edit.at.x, y: o.y + edit.to.y - edit.at.y };
    if (next !== o) { objects[i] = next; done.push(`${name} → ${next.id === o.id ? "" : `${next.id} `}(${next.x},${next.y})`); }
  }
  if (!done.length) return fail(`바꾼 가구가 없다: ${problems.join(" · ")}`);
  const args = { ...base.args, objects };
  const attempt = build(run, args);
  const revert = () => { build(run, base.args); if (prev?.stamps) applyStamps(run, base.tilesetId, mapId, prev.stamps); };
  if (!attempt.ok) { revert(); return fail(`그렇게 놓으면 방을 지을 수 없어 되돌렸다(${attempt.summary.slice(0, 160)}) — 다른 칸으로`); }
  if (Array.isArray(attempt.data?.unreachedFloor) && (attempt.data!.unreachedFloor as unknown[]).length > 0) {
    revert();
    return fail(`그렇게 놓으면 바닥 ${(attempt.data!.unreachedFloor as unknown[]).length}칸에 갈 수 없게 돼 되돌렸다 — 길을 막지 않는 칸으로`);
  }
  if (prev?.stamps) applyStamps(run, base.tilesetId, mapId, prev.stamps);
  const placed = prev?.placed ?? [];
  const state: InteriorState = { ...(prev ?? {}), tilesetId: base.tilesetId, mapId, args, placed };
  return { ok: true, mapIds: [mapId], summary: `${spec.name ?? mapId}: ${done.join(" · ")}`, warnings: problems, missingArt: [], calls: run.calls, state };
}
