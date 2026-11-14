// 버들항 마을 장면 놓기(2026-11-14) — 마을 종류(beodeulVillageKinds.ts)의 «장면» 을 통째로 놓는다.
//
// 왜(오너 2026-11-14 «마을들을 잘 어울리게 수십 종류를 미리미리 만들어놔서»): 기물을 해시로 하나씩 뿌리면 물건은 많아도 «곳» 이 되지 않는다 —
// 화덕 없는 모루, 그물 없는 통발. 장면은 서너 ~ 여덟 가지가 제자리에 모인 무더기이고, 다 들어갈 자리가 있을 때만 놓는다(통째로, 아니면 안 놓는다).
// 자리 검사는 빌더의 것 그대로다(host — 빈 땅·한 단·문 앞·길). 여기서 더 보는 것은 «무더기» 의 조건뿐이다: 한 단 위, 걸어 닿는 곳, 둘레가 트인 곳,
// 다른 장면과 떨어진 곳(무더기 사이에 빈 땅이 남는다).
import { lookHash } from "@/project/kitLook";
import type { BeodeulObjectHost, ObjectKit, RouteGuard } from "./beodeulObjectSets";

/** 장면이 기대는 자리: 일터 건물 문 곁 · 물가 · 모이는 곳 가장자리 · 큰길 어귀 · 높은 단 · 집 옆 · 집 뒤 · 길가 · 들 · 판석 광장. */
export type SceneAnchor = "work" | "shore" | "commons" | "entry" | "upper" | "house" | "behind" | "road" | "wild" | "plaza";
export const SCENE_ANCHORS: readonly SceneAnchor[] = ["work", "shore", "commons", "entry", "upper", "house", "behind", "road", "wild", "plaza"];

export interface ScenePiece {
  /** 킷 후보(앞에서부터 타일셋에 있는 첫 번째를 쓴다). */
  readonly ids: readonly string[];
  /** 발(맨 아래 줄 왼쪽 칸)의 자리 — 장면 원점에서. 키가 다른 그림도 같은 땅 줄에 선다. */
  readonly dx: number; readonly dy: number;
  /** 없어도 장면이 서는 곁들이. */
  readonly optional: boolean;
  /** 물 위에 뜨는 것(배·부표) — 제자리에서 가장 가까운 물 칸에 놓는다. 장면의 수에 세지 않는다. */
  readonly water: boolean;
}
export interface VillageScene {
  readonly id: string; readonly ko: string; readonly en: string;
  readonly at: SceneAnchor;
  readonly pieces: readonly ScenePiece[];
  /** 놓인 뭍 조각이 이 수보다 적으면 장면이 아니다. */
  readonly min: number;
}
export interface PlacedScene {
  readonly id: string; readonly ko: string; readonly en: string; readonly at: SceneAnchor;
  /** 장면이 차지한 네모(뭍 조각의 그림 칸 전부). */
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  /** 사람이 설 칸(장면 곁의 빈 땅) — 빌더가 다 지은 뒤 걸어 닿는 칸으로 다시 고른다. */
  stand: { x: number; y: number };
  readonly required: number; readonly min: number; readonly pieces: number;
  /** 다 찍은 뒤 길목 검사·갇힌 빈터 열기가 조각을 걷어 장면이 깨져 통째로 걷었다. */
  lifted?: boolean;
}
export type SceneSkip = "kits" | "room" | "anchor";
/** tried = 자리 없음의 속: 닻이 준 후보 수 · 무더기 조건(한 단·트인 둘레·다른 장면과 거리)에서 떨어진 수 · 조각이 안 들어간 수 · 길을 돌려서 뺀 수. */
export interface SceneReport { placed: PlacedScene[]; skipped: { id: string; ko: string; why: SceneSkip; tried?: { spots: number; group: number; fit: number; route: number } }[] }

