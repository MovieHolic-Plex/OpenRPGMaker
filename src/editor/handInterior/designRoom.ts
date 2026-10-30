// 모델이 설계한 방(RoomDesign)을 그대로 짓고, 함수는 «조화·검사»만 한다(2026-10-29 사용자 결정 「방을 짓는 건 조수여야만 한다」).
//
// 누가 무엇을 정하나:
//  - 모델: 방 모양(네모·ㄱ자·ㅗ자·창가 돌출)·바닥 크기·문 자리·바닥/벽 재질, 가구 묶음(무엇을·몇 개·묶음 안 상대 자리)과 묶음마다 놓을 벽·모서리·가운데·벽을 따라 몇 % 자리, 깔개.
//  - 함수(이 파일): 칩셋에 없는 기물 이름을 가까운 이름으로 맞추거나 빼기, 묶음 안 겹침 풀기, 책상·탁자 옆 의자 방향 맞추기, 벽 가구(책장)는 북벽에만·걸이는 벽면 윗줄에만,
//    방 안·도려 낸 귀퉁이·문 앞 통로를 피해 가장 가까운 자리로 밀기, 놓을 때마다 조립기 도달 검사(닿지 못하는 바닥이 늘면 다음 자리), 끝내 못 놓으면 빼기.
//    고친 것은 모두 fixes 에 한 줄씩 남겨 모델에게 돌려준다 — 모델이 보고 설계를 고쳐 다시 지을 수 있다.
// 함수는 가구를 더하지 않는다(빈 바닥은 알리기만 한다).
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "./builder";
import type { ComposedRooms } from "./rooms";
import { notchRect, type HandInteriorNotch } from "./rooms";
import type { LayoutRoom } from "./layout";
import type { InteriorTemplateItem } from "./templates";
import { doorwayCells } from "./furnish";
import { blocks, box, cellsOfBox, wallColumns, withItems } from "./vignettes";
import type { TilesetDef } from "@/project/types";

export type DesignAt = "north" | "south" | "west" | "east" | "center" | "nw" | "ne" | "sw" | "se";
export interface RoomDesignItem {
  /** 칩셋 기물 id(예: "bookshelf 3w", "desk 3x1", "chair N") 또는 탁상 물건 id. */
  readonly id: string;
  /** 묶음 안 상대 칸(왼쪽 위 = 0,0). 생략하면 앞 기물 옆(북·남·가운데 묶음은 오른쪽으로, 서·동 묶음은 아래로) 이어 붙인다. */
  readonly dx?: number; readonly dy?: number;
  /** 같은 기물을 몇 개 잇대어(기본 1, 최대 8). */
  readonly count?: number;
}
export interface RoomDesignGroup {
  /** 묶음 이름(모델이 붙인다): 「책상 자리」「독서 구석」「책장 벽」. */
  readonly name?: string;
  /** 놓는 곳(north·south·west·east·center·nw·ne·sw·se — 「north wall」「southeast」「북서」 같은 말도 읽는다). 생략하고 x·y 도 없으면 items 의 dx·dy 를 바닥 좌표로 읽는다. */
  readonly at?: string;
  /** 그 벽을 따라 0(서·북 끝)~1(동·남 끝). 기본 0.5. */
  readonly pos?: number;
  /** 바닥 칸 좌표(바닥 왼쪽 위 = 0,0 — 벽면 두 줄 아래 첫 바닥 줄). 주면 at·pos 보다 먼저. */
  readonly x?: number; readonly y?: number;
  /** 묶음 밑 깔개 — "rug red|royal|blue|green|purple|brown" 또는 색 낱말. */
  readonly rug?: string;
  readonly items: readonly RoomDesignItem[];
}
export interface RoomDesign {
  /** 방 모양 — SHAPE_GUIDE 참고: rect 네모 · L ㄱ자 · U ㄷ자 · T ㅜ자 · bay 창가 돌출 · alcove 알코브. */
  readonly shape?: string;
  /** 바닥 가로·세로(벽면 줄 빼고). */
  readonly w?: number; readonly h?: number;
  readonly corner?: string;
  /** 남쪽 출구 자리 — left·center·right 또는 0~1 숫자(글자). */
  readonly door?: string | number;
  readonly floor?: string; readonly wall?: string;
  readonly groups?: readonly RoomDesignGroup[];
}
export interface DesignRoomReport { placed: string[]; fixes: string[]; blockedShare: number; floor: number; items: number }
export interface DesignFurnishResult { readonly input: HandInteriorInput; readonly perRoom: Record<string, DesignRoomReport> }

