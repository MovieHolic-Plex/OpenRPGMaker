// 기물 묶음(vignette) — 제작자 예제 방에서 «서로 붙은 기물 무리»를 뽑은 라이브러리와, 방 용도에 맞는 묶음을 고르고 자리를 잡는 결정적 배치기.
//
// 왜(2026-10-29 사용자 결정 「기물 배치가 너무 엉망」): 옛 길은 방마다 예제 방 «한 벌»을 통째로 옮겨 심고(furnish.ts), 남는 바닥을
// 쓰임 가구로 메우고(fillBare), 그래도 비면 dress_room 규칙으로 또 채웠다. 견본보다 작은 방(6×7 서재)에서는 한 벌이 비켜 앉으며
// 벽을 따라 빽빽해져 주인공이 상자·책상 사이에 갇혔고(mt3 argon escape), 큰 방은 식탁 열 벌이 늘어선 전시장이 됐다.
// 새 길: 모델은 방 용도(kind)만 준다. 함수가
//  1) 그 용도 예제 방들에서 뽑은 묶음 가운데 큰 몸통 하나(앵커)를 벽에 먼저 세우고,
//  2) 자주 나온 묶음부터 벽 → 가운데 순으로, 묶음마다 앞(열린 쪽) 한 줄을 비워 두며, 문 앞 두 칸을 비우고,
//  3) 놓을 때마다 조립기 도달 검사(닿지 못하는 바닥이 늘면 뺀다)로 통로를 지키고,
//  4) 북·남 벽 묶음은 좌우 대칭 자리에 짝을 놓아 보며,
//  5) 막힌 바닥이 방 바닥의 DENSITY 를 넘으면 멈춘다 — 남는 빈 바닥은 메우지 않는다(짓기 쪽이 방을 줄인다).
// 라이브러리: src/assets/interiorVignettes.json (scripts/content/interior-vignettes/extract.mts 가 방 견본 JSON 에서 굽는다).
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "./builder";
import type { ComposedRooms } from "./rooms";
import { notchRect } from "./rooms";
import type { LayoutRoom } from "./layout";
import { roomTemplates, templateStyle, type InteriorRoomTemplate, type InteriorTemplateItem } from "./templates";
import { doorwayCells } from "./furnish";
import data from "@/assets/interiorVignettes.json";
import type { TilesetDef } from "@/project/types";

export type VignetteWall = "N" | "S" | "W" | "E" | "C";
export interface Vignette {
  /** `<첫 출처 견본 id>#<덩이 번호>` */
  readonly id: string;
  /** 이 묶음이 나온 방 종류들. */
  readonly kinds: readonly string[];
  /** 화풍 묶음(templateStyle) — 한 건물 안에서 섞으면 어색한 것끼리 나눈다. */
  readonly style: string;
  /** 놓이는 곳: 북·남·서·동 벽에 붙음, C = 방 가운데(벽에서 떨어짐). */
  readonly wall: VignetteWall;
  /** 바닥 위 상자 크기(칸). 걸이만 있는 묶음은 h 0. */
  readonly w: number; readonly h: number;
  /** 북벽 묶음: y 는 첫 바닥 줄 기준(걸이는 음수). 그 밖: 상자 위쪽 기준. x 는 상자 왼쪽 기준. */
  readonly items: readonly InteriorTemplateItem[];
  /** 열린 쪽에 비워 둘 줄 수(예제 방에서 잰 값, 1~2). */
  readonly front: number;
  /** 막는 칸 수. */
  readonly area: number;
  /** 가장 큰 기물 id(묶음 이름). */
  readonly main: string;
  /** 예제 방들에서 나온 횟수 · 한 방 안에서 가장 많이 되풀이된 수. */
  readonly count: number; readonly perRoom: number;
  readonly from: readonly string[];
}
interface VignetteData { readonly version: 1; readonly tilesets: Readonly<Record<string, readonly Vignette[]>> }
const D = data as unknown as VignetteData;
export function roomVignettes(tilesetId: string): readonly Vignette[] { return D.tilesets[tilesetId] ?? []; }

