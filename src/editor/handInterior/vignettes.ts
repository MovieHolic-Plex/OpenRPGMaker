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

/** 막힌 바닥이 방 바닥의 이 몫을 넘으면 더 놓지 않는다(6×7 서재에 상자·책상이 빽빽해 갇힌 판을 막는다). 제작자 예제 v5 방은 막힘 중앙값 40%·사분위 33~50%. */
export const VIGNETTE_DENSITY = 0.45;
/** 가운데 묶음은 바닥이 이만큼은 돼야 놓는다(작은 방 가운데 식탁이 통로를 끊는다). */
const CENTRE_MIN_FLOOR = 20;

export interface VignetteFurnishOptions {
  /** 방 id → 고른 묶음(묶음 id 또는 몸통 기물 id·낱말). 모델이 고를 때. 없으면 방 종류로 함수가 고른다. */
  readonly picks?: Readonly<Record<string, readonly string[]>>;
  /** 방 id → 용도 글(구역 kind·purpose·장소 이름). 견본 없는 용도(교실)의 핵심 묶음을 고른다. */
  readonly purposes?: Readonly<Record<string, string>>;
  readonly density?: number;
  /**
   * 조합 씨앗(2026-10-29 「서재가 늘 같은 방」). 주면 (1) 손으로 짠 견본까지 넣은 묶음 후보에서 (2) 용도 글의 성격 낱말(마법사·학자·귀족·천문)이
   * 묶음의 비중을 정하고, 성격이 다른 묶음(평범한 서재의 마법진·부엉이 횃대)은 빼며, (3) 씨앗이 같은 역할 안 순서·벽 자리·좌우 뒤집기를 정한다.
   * 같은 씨앗·같은 글이면 같은 배치(결정적). 생략하면 옛 동작 그대로.
   */
  readonly seed?: number;
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

/** 홀로 선 단품 — 막는 기물이 하나뿐인 가운데 묶음(마네킹·의자). */
const isSingle = (v: Vignette): boolean => v.wall === "C" && v.area <= 2 && v.items.filter((it) => it.t !== "g" && it.t !== "l").length === 1;

/**
 * 견본이 없는 용도(교실 등) — 가장 가까운 용도의 묶음 + 그 용도의 핵심 기물로 만든 묶음(core:). 핵심 묶음은 기물 사전에 있는 그림만 쓴다(새 그림 없음).
 * 학생 책상 줄은 줄 수만큼 되풀이할 수 있다(perRoom).
 */
interface PurposeCore { readonly re: RegExp; readonly near: readonly string[]; readonly core: readonly Omit<Vignette, "kinds" | "style" | "count" | "from" | "area" | "main" | "front">[] }
const PURPOSE_CORES: readonly PurposeCore[] = [
  { re: /교실|classroom|학교|school|강의|lecture/iu, near: ["study", "library"], core: [
    { id: "core:class-blackboard", wall: "N", w: 2, h: 0, items: [{ t: "o", id: "blackboard", x: 0, y: -2 }], perRoom: 1 },
    { id: "core:class-teacher", wall: "N", w: 3, h: 2, items: [{ t: "o", id: "chair S", x: 1, y: 0 }, { t: "o", id: "desk 3x1", x: 0, y: 1 }], perRoom: 1 },
    { id: "core:class-row", wall: "C", w: 5, h: 2, items: [0, 2, 4].flatMap((x) => [{ t: "o" as const, id: "school desk", x, y: 0 }, { t: "o" as const, id: "chair N", x, y: 1 }]), perRoom: 3 },
  ] },
];
function coreVignettes(purpose: string | undefined, S: HandInteriorSpec): { near: readonly string[]; core: Vignette[] } | undefined {
  const hit = purpose ? PURPOSE_CORES.find((p) => p.re.test(purpose)) : undefined;
  if (!hit) return undefined;
  const core = hit.core.filter((v) => v.items.every((it) => it.t !== "o" || S.objects[it.id])).map((v): Vignette => {
    const area = v.items.reduce((n, it) => n + (blocks(it, S) ? (box(it, S)[2] - box(it, S)[0]) * (box(it, S)[3] - box(it, S)[1]) : 0), 0);
    return { ...v, kinds: [], style: "any", count: 9, from: [], area, main: v.items[v.items.length - 1]!.id, front: 1 };
  });
  return { near: hit.near, core };
}

/** 방 용도에 맞는 묶음 후보(같은 화풍 먼저). 용도 핵심이 있으면 핵심 묶음 + 가까운 용도 묶음. */
function pool(tilesetId: string, kind: string, style: string | undefined, picks: readonly string[] | undefined, purpose?: string, S?: HandInteriorSpec): Vignette[] {
  const all = roomVignettes(tilesetId);
  const core = S ? coreVignettes(purpose, S) : undefined;
  if (core && !picks?.length) {
    const near = all.filter((v) => v.kinds.some((k) => core.near.includes(k)));
    return [...core.core, ...near];
  }
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
    const composed = opts.seed !== undefined && !opts.picks?.[room.id]?.length ? composedPool(tilesetId, room.kind, opts.purposes?.[room.id] ?? room.kind, S) : undefined;
    const cands = composed?.cands ?? pool(tilesetId, room.kind, style, opts.picks?.[room.id], opts.purposes?.[room.id], S);
    const rnd = composed ? seeded((opts.seed! >>> 0) ^ hashText(room.id)) : undefined;
    const placed: string[] = [];
    const placedIds = new Map<string, number>();
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
      // 조합: 방에 하나면 되는 기물(지구의·시계·벽난로·안락의자 둘…)은 다른 묶음에 섞여 다시 오지 않게 — 안락의자 넷·지구의 둘이 한 방에 섰다.
      if (rnd && v.items.some((it) => it.t === "o" && (placedIds.get(it.id) ?? 0) >= (ONE_PER_ROOM.get(it.id) ?? 99))) return false;
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
      for (const it of items) if (it.t === "o") placedIds.set(it.id, (placedIds.get(it.id) ?? 0) + 1);
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
      else if (isSingle(v)) {
        // 홀로 선 단품(마네킹·의자·화분)은 방 가운데에 띄우지 않는다 — 벽 줄이나 이미 놓은 가구 옆 칸에만.
        const near = (x: number, y: number) => x === room.x0 || x + v.w - 1 === room.x1 || y === fy0 || [...solid].some((c) => { const [sx, sy] = c.split(",").map(Number) as [number, number]; return sx >= x - 1 && sx <= x + v.w && sy >= y - 1 && sy <= y + v.h; });
        for (const y of ys) for (const x of xs) if (near(x, y)) out.push([x, y]);
      } else if (floor >= CENTRE_MIN_FLOOR) {
        const inner = xs.filter((x) => x > room.x0 && x + v.w - 1 < room.x1), innerY = ys.filter((y) => y > fy0 && y + v.h - 1 < room.y1);
        for (const y of byCentre(innerY, fy0 + Math.floor((fh - v.h) / 2))) for (const x of byCentre(inner, cx(v.w))) out.push([x, y]);
      }
      return out;
    };
    /**
     * 맞은편 짝. 가운데 묶음(탁자 세트·의자 줄)만 같은 묶음을 되풀이한다 — 벽 묶음·단품을 좌우로 똑같이 복사하면 검수에서 「복붙」으로 읽힌다(벤치 room-vig-1029:
     * 서재 망원경 세트·연구실 솥/바구니). 벽 묶음 맞은편에는 몸통이 다른 같은 벽 묶음(폭 비슷한 것)을 놓아 균형만 맞춘다.
     */
    const pair = (v: Vignette, px: number, py: number): void => {
      if (v.h === 0 && hangCount() >= hangCap) return;
      if (v.wall === "C") return;
      const others = (wall: Vignette["wall"]) => cands.filter((q) => q !== v && q.h > 0 && q.wall === wall && q.main !== v.main && Math.abs(q.w - v.w) <= 1
        && (uses.get(q.id) ?? 0) === 0 && (mains.get(q.main) ?? 0) === 0);
      if (v.wall === "N" || v.wall === "S") {
        for (const q of others(v.wall)) {
          const mx = room.x0 + room.x1 - (px + q.w - 1);
          if (Math.abs(mx - px) >= Math.max(v.w, q.w) && tryPlace(q, mx, v.wall === "S" ? room.y1 - q.h + 1 : py)) { mains.set(q.main, 1); return; }
        }
      } else if (v.wall === "W" || v.wall === "E") {
        const opp = v.wall === "W" ? "E" : "W";
        for (const q of others(opp)) if (tryPlace(q, opp === "E" ? room.x1 - q.w + 1 : room.x0, py)) { mains.set(q.main, 1); return; }
      }
    };
    // 조합 씨앗: 자리 후보의 시작점을 돌리고(앵커는 가운데 앞 셋 중, 벽 묶음은 왼쪽·오른쪽 끝 중), 좌우로 기울지 않은 묶음은 반쯤 뒤집는다.
    const flipStart = rnd ? rnd() < 0.5 : false;
    const seededSpots = (list: [number, number][], anchor: boolean): [number, number][] => {
      if (!rnd || list.length < 2) return list;
      if (anchor) { const k = Math.floor(rnd() * Math.min(3, list.length)); return [...list.slice(k), ...list.slice(0, k)]; }
      return flipStart ? [...list].reverse() : list;
    };
    const place = (v: Vignette, anchor: boolean): boolean => {
      const mirror = !!rnd && v.wall !== "W" && v.wall !== "E" && !v.items.some((it) => LATERAL.test(it.id)) && rnd() < 0.5;
      for (const [x, y] of seededSpots(spots(v, anchor), anchor)) if (tryPlace(v, x, y, mirror) || (mirror && tryPlace(v, x, y))) { if (!anchor) pair(v, x, y); return true; }
      return false;
    };

