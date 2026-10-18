// 시설 84곳(facilityVenues*.ts)을 짧게 적는 도구 - 2026-10-18 21:17 사용자 「왜 방을 사각형으로만 만드냐 … 교육·의료·상점·음식점·오락·주거·공공·교통·숙박·일본 전통·기타 시설 다 만들어」.
// 방 안 가구는 줄(rows)·격자(grid)·벽 줄(wall)·걸이 줄(hang)·책상 열(desks)로 적고, 칸 크기는 공용 방 스펙(modernCityRoomSpec.json)에서 읽는다.
// 겹침·방 밖은 furnish.ts 가 거른다. 평면은 rows 의 `~` 표지가 만든다: `~` 는 그 줄에서 남는 너비를 채우는 건물 밖(void)이라
// 줄마다 방 너비 합이 다르면 ㄱ·ㅜ·ㄷ·계단형 외곽이 된다 - 사각형으로 두지 않는다.
import spec from "@/assets/modernCityRoomSpec.json";
import type { InteriorRoomTemplate, InteriorTemplateItem } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";
import { o, seatedTable, t, type Venue } from "./venueKit";

// 번들 JSON(모양 고정)에서 칸 크기만 읽는다 - 이름 붙인 형으로 한 번만 단언한다.
interface SpecObj { readonly w: number; readonly h: number; readonly up: number; readonly kind: string }
interface SpecShape { objects: Record<string, SpecObj> }
const OBJ = (spec as unknown as SpecShape).objects;
/** `m:xxx` 는 `mci-xxx`. */
export const id = (s: string): string => (s.startsWith("m:") ? `mci-${s.slice(2)}` : s);
const sizeOf = (s: string): { w: number; h: number; up: number } => { const q = OBJ[id(s)]; return { w: q?.w ?? 1, h: Math.max(1, q?.h ?? 1), up: q?.up ?? 0 }; };

export const F = { oak: "mci-wood-oak", dark: "mci-wood-dark", carpet: "mci-carpet-office", stone: "mci-stone-lobby", vinyl: "mci-vinyl-store", hosp: "mci-vinyl-hospital", tile: "mci-tile-concourse", conc: "mci-concrete", small: "mci-tile-small" } as const;
export const W = { office: "mci-wall-office", lobby: "mci-wall-lobby", store: "mci-wall-store", home: "mci-wall-home", hosp: "mci-wall-hospital", brick: "mci-wall-brick", tile: "mci-wall-tile", metal: "mci-wall-metal" } as const;

export type RowAlign = "spread" | "center" | "west" | "east";

/** x0..x1 구간에 w_i 폭 아이템들을 align 에 맞춰 배치한 x 좌표 목록. `_` 는 빈 자리(가중치). */
function packLine(w: number, list: readonly string[], align: RowAlign = "spread", x0?: number, gap?: number, minX = 1, maxX = w - 2): { id: string; x: number; w: number }[] {
  const real = list.filter((k) => k !== "_");
  if (!real.length) return [];
  if (x0 !== undefined) {
    const g = gap ?? 1;
    let cx = x0;
    const out: { id: string; x: number; w: number }[] = [];
    for (const k of list) {
      if (k === "_") { cx += 2; continue; }
      const sw = sizeOf(k).w;
      out.push({ id: id(k), x: cx, w: sw });
      cx += sw + g;
    }
    return out;
  }
  const widths = list.map((k) => (k === "_" ? 0 : sizeOf(k).w));
  const sumW = widths.reduce((a, b) => a + b, 0);
  const span = Math.max(sumW, maxX - minX + 1);
  const slack = Math.max(0, span - sumW);
  if (align === "west") {
    let cx = minX;
    const out: { id: string; x: number; w: number }[] = [];
    for (const k of list) {
      if (k === "_") { cx += 2; continue; }
      const sw = sizeOf(k).w;
      out.push({ id: id(k), x: cx, w: sw });
      cx += sw + (gap ?? 1);
    }
    return out;
  }
  if (align === "east") {
    const g = gap ?? 1;
    const total = sumW + (real.length - 1) * g;
    let cx = Math.max(minX, maxX + 1 - total);
    const out: { id: string; x: number; w: number }[] = [];
    for (const k of list) {
      if (k === "_") { cx += 2; continue; }
      const sw = sizeOf(k).w;
      out.push({ id: id(k), x: cx, w: sw });
      cx += sw + g;
    }
    return out;
  }
  if (align === "center") {
    const g = gap ?? 1;
    const total = sumW + (list.length - 1) * g;
    let cx = Math.max(minX, minX + Math.floor((span - total) / 2));
    const out: { id: string; x: number; w: number }[] = [];
    for (const k of list) {
      if (k === "_") { cx += 2; continue; }
      const sw = sizeOf(k).w;
      out.push({ id: id(k), x: cx, w: sw });
      cx += sw + g;
    }
    return out;
  }
  // align === "spread": 아이템과 `_` 슬롯 사이에 slack 을 고르게 분배(남는 칸은 가운데 간격부터).
  const slots = list.length + 1;
  const baseG = Math.floor(slack / slots);
  const rem = slack % slots;
  const midStart = Math.floor((slots - rem) / 2);
  let cx = minX;
  const out: { id: string; x: number; w: number }[] = [];
  for (let i = 0; i < list.length; i++) {
    cx += baseG + (i >= midStart && i < midStart + rem ? 1 : 0);
    const k = list[i]!;
    if (k === "_") continue;
    const sw = sizeOf(k).w;
    out.push({ id: id(k), x: Math.min(w - sw, cx), w: sw });
    cx += sw;
  }
  return out;
}