/** 모델이 쓴 자리 낱말 → 자리(모르면 undefined). */
export function normalizeAt(raw: unknown): DesignAt | undefined {
  const w = String(raw ?? "").toLowerCase().replace(/\s*(wall|side|corner|쪽|벽|구석|모서리)\s*/gu, " ").trim();
  if (!w) return undefined;
  const n = /north|top|위|북|^n$|^n\b/u.test(w), s = /south|bottom|아래|남|^s$|^s\b/u.test(w), e = /east|right|오른|동|^e$/u.test(w), wst = /west|left|왼|서|^w$/u.test(w);
  if (/^(nw|ne|sw|se)$/u.test(w)) return w as DesignAt;
  if (n && wst) return "nw"; if (n && e) return "ne"; if (s && wst) return "sw"; if (s && e) return "se";
  if (n) return "north"; if (s) return "south"; if (wst) return "west"; if (e) return "east";
  if (/center|centre|middle|가운데|중앙|중간/u.test(w)) return "center";
  return undefined;
}
export type DesignShape = "rect" | "L" | "U" | "T" | "bay" | "alcove";
export function normalizeShape(raw: unknown): DesignShape {
  const w = String(raw ?? "").trim();
  if (/^l$|l.?shape|ㄱ|ㄴ|꺾/iu.test(w)) return "L";
  if (/^u$|u.?shape|ㄷ|ㄇ|말굽|horseshoe/iu.test(w)) return "U";
  if (/^t$|t.?shape|ㅗ|ㅜ/iu.test(w)) return "T";
  if (/alcove|알코브|벽감|nook|구석방/iu.test(w)) return "alcove";
  if (/bay|돌출|창가|oriel/iu.test(w)) return "bay";
  return "rect";
}

/** 모델이 모양을 고를 재료(room_parts·되돌려 보내기에 그대로 싣는다). 최소 크기는 바닥 칸(벽면 줄 빼고). */
export const SHAPE_GUIDE: readonly { shape: DesignShape; ko: string; min: string; what: string }[] = [
  { shape: "rect", ko: "네모", min: "5×4", what: "작은 방(바닥 40칸 아래)에 맞다. 60칸이 넘는 네모 방은 ㅁ자로 읽혀 검사가 짚는다" },
  { shape: "L", ko: "ㄱ자", min: "6×5", what: "corner(nw·ne·sw·se) 귀퉁이 하나를 막힌 덩이로 도려 낸다 — 꺾인 안쪽에 책상·독서 구석을 둔다" },
  { shape: "U", ko: "ㄷ자", min: "8×5", what: "북벽 가운데를 도려 낸다 — 양쪽 날개(서·동 북쪽 끝)가 위로 뻗고, 가운데 들어간 벽 앞이 주인공 자리" },
  { shape: "T", ko: "ㅜ자", min: "7×5", what: "남쪽 두 귀퉁이를 도려 낸다 — 문 쪽이 좁은 현관, 안쪽이 넓다" },
  { shape: "bay", ko: "창가 돌출", min: "8×5", what: "북쪽 두 귀퉁이를 도려 북벽 가운데가 앞으로 튀어나온다 — 돌출부에 창·책상·망원경" },
  { shape: "alcove", ko: "알코브", min: "7×5", what: "corner 쪽 북벽에 좁은(3~4칸) 들어간 구석을 남기고 나머지 북벽을 두 줄 내린다 — 구석에 침대·독서 의자·제단" },
];