    const hangCap = Math.max(1, Math.floor(fw / 4));
    const hangCount = () => cands.filter((q) => q.h === 0).reduce((n, q) => n + (uses.get(q.id) ?? 0), 0);
    const recipe = vignetteRecipe(cands, S, floor, composed ? (v) => composed.bias(v) + rnd!() * 4 : undefined);
    const mains = new Map<string, number>();
    const cap = (v: Vignette) => (v.id.startsWith("core:") ? Math.max(2, v.perRoom) : v.wall === "C" ? 2 : 1);   // 가운데 묶음만 두 번(탁자 줄), 벽 묶음은 한 번
    const tryRole = (list: readonly Vignette[], want: number, anchor: boolean, stopAt = density): number => {
      let got = 0;
      for (const v of list) {
        if (got >= want || blockedCells >= floor * stopAt) break;
        if ((uses.get(v.id) ?? 0) >= cap(v) || (!v.id.startsWith("core:") && (mains.get(v.main) ?? 0) >= (v.wall === "C" ? 2 : 1))) continue;
        const before = uses.get(v.id) ?? 0;
        if (place(v, anchor)) { got++; mains.set(v.main, (mains.get(v.main) ?? 0) + (uses.get(v.id) ?? 0) - before); }
      }
      return got;
    };
    // 레시피(견본 빈도에서): 핵심 1~2 → 가운데(탁자 세트·깔개+가구) → 보조 2~4(홀로 선 단품은 벽·다른 묶음 옆에만) → 작은 소품(막힘 25% 까지) → 걸이.
    // 앵커는 몸통 기물이 서로 달라야 한다(책상 둘이 아니라 책상+책장).
    // 조합 씨앗: 역할마다 앞 몇 개 가운데 어디서 시작할지를 씨앗이 정한다 — 점수만 따르면 「책장+벽난로」 앵커와 안락의자 묶음이 판마다 같았다.
    const turn = <T,>(list: readonly T[], top: number): T[] => { if (!rnd || list.length < 2) return [...list]; const k = Math.floor(rnd() * Math.min(top, list.length)); return [...list.slice(k), ...list.slice(0, k)]; };
    {
      const seen = new Set<string>();
      const list = turn(recipe.anchors.filter((v) => !seen.has(v.main) && seen.add(v.main)), 5);
      // 그 용도의 «없으면 그 방이 아닌» 기물(서재의 책장)이 든 앵커를 먼저 — 씨앗이 고른 첫 앵커가 안락의자 묶음이면 책장 없는 서재가 됐다.
      const must = composed?.must;
      tryRole(must ? [...list.filter((v) => v.items.some((it) => must.test(it.id))), ...list.filter((v) => !v.items.some((it) => must.test(it.id)))] : list, recipe.counts.anchors, true);
    }
    // 핵심 줄 묶음(교실 책상 줄)은 바닥 20칸마다 한 줄까지.
    const rows = recipe.centre[0]?.id.startsWith("core:") && recipe.centre[0].perRoom > 1 ? Math.min(recipe.centre[0].perRoom, Math.max(1, Math.floor(floor / 20))) : 0;
    tryRole(turn(recipe.centre, 4), Math.max(recipe.counts.centre, rows), false);
    tryRole(turn(recipe.support, 4), recipe.counts.support, false);
    tryRole(recipe.small, 6, false, 0.25);
    // 예제가 적은 용도(재봉 가게 묶음 5개)는 레시피를 다 놓아도 막힘이 30% 에 못 미친다 — 같은 묶음을 함께 쓰는 가까운 용도(재봉 작업실·가봉실)의
    // 보조·가운데 묶음으로 마저 채운다(같은 화풍만).
    if (blockedCells < floor * 0.3 && !opts.picks?.[room.id]?.length) {
      const near = relatedKinds(tilesetId, room.kind);
      const more = vignetteRecipe(roomVignettes(tilesetId).filter((v) => !cands.includes(v) && v.kinds.some((k) => near.includes(k)) && (!style || v.style === style)), S, floor);
      tryRole(more.centre, 1, false, 0.36);
      tryRole(more.support, 3, false, 0.36);
    }
    const hangMains = new Map<string, number>();
    for (const v of recipe.hangs) {
      if (hangCount() >= hangCap) break;
      if ((hangMains.get(v.main) ?? 0) >= 2) continue;
      const before = uses.get(v.id) ?? 0;
      if (place(v, false)) hangMains.set(v.main, (hangMains.get(v.main) ?? 0) + (uses.get(v.id) ?? 0) - before);
    }
    perRoom[room.id] = { placed, blockedShare: floor ? Math.round(100 * blockedCells / floor) / 100 : 0, floor };
  }
  return { input, perRoom };
}