const TOP_KINDS = new Set(["wall", "hang", "door", "sidedoor"]);
const blocks = (it: InteriorTemplateItem, S: HandInteriorSpec): boolean => {
  if (it.t === "g" || it.t === "l" || it.t === "d") return false;
  if (it.t === "t") return true;
  const k = S.objects[it.id]?.kind;
  return k !== undefined && k !== "hang" && k !== "flat" && k !== "door" && k !== "sidedoor";
};
function box(it: InteriorTemplateItem, S: HandInteriorSpec): [number, number, number, number] {
  if (it.t === "l") { const xs = it.cells!.map((c) => c[0]), ys = it.cells!.map((c) => c[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1]; }
  if (it.t === "o") { const o = S.objects[it.id]; return [it.x, it.y, it.x + (o?.w ?? 1), it.y + Math.max(1, o?.h ?? 1)]; }
  if (it.t === "t" || it.t === "d") return [it.x, it.y, it.x + (it.w ?? 1), it.y + (it.h ?? 1)];
  return [it.x, it.y, it.x + 1, it.y + 1];
}
const cellsOfBox = (b: readonly number[]): string[] => { const out: string[] = []; for (let y = b[1]!; y < b[3]!; y++) for (let x = b[0]!; x < b[2]!; x++) out.push(`${x},${y}`); return out; };

/**
 * 묶음 = 맞닿은(틈 0칸) 기물 무리. 방 견본 옮겨 심기(templateClusters)는 1칸 띄운 것까지 한 덩이로 묶어, 여관 홀은 계산대부터 식탁 줄까지
 * 방 전체가 한 덩이(14×10)가 됐다 — 묶음 라이브러리에는 맞닿은 것만. 탁상 물건은 받친 가구와, 걸이는 바로 아래 벽 가구와, 깔개는 깔개끼리만 잇는다.
 */
function touchingClusters(t: InteriorRoomTemplate, S: HandInteriorSpec): number[][] {
  const n = t.items.length, parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const boxes = t.items.map((it) => box(it, S));
  const isFlat = (it: InteriorTemplateItem) => it.t === "l" || it.t === "d" || (it.t === "o" && S.objects[it.id]?.kind === "flat");
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = t.items[i]!, b = t.items[j]!;
    if (isFlat(a) !== isFlat(b)) continue;
    const [ax0, ay0, ax1, ay1] = boxes[i]!, [bx0, by0, bx1, by1] = boxes[j]!;
    const goods = a.t === "g" || b.t === "g";
    const ox = ax0 < bx1 && bx0 < ax1, oy = ay0 < by1 && by0 < ay1;
    const touch = goods
      ? ox && ay0 <= by1 && by0 <= ay1   // 탁상 물건: 같은 열에서 윗면 줄에 닿음
      : (ox && (ay1 === by0 || by1 === ay0 || oy)) || (oy && (ax1 === bx0 || bx1 === ax0));
    if (touch) parent[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  return [...groups.values()];
}

/** 예제 방 견본 하나 → 묶음들(문·문틀은 뺀다). 추출 스크립트와 시험이 같이 쓴다. */
export function vignettesOfTemplate(t: InteriorRoomTemplate, S: HandInteriorSpec): Vignette[] {
  const out: Vignette[] = [];
  const blocked = new Set<string>();
  for (const it of t.items) if (blocks(it, S)) for (const c of cellsOfBox(box(it, S))) blocked.add(c);
  const clusters = touchingClusters(t, S);
  clusters.forEach((c, n) => {
    const members = c.map((k) => t.items[k]!).filter((it) => !(it.t === "o" && ["door", "sidedoor"].includes(S.objects[it.id]?.kind ?? "")) && (it.t !== "o" || S.objects[it.id]));
    if (!members.length) return;
    const solid = members.filter((it) => blocks(it, S));
    const ground = members.filter((it) => !(it.t === "o" && S.objects[it.id]?.kind === "hang") && it.t !== "g");
    const all = members.map((it) => box(it, S));
    const x0 = Math.min(...all.map((b) => b[0])), x1 = Math.max(...all.map((b) => b[2]));
    const gb = (ground.length ? ground : members).map((it) => box(it, S));
    const y0 = Math.min(...gb.map((b) => b[1])), y1 = Math.max(...gb.map((b) => b[3]));
    const pinTop = members.some((it) => it.t === "o" && TOP_KINDS.has(S.objects[it.id]?.kind ?? ""));
    const onlyHang = !ground.length;
    const sb = solid.map((it) => box(it, S));
    const sx0 = sb.length ? Math.min(...sb.map((b) => b[0])) : x0, sx1 = sb.length ? Math.max(...sb.map((b) => b[2])) : x1;
    const sy0 = sb.length ? Math.min(...sb.map((b) => b[1])) : y0, sy1 = sb.length ? Math.max(...sb.map((b) => b[3])) : y1;
    const wall: VignetteWall = pinTop || onlyHang || (sb.length && sy0 <= 2) ? "N"
      : sb.length && sx0 <= 0 ? "W" : sb.length && sx1 >= t.w ? "E" : sb.length && sy1 >= t.h ? "S" : "C";
    // 앞 비울 줄: 예제 방에서 열린 쪽으로 막히지 않은 줄 수(최대 2, 최소 1).
    const free = (cells: string[]) => cells.every((c) => !blocked.has(c) && (() => { const [x, y] = c.split(",").map(Number) as [number, number]; return x >= 0 && x < t.w && y >= 2 && y < t.h; })());
    let front = 0;
    for (let d = 1; d <= 2; d++) {
      const line: string[] = [];
      if (wall === "N") for (let x = sx0; x < sx1; x++) line.push(`${x},${sy1 + d - 1}`);
      else if (wall === "S") for (let x = sx0; x < sx1; x++) line.push(`${x},${sy0 - d}`);
      else if (wall === "W") for (let y = sy0; y < sy1; y++) line.push(`${sx1 + d - 1},${y}`);
      else if (wall === "E") for (let y = sy0; y < sy1; y++) line.push(`${sx0 - d},${y}`);
      else break;
      if (!sb.length || !free(line)) break;
      front = d;
    }
    const yBase = wall === "N" ? 2 : y0;
    const rel = (it: InteriorTemplateItem): InteriorTemplateItem => it.t === "l"
      ? { ...it, cells: it.cells!.map(([x, y]) => [x - x0, y - yBase] as [number, number]) }
      : { ...it, x: it.x - x0, y: it.y - yBase };
    const area = solid.reduce((s, it) => { const b = box(it, S); return s + (b[2] - b[0]) * (b[3] - b[1]); }, 0);
    const main = [...members].sort((a, b) => { const A = box(a, S), B = box(b, S); return (B[2] - B[0]) * (B[3] - B[1]) * Number(blocks(b, S)) - (A[2] - A[0]) * (A[3] - A[1]) * Number(blocks(a, S)); })[0]!;
    out.push({
      id: `${t.id}#${n}`, kinds: [t.kind], style: templateStyle(t), wall, w: x1 - x0, h: onlyHang ? 0 : y1 - (wall === "N" ? Math.min(2, y0) : y0),
      items: members.map(rel), front: wall === "C" ? 1 : Math.max(1, front), area, main: main.id, count: 1, perRoom: 1, from: [t.id],
    });
  });
  return out;
}

const signature = (v: Vignette): string => `${v.wall}|${v.items.map((it) => `${it.t}:${it.id}@${it.x},${it.y}${it.w ? `:${it.w}x${it.h}` : ""}`).sort().join(";")}`;

/** 칩셋의 방 견본 전부 → 같은 묶음끼리 합친 라이브러리(나온 횟수 내림차순). */
export function extractVignettes(tilesetId: string, S: HandInteriorSpec, templates: readonly InteriorRoomTemplate[] = roomTemplates(tilesetId)): Vignette[] {
  const bySig = new Map<string, Vignette>();
  for (const t of templates) {
    const local = new Map<string, number>();
    for (const v of vignettesOfTemplate(t, S)) {
      const sig = `${v.style}|${signature(v)}`;
      local.set(sig, (local.get(sig) ?? 0) + 1);
      const prev = bySig.get(sig);
      bySig.set(sig, prev
        ? { ...prev, kinds: [...new Set([...prev.kinds, ...v.kinds])], count: prev.count + 1, perRoom: Math.max(prev.perRoom, local.get(sig)!), from: [...new Set([...prev.from, ...v.from])] }
        : v);
    }
  }
  return [...bySig.values()].sort((a, b) => b.count - a.count || b.area - a.area || a.id.localeCompare(b.id));
}

// ── 배치기 ─────────────────────────────────────────────────────────────

/** 막힌 바닥이 방 바닥의 이 몫을 넘으면 더 놓지 않는다(6×7 서재에 상자·책상이 빽빽해 갇힌 판을 막는다). */
export const VIGNETTE_DENSITY = 0.34;
/** 가운데 묶음은 바닥이 이만큼은 돼야 놓는다(작은 방 가운데 식탁이 통로를 끊는다). */
const CENTRE_MIN_FLOOR = 30;

export interface VignetteFurnishOptions {
  /** 방 id → 고른 묶음(묶음 id 또는 몸통 기물 id·낱말). 모델이 고를 때. 없으면 방 종류로 함수가 고른다. */
  readonly picks?: Readonly<Record<string, readonly string[]>>;
  readonly density?: number;
}
export interface VignetteFurnishResult {
  readonly input: HandInteriorInput;
  /** 방 id → 놓은 묶음 id 목록·막힌 몫 */
  readonly perRoom: Record<string, { placed: string[]; blockedShare: number; floor: number }>;
}

function withItems(base: HandInteriorInput, items: readonly InteriorTemplateItem[]): HandInteriorInput {
  return {
    ...base,
    objects: [...(base.objects ?? []), ...items.filter((i) => i.t === "o").map((i) => ({ id: i.id, x: i.x, y: i.y }))],
    tables: [...(base.tables ?? []), ...items.filter((i) => i.t === "t").map((i) => ({ style: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! }))],
    goods: [...(base.goods ?? []), ...items.filter((i) => i.t === "g").map((i) => ({ id: i.id, x: i.x, y: i.y }))],
    daises: [...(base.daises ?? []), ...items.filter((i) => i.t === "d").map((i) => ({ id: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! }))],
    lines: [...(base.lines ?? []), ...items.filter((i) => i.t === "l").map((i) => ({ id: i.id, cells: i.cells!.map(([x, y]) => ({ x, y })) }))],
  };
}

/** 북벽에 닿는 열(걸이·벽 가구·키 큰 가구가 벽면을 쓰는 열) — 같은 열을 둘이 쓰지 않는다. */
function wallColumns(it: InteriorTemplateItem, S: HandInteriorSpec): string[] {
  if (it.t !== "o") return [];
  const o = S.objects[it.id];
  if (!o) return [];
  if (o.kind === "hang" || o.kind === "wall" || (o.kind === "floor" && o.up >= 8)) return Array.from({ length: Math.max(1, o.w) }, (_, dx) => `${it.x + dx}`);
  return [];
}
const FACING = /\b(chair|stool|bench|seat)\b.*\b[EW]\b|\b[EW]$/u;

/** 방 용도에 맞는 묶음 후보(같은 화풍 먼저). */
function pool(tilesetId: string, kind: string, style: string | undefined, picks: readonly string[] | undefined): Vignette[] {
  const all = roomVignettes(tilesetId);
  if (picks?.length) {
    const want = picks.map((p) => p.toLowerCase());
    const hit = all.filter((v) => want.some((w) => v.id.toLowerCase() === w || v.main.toLowerCase().includes(w) || v.items.some((it) => it.id.toLowerCase() === w)));
    if (hit.length) return hit;
  }
  const ofKind = all.filter((v) => v.kinds.includes(kind));
  const same = style ? ofKind.filter((v) => v.style === style) : ofKind;
  return same.length ? same : ofKind;
}

export function furnishWithVignettes(base: HandInteriorInput, rooms: readonly LayoutRoom[], composed: ComposedRooms, tilesetId: string, tileset: TilesetDef, S: HandInteriorSpec, opts: VignetteFurnishOptions = {}): VignetteFurnishResult {
  const density = opts.density ?? VIGNETTE_DENSITY;
  const keep = doorwayCells(composed);
  const byTemplate = new Map(roomTemplates(tilesetId).map((t) => [t.id, t]));
  let input = base;
  const firstInput = composed.exit.width === 0 && !input.start?.length ? { ...input, start: [{ x: composed.exit.x, y: Math.max(2, composed.exit.y - 1) }] } : input;
  const first = buildHandInteriorLayers(firstInput, tileset, S);
  let errors = first.issues.filter((i) => i.severity === "error").length, unreached = first.unreachedFloor.length;
  const perRoom: VignetteFurnishResult["perRoom"] = {};
  const solid = new Set<string>(), walk = new Set<string>(), wcols = new Set<string>(), flat = new Set<string>();

  for (const room of rooms) {
    const fy0 = room.y0 + 2;
    const fw = room.x1 - room.x0 + 1, fh = room.y1 - fy0 + 1;
    if (fw < 2 || fh < 1) continue;
    const nrs = (room.notches ?? []).map((n) => notchRect(room, n));
    const inNotch = (x: number, y: number) => nrs.some((nr) => x >= nr.x0 - 1 && x <= nr.x1 + 1 && y >= nr.y0 - 1 && y <= nr.y1);
    let floor = 0;
    for (let y = fy0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) if (!inNotch(x, y)) floor++;
    const style = room.template ? templateStyle(byTemplate.get(room.template) ?? { map: "" }) : undefined;
    const cands = pool(tilesetId, room.kind, style, opts.picks?.[room.id]);
    const placed: string[] = [];
    const uses = new Map<string, number>();
    let blockedCells = 0;

    /** 묶음을 (px, py) 에 놓은 절대 좌표 기물들. N 은 py 무시(첫 바닥 줄 기준). */
    const at = (v: Vignette, px: number, py: number, mirror = false): InteriorTemplateItem[] => v.items.map((it) => {
      const yb = v.wall === "N" ? fy0 : py;
      if (it.t === "l") return { ...it, cells: it.cells!.map(([x, y]) => [px + (mirror ? v.w - 1 - x : x), yb + y] as [number, number]) };
      const [bx0, , bx1] = box(it, S);
      const x = mirror ? v.w - (bx1 - bx0) - it.x : it.x;
      return { ...it, x: px + x, y: yb + it.y };
    });
    /** 놓을 수 있나 + 놓기. 싼 검사(방 안·문 앞·겹침·앞 통로·밀도) 뒤 조립기 도달 검사. */
    const tryPlace = (v: Vignette, px: number, py: number, mirror = false): boolean => {
      const items = at(v, px, py, mirror);
      const sCells: string[] = [], fCells: string[] = [], cols: string[] = [];
      for (const it of items) {
        const b = box(it, S);
        const ground = !(it.t === "o" && S.objects[it.id]?.kind === "hang") && it.t !== "g";
        if (ground) for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
          if (x < room.x0 || x > room.x1 || y < fy0 || y > room.y1 || inNotch(x, y)) return false;
        }
        if (it.t === "o" && S.objects[it.id]?.kind === "hang" && (b[0] < room.x0 || b[2] - 1 > room.x1)) return false;
        if (blocks(it, S)) sCells.push(...cellsOfBox(b));
        else if (it.t !== "g" && ground) fCells.push(...cellsOfBox(b));
        cols.push(...wallColumns(it, S));
      }
      if (sCells.some((c) => keep.has(c) || solid.has(c) || walk.has(c) || flat.has(c))) return false;
      if (fCells.some((c) => keep.has(c) || solid.has(c) || flat.has(c))) return false;
      if (cols.some((c) => wcols.has(c))) return false;
      if (blockedCells + new Set(sCells).size > floor * density) return false;
      // 앞(열린 쪽) 통로 — 막힌 칸의 열린 쪽 이웃 줄.
      const front: string[] = [];
      const ss = new Set(sCells);
      for (const c of ss) {
        const [x, y] = c.split(",").map(Number) as [number, number];
        const near = v.wall === "N" ? [[0, 1]] : v.wall === "S" ? [[0, -1]] : v.wall === "W" ? [[1, 0]] : v.wall === "E" ? [[-1, 0]] : [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of near) for (let d = 1; d <= (v.wall === "C" ? 1 : v.front); d++) {
          const k = `${x + dx! * d},${y + dy! * d}`;
          if (ss.has(k)) continue;
          const [kx, ky] = [x + dx! * d, y + dy! * d];
          if (kx < room.x0 || kx > room.x1 || ky < fy0 || ky > room.y1) continue;
          front.push(k);
        }
      }
      if (front.some((c) => solid.has(c))) return false;
      const next = withItems(input, items);
      const built = buildHandInteriorLayers(next, tileset, S);
      const e = built.issues.filter((i) => i.severity === "error").length;
      if (e > errors || built.unreachedFloor.length > unreached) return false;
      input = next; errors = e; unreached = built.unreachedFloor.length;
      for (const c of sCells) solid.add(c);
      for (const c of fCells) flat.add(c);
      for (const c of front) walk.add(c);
      for (const c of cols) wcols.add(c);
      blockedCells += ss.size;
      uses.set(v.id, (uses.get(v.id) ?? 0) + 1);
      placed.push(mirror ? `${v.id}~` : v.id);
      return true;
    };
    const cx = (w: number) => room.x0 + Math.floor((fw - w) / 2);
    /** 자리 후보: 앵커는 가운데부터, 나머지 벽 묶음은 모서리부터(가운데를 비운다). */
    const spots = (v: Vignette, anchor: boolean): [number, number][] => {
      const out: [number, number][] = [];
      const xs = Array.from({ length: Math.max(0, fw - v.w + 1) }, (_, i) => room.x0 + i);
      const ys = Array.from({ length: Math.max(0, fh - v.h + 1) }, (_, i) => fy0 + i);
      const byEdge = (list: number[], lo: number, hi: number) => [...list].sort((a, b) => Math.min(a - lo, hi - a) - Math.min(b - lo, hi - b) || a - b);
      const byCentre = (list: number[], c: number) => [...list].sort((a, b) => Math.abs(a - c) - Math.abs(b - c) || a - b);
      if (v.wall === "N") for (const x of anchor ? byCentre(xs, cx(v.w)) : byEdge(xs, room.x0, room.x1 - v.w + 1)) out.push([x, fy0]);
      else if (v.wall === "S") for (const x of byEdge(xs, room.x0, room.x1 - v.w + 1)) out.push([x, room.y1 - v.h + 1]);
      else if (v.wall === "W") for (const y of ys) out.push([room.x0, y]);
      else if (v.wall === "E") for (const y of ys) out.push([room.x1 - v.w + 1, y]);
      else if (floor >= CENTRE_MIN_FLOOR) {
        const inner = xs.filter((x) => x > room.x0 && x + v.w - 1 < room.x1), innerY = ys.filter((y) => y > fy0 && y + v.h - 1 < room.y1);
        for (const y of byCentre(innerY, fy0 + Math.floor((fh - v.h) / 2))) for (const x of byCentre(inner, cx(v.w))) out.push([x, y]);
      }
      return out;
    };
    const mirrorable = (v: Vignette) => !v.items.some((it) => FACING.test(it.id) || (it.t === "o" && (S.objects[it.id]?.facing === "E" || S.objects[it.id]?.facing === "W")));
    /** 대칭 짝 — 북·남 벽 묶음은 좌우 맞은편 같은 줄에, 서·동 벽 묶음은 맞은편 벽에(방향 있는 기물이 없으면 뒤집어). */
    const pair = (v: Vignette, px: number, py: number): void => {
      if ((uses.get(v.id) ?? 0) >= Math.max(2, v.perRoom)) return;
      if (v.h === 0 && hangCount() >= hangCap) return;
      if (v.wall === "N" || v.wall === "S") {
        const mx = room.x0 + room.x1 - (px + v.w - 1);
        if (Math.abs(mx - px) >= v.w) tryPlace(v, mx, py);
      } else if ((v.wall === "W" || v.wall === "E") && mirrorable(v)) {
        tryPlace({ ...v, wall: v.wall === "W" ? "E" : "W" }, v.wall === "W" ? room.x1 - v.w + 1 : room.x0, py, true);
      }
    };
    const place = (v: Vignette, anchor: boolean): boolean => {
      for (const [x, y] of spots(v, anchor)) if (tryPlace(v, x, y)) { if (!anchor) pair(v, x, y); return true; }
      return false;
    };

    const hangCap = Math.max(1, Math.floor(fw / 4));
    const hangCount = () => cands.filter((q) => q.h === 0).reduce((n, q) => n + (uses.get(q.id) ?? 0), 0);
    const ground = cands.filter((v) => v.h > 0);
    // 1) 앵커: 벽에 붙는 가장 큰 묶음(예제에 두 번 이상 나왔으면 그쪽 먼저) — 방이 무엇인지 한눈에 보이게.
    const anchors = ground.filter((v) => v.wall !== "C" && v.area >= 2).sort((a, b) => Number(b.count > 1) - Number(a.count > 1) || b.area - a.area);
    let anchorMain = "";
    for (const v of anchors) if (place(v, true)) { anchorMain = v.main; break; }
    // 2) 나머지: 자주 나온 묶음부터, 같은 몸통 기물은 예제 한 방에서 되풀이된 만큼만, 벽 → 가운데.
    // 점수: 예제에 자주 나옴 + 이 방 종류에만 나옴(방을 말해 주는 묶음 — 서재의 책상) + 크기. 벽 묶음이 같은 점수면 먼저.
    const score = (v: Vignette) => v.count + (v.kinds.length === 1 ? 1 : 0) + v.area / 4 + (v.items.some((it) => it.t === "o" && (S.objects[it.id]?.use ?? []).some((u) => u === "read" || u === "counter" || u === "sleep")) ? 1 : 0);
    const order = ground.filter((v) => !placed.includes(v.id)).sort((a, b) => score(b) - score(a) || Number(a.wall === "C") - Number(b.wall === "C") || a.id.localeCompare(b.id));
    const mains = new Map<string, number>(anchorMain ? [[anchorMain, 1]] : []);
    for (const v of order) {
      if (blockedCells >= floor * density) break;
      const limit = Math.max(1, v.perRoom);
      if ((mains.get(v.main) ?? 0) >= limit) continue;
      if (place(v, false)) mains.set(v.main, (mains.get(v.main) ?? 0) + (uses.get(v.id) ?? 1));
    }
    // 3) 작은 벽 소품(통·상자·자루 — 막는 칸 2 이하) 되풀이 — 예제에 한 번 나온 것도 벽을 따라 짝으로 한 번 더(밀도 안에서만).
    //    큰 묶음을 되풀이하면 전시장이 된다(옛 길의 식탁 열 벌) — 작은 것만.
    for (const v of order.filter((q) => q.wall !== "C" && q.area <= 2 && q.area > 0)) {
      if (blockedCells >= floor * density * 0.8) break;
      if ((uses.get(v.id) ?? 0) >= Math.max(2, v.perRoom) + 1) continue;
      place(v, false);
    }
    // 4) 걸이(창·그림·선반) — 북벽 4칸에 하나쯤, 같은 걸이는 둘까지.
    const hangMains = new Map<string, number>();
    for (const v of cands.filter((q) => q.h === 0)) {
      if (hangCount() >= hangCap) break;
      if ((hangMains.get(v.main) ?? 0) >= 2) continue;
      const before = uses.get(v.id) ?? 0;
      if (place(v, false)) hangMains.set(v.main, (hangMains.get(v.main) ?? 0) + (uses.get(v.id) ?? 0) - before);
    }
    perRoom[room.id] = { placed, blockedShare: floor ? Math.round(100 * blockedCells / floor) / 100 : 0, floor };
  }
  return { input, perRoom };
}