/** 설계 모양 → 귀퉁이·가운데 도려내기. 바닥이 모양 최소 크기보다 작으면 네모로 짓고 이유를 돌려준다(함수가 크기를 바꾸지 않는다). */
export function shapeNotches(design: Pick<RoomDesign, "shape" | "corner">, w: number, fh: number): { shape: DesignShape; notches: HandInteriorNotch[]; dropped?: string } {
  const shape = normalizeShape(design.shape);
  const corner = normalizeCorner(design.corner);
  // 조립기 한도(rooms.ts·layout.ts): 도려 낸 너비 ≤ 바닥 너비-4, 높이 ≤ 바닥 높이-3.
  const maxW = w - 4, maxH = fh - 3;
  const guide = SHAPE_GUIDE.find((g) => g.shape === shape)!;
  const tooSmall = (): { shape: DesignShape; notches: HandInteriorNotch[]; dropped: string } => ({ shape: "rect", notches: [], dropped: `모양 ${shape}(${guide.ko})은 바닥 ${guide.min} 이상에서 지어진다 — 설계 바닥 ${w}×${fh} 라 네모로 지었다(w·h 를 키우거나 다른 모양으로)` });
  if (shape === "rect") return { shape, notches: [] };
  if (shape === "L") {
    const c = corner ?? "nw";
    const nw = Math.min(maxW, Math.max(2, Math.floor(w / 3))), nh = Math.min(maxH, c[0] === "n" ? 2 : Math.max(2, Math.min(3, fh - 3)));
    if (nw < 2 || nh < 2) return tooSmall();
    return { shape, notches: [{ corner: c, w: nw, h: nh }] };
  }
  if (shape === "U") {
    const nw = Math.min(maxW, w - 6), nh = Math.min(maxH, fh >= 7 ? 3 : 2);
    if (w < 8 || nw < 2 || nh < 2) return tooSmall();
    return { shape, notches: [{ corner: "nw", w: nw, h: nh, at: Math.floor((w - nw) / 2) }] };
  }
  if (shape === "T") {
    const nw = Math.min(maxW, Math.max(2, Math.floor((w - 3) / 2))), nh = Math.min(maxH, 2);
    if (w < 7 || nw < 2 || nh < 2) return tooSmall();
    return { shape, notches: [{ corner: "sw", w: nw, h: nh }, { corner: "se", w: nw, h: nh }] };
  }
  if (shape === "bay") {
    const bayW = Math.max(4, Math.ceil(w / 2));
    const nwL = Math.floor((w - bayW) / 2), nwR = w - bayW - nwL;
    if (w < 8 || Math.min(nwL, nwR) < 2 || maxH < 2) return tooSmall();
    return { shape, notches: [{ corner: "nw", w: Math.min(maxW, nwL), h: 2 }, { corner: "ne", w: Math.min(maxW, nwR), h: 2 }] };
  }
  // alcove: 구석(corner 쪽, 기본 nw) 3~4칸만 북벽 그대로, 나머지 북벽을 두 줄 내린다.
  const c = corner && corner[0] === "n" ? corner : "nw";
  const nookW = w >= 10 ? 4 : 3;
  const cutW = Math.min(maxW, w - nookW);
  if (w < 7 || cutW < 2 || maxH < 2) return tooSmall();
  return { shape, notches: [{ corner: c === "nw" ? "ne" : "nw", w: cutW, h: 2 }] };
}
export function normalizeCorner(raw: unknown): "nw" | "ne" | "sw" | "se" | undefined {
  const a = normalizeAt(raw);
  return a === "nw" || a === "ne" || a === "sw" || a === "se" ? a : undefined;
}
/** 남쪽 출구 자리 → 0~1(서→동). 모르면 undefined. */
export function normalizeDoor(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0.1, Math.min(0.9, raw > 1 ? raw / 100 : raw));
  const w = String(raw ?? "").toLowerCase();
  const num = Number(w);
  if (w && Number.isFinite(num)) return normalizeDoor(num);
  if (/left|west|왼|서/u.test(w)) return 0.2;
  if (/right|east|오른|동/u.test(w)) return 0.8;
  if (/center|middle|가운데|중앙|south|남/u.test(w)) return 0.5;
  return undefined;
}

const RUG_WORDS: readonly [RegExp, string][] = [[/royal|진홍|왕/iu, "rug royal"], [/red|붉|빨/iu, "rug red"], [/blue|파랑|파란|푸른/iu, "rug blue"], [/green|초록|녹/iu, "rug green"], [/purple|보라/iu, "rug purple"], [/brown|갈색|밤색/iu, "rug brown"]];
const SURFACE_RE = /desk|table|counter|roundtable|dining|bench|altar|stand|lectern/iu;
const FACE_RE = /^(.*) ([NSEW])$/u;

/** 칩셋에 있는 이름으로 맞춘다: 정확히 → 대소문자 무시 → 한국어 이름 → 낱말 포함(가장 짧은 것). */
export function resolveDesignItem(raw: string, S: HandInteriorSpec): { t: "o" | "g"; id: string } | undefined {
  const id = String(raw ?? "").trim();
  if (!id) return undefined;
  if (S.objects[id]) return { t: "o", id };
  if (S.goods[id] !== undefined) return { t: "g", id };
  const low = id.toLowerCase();
  const objs = Object.entries(S.objects);
  const exact = objs.find(([k, o]) => k.toLowerCase() === low || o.ko === id);
  if (exact) return { t: "o", id: exact[0] };
  const good = Object.keys(S.goods).find((k) => k.toLowerCase() === low);
  if (good) return { t: "g", id: good };
  const words = low.split(/[\s_·,/-]+/u).filter((w) => w.length >= 2);
  if (!words.length) return undefined;
  const hits = objs.filter(([k, o]) => { const hay = `${k} ${o.ko}`.toLowerCase(); return words.every((w) => hay.includes(w)); }).sort((a, b) => a[0].length - b[0].length);
  return hits[0] ? { t: "o", id: hits[0][0] } : undefined;
}
const rugId = (word: string | undefined, S: HandInteriorSpec): string | undefined => {
  if (!word) return undefined;
  if (S.lines[word]) return word;
  const hit = RUG_WORDS.find(([re]) => re.test(word));
  const id = hit?.[1] ?? "rug red";
  return S.lines[id] ? id : Object.keys(S.lines).find((k) => k.startsWith("rug"));
};