export interface VignetteRecipe {
  readonly anchors: readonly Vignette[]; readonly centre: readonly Vignette[]; readonly support: readonly Vignette[];
  readonly small: readonly Vignette[]; readonly hangs: readonly Vignette[];
  readonly counts: { readonly anchors: number; readonly centre: number; readonly support: number };
}
/** 앉을 것 — 가운데 탁자 묶음은 의자가 딸린 것을 먼저(벤치 room-vig-1029 여관: 의자 없는 식탁). */
const SEAT = /chair|stool|bench|seat|sofa|pew/u;
const USE_WORDS = new Set(["read", "counter", "sleep", "heal", "save"]);
/** 후보 묶음 → 역할별 순서(견본 빈도·이 용도에만 나옴·쓰임·크기) + 바닥 넓이에 따른 개수. */
export function vignetteRecipe(cands: readonly Vignette[], S: HandInteriorSpec, floor: number, bias?: (v: Vignette) => number): VignetteRecipe {
  const useful = (v: Vignette) => v.items.some((it) => it.t === "o" && (S.objects[it.id]?.use ?? []).some((u) => USE_WORDS.has(u)));
  const seated = (v: Vignette) => v.wall === "C" && v.items.some((it) => SEAT.test(it.id)) && v.items.some((it) => !SEAT.test(it.id) && it.t === "o");
  // bias 는 묶음마다 한 번만 잰다(씨앗 난수를 섞으므로 정렬 비교마다 다시 부르면 순서가 흔들린다).
  const extra = new Map<Vignette, number>();
  const bonus = (v: Vignette) => { if (!bias) return 0; let b = extra.get(v); if (b === undefined) { b = bias(v); extra.set(v, b); } return b; };
  const score = (v: Vignette) => (seated(v) ? 3 : 0) + v.count + (v.kinds.length === 1 ? 1 : 0) + v.area / 4 + (useful(v) ? 1 : 0) + (v.id.startsWith("core:") ? 5 : 0) + bonus(v);
  const by = (list: Vignette[]) => list.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const ground = cands.filter((v) => v.h > 0);
  const anchors = by(ground.filter((v) => v.wall !== "C" && (v.area >= 3 || (useful(v) && v.area >= 2))));
  const centre = by(ground.filter((v) => v.wall === "C" && !isSingle(v) && v.area >= 2));
  const support = by(ground.filter((v) => (v.wall !== "C" && v.area >= 1 && v.area <= 4) || isSingle(v)));
  const small = by(ground.filter((v) => v.wall !== "C" && v.area <= 1));
  const hangs = by(cands.filter((v) => v.h === 0));
  return { anchors, centre, support, small, hangs, counts: {
    anchors: floor >= 40 ? 2 : 1,
    centre: floor >= 80 ? 2 : floor >= CENTRE_MIN_FLOOR ? 1 : 0,
    support: Math.max(2, Math.min(4, Math.round(floor / 15))),
  } };
}