export interface RoomSpec {
  /** 북쪽 벽 걸이(y 0) - 키가 큰 벽 가구(up≥32) 위를 피해 빈 구간에 고르게 건다. */
  readonly hang?: readonly string[];
  /** 북쪽 벽 가구(y 2) - 기본 spread 정렬로 방 너비에 고르게 편다 (`_` 는 빈 구간 가중치). */
  readonly wall?: readonly string[];
  readonly wallAlign?: RowAlign;
  /** 남쪽 벽 가구(y = h - objH) */
  readonly south?: readonly string[];
  /** 서쪽 벽 가구(x = 0) / 동쪽 벽 가구(x = w - objW) */
  readonly west?: readonly string[];
  readonly east?: readonly string[];
  /** F-B counterLine: [카운터 id, n, x, y, staffProps?] — 연속 카운터 + 뒤쪽 직원 라인 */
  readonly counterLine?: readonly (readonly [string, number, number, number, (readonly string[])?])[];
  /** [y (음수면 h+y), 가구 목록, 시작 x (생략 시 align), 간격, 정렬 = "spread"] */
  readonly rows?: readonly (readonly [number, readonly string[], number?, number?, RowAlign?])[];
  /** front/mid/back 3대역 자동 배치: [front(y=3..4), mid(y=h/2), back(y=h-2)] */
  readonly bands?: { readonly front?: readonly string[]; readonly mid?: readonly string[]; readonly back?: readonly string[] };
  /** [가구, x0, y0, 열, 행, x 걸음 = 폭 + 1, y 걸음 = 높이 + 1] */
  readonly grid?: readonly (readonly [string, number, number, number, number, number?, number?])[];
  readonly at?: readonly (readonly [string, number, number])[];
  /** [탁자 줄, 의자 바탕 id, x, y, w, h, 면 선택] - 네 면 의자 */
  readonly seat?: readonly (readonly [string, string, number, number, number, number, { readonly n?: boolean; readonly s?: boolean; readonly e?: boolean; readonly w?: boolean }?])[];
  /** [x0, y0, 열, 행, x 걸음 = 3, y 걸음 = 3] 학생 책상(2×1)과 아래 두 의자 */
  readonly desks?: readonly (readonly [number, number, number, number, number?, number?])[];
  /** F3 bar: [카운터 id, 스툴 id, x, y, 카운터 수, 방향="s"|"n"] — 빈틈 없이 이어 붙인 카운터와 바로 맞닿은 스툴 한 덩이 */
  readonly bar?: readonly (readonly [string, string, number, number, number, ("s" | "n")?])[];
  /** F3 pair: [책상/거울 id, 의자 id, x, y, 열, 행, pitchX, pitchY, 방향="s"|"n"|"pod"] — 책상과 의자가 맞닿은 짝/양면 섬 */
  readonly pair?: readonly (readonly [string, string, number, number, number, number, number?, number?, ("s" | "n" | "pod")?])[];
  /** F3 queue: [창구/카운터 id, x, y, 개수, 대기열 의자 id?, 대기열 y?, 대기열 개수?] — 서비스 창구 줄 + 2줄 빈 대기 공간 + 마주 보는 대기석 */
  readonly queue?: readonly (readonly [string, number, number, number, string?, number?, number?])[];
  /** 체육관·차고·승강장 등 가운데 바닥을 비워 두는 방 표시 */
  readonly openFloor?: boolean;
  /** 로비·라운지 등에서 출입문 옆 화분 1개만 허용 (구석 쌍 화분 금지) */
  readonly pl?: boolean | readonly [number, number];
}