interface LocalItem { it: InteriorTemplateItem; hang: boolean; wallKind: boolean }

/** 묶음 하나를 상대 좌표 기물 목록으로(이름 맞춤·묶음 안 겹침 풀기·의자 방향은 여기서). */
function localGroup(g: RoomDesignGroup, S: HandInteriorSpec, label: string, fixes: string[]): { items: LocalItem[]; origin: [number, number] } {
  const at0 = normalizeAt(g.at);
  const vertical = at0 === "west" || at0 === "east";
  const out: LocalItem[] = [];
  const taken = new Set<string>();
  let cursor = 0;
  for (const raw0 of (g.items ?? []).slice(0, 24)) {
    // 기물 자리를 x·y 로 쓴 모델도 있다 — 묶음 안 상대 칸(dx·dy)으로 읽는다.
    const loose = raw0 as RoomDesignItem & { x?: number; y?: number };
    const raw: RoomDesignItem = { ...raw0, ...(typeof loose.dx !== "number" && typeof loose.x === "number" ? { dx: loose.x } : {}), ...(typeof loose.dy !== "number" && typeof loose.y === "number" ? { dy: loose.y } : {}) };
    const r = resolveDesignItem(raw.id, S);
    if (!r) { fixes.push(`${label}: 「${raw.id}」는 칩셋에 없어 뺐다`); continue; }
    if (r.id !== raw.id) fixes.push(`${label}: 「${raw.id}」를 칩셋 이름 「${r.id}」로 맞췄다`);
    const o = r.t === "o" ? S.objects[r.id] : undefined;
    const w = o?.w ?? 1, h = Math.max(1, o?.h ?? 1);
    const hang = o?.kind === "hang";
    const n = Math.max(1, Math.min(8, Math.floor(raw.count ?? 1)));
    for (let k = 0; k < n; k++) {
      let x: number, y: number;
      const given = typeof raw.dx === "number" || typeof raw.dy === "number";
      if (given) { x = Math.round(raw.dx ?? 0) + (vertical ? 0 : k * w); y = Math.round(raw.dy ?? 0) + (vertical ? k * h : 0); }
      else if (vertical) { x = 0; y = cursor; }
      else { x = cursor; y = 0; }
      if (hang) y = typeof raw.dy === "number" ? Math.min(-1, Math.round(raw.dy)) : -2;
      // 묶음 안에서 겹치면 이어 붙이는 쪽으로 민다.
      const cells = (px: number, py: number) => { const c: string[] = []; for (let yy = py; yy < py + (hang ? 1 : h); yy++) for (let xx = px; xx < px + w; xx++) c.push(`${xx},${yy}`); return c; };
      let shifted = 0;
      if (r.t === "o") while (cells(x, y).some((c) => taken.has(c)) && shifted < 12) { if (vertical) y++; else x++; shifted++; }
      if (shifted) fixes.push(`${label}: ${r.id} 가 같은 묶음 기물과 겹쳐 ${shifted}칸 밀었다`);
      if (r.t === "o") for (const c of cells(x, y)) taken.add(`${hang ? "h" : ""}${c}`);
      out.push({ it: { t: r.t, id: r.id, x, y }, hang, wallKind: o?.kind === "wall" });
      if (!given) cursor = vertical ? y + h : x + w;
      else cursor = Math.max(cursor, vertical ? y + h : x + w);
    }
  }
  // 의자 방향: 책상·탁자와 맞닿은 의자는 그쪽을 보게(그 방향 그림이 칩셋에 있을 때).
  for (const li of out) {
    const m = FACE_RE.exec(li.it.id);
    if (!m || !/chair|stool|armchair|sofa|bench/iu.test(m[1]!)) continue;
    const [cx, cy] = [li.it.x, li.it.y];
    const touch = (dx: number, dy: number) => out.some((q) => q !== li && q.it.t === "o" && SURFACE_RE.test(q.it.id) && (() => { const b = box(q.it, S); return cx + dx >= b[0] && cx + dx < b[2] && cy + dy >= b[1] && cy + dy < b[3]; })());
    const want = touch(0, -1) ? "N" : touch(0, 1) ? "S" : touch(-1, 0) ? "W" : touch(1, 0) ? "E" : undefined;
    if (!want || want === m[2]) continue;
    const next = `${m[1]} ${want}`;
    if (!S.objects[next]) continue;
    fixes.push(`${label}: ${li.it.id} 를 맞닿은 책상·탁자 쪽을 보게 ${next} 로 돌렸다`);
    (li as { it: InteriorTemplateItem }).it = { ...li.it, id: next };
  }
  // 바닥 상자 기준으로 0,0 에 맞춘다(걸이는 상대 y 그대로).
  const ground = out.filter((li) => !li.hang && li.it.t === "o");
  const mx = ground.length ? Math.min(...ground.map((li) => li.it.x)) : 0, my = ground.length ? Math.min(...ground.map((li) => li.it.y)) : 0;
  return { items: out.map((li) => ({ ...li, it: { ...li.it, x: li.it.x - mx, y: li.hang ? li.it.y : li.it.y - my } })), origin: [mx, my] };
}