export interface BeodeulSceneHost extends BeodeulObjectHost {
  /** 모이는 곳(우물 자리) · 큰길이 맵으로 드는 칸 · 일터 건물 문 앞 칸(건물이 섰을 때). */
  readonly gather: { x: number; y: number } | null;
  readonly entrance: { x: number; y: number } | null;
  readonly workDoor: { x: number; y: number } | null;
  /**
   * 빌더가 아는 칸 목록(있을 때만): 마당(모이는 곳의 다진 흙)·둑 위. 주면 닻 찾기가 그 칸을 쓰고, 없으면 모이는 곳·문·물가·길에서 스스로 찾는다.
   */
  readonly areas?: SceneAreas;
  /** 그 킷이 그 자리에서 막는 칸(발). */
  footCells(kit: ObjectKit, x: number, y: number): number[];
  /** 장면 안의 빈 칸을 비워 둔다 — 나무·덤불·밭이 들어오지 않게(걷는 땅 그대로). */
  reserve(x: number, y: number): void;
}

/** 바닥·배치 쪽이 내어 주는 칸 목록(칸 번호 y*W+x). */
export interface SceneAreas {
  readonly commons?: readonly number[]; readonly quay?: readonly number[];
  /** 빌더가 집·길보다 먼저 비워 둔 장면 터 — 일터 문 곁 마당 · 모이는 곳 곁. 그 닻의 첫 장면이 여기 선다. */
  readonly workYard?: readonly number[]; readonly gatherYard?: readonly number[];
}
/** 장면이 차지하는 네모의 크기(지금 타일셋에 있는 뭍 조각으로) — 빌더가 터를 미리 비울 때 쓴다. 설 수 없는 장면이면 null. */
export function sceneFootprint(scene: VillageScene, kitOf: (id: string) => ObjectKit | undefined, requiredOnly = false): { w: number; h: number } | null {
  const land: { k: ObjectKit; dx: number; dy: number }[] = [];
  for (const p of scene.pieces) {
    if (p.water) continue;
    const k = p.ids.map(kitOf).find((x) => !!x);
    if (!k) { if (!p.optional) return null; continue; }
    if (!requiredOnly || !p.optional) land.push({ k, dx: p.dx, dy: p.dy });
  }
  if (land.length < Math.min(scene.min, requiredOnly ? 1 : scene.min)) return null;
  const x0 = Math.min(...land.map((p) => p.dx)), x1 = Math.max(...land.map((p) => p.dx + p.k.w - 1)), y0 = Math.min(...land.map((p) => p.dy - p.k.h + 1)), y1 = Math.max(...land.map((p) => p.dy));
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
interface Box { x0: number; y0: number; x1: number; y1: number }
interface AnchorContext { /** 미리 비워 둔 터(그 닻의 것) — 네모가 통째로 그 안이면 가장 좋은 자리다. */ yard: ReadonlySet<number> | null; reach: Int16Array; settled: Int16Array; /** 일터 문 앞에서 걸어서(빈 땅·길, 같은 단) 몇 걸음인가 — 99 = 열두 걸음 안에 안 닿는다. */ fromDoor: Int16Array | null; baseLevel: number; hasUpper: boolean; commons: ReadonlySet<number> | null; quay: ReadonlySet<number> | null }

/**
 * 닻 → 네모의 점수(작을수록 좋다 · Infinity = 그 닻의 자리가 아니다). 닻을 찾는 규칙은 모두 여기 있다.
 * 칸 목록(ctx.commons·ctx.quay)이 있으면 그 칸으로, 없으면 모이는 곳·일터 문·물가·길·집으로 찾는다. null = 이 마을에 그 닻이 없다.
 * 어느 닻이든 집에서 멀면(닻마다 정한 칸 수) 자리가 아니다 — 장면은 집과 마당 곁에 무리로 앉는다.
 */
function sceneAnchorScore(host: BeodeulSceneHost, ctx: AnchorContext, at: SceneAnchor, onPlaza: boolean): ((b: Box) => number) | null {
  const base = anchorScore(host, ctx, at, onPlaza), yard = ctx.yard, W0 = host.W;
  if (!yard) return base;
  return (b) => { for (let y = b.y0; y <= b.y1; y += 1) for (let x = b.x0; x <= b.x1; x += 1) if (!yard.has(y * W0 + x)) return base ? base(b) : Infinity; return -100; };
}
function anchorScore(host: BeodeulSceneHost, ctx: AnchorContext, at: SceneAnchor, onPlaza: boolean): ((b: Box) => number) | null {
  const { W, H } = host;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const cx = (b: Box) => Math.floor((b.x0 + b.x1) / 2), cy = (b: Box) => Math.floor((b.y0 + b.y1) / 2);
  /** 네모에서 점까지의 틈(여덟 방향). 0 = 네모 안. */
  const gap = (b: Box, p: { x: number; y: number }) => Math.max(p.x < b.x0 ? b.x0 - p.x : p.x > b.x1 ? p.x - b.x1 : 0, p.y < b.y0 ? b.y0 - p.y : p.y > b.y1 ? p.y - b.y1 : 0);
  const ring = (b: Box, d: number, hit: (x: number, y: number) => boolean): number => {
    let n = 0;
    for (let y = b.y0 - d; y <= b.y1 + d; y += 1) for (let x = b.x0 - d; x <= b.x1 + d; x += 1) if ((x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) && inMap(x, y) && hit(x, y)) n += 1;
    return n;
  };
  const inside = (b: Box, hit: (x: number, y: number) => boolean): number => { let n = 0; for (let y = b.y0; y <= b.y1; y += 1) for (let x = b.x0; x <= b.x1; x += 1) if (hit(x, y)) n += 1; return n; };
  const kind = (k: string) => (x: number, y: number) => host.cell(x, y) === k;
  const homes = (b: Box) => ctx.settled[cy(b) * W + cx(b)]!;
  const focus = host.work ?? host.gather;
  const far = (b: Box) => (focus ? Math.hypot(cx(b) - focus.x, cy(b) - focus.y) : 0);
  const anchor: SceneAnchor = at === "plaza" && !onPlaza ? "commons" : at === "work" && !host.work && !host.workDoor ? "commons" : at;
  if (anchor === "work") {
    const door = host.workDoor;
    // 문 곁: 문 줄(문 앞에서 남쪽으로 난 걸음 자리)은 비우고 건물 앞줄에서 옆으로 붙는다. 건물이 없으면 일터 자리 둘레.
    // 문 앞에서 남쪽으로 난 걸음 자리(문 줄 세 칸)를 덮지 않으면 길 건너도 된다 — 다만 멀수록 나쁘고 여덟 칸을 넘지 않는다.
    // 강 건너·절벽 아래는 문 곁이 아니다: 네모 둘레에 문에서 걸어 열 걸음 안에 닿는 칸이 있어야 한다.
    if (door && ctx.fromDoor) { const walk = ctx.fromDoor; return (b) => {
      const g = gap(b, door); if (g < 1 || g > 8 || (b.x0 <= door.x && b.x1 >= door.x && b.y0 <= door.y + 3)) return Infinity;
      let near = 99; for (let y = b.y0 - 1; y <= b.y1 + 1; y += 1) for (let x = b.x0 - 1; x <= b.x1 + 1; x += 1) if (inMap(x, y)) near = Math.min(near, walk[y * W + x]!);
      return near > 10 ? Infinity : near * 1.2 + g * 0.5 + Math.abs(b.y0 - door.y) * 0.3;
    }; }
    const w = host.work!; return (b) => { const g = gap(b, w); return g > 5 ? Infinity : g; };
  }
  if (anchor === "commons" || anchor === "plaza") {
    // 마당 칸을 받았으면 그 가장자리(네모는 마당 밖에 걸치고 둘레가 마당에 닿는다), 아니면 모이는 곳에서 두세 칸.
    const yard = ctx.commons;
    if (yard && !onPlaza) return (b) => { const on = inside(b, (x, y) => yard.has(y * W + x)), touch = ring(b, 1, (x, y) => yard.has(y * W + x)); return !touch || on > ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)) * 0.4 ? Infinity : on * 0.5 + homes(b) * 0.3; };
    const g0 = host.gather; if (!g0) return null;
    return (b) => { const g = gap(b, g0); return g < 2 || g > (onPlaza ? 9 : 7) ? Infinity : Math.abs(g - 3) + homes(b) * 0.2; };
  }
  if (anchor === "entry") {
    const e = host.entrance; if (!e) return null;
    return (b) => { const g = gap(b, e); return g < 3 || g > 10 || !ring(b, 1, kind("road")) ? Infinity : Math.abs(g - 5); };
  }
  if (anchor === "shore") {
    const quay = ctx.quay;
    if (quay) return (b) => (ring(b, 1, (x, y) => quay.has(y * W + x)) + inside(b, (x, y) => quay.has(y * W + x)) && homes(b) <= 9 ? far(b) * 0.25 : Infinity);
    return (b) => (ring(b, 2, kind("water")) && homes(b) <= 8 ? far(b) * 0.25 + homes(b) * 0.4 + (ring(b, 1, kind("water")) ? 0 : 1.5) : Infinity);
  }
  // 높은 단: 마을 단보다 높은 단이 있을 때만 — 마을이 맨 윗단에 앉았으면(더 높은 땅이 없다) 마을 끝의 들로 간다.
  if (anchor === "upper" && ctx.hasUpper) return (b) => (host.level(b.x0, b.y1) > ctx.baseLevel && homes(b) >= 2 && homes(b) <= 14 ? homes(b) * 0.5 + far(b) * 0.1 : Infinity);
  if (anchor === "house" || anchor === "behind") {
    if (!host.houses.length) return null;
    // 집 옆: 벽에서 한 칸 띄워 집 발치 줄에. 집 뒤: 지붕 윗변에서 한두 칸 위, 집 폭 안에.
    return (b) => {
      let best = Infinity;
      host.houses.forEach((h, n) => {
        const order = (lookHash(`scene-house|${host.seed}|${at}|${h.x},${h.y}`) % 97) / 97 * 3 + n * 0.01;
        if (anchor === "house") { const foot = h.y + h.h - 1; if ((b.x0 === h.x + h.w + 1 || b.x1 === h.x - 2) && b.y1 <= foot && b.y1 >= foot - 2) best = Math.min(best, order + (foot - b.y1)); }
        else if ((b.y1 === h.y - 1 || b.y1 === h.y - 2) && b.x0 >= h.x - 1 && b.x1 <= h.x + h.w) best = Math.min(best, order + (h.y - 1 - b.y1));
      });
      return best;
    };
  }
  if (anchor === "road") return (b) => (ring(b, 1, kind("road")) && homes(b) >= 2 && homes(b) <= 6 ? far(b) * 0.15 + homes(b) * 0.3 : Infinity);
  // 들: 길에서 서너 칸 든 풀밭 — 그래도 집에서 여덟 칸 안(마을 끝의 벌통 줄·숯가마이지 숲속의 외딴 무더기가 아니다).
  return (b) => { const d = ctx.reach[b.y1 * W + b.x0]!; return d >= 3 && d <= 7 && homes(b) >= 3 && homes(b) <= 8 ? homes(b) * 0.4 + far(b) * 0.05 : Infinity; };
}