const WALL_ONLY_RE = /vending|locker|ticket-machine|atm|cooler|fridge|mci-shelf|filing|bookshelf|cabinet|vault-door|board|tv|plant-tall|dispenser|pallet|basket-stack|rack|glass-showcase|med-cart|stone-lantern/u;
const FLOOR_GONDOLA_RE = /stationery-rack|clothing-rack/u;

export type FRoom = Venue["rooms"][number] & { readonly openFloor?: boolean };

export function room(kind: string, w: number, h: number, floor: string, wall: string, s: RoomSpec = {}): FRoom {
  const items: InteriorTemplateItem[] = [];
  const resolveY = (y: number) => (y < 0 ? h + y : y);

  // 1) 북벽 가구(y=2)를 먼저 배치하고 점유 열을 기록한다 — 모든 북벽 가구는 윗부분(y=1)을 쓰므로 걸이(y=0..1)와 열이 겹치지 않게 한다(F1, F4).
  const tallWallCols = new Set<number>();
  const markWallObj = (_wid: string, wx: number, ww: number) => {
    for (let dx = 0; dx < ww; dx++) tallWallCols.add(wx + dx);
  };
  const wallPlaced = packLine(w, s.wall ?? [], s.wallAlign ?? "spread", undefined, undefined, 0, w - 1);
  for (const wp of wallPlaced) {
    items.push(o(wp.id, wp.x, 2));
    markWallObj(wp.id, wp.x, wp.w);
  }
  for (const [k, ax, ay] of s.at ?? []) {
    if (resolveY(ay) === 2) {
      markWallObj(id(k), ax, sizeOf(k).w);
    }
  }
  if (s.south?.length) {
    for (const sp of packLine(w, s.south, "spread", undefined, undefined, 1, w - 2)) {
      const sh = sizeOf(sp.id).h;
      items.push(o(sp.id, sp.x, h - sh));
    }
  }
  if (s.west?.length) {
    let wy = 2;
    for (const wk of s.west) {
      const wz = sizeOf(wk);
      if (wy === 2) markWallObj(id(wk), 0, wz.w);
      items.push(o(id(wk), 0, wy));
      wy += wz.h + 1;
    }
  }
  if (s.east?.length) {
    let ey = 2;
    for (const ek of s.east) {
      const ez = sizeOf(ek);
      if (ey === 2) markWallObj(id(ek), w - ez.w, ez.w);
      items.push(o(id(ek), w - ez.w, ey));
      ey += ez.h + 1;
    }
  }
  for (const [cId, n, cx, cy0, staffProps] of s.counterLine ?? []) {
    const cy = resolveY(cy0);
    const cw = sizeOf(cId).w;
    for (let i = 0; i < n; i++) items.push(o(id(cId), cx + i * cw, cy));
    if (staffProps?.length) {
      for (const sp of packLine(n * cw, staffProps, "spread", undefined, undefined, 0, n * cw - 1)) {
        items.push(o(sp.id, cx + sp.x, 2));
        markWallObj(sp.id, cx + sp.x, sp.w);
      }
    }
  }

  // 2) 걸이(hang, y=0)는 tallWallCols 와 겹치지 않는 열에 고르게 배치한다(F4).
  if (s.hang?.length) {
    const candidates = packLine(w, s.hang, "spread", undefined, undefined, 1, w - 2);
    const usedHang = new Set<number>();
    for (const hg of candidates) {
      let hx = hg.x;
      const fits = (pos: number) => pos >= 0 && pos + hg.w <= w && Array.from({ length: hg.w }, (_, d) => pos + d).every((c) => !tallWallCols.has(c) && !usedHang.has(c));
      if (!fits(hx)) {
        for (let d = 1; d < w; d++) {
          if (fits(hx + d)) { hx = hx + d; break; }
          if (fits(hx - d)) { hx = hx - d; break; }
        }
      }
      if (fits(hx)) {
        items.push(o(hg.id, hx, 0));
        for (let d = 0; d < hg.w; d++) usedHang.add(hx + d);
      }
    }
  }

  // 3) F3 bar: 연속 카운터 + 빈틈없이 맞닿은 스툴
  for (const [cId, sId, bx, by0, n, side = "s"] of s.bar ?? []) {
    const by = resolveY(by0);
    const cw = sizeOf(cId).w, ch = sizeOf(cId).h;
    const sy = side === "n" ? by - 1 : by + ch;
    for (let i = 0; i < n; i++) {
      const cx = bx + i * cw;
      items.push(o(id(cId), cx, by));
      for (let dx = 0; dx < cw; dx++) items.push(o(id(sId), cx + dx, sy));
    }
  }

  // 4) F3 pair: 책상/거울 + 맞닿은 의자 (또는 마주 보는 pod)
  for (const [dId, cId, px, py0, cols, rws, sx, sy, mode = "s"] of s.pair ?? []) {
    const py = resolveY(py0);
    const dw = sizeOf(dId).w, dh = sizeOf(dId).h;
    const stepX = sx ?? dw + 2;
    const stepY = sy ?? (mode === "pod" ? dh * 2 + 3 : dh + 2);
    for (let r = 0; r < rws; r++) for (let c = 0; c < cols; c++) {
      const dx = px + c * stepX, dy = py + r * stepY;
      if (mode === "n") {
        items.push(o(id(cId), dx, dy), o(id(dId), dx, dy + 1));
      } else if (mode === "pod") {
        const backDesk = id(dId) === "mci-desk-pc" ? "mci-desk-pc-back" : id(dId);
        const southChair = id(cId).replace(/-[nsew]$/u, "") + "-s";
        const northChair = id(cId).replace(/-[nsew]$/u, "") + "-n";
        items.push(o(southChair, dx, dy), o(backDesk, dx, dy + 1), o(id(dId), dx, dy + 2), o(northChair, dx, dy + 3));
      } else {
        items.push(o(id(dId), dx, dy), o(id(cId), dx, dy + dh));
      }
    }
  }

  // 5) F3 queue: 연속 창구 줄 + 최소 2칸 대기 공간 + 마주 보는 대기 의자 줄
  for (const [qId, qx, qy0, n, wId, wy0, wn] of s.queue ?? []) {
    const qy = resolveY(qy0);
    const qw = sizeOf(qId).w;
    for (let i = 0; i < n; i++) items.push(o(id(qId), qx + i * qw, qy));
    if (wId && wn) {
      const wy = wy0 !== undefined ? resolveY(wy0) : Math.min(h - 2, qy + 3);
      const ww = sizeOf(wId).w;
      for (let i = 0; i < wn; i++) items.push(o(id(wId), qx + i * (ww + 1), wy));
    }
  }

  // 6) F1 & F5 rows + bands (식물은 rows 에서 자동 제거)
  const allRows: (readonly [number, readonly string[], number?, number?, RowAlign?])[] = [
    ...(s.rows ?? []),
    ...(s.bands?.front ? [[3, s.bands.front] as const] : []),
    ...(s.bands?.mid ? [[Math.floor(h / 2), s.bands.mid] as const] : []),
    ...(s.bands?.back ? [[h - 2, s.bands.back] as const] : []),
  ];
  for (const [rawY, list, x0, gap, align = "spread"] of allRows) {
    const y = resolveY(rawY);
    const filtered = list.filter((k) => id(k) !== "mci-plant-tall");
    for (const p of packLine(w, filtered, align, x0, gap, 1, w - 2)) {
      items.push(o(p.id, p.x, y));
    }
  }

  // 7) grid / desks / seat / at
  for (const [k, x0, y0, cols, rws, sx, sy] of s.grid ?? []) {
    const z = sizeOf(k);
    const ry0 = resolveY(y0);
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) items.push(o(id(k), x0 + i * (sx ?? z.w + 1), ry0 + j * (sy ?? z.h + 1)));
  }
  for (const [x0, y0, cols, rws, sx = 3, sy = 3] of s.desks ?? []) {
    const ry0 = resolveY(y0);
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
      const dx = x0 + i * sx, dy = ry0 + j * sy;
      items.push(t("mci-t-wood", dx, dy, 2, 1), o("mci-chair-wood-n", dx, dy + 1), o("mci-chair-wood-n", dx + 1, dy + 1));
    }
  }
  for (const [tb, ch, tx, ty, tw, th, sides] of s.seat ?? []) items.push(...seatedTable(tb, id(ch), tx, resolveY(ty), tw, th, sides));
  for (const [k, ax, ay] of s.at ?? []) {
    if (id(k) === "mci-plant-tall") continue;
    items.push(o(id(k), ax, resolveY(ay)));
  }

  // 8) F2: 화분은 방당 최대 1개, 명시된 위치(s.pl = [x, y])에만 둔다(기본 pl: true 구석 쌍 화분 폐기).
  if (Array.isArray(s.pl)) {
    items.push(o("mci-plant-tall", s.pl[0], resolveY(s.pl[1])));
  }
  for (const it of items) {
    if (it.t !== "o") continue;
    const q = OBJ[it.id];
    if (!q || q.kind === "hang" || q.kind === "flat") continue;
    const iw = Math.max(1, q.w ?? 1), ih = Math.max(1, q.h ?? 1);
    const touchesWall = it.y <= 2 || it.y + ih >= h || it.x === 0 || it.x + iw >= w;
    if (WALL_ONLY_RE.test(it.id) && !FLOOR_GONDOLA_RE.test(it.id) && !touchesWall) {
      throw new Error(`WALL_ONLY prop ${it.id} in ${kind} at (${it.x},${it.y}) must touch a wall`);
    }
  }
  return { kind, w, h, floor, wall, items, ...(s.openFloor ? { openFloor: true } : {}) };
}