/** 설계가 있는 방마다 묶음을 놓는다. 다른 방은 건드리지 않는다. */
export function furnishFromDesign(base: HandInteriorInput, rooms: readonly LayoutRoom[], designs: Readonly<Record<string, RoomDesign>>, composed: ComposedRooms, tileset: TilesetDef, S: HandInteriorSpec): DesignFurnishResult {
  const keep = doorwayCells(composed);
  let input = base;
  const first = buildHandInteriorLayers(input, tileset, S);
  let errors = first.issues.filter((i) => i.severity === "error").length, unreached = first.unreachedFloor.length;
  const solid = new Set<string>(), flat = new Set<string>(), wcols = new Set<string>();
  const perRoom: Record<string, DesignRoomReport> = {};
  for (const room of rooms) {
    const design = designs[room.id];
    if (!design) continue;
    const fixes: string[] = [], placed: string[] = [];
    const fy0 = room.y0 + 2;
    const fw = room.x1 - room.x0 + 1, fh = room.y1 - fy0 + 1;
    const nrs = (room.notches ?? []).map((n) => notchRect(room, n));
    const inNotch = (x: number, y: number) => nrs.some((nr) => x >= nr.x0 && x <= nr.x1 && y >= nr.y0 && y <= nr.y1);
    // 북벽 줄: 북쪽을 도려 낸 칸(ㄷ자 가운데·창가 돌출 양옆·알코브 옆)은 북벽이 내려와 있다 — 벽 가구·걸이는 그 내려온 벽 밑에도 선다.
    const northCuts = (room.notches ?? []).filter((n) => n.corner[0] === "n").map((n) => notchRect(room, n));
    const wallRowAt = (x: number) => { const nr = northCuts.find((r) => x >= r.x0 && x <= r.x1); return nr ? nr.y1 + 1 : fy0; };
    /** x0..x1 이 같은 북벽 줄 밑이면 그 바닥 줄, 계단 진 곳에 걸치면 undefined. */
    const wallRowOf = (x0: number, x1: number): number | undefined => { const r = wallRowAt(x0); for (let x = x0 + 1; x <= x1; x++) if (wallRowAt(x) !== r) return undefined; return r; };
    let floor = 0;
    for (let y = fy0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) if (!inNotch(x, y)) floor++;
    let blocked = 0, itemCount = 0;
    const groups: { g: RoomDesignGroup; label: string }[] = [];
    (design.groups ?? []).slice(0, 16).forEach((g, i) => {
      const label = `「${g.name ?? `묶음 ${i + 1}`}」`;
      // 벽 가구(책장·진열장)는 북벽 첫 바닥 줄에만 선다 — 다른 벽 묶음에 든 것은 북벽 묶음으로 떼어 낸다.
      const ga = normalizeAt(g.at);
      if (ga && ga !== "north" && ga !== "nw" && ga !== "ne" && typeof g.y !== "number") {
        const wallItems = (g.items ?? []).filter((it) => { const r = resolveDesignItem(it.id, S); return r?.t === "o" && (S.objects[r.id]?.kind === "wall" || S.objects[r.id]?.kind === "hang"); });
        if (wallItems.length) {
          fixes.push(`${label}: 벽 가구·걸이(${wallItems.map((it) => it.id).join("·")})는 북벽에만 서서 북벽 묶음으로 옮겼다`);
          groups.push({ g: { ...g, items: (g.items ?? []).filter((it) => !wallItems.includes(it)) }, label });
          groups.push({ g: { name: `${g.name ?? `묶음 ${i + 1}`}(북벽)`, at: "north", pos: ga === "west" || ga === "sw" ? 0 : ga === "east" || ga === "se" ? 1 : g.pos ?? 0.5, items: wallItems.map((it) => ({ id: it.id, count: it.count })) }, label: `「${g.name ?? `묶음 ${i + 1}`}(북벽)」` });
          return;
        }
      }
      groups.push({ g, label });
    });
    for (const { g: g0, label } of groups) {
      // 묶음 자리를 dx·dy 로 쓴 모델도 있다(flash): at 이 있으면 그 자리에서 민 만큼, 없으면 바닥 좌표 x·y 로 읽는다.
      const lg = g0 as RoomDesignGroup & { dx?: number; dy?: number };
      const shove = typeof lg.dx === "number" || typeof lg.dy === "number" ? [Math.round(lg.dx ?? 0), Math.round(lg.dy ?? 0)] as const : undefined;
      const g: RoomDesignGroup = shove && typeof g0.x !== "number" && g0.at === undefined ? { ...g0, x: shove[0], y: shove[1] } : g0;
      const offset = shove && g0.at !== undefined && typeof g0.x !== "number" ? shove : [0, 0] as const;
      if (!(g.items ?? []).length) continue;
      const { items: local0, origin } = localGroup(g, S, label, fixes);
      if (!local0.length) continue;
      // 묶음이 벽·방보다 길면 묶음째 버리지 않고 뒤에서부터 덜어 들어가는 만큼 놓는다(2026-10-29 3c flash: 책장 3w×3 을 8칸 북벽에 줘 책장이 하나도 안 섰다).
      const attempt = (local: LocalItem[]) => {
      const ground = local.filter((li) => !li.hang && li.it.t === "o");
      const gw = ground.length ? Math.max(...ground.map((li) => box(li.it, S)[2])) : Math.max(1, ...local.map((li) => box(li.it, S)[2]));
      const gh = ground.length ? Math.max(...ground.map((li) => box(li.it, S)[3])) : 1;
      if (ground.some((li) => li.wallKind && li.it.y !== 0)) fixes.push(`${label}: 벽 가구는 묶음 맨 윗줄(북벽에 붙는 줄)에 둬야 한다 — 도달 검사가 막으면 빠진다`);
      // 자리: x·y 가 있으면 그 칸, at 이 있으면 그 벽·모서리, 둘 다 없으면 items 의 dx·dy 를 바닥 좌표로(2026-10-29 Argon: at 없이 dx·dy 에 방 좌표를 썼다).
      const named = normalizeAt(g.at);
      if (g.at !== undefined && !named) fixes.push(`${label}: 자리 「${g.at}」를 몰라 가운데로 읽었다`);
      // at·x·y 가 없을 때: 기물에 dx·dy 를 줬으면 그것이 바닥 좌표, pos 만 줬으면 벽을 따라 그 자리(벽 가구가 든 묶음은 북벽, 아니면 가운데 줄)
      // — 2026-10-29 3c flash 귀족 서재: pos 0·0.5·1 만 준 세 묶음을 바닥 좌표로 읽어 모두 (0,0) 에 몰고 벽난로 묶음을 버렸다.
      const givenXY = (g.items ?? []).some((it) => { const l = it as RoomDesignItem & { x?: number; y?: number }; return typeof it.dx === "number" || typeof it.dy === "number" || typeof l.x === "number" || typeof l.y === "number"; });
      const hasWall = local.some((li) => li.wallKind || li.hang);
      const absolute = !named && g.at === undefined && !(typeof g.x === "number" && typeof g.y === "number") && givenXY && typeof g.pos !== "number";
      const implied = !named && g.at === undefined && !(typeof g.x === "number" && typeof g.y === "number") && !absolute ? (hasWall ? "north" : "center") as DesignAt : undefined;
      const impliedNote = `${label}: 자리(at)가 없어 pos ${g.pos} 를 ${implied === "north" ? "북벽" : "가운데 줄"}을 따라 읽었다`;
      if (implied && typeof g.pos === "number" && !fixes.includes(impliedNote)) fixes.push(impliedNote);
      const at = typeof g.x === "number" && typeof g.y === "number" || absolute ? undefined : (named ?? implied ?? "center");
      const pos = Math.max(0, Math.min(1, typeof g.pos === "number" ? g.pos : 0.5));
      const along = (span: number) => Math.round(pos * Math.max(0, span));
      let tx: number, ty: number;
      if (absolute) { tx = room.x0 + origin[0]; ty = fy0 + origin[1]; }
      else if (!at) { tx = room.x0 + Math.round(g.x!); ty = fy0 + Math.round(g.y!); }
      else {
        const west = at === "west" || at === "nw" || at === "sw", east = at === "east" || at === "ne" || at === "se";
        const north = at === "north" || at === "nw" || at === "ne", south = at === "south" || at === "sw" || at === "se";
        tx = west ? room.x0 : east ? room.x1 - gw + 1 : room.x0 + along(fw - gw);
        ty = north ? wallRowOf(Math.max(room.x0, tx), Math.min(room.x1, tx + gw - 1)) ?? fy0 : south ? room.y1 - gh + 1 : at === "west" || at === "east" ? fy0 + along(fh - gh) : fy0 + Math.round((fh - gh) / 2);
        tx += offset[0]; ty += offset[1];
      }
      const onLine = (x: number, y: number) => {
        if (!at) return 0;
        if (at === "north" || at === "nw" || at === "ne") return y === (wallRowOf(x, x + gw - 1) ?? fy0) ? 0 : 4;
        if (at === "south" || at === "sw" || at === "se") return y === room.y1 - gh + 1 ? 0 : 4;
        if (at === "west") return x === room.x0 ? 0 : 4;
        if (at === "east") return x === room.x1 - gw + 1 ? 0 : 4;
        return 0;
      };
      const spots: [number, number, number][] = [];
      for (let y = fy0; y <= room.y1 - gh + 1; y++) for (let x = room.x0; x <= room.x1 - gw + 1; x++) {
        const d = Math.abs(x - tx) + Math.abs(y - ty) + onLine(x, y);
        if (d <= 8) spots.push([x, y, d]);
      }
      spots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      let why = gw > fw || gh > fh ? `묶음 ${gw}×${gh}칸이 바닥 ${fw}×${fh}칸보다 크다` : spots.length ? "" : "8칸 안에 자리가 없다";
      const tryAt = (px: number, py: number): InteriorTemplateItem[] | undefined => {
        const items: InteriorTemplateItem[] = local.map((li) => { const x = px + li.it.x; return { ...li.it, x, y: li.hang ? (wallRowOf(x, x + (S.objects[li.it.id]?.w ?? 1) - 1) ?? fy0) + li.it.y : py + li.it.y }; });
        const sCells: string[] = [], fCells: string[] = [], cols: string[] = [];
        for (const it of items) {
          const b = box(it, S);
          const hang = it.t === "o" && S.objects[it.id]?.kind === "hang";
          if (hang) { if (b[0] < room.x0 || b[2] - 1 > room.x1 || wallRowOf(b[0], b[2] - 1) === undefined) { why = "걸이가 벽 밖·꺾인 벽에 걸침"; return undefined; } }
          else if (it.t !== "g") for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
            if (x < room.x0 || x > room.x1 || y < fy0 || y > room.y1 || inNotch(x, y)) { why = "방 밖·도려 낸 귀퉁이"; return undefined; }
          }
          if (it.t === "o" && S.objects[it.id]?.kind === "wall" && b[1] !== wallRowOf(b[0], b[2] - 1)) { why = "벽 가구가 북벽에서 떨어짐"; return undefined; }
          if (blocks(it, S)) sCells.push(...cellsOfBox(b));
          else if (!hang && it.t !== "g") fCells.push(...cellsOfBox(b));
          // 벽면 열은 북벽에 붙은 키 큰 가구·걸이만 쓴다(방 가운데·남쪽의 망원경이 북벽 책장 열과 다툰다며 빠졌다 — 2026-10-29 Argon 첫 시험).
          if (hang || b[1] === wallRowOf(b[0], b[2] - 1)) cols.push(...wallColumns(it, S));
        }
        if (sCells.some((c) => keep.has(c))) { why = "문 앞 통로"; return undefined; }
        if (sCells.some((c) => solid.has(c) || flat.has(c)) || fCells.some((c) => solid.has(c))) { why = "다른 묶음과 겹침"; return undefined; }
        if (cols.some((c) => wcols.has(c))) { why = "벽면 열을 다른 벽 가구가 씀"; return undefined; }
        // 깔개: 묶음 바닥 상자 전체(가구 밑까지).
        const rug = rugId(g.rug, S);
        const rugCells: [number, number][] = [];
        if (rug) for (let y = py; y < py + gh; y++) for (let x = px; x < px + gw; x++) if (!keep.has(`${x},${y}`) && !flat.has(`${x},${y}`) && !solid.has(`${x},${y}`) && !inNotch(x, y) && x >= room.x0 && x <= room.x1 && y >= fy0 && y <= room.y1) rugCells.push([x, y]);
        const withRug = rug && rugCells.length ? [{ t: "l" as const, id: rug, x: px, y: py, cells: rugCells }, ...items] : items;
        const next = withItems(input, withRug);
        const built = buildHandInteriorLayers(next, tileset, S);
        const e = built.issues.filter((i) => i.severity === "error").length;
        if (e > errors) { why = `조립 오류(${built.issues.find((i) => i.severity === "error")?.message.slice(0, 60)})`; return undefined; }
        if (built.unreachedFloor.length > unreached) { why = "닿지 못하는 바닥이 생김"; return undefined; }
        input = next; errors = e; unreached = built.unreachedFloor.length;
        for (const c of sCells) solid.add(c);
        for (const c of fCells) flat.add(c);
        for (const [x, y] of rugCells) flat.add(`${x},${y}`);
        for (const c of cols) wcols.add(c);
        blocked += new Set(sCells).size;
        return withRug;
      };
      let done: [number, number] | undefined, firstWhy = "";
      for (const [x, y] of spots) {
        if (tryAt(x, y)) { done = [x, y]; break; }
        if (!firstWhy) firstWhy = why;
      }
      return { done, firstWhy, why, tx, ty };
      };
      let local = local0;
      let got = attempt(local);
      const firstTry = got;
      while (!got.done && local.filter((li) => li.it.t === "o").length > 1) {
        // 맨 뒤 기물(걸이가 아닌 것)부터 하나씩 덜어 본다.
        const idx = local.map((li, i) => [li, i] as const).filter(([li]) => li.it.t === "o" && !li.hang).map(([, i]) => i).pop() ?? local.length - 1;
        local = local.filter((_, i) => i !== idx);
        got = attempt(local);
      }
      if (got.done && local.length < local0.length) {
        const cut = local0.filter((li) => !local.includes(li)).map((li) => li.it.id);
        fixes.push(`${label}: 묶음 전체(${local0.length}개)는 바닥 (${firstTry.tx - room.x0},${firstTry.ty - fy0}) 근처에 들어가지 않아(${firstTry.firstWhy || firstTry.why || "자리 없음"}) ${local.length}개만 놓고 ${cut.join("·")} 를 뺐다 — 방을 넓히거나 묶음을 줄여라`);
      }
      const { done, tx, ty } = got;
      const firstWhy = got.firstWhy || firstTry.firstWhy, why = got.why;
      if (!done) {
        fixes.push(`${label}: 바닥 (${tx - room.x0},${ty - fy0}) 근처에 놓을 자리가 없어 뺐다(${firstWhy || why || "자리 없음"})`);
        continue;
      }
      itemCount += local.filter((li) => li.it.t === "o").length;
      const [dx, dy] = [done[0] - tx, done[1] - ty];
      if (dx || dy) fixes.push(`${label}: 바닥 (${tx - room.x0},${ty - fy0}) → (${done[0] - room.x0},${done[1] - fy0}) 로 ${Math.abs(dx) + Math.abs(dy)}칸 옮겼다(${firstWhy})`);
      placed.push(`${g.name ?? label} @${done[0] - room.x0},${done[1] - fy0}`);
    }
    // 묶음을 넘는 의자 방향: 다른 묶음의 책상·탁자와 맞닿은 의자도 그쪽을 보게(2026-10-29 flash: 「의자」를 따로 묶어 책상 북쪽에 두어 책장을 보고 앉았다).
    {
      const inRoom = (x: number, y: number) => x >= room.x0 && x <= room.x1 && y >= fy0 && y <= room.y1;
      const surfaces: [number, number, number, number][] = [
        ...(input.objects ?? []).filter((o) => SURFACE_RE.test(o.id) && S.objects[o.id] && inRoom(o.x, o.y)).map((o) => box({ t: "o", id: o.id, x: o.x, y: o.y }, S)),
        ...(input.tables ?? []).filter((t) => inRoom(t.x, t.y)).map((t) => [t.x, t.y, t.x + t.w, t.y + t.h] as [number, number, number, number]),
      ];
      const hit = (x: number, y: number) => surfaces.some((b) => x >= b[0] && x < b[2] && y >= b[1] && y < b[3]);
      const objects = (input.objects ?? []).map((o) => {
        const m = FACE_RE.exec(o.id);
        if (!m || !/chair|stool|armchair|sofa|bench/iu.test(m[1]!) || !inRoom(o.x, o.y)) return o;
        const facing: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
        if (hit(o.x + facing[m[2]!]![0], o.y + facing[m[2]!]![1])) return o;
        const want = (["N", "S", "W", "E"] as const).find((d) => hit(o.x + facing[d]![0], o.y + facing[d]![1]));
        const next = want ? `${m[1]} ${want}` : undefined;
        if (!next || !S.objects[next]) return o;
        fixes.push(`${o.id}(${o.x - room.x0},${o.y - fy0}) 를 맞닿은 책상·탁자 쪽을 보게 ${next} 로 돌렸다`);
        return { ...o, id: next };
      });
      input = { ...input, objects };
    }
    perRoom[room.id] = { placed, fixes, blockedShare: floor ? Math.round(100 * blocked / floor) / 100 : 0, floor, items: itemCount };
  }
  return { input, perRoom };
}