/** 장면 조각의 쓰임 이름 — 빌더가 걷어 낼 때 어느 장면의 어떤 조각인지 안다. */
export const sceneSlot = (scene: number, required: boolean): string => `scene:${scene}:${required ? "r" : "o"}`;

/** 살아 있는 조각의 쓰임 이름들로 깨진 장면(필수 조각이 빠졌거나 남은 것이 모자란 장면)의 번호를 고른다. */
export function brokenVillageScenes(scenes: readonly PlacedScene[], liveSlots: readonly string[]): number[] {
  const req = new Map<number, number>(), all = new Map<number, number>();
  for (const slot of liveSlots) {
    const m = /^scene:(\d+):([ro])$/u.exec(slot); if (!m) continue;
    const i = Number(m[1]);
    all.set(i, (all.get(i) ?? 0) + 1); if (m[2] === "r") req.set(i, (req.get(i) ?? 0) + 1);
  }
  return scenes.flatMap((s, i) => (!s.lifted && ((req.get(i) ?? 0) < s.required || (all.get(i) ?? 0) < s.min) ? [i] : []));
}

interface Part { kit: ObjectKit; dx: number; dy: number; optional: boolean; water: boolean }
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** 종류의 장면을 차례로 놓는다. key = 게임 열쇠(없으면 종류 이름) — 같은 게임·같은 씨앗은 같은 자리다. */
export function placeVillageScenes(host: BeodeulSceneHost, scenes: readonly VillageScene[], key: string, walkOn: ReadonlySet<string>, guard: RouteGuard): SceneReport {
  const { W, H } = host;
  const report: SceneReport = { placed: [], skipped: [] };
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const open = (x: number, y: number) => { const c = host.cell(x, y); return c === "free" || c === "road" || c === "plaza"; };
  // 길에서 걸어 닿는 거리(빈 땅은 같은 단끼리만 — 단은 길이 건넌다). 99 = 닿지 않는다.
  const reach = new Int16Array(W * H).fill(99);
  { const q: number[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const c = host.cell(x, y); if (c === "road" || c === "plaza") { reach[idx(x, y)] = 0; q.push(idx(x, y)); } }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; if (reach[c]! >= 12) continue;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || host.cell(nx, ny) !== "free" || host.level(nx, ny) !== host.level(x, y)) continue;
        const n = idx(nx, ny); if (reach[n]! > reach[c]! + 1) { reach[n] = reach[c]! + 1; q.push(n); } } } }
  // 집·큰 건물까지의 거리(여덟 방향, 16칸까지) — 장면은 집과 마당 곁에 앉는다. 빈 풀밭 한가운데의 장면은 «곳» 이 아니다.
  const settled = new Int16Array(W * H).fill(99);
  { const q: number[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (host.cell(x, y) === "building") { settled[idx(x, y)] = 0; q.push(idx(x, y)); }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; if (settled[c]! >= 16) continue;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny); if (settled[n]! > settled[c]! + 1) { settled[n] = settled[c]! + 1; q.push(n); } } } }
  const baseLevel = host.gather ? host.level(host.gather.x, host.gather.y) : host.entrance ? host.level(host.entrance.x, host.entrance.y) : 0;
  let fromDoor: Int16Array | null = null;
  if (host.workDoor && inMap(host.workDoor.x, host.workDoor.y)) {
    fromDoor = new Int16Array(W * H).fill(99); const q = [idx(host.workDoor.x, host.workDoor.y)]; fromDoor[q[0]!] = 0;
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; if (fromDoor[c]! >= 12) continue;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || !open(nx, ny) || host.level(nx, ny) !== host.level(x, y)) continue;
        const n = idx(nx, ny); if (fromDoor[n]! > fromDoor[c]! + 1) { fromDoor[n] = fromDoor[c]! + 1; q.push(n); } } }
  }
  let hasUpper = false;
  for (let y = 2; y < H - 2 && !hasUpper; y += 1) for (let x = 2; x < W - 2; x += 1) if (host.level(x, y) > baseLevel && host.cell(x, y) === "free" && settled[idx(x, y)]! <= 14) { hasUpper = true; break; }
  const yardOf = { work: host.areas?.workYard?.length ? new Set(host.areas.workYard) : null, gather: host.areas?.gatherYard?.length ? new Set(host.areas.gatherYard) : null };
  const yardUsed = { work: false, gather: false };
  const ctx0 = { reach, settled, fromDoor, baseLevel, hasUpper, commons: host.areas?.commons?.length ? new Set(host.areas.commons) : null, quay: host.areas?.quay?.length ? new Set(host.areas.quay) : null };
  const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];

  scenes.forEach((scene, at) => {
    const skip = (why: SceneSkip) => { report.skipped.push({ id: scene.id, ko: scene.ko, why }); };
    const parts: Part[] = [];
    for (const p of scene.pieces) {
      const kit = p.ids.map((id) => host.kit(id)).find((k) => !!k);
      if (kit) parts.push({ kit, dx: p.dx, dy: p.dy, optional: p.optional, water: p.water });
      else if (!p.optional && !p.water) return skip("kits");
    }
    const land = parts.filter((p) => !p.water);
    if (land.length < scene.min) return skip("kits");
    const tried = { spots: 0, group: 0, fit: 0, route: 0 };
    /** set = 이번에 놓아 볼 뭍 조각들(그 네모로 자리를 찾는다). 놓았으면 true. */
    const attempt = (set: readonly Part[]): boolean => {
    // 그림 칸의 네모(원점 기준) — 발은 dy 줄, 그림은 그 위로 kit.h 줄.
    const x0 = Math.min(...set.map((p) => p.dx)), x1 = Math.max(...set.map((p) => p.dx + p.kit.w - 1));
    const y0 = Math.min(...set.map((p) => p.dy - p.kit.h + 1)), y1 = Math.max(...set.map((p) => p.dy));
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // 원점 (ox,oy) · 좌우 뒤집기에서 조각의 왼쪽 위 칸.
    const spot = (p: Part, ox: number, oy: number, flip: boolean) => ({ x: ox + (flip ? x0 + x1 - p.dx - p.kit.w + 1 : p.dx), y: oy + p.dy - p.kit.h + 1 });
    // 판석 광장 장면은 광장 위를 먼저 보고, 안 들어가면 광장 곁 맨땅(모이는 곳 가장자리)으로 간다.
    for (const onPlaza of scene.at === "plaza" && host.plazaCells.length >= 20 ? [true, false] : [false]) {
    const yardKey = scene.at === "work" ? "work" as const : scene.at === "commons" || (scene.at === "plaza" && !onPlaza) ? "gather" as const : null;
    const ctx: AnchorContext = { ...ctx0, yard: yardKey && !yardUsed[yardKey] ? yardOf[yardKey] : null };
    const fitsPart = (p: Part, ox: number, oy: number, flip: boolean): boolean => { const s = spot(p, ox, oy, flip); return onPlaza ? host.fitsPlaza(p.kit, s.x, s.y) : host.fitsLand(p.kit, s.x, s.y); };
    const boxOf = (ox: number, oy: number) => ({ x0: ox + x0, y0: oy + y0, x1: ox + x1, y1: oy + y1 });
    /** 무더기의 조건: 맵 안 · 다른 장면과 두 칸 넘게 · 한 단 · 둘레 한 칸의 절반 넘게 트임 · 둘레에 걸어 닿는 칸. */
    const groupOk = (ox: number, oy: number, plazaOk: boolean): boolean => {
      const b = boxOf(ox, oy);
      if (b.x0 < 2 || b.y0 < 2 || b.x1 >= W - 2 || b.y1 >= H - 2) return false;
      if (taken.some((t) => b.x0 <= t.x1 + 3 && b.x1 >= t.x0 - 3 && b.y0 <= t.y1 + 3 && b.y1 >= t.y0 - 3)) return false;
      const L = host.level(b.x0, b.y1);
      let ring = 0, free = 0, walkTo = false;
      for (let y = b.y0 - 1; y <= b.y1 + 1; y += 1) for (let x = b.x0 - 1; x <= b.x1 + 1; x += 1) {
        const inside = x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
        // 네모 안에 길·집·물이 끼면 안 된다(광장 장면은 판석 위) — 길을 걸치고 앉은 무더기는 한 «곳» 으로 읽히지 않고 길목을 막는다.
        if (inside) { const v = host.cell(x, y); if (host.level(x, y) !== L || v === "road" || v === "building" || v === "water" || v === "out" || (v === "plaza" && !plazaOk)) return false; continue; }
        ring += 1; if (!open(x, y) || host.level(x, y) !== L) continue;
        free += 1; if (reach[idx(x, y)]! < 99) walkTo = true;
      }
      return walkTo && free >= ring * 0.55;
    };
    // 닻 찾기는 sceneAnchorScore 하나가 한다 — 네모마다 점수(작을수록 좋다, Infinity = 여기는 아니다).
    const score = sceneAnchorScore(host, ctx, scene.at, onPlaza);
    if (!score) continue;
    const cands: { ox: number; oy: number; s: number }[] = [];
    for (let oy = 2 - y0; oy + y1 < H - 2; oy += 1) for (let ox = 2 - x0; ox + x1 < W - 2; ox += 1) {
      const sc = score(boxOf(ox, oy)); if (Number.isFinite(sc)) cands.push({ ox, oy, s: sc + (lookHash(`scene|${key}|${host.seed}|${scene.id}|${ox}|${oy}`) % 1000) / 600 });
    }
    cands.sort((a, b) => a.s - b.s);
    tried.spots += cands.length;
    const required = set.filter((p) => !p.optional);
    for (const { ox, oy } of cands) {
      if (!groupOk(ox, oy, onPlaza)) { tried.group += 1; continue; }
      for (const flip of lookHash(`scene|${key}|${scene.id}|flip`) % 2 ? [true, false] : [false, true]) {
        if (!required.every((p) => fitsPart(p, ox, oy, flip))) { tried.fit += 1; continue; }
        const use = set.filter((p) => !p.optional || fitsPart(p, ox, oy, flip));
        if (use.length < scene.min) continue;
        // 장면이 문·모이는 곳·들머리 사이의 걷는 길을 두 칸 넘게 돌리면 그 자리는 아니다.
        const feet = use.flatMap((p) => { const s = spot(p, ox, oy, flip); return walkOn.has(p.kit.id) ? [] : host.footCells(p.kit, s.x, s.y); });
        // 장면 네모 안의 틈(조각 사이에 갇힌 칸)은 갇혀도 된다 — 네모 밖의 걷는 땅을 가두면 안 된다.
        const inBox = new Set<number>(); { const bb = boxOf(ox, oy); for (let y = bb.y0; y <= bb.y1; y += 1) for (let x = bb.x0; x <= bb.x1; x += 1) inBox.add(idx(x, y)); }
        if (!guard.ok(feet, inBox)) { tried.route += 1; continue; }
        guard.take(feet);
        for (const p of use) { const s = spot(p, ox, oy, flip); const slot = sceneSlot(at, !p.optional);
          if (onPlaza) host.placePlaza(p.kit, s.x, s.y, slot); else host.placeLand(p.kit, s.x, s.y, walkOn.has(p.kit.id), slot); }
        const b = boxOf(ox, oy);
        for (let y = b.y0; y <= b.y1 + 1; y += 1) for (let x = b.x0 - 1; x <= b.x1 + 1; x += 1) if (host.cell(x, y) === "free") host.reserve(x, y);
        taken.push(b); if (yardKey) yardUsed[yardKey] = true;
        // 물 위 조각: 제자리에서 가장 가까운, 둘레까지 물인 칸(네 칸 안).
        for (const p of parts.filter((q) => q.water)) {
          const want = spot(p, ox, oy, flip); let best: { x: number; y: number; d: number } | null = null;
          for (let y = want.y - 5; y <= want.y + 5; y += 1) for (let x = want.x - 5; x <= want.x + 5; x += 1) {
            let ok = true;
            for (let j = 0; j < p.kit.h && ok; j += 1) for (let i = 0; i < p.kit.w; i += 1) if (host.cell(x + i, y + j) !== "water" || host.waterTaken(x + i, y + j)) { ok = false; break; }
            const d = Math.hypot(x - want.x, y - want.y); if (ok && (!best || d < best.d)) best = { x, y, d };
          }
          if (best) host.placeWater(p.kit, best.x, best.y);
        }
        // 설 칸: 장면 아랫줄 바로 아래의 걸어 닿는 칸(가운데부터), 없으면 둘레 아무 칸.
        let stand: { x: number; y: number } | null = null;
        const mid = Math.floor((b.x0 + b.x1) / 2);
        for (const y of [b.y1 + 1, b.y1, b.y0 - 1]) { for (let i = 0; i <= bw && !stand; i += 1) for (const x of [mid + i, mid - i]) if (inMap(x, y) && open(x, y) && reach[idx(x, y)]! < 99) { stand = { x, y }; break; } if (stand) break; }
        report.placed[at] = { id: scene.id, ko: scene.ko, en: scene.en, at: scene.at, x: b.x0, y: b.y0, w: bw, h: bh, stand: stand ?? { x: mid, y: Math.min(H - 1, b.y1 + 1) },
          required: use.filter((p) => !p.optional).length, min: scene.min, pieces: use.length };
        return true;
      }
    }
    }
    return false;
    };
    // 먼저 고를 수 있는 조각까지 모두 든 네모로, 안 되면 꼭 있어야 하는 조각의 네모(그 안에 드는 고를 조각만 더해)로 —
    // 새 그림이 늘어 네모가 커져도 장면이 통째로 빠지지 않는다.
    if (attempt(land)) return;
    const must = land.filter((p) => !p.optional);
    if (must.length < land.length && must.length >= scene.min) {
      const bx0 = Math.min(...must.map((p) => p.dx)), bx1 = Math.max(...must.map((p) => p.dx + p.kit.w - 1));
      const by0 = Math.min(...must.map((p) => p.dy - p.kit.h + 1)), by1 = Math.max(...must.map((p) => p.dy));
      if (attempt(land.filter((p) => !p.optional || (p.dx >= bx0 && p.dx + p.kit.w - 1 <= bx1 && p.dy - p.kit.h + 1 >= by0 && p.dy <= by1)))) return;
    }
    // 후보가 하나도 없으면 이 터에 그 닻이 없는 것이다(물 없는 마을의 물가 장면) — 자리 부족과 따로 센다.
    report.skipped.push({ id: scene.id, ko: scene.ko, why: tried.spots ? "room" : "anchor", tried });
  });
  // 번호(scene:<n>)는 종류의 장면 차례다 — 못 놓은 자리는 비어 있다.
  return report;
}