export type Category = "교육시설" | "의료시설" | "상점" | "음식점" | "오락시설" | "주거시설" | "공공시설" | "교통시설" | "숙박시설" | "일본 전통시설" | "기타 시설";

export interface FacilitySpec {
  readonly cat: Category;
  readonly p: string;
  readonly map: string;
  readonly ko: string;
  /** 외곽 모양 태그(L자형·ㄷ자형·ㅗ자형·계단형·중정형…) */
  readonly shape: string;
  readonly entrance: string;
  /** 줄 배치(북→남, 서→동). `~` 는 남는 너비를 채우는 건물 밖. */
  readonly rows: readonly (readonly string[])[];
  readonly rooms: readonly FRoom[];
  readonly hubs?: readonly string[];
  readonly above?: readonly (readonly [string, string])[];
  readonly left?: readonly (readonly [string, string])[];
}
export interface FacilityVenue extends Venue { readonly cat: Category; readonly ko: string; readonly shape: string; readonly rooms: readonly FRoom[] }

const ALT_F: Record<string, string> = { [F.oak]: F.dark, [F.dark]: F.carpet, [F.carpet]: F.small, [F.stone]: F.tile, [F.vinyl]: F.small, [F.hosp]: F.tile, [F.tile]: F.stone, [F.conc]: F.tile, [F.small]: F.vinyl };
const ALT_W: Record<string, string> = { [W.office]: W.home, [W.lobby]: W.store, [W.store]: W.tile, [W.home]: W.brick, [W.hosp]: W.tile, [W.brick]: W.office, [W.tile]: W.store, [W.metal]: W.office };

