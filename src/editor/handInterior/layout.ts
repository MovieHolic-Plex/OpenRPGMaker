// 방 구성 → 배치 후보. 조수(모델)는 방 종류만 고르고, 방 사각형 배치는 여기서 짠다(2026-10-08: 모델에게 평면을 맡기면
// 「예제 통째로 베끼기」 아니면 「보고 있는 맵 크기의 큰 네모 하나」로 끝났다).
//
//  크기: 방마다 같은 종류의 방 견본(templates.ts, 제작자 예제에서 자른 것) 크기를 목표로 한다. 견본이 없으면 종류별 기본 크기.
//  배치: 안쪽 사각형을 재귀로 둘로 가르는 slicing — 칸막이 1칸을 빼고 면적 비례로 가른다. 출구 방은 늘 맨 아래 줄에 닿게 한다.
//  점수: 목표 크기와의 차이 · 너무 길쭉한 방 · 원하는 이웃(prefer)을 못 붙인 수 · 통과용이 아닌 방(화장실·욕실·침실)을 지나야 하는 수.
//  문: 출구 방에서 넓게 퍼지는 나무 — 복도·거실 같은 중심 방을 먼저 거친다. 현관↔복도·부엌↔거실처럼 트인 쌍은 칸막이를 걷는다.
// 결과는 rooms.ts 의 rooms·connect·exit 그대로다.
import type { HandInteriorSpec } from "./builder";
import type { HandInteriorConnect, HandInteriorRoom } from "./rooms";
import { programKinds, roomTemplates, templatesOfKind, templateStyle, type InteriorRoomTemplate } from "./templates";

type Pair = readonly [string, string] | { readonly a: string; readonly b: string };
export interface LayoutRoomRequest { readonly id?: string; readonly kind: string; readonly w?: number; readonly h?: number; readonly floor?: string; readonly wall?: string }
export interface LayoutRequest {
  /** 예제 맵 key(house-1f·bakery…) 또는 건물 id(jp_house·tavern…) — 그 예제의 방 종류 목록을 쓴다. */
  readonly program?: string;
  readonly rooms?: readonly LayoutRoomRequest[];
  /** 출구 방 id(생략하면 genkan·entrance·hall·가게 순으로 찾는다). */
  readonly entrance?: string;
  /** 문으로 바로 잇고 싶은 방 쌍(id 또는 종류). */
  readonly prefer?: readonly Pair[];
  /** 칸막이 없이 트고 싶은 방 쌍. */
  readonly open?: readonly Pair[];
  readonly seed?: number;
  readonly maxWidth?: number; readonly maxHeight?: number;
}
export interface LayoutRoom extends HandInteriorRoom { readonly kind: string; readonly template?: string }
export interface LayoutCandidate {
  readonly width: number; readonly height: number; readonly score: number;
  readonly rooms: LayoutRoom[]; readonly connect: HandInteriorConnect[]; readonly exit: { readonly room: string };
  readonly notes: string[];
}