/** 막힌 바닥 목표(가운데 값, 예제 방 사분위 33~50% 의 아래쪽 — 앞 통로를 비우므로). 짓기 쪽이 방을 이 비율에 맞춰 줄이거나 키운다. */
export const VIGNETTE_TARGET = 0.36;

/**
 * 묶음 발자국으로 정한 방 크기(벽면 두 줄 포함) — 레시피의 앵커·가운데·보조 묶음 넓이 ÷ 목표 막힘 비율이 바닥 넓이.
 * 폭은 가장 넓은 앵커·가운데 묶음 + 양옆 한 칸 이상, 가로:세로 약 4:3.
 */
export function vignetteRoomSize(tilesetId: string, kind: string, S: HandInteriorSpec, opts: { style?: string; purpose?: string; picks?: readonly string[]; scale?: number; composed?: boolean } = {}): { w: number; h: number } | undefined {
  const cands = opts.composed && !opts.picks?.length ? composedPool(tilesetId, kind, opts.purpose ?? kind, S).cands : pool(tilesetId, kind, opts.style, opts.picks, opts.purpose, S);
  if (!cands.length) return undefined;
  let floor = 48;
  let w = 8, fh = 6;
  for (let pass = 0; pass < 2; pass++) {
    const r = vignetteRecipe(cands, S, floor);
    const distinct = (list: readonly Vignette[], n: number) => { const seen = new Set<string>(); return list.filter((v) => !seen.has(v.main) && seen.add(v.main)).slice(0, n); };
    const take = [...distinct(r.anchors, r.counts.anchors), ...distinct(r.centre, r.counts.centre), ...distinct(r.support, r.counts.support)];
    const area = take.reduce((n, v) => n + v.area, 0);
    floor = Math.max(16, Math.round((area / VIGNETTE_TARGET) * (opts.scale ?? 1)));
    const widest = Math.max(4, ...take.map((v) => v.w + 2));
    w = Math.max(widest, Math.round(Math.sqrt(floor * 4 / 3)));
    fh = Math.max(3, Math.ceil(floor / w));
  }
  return { w, h: fh + 2 };
}