/** `~` 를 void:N 으로 푼다 - 방 줄(~ 없는 줄) 가운데 가장 넓은 줄이 건물 너비, ~ 가 있는 줄은 남는 너비를 ~ 끼리 나눠 채운다. */
function resolveRows(rows: readonly (readonly string[])[], rooms: readonly FRoom[]): string[][] {
  const wOf = new Map(rooms.map((r) => [r.kind, r.w]));
  const natural = (row: readonly string[]) => row.filter((k) => k !== "~").reduce((s, k) => s + (wOf.get(k) ?? 0) + 1, 0) - 1;
  const full = rows.filter((r) => !r.includes("~"));
  if (!full.length) throw new Error(`rows 에 ~ 없는 줄이 없다: ${rows.map((r) => r.join(",")).join(" / ")}`);
  const W0 = Math.max(...full.map(natural));
  return rows.map((row) => {
    const n = row.filter((k) => k === "~").length;
    if (!n) return [...row];
    const total = W0 + 1 - row.filter((k) => k !== "~").reduce((s, k) => s + (wOf.get(k) ?? 0) + 1, 0);
    if (total < n) throw new Error(`~ 자리가 모자란다(${total}): ${row.join(",")} (건물 너비 ${W0})`);
    let left = total;
    return row.map((k, i) => {
      if (k !== "~") return k;
      const idx = row.slice(0, i).filter((q) => q === "~").length;
      const g = idx === n - 1 ? left : Math.floor(total / n);
      left -= g;
      return `void:${g}`;
    });
  });
}