const DEFAULT_SIZE: Record<string, [number, number]> = {
  genkan: [4, 3], entrance: [5, 4], hall: [6, 4], corridor: [8, 4], toilet: [3, 4], bath: [3, 5], unitbath: [3, 4], dressing: [3, 5],
  bathroom: [4, 5], storeroom: [5, 5], pantry: [4, 5], kitchen: [6, 5], bedroom: [6, 5], kids: [6, 5], washitsu: [6, 5], study: [6, 5],
  living: [8, 6], ldk: [8, 7], dining: [7, 6], great_hall: [12, 8], tavern: [10, 7], shop: [9, 6],
};
/** 지나다니는 방 — 문 나무의 가지가 여기서 뻗는다. 나머지(화장실·욕실·침실…)는 끝방이 되도록 점수를 준다. */
const HUB = /^(genkan|entrance|hall|corridor|ldk|living|great_hall|tavern|dining|waiting_room|.*_shop|shop|konbini|supermarket|chapel|throne_room|engine_hall|casino|theater|common)$/u;
// 손님이 드는 방(가게·주점·대청)이 복도보다 먼저 — 여관이 복도로 들어가 주점을 거치게 짜였다(2026-10-09).
const ENTRANCE_ORDER = [/^genkan$/u, /^entrance$/u, /_shop$|^shop$|^tavern$|^great_hall$|^konbini$|^supermarket$|^common$/u, /^hall$/u, /^corridor$/u, HUB];
/** 기본으로 트는 쌍(종류). */
const OPEN_DEFAULT: [string, string][] = [["genkan", "hall"], ["genkan", "ldk"], ["genkan", "entrance"], ["kitchen", "ldk"], ["kitchen", "dining"]];
/** 일본 집 문 기물(사양에 있을 때만). */
const DOOR_OF: Record<string, { h?: string; v?: string }> = {
  toilet: { h: "door-open-toilet", v: "door-side-western" }, washitsu: { h: "fusuma-open", v: "door-side-sliding" },
  bath: { v: "door-side-sliding" }, dressing: { v: "door-side-sliding" }, unitbath: { h: "door-open-toilet", v: "door-side-western" },
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Want { id: string; kind: string; tw: number; th: number; minW: number; minH: number; floor?: string; wall?: string; template?: InteriorRoomTemplate }
interface Rect { x: number; y: number; w: number; h: number }

export class LayoutError extends Error { constructor(message: string) { super(message); this.name = "LayoutError"; } }

/** 요청 → 방 목록(목표 크기·견본). */
export function layoutWants(tilesetId: string, req: LayoutRequest): Want[] {
  let rooms: LayoutRoomRequest[] = [...(req.rooms ?? [])];
  if (!rooms.length && req.program) {
    const p = programKinds(tilesetId, req.program);
    if (!p) throw new LayoutError(`방 구성 "${req.program}" 이 없다 — list_interior_programs 로 찾거나 rooms 로 방 종류를 직접 준다`);
    rooms = p.kinds.map((kind) => ({ kind }));
  }
  if (!rooms.length) throw new LayoutError("program 또는 rooms(방 종류 목록)를 준다");
  const seen = new Map<string, number>();
  const r = rng((req.seed ?? 1) * 7919);
  // 화풍: program 이면 그 예제 맵의 묶음, 아니면 방 종류들이 가장 많이 나오는 묶음.
  const P = req.program ? programKinds(tilesetId, req.program) : undefined;
  let style = P ? templateStyle({ map: P.map }) : undefined;
  if (!style) {
    const votes = new Map<string, number>();
    for (const q of rooms) for (const t of roomTemplates(tilesetId)) if (t.kind === q.kind) votes.set(templateStyle(t), (votes.get(templateStyle(t)) ?? 0) + 1);
    style = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  return rooms.map((q) => {
    const n = (seen.get(q.kind) ?? 0) + 1; seen.set(q.kind, n);
    const id = q.id ?? (n === 1 ? q.kind : `${q.kind}${n}`);
    const near = q.w && q.h ? { w: q.w, h: q.h } : undefined;
    const pool = templatesOfKind(tilesetId, q.kind, near, style);
    // 크기를 주지 않았으면 같은 종류 견본 중 하나를 고른다(seed 마다 다른 견본 — 같은 집이 반복되지 않게).
    const template = near ? pool[0] : pool[Math.floor(r() * pool.length)];
    const [dw, dh] = DEFAULT_SIZE[q.kind] ?? (/_shop$/u.test(q.kind) ? DEFAULT_SIZE.shop! : [6, 5]);
    const tw = q.w ?? template?.w ?? dw, th = q.h ?? template?.h ?? dh;
    // 세로는 벽면 두 줄 + 걸을 바닥 — 작은 방(복도·현관·화장실·욕실)은 바닥 2줄, 나머지는 3줄 이상(2026-10-08: 바닥 2줄짜리 여관 방이 납작했다).
    const small = /^(hall|corridor|genkan|toilet|bath|unitbath|dressing|cell)$/u.test(q.kind);
    const minH = Math.max(small ? 4 : 5, Math.min(th, small ? 4 : 5));
    return { id, kind: q.kind, tw, th: Math.max(th, minH), minW: Math.max(2, Math.min(tw, 3) - (tw <= 2 ? 1 : 0)), minH,
      floor: q.floor ?? template?.floor, wall: q.wall ?? template?.wall, template };
  });
}

function pickEntrance(wants: Want[], req: LayoutRequest): string {
  if (req.entrance) {
    const hit = wants.find((w) => w.id === req.entrance) ?? wants.find((w) => w.kind === req.entrance);
    if (!hit) throw new LayoutError(`entrance "${req.entrance}" 이 방 목록에 없다`);
    return hit.id;
  }
  for (const re of ENTRANCE_ORDER) { const hit = wants.find((w) => re.test(w.kind)); if (hit) return hit.id; }
  return wants[0]!.id;
}

/** 사각형을 방 묶음으로 재귀 분할. 출구 방이 든 쪽은 늘 아래(가로로 가를 때). */
function slice(rect: Rect, list: Want[], entrance: string, r: () => number): Map<string, Rect> | null {
  if (list.length === 1) {
    const w = list[0]!;
    return rect.w >= w.minW && rect.h >= w.minH ? new Map([[w.id, rect]]) : null;
  }
  const area = (ws: Want[]) => ws.reduce((s, w) => s + w.tw * w.th, 0);
  const total = area(list);
  const vertical = rect.w > rect.h * (0.9 + r() * 0.6);
  const options: { k: number; dev: number }[] = [];
  for (let k = 1; k < list.length; k++) options.push({ k, dev: Math.abs(area(list.slice(0, k)) / total - 0.5) + r() * 0.15 });
  options.sort((a, b) => a.dev - b.dev);
  for (const { k } of options.slice(0, 3)) {
    let A = list.slice(0, k), B = list.slice(k);
    if (vertical) {
      const wA = Math.round((rect.w - 1) * area(A) / total), wB = rect.w - 1 - wA;
      if (wA < Math.max(...A.map((w) => w.minW)) || wB < Math.max(...B.map((w) => w.minW))) continue;
      const a = slice({ x: rect.x, y: rect.y, w: wA, h: rect.h }, A, entrance, r), b = a && slice({ x: rect.x + wA + 1, y: rect.y, w: wB, h: rect.h }, B, entrance, r);
      if (a && b) return new Map([...a, ...b]);
    } else {
      if (A.some((w) => w.id === entrance)) [A, B] = [B, A];             // 출구 방 쪽이 아래
      const hA = Math.round((rect.h - 1) * area(A) / total), hB = rect.h - 1 - hA;
      if (hA < Math.max(...A.map((w) => w.minH)) || hB < Math.max(...B.map((w) => w.minH))) continue;
      const a = slice({ x: rect.x, y: rect.y, w: rect.w, h: hA }, A, entrance, r), b = a && slice({ x: rect.x, y: rect.y + hA + 1, w: rect.w, h: hB }, B, entrance, r);
      if (a && b) return new Map([...a, ...b]);
    }
  }
  return null;
}

/**
 * 아래에서 위로 짜는 분할(2026-10-09) — 방마다 목표 크기(견본 크기)를 먼저 정하고, 둘씩 묶을 때 가로면 너비를 더하고(+칸막이 1)
 * 높이는 큰 쪽, 세로면 그 반대로 바깥 크기를 정한다. 그래서 어떤 방도 견본보다 작아지지 않는다(작아지면 가구가 빠지거나 엉킨다).
 * 작은 쪽은 남는 만큼 늘어나고, 건물 바깥에 닿은 남는 부분은 trimToTarget 이 깎아 ㄱ·ㄷ자 외곽이 된다.
 */
interface Tree { w: number; h: number; leaf?: Want; vertical?: boolean; a?: Tree; b?: Tree }
function buildTree(list: Want[], entrance: string, r: () => number): Tree {
  if (list.length === 1) return { w: list[0]!.tw, h: list[0]!.th, leaf: list[0]! };
  const area = (ws: Want[]) => ws.reduce((s, w) => s + w.tw * w.th, 0);
  const total = area(list);
  const options: { k: number; dev: number }[] = [];
  for (let k = 1; k < list.length; k++) options.push({ k, dev: Math.abs(area(list.slice(0, k)) / total - 0.5) + r() * 0.2 });
  options.sort((x, y) => x.dev - y.dev);
  const k = options[Math.min(options.length - 1, Math.floor(r() * Math.min(2, options.length)))]!.k;
  let A = list.slice(0, k), B = list.slice(k);
  const ta0 = buildTree(A, entrance, r), tb0 = buildTree(B, entrance, r);
  // 가로로 붙일지 세로로 쌓을지: 바깥 상자가 덜 길쭉하고 덜 비는 쪽(조금 무작위)
  const cost = (w: number, h: number) => w * h - (ta0.w * ta0.h + tb0.w * tb0.h) + Math.max(w / h, h / w) * 6 + r() * 6;
  const vw = ta0.w + 1 + tb0.w, vh = Math.max(ta0.h, tb0.h), hw = Math.max(ta0.w, tb0.w), hh = ta0.h + 1 + tb0.h;
  const vertical = cost(vw, vh) < cost(hw, hh);
  let ta = ta0, tb = tb0;
  if (!vertical && A.some((w) => w.id === entrance)) { [A, B] = [B, A]; [ta, tb] = [tb, ta]; }   // 출구 방 쪽이 아래
  return vertical ? { w: vw, h: vh, vertical, a: ta, b: tb } : { w: hw, h: hh, vertical, a: ta, b: tb };
}
function placeTree(t: Tree, rect: Rect, out: Map<string, Rect>, r: () => number) {
  if (t.leaf) { out.set(t.leaf.id, rect); return; }
  const extra = t.vertical ? rect.w - t.w : rect.h - t.h;
  const toA = Math.round(extra * r());
  if (t.vertical) {
    const wA = t.a!.w + toA;
    placeTree(t.a!, { x: rect.x, y: rect.y, w: wA, h: rect.h }, out, r);
    placeTree(t.b!, { x: rect.x + wA + 1, y: rect.y, w: rect.w - wA - 1, h: rect.h }, out, r);
  } else {
    const hA = t.a!.h + toA;
    placeTree(t.a!, { x: rect.x, y: rect.y, w: rect.w, h: hA }, out, r);
    placeTree(t.b!, { x: rect.x, y: rect.y + hA + 1, w: rect.w, h: rect.h - hA - 1 }, out, r);
  }
}

/**
 * 가른 칸이 목표보다 크면 건물 바깥에 닿은 변(위·왼쪽·오른쪽, 출구 방이 아니면 아래도)을 목표 크기까지 깎는다 —
 * 깎인 자리는 건물 밖이 되어 바깥 모양이 ㄱ·ㄷ자로 꺾인다. 큰 방이 텅 비는 것(2026-10-08 시험: 복도 11×7)을 막는다.
 */
function trimToTarget(rects: Map<string, Rect>, wants: Want[], entrance: string, W: number, H: number) {
  for (const w of wants) {
    const rc = rects.get(w.id)!;
    let extraW = rc.w - w.tw, extraH = rc.h - w.th;
    if (extraW >= 2) {
      const left = rc.x === 1, right = rc.x + rc.w - 1 === W;
      if (right) { const cut = left ? Math.ceil(extraW / 2) : extraW; rc.w -= cut; extraW -= cut; }
      if (left && extraW >= 1) { rc.x += extraW; rc.w -= extraW; }
    }
    if (extraH >= 2) {
      const top = rc.y === 1, bottom = rc.y + rc.h - 1 === H && w.id !== entrance;
      if (top) { const cut = bottom ? Math.ceil(extraH / 2) : extraH; rc.y += cut; rc.h -= cut; extraH -= cut; }
      if (bottom && extraH >= 1) rc.h -= extraH;
    }
  }
}

interface Edge { a: string; b: string; kind: "h" | "v" }
function adjacency(rects: Map<string, Rect>): Edge[] {
  const out: Edge[] = [];
  const ids = [...rects.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = rects.get(ids[i]!)!, B = rects.get(ids[j]!)!;
    const [top, bot] = A.y + A.h + 1 === B.y ? [A, B] : B.y + B.h + 1 === A.y ? [B, A] : [];
    if (top && bot && Math.min(top.x + top.w, bot.x + bot.w) - Math.max(top.x, bot.x) >= 1) { out.push({ a: ids[i]!, b: ids[j]!, kind: "h" }); continue; }
    const [lft, rgt] = A.x + A.w + 1 === B.x ? [A, B] : B.x + B.w + 1 === A.x ? [B, A] : [];
    if (lft && rgt && Math.min(lft.y + lft.h, rgt.y + rgt.h) - Math.max(lft.y, rgt.y) >= 3) out.push({ a: ids[i]!, b: ids[j]!, kind: "v" });
  }
  return out;
}

const matches = (w: Want, key: string) => w.id === key || w.kind === key;

/** 배치 후보를 점수 순으로(낮을수록 좋다). */
export function layoutCandidates(tilesetId: string, req: LayoutRequest, S: HandInteriorSpec, count = 3): LayoutCandidate[] {
  const wants = layoutWants(tilesetId, req);
  const entrance = pickEntrance(wants, req);
  const byId = new Map(wants.map((w) => [w.id, w]));
  const pairOf = (list: readonly Pair[] | undefined) => (list ?? []).map((x) => (Array.isArray(x) ? x : [(x as { a: string }).a, (x as { b: string }).b]) as readonly [string, string]).flatMap(([p, q]) =>
    wants.filter((w) => matches(w, p)).flatMap((a) => wants.filter((w) => w !== a && matches(w, q)).map((b) => [a.id, b.id] as [string, string])));
  const prefer = pairOf(req.prefer);
  const openPairs = [...pairOf(req.open), ...pairOf(OPEN_DEFAULT as Pair[])];
  const isOpen = (a: string, b: string) => openPairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const total = wants.reduce((s, w) => s + w.tw * w.th, 0);
  const r = rng(req.seed ?? 1);
  const found = new Map<string, LayoutCandidate>();
  for (let trial = 0; trial < 600 && found.size < 60; trial++) {
    const order = [...wants];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
    const ar = 1.05 + r() * 0.75;
    const slack = 1 + order.length * 0.06;
    let W = Math.max(...wants.map((w) => w.minW), Math.round(Math.sqrt(total * slack * ar)));
    let H = Math.max(...wants.map((w) => w.minH), Math.ceil(total * slack / W));
    if (req.maxWidth) W = Math.min(W, req.maxWidth - 2);
    if (req.maxHeight) H = Math.min(H, req.maxHeight - 2);
    // 짝수 번 시도는 아래에서 위로(견본보다 작은 방이 없다), 홀수 번은 바깥 크기를 먼저 정하고 가르는 옛 방식 —
    // 크기 제한(maxWidth·maxHeight)에 걸려 앞쪽이 안 될 때를 위해 남긴다.
    let rects: Map<string, Rect> | null;
    if (trial % 2 === 0) {
      const tree = buildTree(order, entrance, r);
      if ((req.maxWidth && tree.w > req.maxWidth - 2) || (req.maxHeight && tree.h > req.maxHeight - 2)) continue;
      rects = new Map(); placeTree(tree, { x: 1, y: 1, w: tree.w, h: tree.h }, rects, r);
      W = tree.w; H = tree.h;
    } else rects = slice({ x: 1, y: 1, w: W, h: H }, order, entrance, r);
    if (!rects) continue;
    trimToTarget(rects, wants, entrance, W, H);
    { // 깎고 남은 빈 바깥 줄·열을 떼어 낸다
      const mx = Math.min(...[...rects.values()].map((q) => q.x)) - 1, my = Math.min(...[...rects.values()].map((q) => q.y)) - 1;
      for (const q of rects.values()) { q.x -= mx; q.y -= my; }
    }
    const BW = Math.max(...[...rects.values()].map((q) => q.x + q.w)) + 1, BH = Math.max(...[...rects.values()].map((q) => q.y + q.h)) + 1;
    const edges = adjacency(rects);
    // 문 나무: 출구 방에서 BFS — 원하는 쌍·트는 쌍·중심 방으로 가는 변을 먼저.
    const prio = (e: Edge, from: string) => {
      const to = e.a === from ? e.b : e.a;
      return (prefer.some(([p, q]) => (p === from && q === to) || (p === to && q === from)) ? 0 : 4) + (isOpen(from, to) ? 0 : 1) + (HUB.test(byId.get(to)!.kind) ? 0 : 2);
    };
    // 1단계는 출구 방·중심 방만 가지를 뻗고(끝방은 잎), 그래도 못 닿은 방이 있으면 2단계에서 끝방도 지나가게 한다(감점).
    const reached = new Set([entrance]); const tree: Edge[] = [];
    for (const allowLeafPass of [false, true]) {
      let frontier = [...reached];
      while (frontier.length) {
        const next: string[] = [];
        for (const from of frontier) {
          if (!allowLeafPass && from !== entrance && !HUB.test(byId.get(from)!.kind)) continue;
          const out = edges.filter((e) => (e.a === from || e.b === from) && !reached.has(e.a === from ? e.b : e.a)).sort((x, y) => prio(x, from) - prio(y, from));
          for (const e of out) { const to = e.a === from ? e.b : e.a; if (reached.has(to)) continue; reached.add(to); tree.push(e); next.push(to); }
        }
        frontier = next;
      }
      if (reached.size === wants.length) break;
    }
    if (reached.size !== wants.length) continue;
    // 원하는 쌍이 이웃이면 문을 더한다(나무 밖이어도)
    for (const [p, q] of prefer) {
      const e = edges.find((x) => (x.a === p && x.b === q) || (x.a === q && x.b === p));
      if (e && !tree.includes(e)) tree.push(e);
    }
    let score = 0;
    const notes: string[] = [];
    for (const w of wants) {
      const rc = rects.get(w.id)!;
      // 견본보다 작은 방은 가구가 다 안 들어가 크게 감점(2026-10-09: 줄인 부엌에서 가구 절반이 빠졌다), 큰 방은 덜.
      const short = Math.max(0, w.tw - rc.w) + Math.max(0, w.th - rc.h), extra = Math.max(0, rc.w - w.tw) + Math.max(0, rc.h - w.th);
      score += (short * 3 + extra * 1.5) / (w.tw + w.th) * 4;
      const asp = Math.max(rc.w / rc.h, rc.h / rc.w);
      if (asp > 2.6 && !/hall|corridor/u.test(w.kind)) score += (asp - 2.6) * 2;
    }
    { // 건물 전체: 깎인 빈 자리가 많거나 너무 길쭉하면 감점(2026-10-09: 아래에서 위로 짜니 35×21·53×14 같은 건물이 1등이었다)
      const roomArea = [...rects.values()].reduce((a, q) => a + q.w * q.h, 0);
      score += Math.max(0, (BW - 2) * (BH - 2) - roomArea * 1.25) / total * 6;
      const basp = Math.max(BW / BH, BH / BW);
      if (basp > 1.7) score += (basp - 1.7) * 3;
    }
    for (const [p, q] of prefer) if (!edges.some((e) => (e.a === p && e.b === q) || (e.a === q && e.b === p))) { score += 3; notes.push(`${p}–${q} 이 이웃이 아니다`); }
    for (const [p, q] of openPairs) if (!edges.some((e) => (e.a === p && e.b === q) || (e.a === q && e.b === p))) score += 1.5;   // 트는 쌍(부엌↔거실…)은 붙어 있는 편이 좋다
    // 끝방(화장실·욕실·침실…)을 지나가야 하면 감점
    const deg = new Map<string, number>(); for (const e of tree) { deg.set(e.a, (deg.get(e.a) ?? 0) + 1); deg.set(e.b, (deg.get(e.b) ?? 0) + 1); }
    for (const w of wants) if (!HUB.test(w.kind) && w.id !== entrance && (deg.get(w.id) ?? 0) > 1) { score += 2.5; notes.push(`${w.id} 를 지나가야 다른 방에 간다`); }
    const connect: HandInteriorConnect[] = tree.map((e) => {
      const A = byId.get(e.a)!, B = byId.get(e.b)!;
      // 위·아래로 트는 쌍은 아래 방 북쪽 벽면을 살리려고 가운데 3칸만 튼다(현관 띠처럼 벽 없는 방이 아래면 전부).
      if (isOpen(e.a, e.b)) {
        const lower = rects.get(e.a)!.y > rects.get(e.b)!.y ? A : B;
        return e.kind === "h" && !/^(genkan|entrance)$/u.test(lower.kind) ? { a: e.a, b: e.b, open: true, span: 3 } : { a: e.a, b: e.b, open: true };
      }
      const pick = (w: Want) => DOOR_OF[w.kind]?.[e.kind];
      const door = pick(A) ?? pick(B);
      return { a: e.a, b: e.b, ...(door && S.objects[door] ? { door } : {}) };
    });
    const rooms: LayoutRoom[] = wants.map((w) => {
      const rc = rects.get(w.id)!;
      return { id: w.id, kind: w.kind, x0: rc.x, y0: rc.y, x1: rc.x + rc.w - 1, y1: rc.y + rc.h - 1, ...(w.floor ? { floor: w.floor } : {}), ...(w.wall ? { wall: w.wall } : {}), ...(w.template ? { template: w.template.id } : {}) };
    });
    const key = rooms.map((x) => `${x.id}:${x.x0},${x.y0},${x.x1},${x.y1}`).join("|");
    if (!found.has(key)) found.set(key, { width: BW, height: BH, score: Math.round(score * 100) / 100, rooms, connect, exit: { room: entrance }, notes });
  }
  if (!found.size) throw new LayoutError(`방 ${wants.length}개를 ${req.maxWidth ?? "?"}×${req.maxHeight ?? "?"} 안에 배치하지 못했다 — 방 수를 줄이거나 크기 제한을 푼다`);
  return [...found.values()].sort((a, b) => a.score - b.score).slice(0, count);
}

/** 후보 미리보기 — 방마다 글자 하나(A,B,…), 칸막이 '#', 문 '+'. */
export function layoutAscii(c: LayoutCandidate, plan: readonly string[]): string[] {
  const g = plan.map((row) => [...row]);
  c.rooms.forEach((rm, i) => {
    const ch = String.fromCharCode(65 + (i % 26));
    for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) if (g[y]![x] === ".") g[y]![x] = ch;
  });
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y]!.length; x++) if (g[y]![x] === ".") g[y]![x] = "+";
  return g.map((row) => row.join(""));
}