/** 같은 묶음이 함께 나온 방 종류(많이 겹치는 순 셋) — 예제가 적은 용도의 보충 후보. */
export function relatedKinds(tilesetId: string, kind: string): string[] {
  const n = new Map<string, number>();
  for (const v of roomVignettes(tilesetId)) if (v.kinds.includes(kind) && v.h > 0) for (const k of v.kinds) if (k !== kind) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([k]) => k);
}

// ── 조합(씨앗 + 성격 낱말) ─────────────────────────────────────────────

/** 조합 방 하나에 이 수까지만 서는 기물. */
const ONE_PER_ROOM: ReadonlyMap<string, number> = new Map([["globe", 1], ["globe_s", 1], ["clock", 1], ["fireplace", 1], ["telescope", 1], ["safe", 1], ["orrery", 1],
  ["magic circle", 1], ["cauldron", 1], ["owl perch", 1], ["armchair", 2], ["royal chest", 1], ["luggage trunk", 1], ["chart table", 1], ["spellbook stand", 1], ["dining 1x1", 2]]);
/** 좌우로 기운 기물(옆을 보는 의자·문) — 뒤집으면 등을 돌린다. */
const LATERAL = /\b[EW]\d?$|\b[EW] |left|right|side/u;
export function hashText(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export function seeded(seed: number): () => number { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** 방 성격 — 용도 글의 낱말. 한 방에 여럿일 수 있다(「마법사 학자의 서재」). */
export type RoomCharacter = "arcane" | "astro" | "scholar" | "noble" | "elf";
const CHARACTER_WORDS: readonly [RegExp, RoomCharacter][] = [
  [/마법|마도|마녀|마술|주술|흑마|연금|wizard|mage|magic|sorcer|witch|warlock|alchem/iu, "arcane"],
  [/천문|별|점성|관측|astro|star|observ/iu, "astro"],
  [/학자|학술|연구|학당|현자|선비|교수|scholar|sage|research|professor/iu, "scholar"],
  [/귀족|저택|영주|백작|공작|후작|남작|왕실|성주|noble|manor|lord|duke|count|baron|royal/iu, "noble"],
  [/엘프|요정|elf|elven|fae/iu, "elf"],
];
export function roomCharacters(text: string): RoomCharacter[] { return CHARACTER_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c); }
/** 기물 → 성격. 여러 성격에 걸치는 기물(책장)은 「두루」라 어느 방에도 맞는다. */
const ITEM_CHARACTER: readonly [RegExp, RoomCharacter][] = [
  [/crystal|spellbook|magic circle|owl perch|cauldron|alembic|potion|skull|mortar|flask|herb|apothecary|alchemy|specimen/u, "arcane"],
  [/telescope|orrery|star chart|chart table/u, "astro"],
  [/armchair|clock|picture|royal|safe|luggage trunk|candelabra|tapestry|column marble|fireplace/u, "noble"],
  [/leaf|\belf\b|elfstone|elven|livewood/u, "elf"],   // 「bookshelf」의 elf 를 엘프로 읽지 않게 낱말 경계
];
function vignetteCharacters(v: Vignette): Set<RoomCharacter> {
  const out = new Set<RoomCharacter>();
  for (const it of v.items) for (const [re, c] of ITEM_CHARACTER) if (re.test(it.id)) out.add(c);
  return out;
}
/** 기물 목록의 성격(마법·천문·귀족·엘프). */
export function itemCharacters(ids: readonly string[]): Set<RoomCharacter> { const out = new Set<RoomCharacter>(); for (const id of ids) for (const [re, c] of ITEM_CHARACTER) if (re.test(id)) out.add(c); return out; }
/** 기물 목록이 이 글의 방에 맞나 — 마법·엘프 기물은 그 낱말이 있을 때만(견본 고르기·조합 후보 공통). 바닥·벽 재질 id 도 엘프(elfstone·livewood)를 본다. */
export function itemsFitWords(ids: readonly string[], text: string): boolean {
  const said = roomCharacters(text);
  for (const id of ids) for (const [re, c] of ITEM_CHARACTER) if ((c === "arcane" || c === "elf") && re.test(id) && !said.includes(c)) return false;
  return true;
}
/** 손으로 짠 견본에서 뽑은 묶음(번들 라이브러리는 예제 맵 견본만 굽는다) — 칩셋·종류마다 한 번. */
const authoredCache = new Map<string, Vignette[]>();
function authoredVignettes(tilesetId: string, kinds: readonly string[], S: HandInteriorSpec): Vignette[] {
  const key = `${tilesetId}|${kinds.join(",")}`;
  let got = authoredCache.get(key);
  if (!got) { got = extractVignettes(tilesetId, S, roomTemplates(tilesetId).filter((t) => kinds.includes(t.kind) && t.map.startsWith("authored-"))); authoredCache.set(key, got); }
  return got;
}
/** 조합에서 이웃 용도의 묶음을 빌려 올 범위 — 서재는 서고(책장·독서 구석)를, 마법사 방이면 연금 구석까지. */
const COMPOSE_NEAR: Readonly<Record<string, readonly string[]>> = { study: ["library"], library: ["study"] };
const COMPOSE_ARCANE: readonly string[] = ["alchemy", "laboratory"];
/** 조합에서 빼는 기물 — 진짜 층계가 아닌 장식 계단(서재에 나선 계단만 덩그러니)·문. */
const COMPOSE_SKIP = /spiral stair|stairs?\b|ladder|door/u;

/**
 * 조합 후보: 그 용도의 예제 묶음 + 손 견본 묶음 + 이웃 용도 묶음(성격이 맞을 때). 성격 낱말이 묶음 점수에 더하는 값(bias)도 돌려준다.
 *  · 방 성격 묶음(마법사 방의 마법진) +3, 두루 묶음(책장·책상) 0, 다른 성격 묶음 -2.
 *  · 마법·엘프 묶음은 그 성격 낱말이 있을 때만 후보에 든다(평범한 서재에 마법진·잎 등불이 들어오지 않게).
 *  · 낱말이 없으면 학자·귀족을 반반(두루 서재).
 */
/** 용도마다 «없으면 그 방이 아닌» 기물 — 조합이 첫 앵커로 꼭 세운다. */
const COMPOSE_MUST: Readonly<Record<string, RegExp>> = { study: /bookshelf|cabinet:book|scroll rack/u, library: /bookshelf|cabinet:book/u };
export function composedPool(tilesetId: string, kind: string, purpose: string, S: HandInteriorSpec): { cands: Vignette[]; bias: (v: Vignette) => number; characters: RoomCharacter[]; must?: RegExp } {
  const said = roomCharacters(purpose);
  const characters: RoomCharacter[] = said.length ? said : ["scholar", "noble"];
  const kinds = [kind, ...(COMPOSE_NEAR[kind] ?? []), ...(said.includes("arcane") ? COMPOSE_ARCANE : [])];
  const lib = roomVignettes(tilesetId).filter((v) => v.kinds.some((k) => kinds.includes(k)));
  const all = [...lib, ...authoredVignettes(tilesetId, kinds, S)];
  const seen = new Set<string>();
  const cands = all.filter((v) => {
    if (v.items.some((it) => COMPOSE_SKIP.test(it.id))) return false;
    if (v.items.some((it) => it.t === "o" && !S.objects[it.id])) return false;
    const c = vignetteCharacters(v);
    if (c.has("arcane") && !characters.includes("arcane")) return false;
    if (c.has("elf") && !characters.includes("elf")) return false;
    // 이웃 용도에서 빌린 묶음은 성격이 맞거나 두루일 때만 — 서고의 큰 벽난로가 작은 서재를 차지하지 않게 넓이 6칸까지.
    if (!v.kinds.includes(kind) && v.area > 6) return false;
    const sig = `${v.wall}|${v.items.map((it) => `${it.t}:${it.id}@${it.x},${it.y}`).sort().join(";")}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  const bias = (v: Vignette): number => {
    const c = vignetteCharacters(v);
    if (!c.size) return 0;
    let b = 0;
    for (const x of c) b += characters.includes(x) ? 3 : -2;
    return b;
  };
  return { cands, bias, characters, ...(COMPOSE_MUST[kind] ? { must: COMPOSE_MUST[kind] } : {}) };
}