export function facility(s: FacilitySpec): FacilityVenue {
  const resolvedRows = resolveRows(s.rows, s.rooms);
  // 줄 배치에서 위 줄 방과 맞닿는 아래 줄 방의 북벽 문 열(겹친 열의 중앙)을 계산해, 북벽 가구(y=2)·걸이(y=0)가 문을 막으면 옆 빈칸으로 옮긴다.
  const wOf = new Map(s.rooms.map((r) => [r.kind, r.w]));
  const rowSpans = resolvedRows.map((row) => {
    let x = 1;
    const out: { kind: string; x0: number; x1: number }[] = [];
    for (const k of row) {
      const gap = /^void:(\d+)$/u.exec(k);
      if (gap) { x += Number(gap[1]); continue; }
      const w = wOf.get(k) ?? 0;
      out.push({ kind: k, x0: x, x1: x + w - 1 });
      x += w + 1;
    }
    return out;
  });
  const doorColsByRoom = new Map<string, Set<number>>();
  const southDoorColsByRoom = new Map<string, Set<number>>();
  for (let r = 1; r < rowSpans.length; r++) {
    for (const bot of rowSpans[r]!) {
      for (const top of rowSpans[r - 1]!) {
        const ox0 = Math.max(top.x0, bot.x0), ox1 = Math.min(top.x1, bot.x1);
        if (ox0 <= ox1) {
          const span = ox1 - ox0 + 1;
          const dw = span >= 10 ? 2 : 1;
          const dx0 = ox0 + Math.floor((span - dw) / 2) - bot.x0;
          let set = doorColsByRoom.get(bot.kind);
          if (!set) { set = new Set<number>(); doorColsByRoom.set(bot.kind, set); }
          for (let d = 0; d < dw; d++) set.add(dx0 + d);
          const tdx0 = ox0 + Math.floor((span - dw) / 2) - top.x0;
          let sSet = southDoorColsByRoom.get(top.kind);
          if (!sSet) { sSet = new Set<number>(); southDoorColsByRoom.set(top.kind, sSet); }
          for (let d = -1; d <= dw; d++) sSet.add(tdx0 + d);
        }
      }
    }
  }
  const entW = wOf.get(s.entrance) ?? 0;
  if (entW > 0) {
    let sSet = southDoorColsByRoom.get(s.entrance);
    if (!sSet) { sSet = new Set<number>(); southDoorColsByRoom.set(s.entrance, sSet); }
    const mid = Math.floor(entW / 2);
    for (let d = -1; d <= 0; d++) sSet.add(mid + d);
  }
  const adjustedRooms: FRoom[] = s.rooms.map((rm) => {
    const dCols = doorColsByRoom.get(rm.kind);
    const sCols = southDoorColsByRoom.get(rm.kind);
    if (!dCols?.size && !sCols?.size) return rm;
    const northTaken = new Set<number>(dCols ?? []);
    const southTaken = new Set<number>(sCols ?? []);
    for (const it of rm.items) {
      if (it.t !== "o") continue;
      const sz = sizeOf(it.id);
      const cols = Array.from({ length: sz.w }, (_, d) => it.x + d);
      if (it.y === 0 || it.y === 2) {
        if (!cols.some((c) => dCols?.has(c))) for (const c of cols) northTaken.add(c);
      } else if (it.y + sz.h >= rm.h) {
        if (!cols.some((c) => sCols?.has(c))) for (const c of cols) southTaken.add(c);
      }
    }
    const nextItems: InteriorTemplateItem[] = [];
    for (const it of rm.items) {
      if (it.t !== "o") { nextItems.push(it); continue; }
      const sz = sizeOf(it.id);
      const isNorth = it.y === 0 || it.y === 2;
      const isSouth = it.y + sz.h >= rm.h;
      const blockSet = isNorth ? dCols : isSouth ? sCols : undefined;
      const takenSet = isNorth ? northTaken : isSouth ? southTaken : undefined;
      if (!blockSet?.size || !takenSet) {
        nextItems.push(it);
        continue;
      }
      const cols = Array.from({ length: sz.w }, (_, d) => it.x + d);
      if (!cols.some((c) => blockSet.has(c))) {
        nextItems.push(it);
        continue;
      }
      let moved: InteriorTemplateItem | undefined;
      for (let dist = 1; dist < rm.w; dist++) {
        for (const dir of [1, -1] as const) {
          const nx = it.x + dir * dist;
          if (nx < 0 || nx + sz.w > rm.w) continue;
          const nCols = Array.from({ length: sz.w }, (_, d) => nx + d);
          if (nCols.every((c) => !takenSet.has(c))) {
            for (const c of nCols) takenSet.add(c);
            moved = { ...it, x: nx };
            break;
          }
        }
        if (moved) break;
      }
      if (moved) nextItems.push(moved);
    }
    return { ...rm, items: nextItems };
  });

  // seed 변주용 바닥·벽면 묶음 둘 - 한 번 바꾼 것, 두 번 바꾼 것.
  const once = (r: FRoom): readonly [string, string] => [ALT_F[r.floor] ?? r.floor, ALT_W[r.wall] ?? r.wall];
  const twice = (r: FRoom): readonly [string, string] => { const [f, w] = once(r); return [ALT_F[f] ?? f, ALT_W[w] ?? w]; };
  const palettes = [once, twice].map((pick) => Object.fromEntries(adjustedRooms.map((r) => [r.kind, pick(r)] as const)));
  const variation: ModernProgramVariation = {
    entrance: s.entrance,
    rows: resolvedRows,
    hubs: s.hubs ?? [s.entrance],
    ...(s.above ? { above: s.above } : {}),
    ...(s.left ? { left: s.left } : {}),
    palettes,
  };
  return { program: s.p, map: s.map, aliases: [s.ko], variation, rooms: adjustedRooms, cat: s.cat, ko: s.ko, shape: s.shape };
}

export function facilityExports(list: readonly FacilityVenue[]) {
  const templates: InteriorRoomTemplate[] = list.flatMap((v) => v.rooms.map((r, i) => ({ ...r, id: `${v.map}:${r.kind}#${i}`, map: v.map, building: v.program, items: [...r.items] })));
  const programs: Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]> =
    Object.fromEntries(list.map((v) => [v.program, [v.map, ...(v.aliases ?? [])].map((map) => ({ map, kinds: v.rooms.map((r) => r.kind) }))]));
  const variation: Record<string, ModernProgramVariation> = Object.fromEntries(list.map((v) => [v.program, v.variation]));
  const openFloorRooms: Record<string, true> = {};
  for (const v of list) for (const r of v.rooms) if (r.openFloor) openFloorRooms[`${v.program}:${r.kind}`] = true;
  return { templates, programs, variation, openFloorRooms };
}
