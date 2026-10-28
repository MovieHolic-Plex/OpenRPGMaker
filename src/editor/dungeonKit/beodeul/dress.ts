// 던전 종류별 장식 규칙 — compose.ts 가 만든 바닥·벽 위에 종류마다 다른 물건을 놓는다(2026-10-14 던전 종류 확장).
// 놓기는 전부 ctx.put 을 거친다: 받침 규칙(groundSupport)·액체/다리 위 금지·문 앞 금지·길 막으면 되돌림이 거기서 걸린다.
// true 를 돌려주면 그 방은 이 파일이 다 꾸민 것이고, false 면 compose 의 공통 방 규칙(홀·묘실·감방·제단·창고·보물 방)이 그 종류의 테마 키트로 이어서 꾸민다.
import type { StructureKitDef } from "@/project/types";
import type { DungeonType, PlacedCorridor, PlacedRoom } from "../types";
import { TK } from "./profiles";

export interface DressCtx {
  W: number; H: number;
  rooms: PlacedRoom[]; corridors: PlacedCorridor[];
  seed: number;
  grid: boolean;
  hasKit(id: string): boolean;
  kit(id: string): StructureKitDef;
  put(kitId: string, x: number, y: number, opts?: { label?: string; free?: boolean; liquidOk?: boolean }): boolean;
  putAny(kitId: string, cands: readonly (readonly [number, number])[], opts?: { label?: string }): [number, number] | null;
  weighted<T>(rs: () => number, list: readonly (readonly [T, number])[]): T;
  shuffle<T>(rs: () => number, list: readonly T[]): T[];
  wallSlots(r: PlacedRoom): { x: number; y: number }[];
  floorCells(r: PlacedRoom, inset?: number): [number, number][];
  edgeCells(r: PlacedRoom, rs: () => number): [number, number][];
  hangAlong(slots: { x: number; y: number }[], rs: () => number, gap: number, pick: () => string, max?: number): number;
  cluster(rs: () => number, cx: number, cy: number, n: number, kinds: readonly (readonly [string, number])[]): void;
  isFloor(x: number, y: number): boolean;
  isWalk(x: number, y: number): boolean;
  isWall(x: number, y: number): boolean;
  idx(x: number, y: number): number;
  inb(x: number, y: number): boolean;
  wallB: Int8Array; roomAt: Int16Array; liquid: Uint8Array; bridge: Uint8Array; doorstep: Uint8Array; blocked: Uint8Array;
  upper: number[]; lower: number[];
  counts: Record<string, number>;
  litter: readonly (readonly [string, number])[];
  /** spec.lair — 무리가 사는 소굴 장식. */
  lair?: boolean;
  /** 방 id → 보스가 설 자리(우두머리 자리·제단 앞). 이벤트 자리(spots)를 이 칸에서 가까운 순으로 고른다. */
  seats: Record<string, { x: number; y: number }>;
}

type Slot = { x: number; y: number };
const P = (place: string, id: string) => `bd-pick-${place}-${id}`;
const SW = (id: string) => P("aqueduct-sewer", id);
const CC = (id: string) => P("castle-catacombs", id);
const CV = (id: string) => P("sea-cave", id);
const TP = (id: string) => P("temple-ruins", id);
const VC = (id: string) => P("volcano-cave", id);
const MV = (id: string) => P("mining-valley", id);

const TORCH = SW("torch-wall");

/** 키트를 바닥 줄 fy 에 맨 아랫줄이 오게 놓는다(왼쪽 x). */
function stand(c: DressCtx, kitId: string, x: number, fy: number, opts?: { label?: string }): boolean {
  if (!c.hasKit(kitId)) return false;
  const def = c.kit(kitId);
  return c.put(kitId, x, fy - (def.height - 1), opts);
}
const free = (c: DressCtx, x: number, y: number) => c.isWalk(x, y) && !c.bridge[c.idx(x, y)] && c.upper[c.idx(x, y)]! < 0 && !c.blocked[c.idx(x, y)];
/** 이미 물건이 있는 칸 둘레(반지름 rad)에 또 놓지 않게 — 군데군데 빈 곳이 남게. */
const lonely = (c: DressCtx, x: number, y: number, rad = 1): boolean => {
  for (let dy = -rad; dy <= rad; dy += 1) for (let dx = -rad; dx <= rad; dx += 1) if (c.inb(x + dx, y + dy) && c.upper[c.idx(x + dx, y + dy)]! >= 0) return false;
  return true;
};
/** 벽 앞면 가운데 줄 칸(양옆도 같은 줄) 전부 — 방 구분 없이. */
export function allWallSlots(c: DressCtx): Slot[] {
  const out: Slot[] = [];
  for (let y = 2; y < c.H; y += 1) for (let x = 1; x < c.W - 1; x += 1) {
    if (!c.isWalk(x, y) || c.bridge[c.idx(x, y)] || c.isFloor(x, y - 1)) continue;
    const wy = y - 2;
    if (c.wallB[c.idx(x, wy)] !== 1 || c.wallB[c.idx(x - 1, wy)] !== 1 || c.wallB[c.idx(x + 1, wy)] !== 1) continue;
    out.push({ x, y: wy });
  }
  return out;
}

/** 물가(액체에 붙은 걸을 수 있는 칸). */
/** 사방이 물인 물 칸 — 물 가장자리 칸은 둑(진흙)이 덮어 그려 연잎·말뚝이 마른 땅에 놓인 것처럼 보였다(2026-10-25 floor VQA r5 swamp). */
const openWater = (c: DressCtx, x: number, y: number): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => c.liquid[c.idx(x + dx!, y + dy!)] === 1);
function shoreCells(c: DressCtx, r: PlacedRoom): [number, number][] {
  return c.floorCells(r).filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => c.liquid[c.idx(x + dx!, y + dy!)] === 1));
}

/** 잔해·뼈 같은 바닥 부스러기(1칸 데칼) — 방 한가운데 길에 흩으면 「바닥이 지저분하다」로 읽혔다(2026-10-25 floor VQA r0). */
export const DEBRIS_RE = /bones|skull|rubble|slagrock|pebble|stones-|coal-pile|grate-floor|ember-a/;
/** 벽 바로 앞(사방 중 한쪽이 막힌) 칸 또는 그 한 칸 안쪽 — 부스러기는 벽가·구석에만 모인다. */
const nearWall = (c: DressCtx, x: number, y: number, d = 1): boolean => {
  for (let dy = -d; dy <= d; dy += 1) for (let dx = -d; dx <= d; dx += 1) if (!c.isWalk(x + dx, y + dy)) return true;
  return false;
};
/** 방 안쪽에 드문드문(확률 p, 둘레 rad 비움) 흩뿌린다. 부스러기 키트는 벽가(벽에서 한 칸 안)에만, 방마다 최대 2개. */
function sprinkle(c: DressCtx, rs: () => number, r: PlacedRoom, p: number, pick: () => string, opts: { inset?: number; rad?: number; max?: number; bottomOnly?: boolean } = {}): number {
  let n = 0, debris = 0;
  for (const [x, y] of c.shuffle(rs, c.floorCells(r, opts.inset ?? 1))) {
    if (n >= (opts.max ?? 99)) break;
    if (rs() > p || !lonely(c, x, y, opts.rad ?? 1)) continue;
    const id = pick();
    if (DEBRIS_RE.test(id) && (debris >= 2 || !nearWall(c, x, y, 2))) continue;
    if (stand(c, id, x, y)) { n += 1; if (DEBRIS_RE.test(id)) debris += 1; }
  }
  return n;
}

// ---------------------------------------------------------------------------------------------

export function dressTyped(c: DressCtx, type: DungeonType, r: PlacedRoom, rs: () => number, stairs: Slot | null, slots: Slot[], centerFirst: Slot[]): boolean {
  switch (type) {
    case "sewer": return dressSewer(c, r, rs, stairs, slots, centerFirst);
    case "temple": return dressTemple(c, r, rs, stairs, slots, centerFirst);
    case "mine": return dressMine(c, r, rs, stairs, slots, centerFirst);
    case "cave": return dressCave(c, r, rs, stairs, slots);
    case "volcano": return dressVolcano(c, r, rs, stairs, slots);
    case "labyrinth": return dressMaze(c, r, rs, stairs);
    case "forest": return dressForest(c, r, rs);
    case "swamp": return dressSwamp(c, r, rs);
    case "pyramid": return dressPyramid(c, r, rs, stairs, slots, centerFirst);
    case "tower": return dressTower(c, r, rs, stairs, slots, centerFirst);
    case "otherworld": return dressOtherworld(c, r, rs, stairs, slots);
    case "ice": return dressIce(c, r, rs, stairs, slots);
    case "castle": return dressCastle(c, r, rs, slots, centerFirst);
    default: return false;
  }
}

/**
 * 통로 장식(2026-10-15). true 면 이 파일이 다 꾸민 통로(공통 규칙의 배수 창살·뼈 흩뿌림을 건너뛴다).
 * 광산: 선로 줄 위에 광차 한두 대, 갱목 틀(선반 조각)을 양 벽 쪽에 쌍으로 세우고 램프. 동굴·화산: 창살(하수구 그림) 대신 잔돌만.
 */
export function dressCorridor(c: DressCtx, type: DungeonType, cor: PlacedCorridor, rs: () => number): boolean {
  const r = cor.rect;
  if (type === "cave" || type === "volcano" || type === "ice" || type === "otherworld" || type === "forest" || type === "swamp") {
    const bit = type === "volcano" ? VC("ember-a") : type === "ice" ? pickKit(c, [TK("snow-drift"), CV("rubble-cave")]) : type === "otherworld" ? VC("ember-a")
      : type === "forest" ? FF("heath-a") : type === "swamp" ? FF("toadstools-b") : CV("rubble-cave");
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (hashDoor(c, x, y) || rs() > 0.02) continue;
      stand(c, bit, x, y);
    }
    return true;
  }
  if (type === "pyramid" || type === "tower") return true;   // 사암·탑 통로는 맨바닥(하수구 창살·뼈가 주제와 안 맞는다)
  if (type !== "mine") return false;
  const horizontal = cor.dir === "E" || cor.dir === "W";
  if (!horizontal) {
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 3) if (rs() < 0.5) stand(c, MV("barrel"), r.x + (rs() < 0.5 ? 0 : r.w - 1), y);
    return true;
  }
  const trackY = r.y + Math.floor(r.h / 2);
  // 광차: 선로 줄 위(통로 한가운데 줄이 널판이다), 너무 붙지 않게.
  if (r.w >= 8 && rs() < 0.7) c.put(pickKit(c, [TK("minecart"), MV("cart-h")]), r.x + 2 + Math.floor(rs() * (r.w - 5)), trackY - 1);
  // 갱목 틀 쌍: 선로 줄 위아래 가장자리 칸에 3칸 간격(선반 2×2 조각이 곧 갱목 틀 모양이다)
  for (let x = r.x + 2; x < r.x + r.w - 2; x += 5) {
    if (rs() < 0.75) { stand(c, MV("rack"), x, r.y + r.h - 1); }
  }
  // 램프: 가로 통로 위쪽 벽 앞 줄에
  if (r.w >= 6 && rs() < 0.6) stand(c, MV("lamp"), r.x + 1 + Math.floor(rs() * (r.w - 2)), r.y);
  return true;
}
const hashDoor = (c: DressCtx, x: number, y: number) => c.doorstep[c.idx(x, y)] === 1;

// ---------------------------------------------------------------- 하수도

function dressSewer(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[], centerFirst: Slot[]): boolean {
  const cx = r.x + Math.floor(r.w / 2);
  const torch = () => TORCH;
  switch (r.kind) {
    case "entrance": {
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
      c.hangAlong(slots.filter((q) => !s || Math.abs(q.x - s.x) > 1), rs, 4, torch, 2);
      const e = c.edgeCells(r, rs);
      c.cluster(rs, e[0]?.[0] ?? r.x + 1, e[0]?.[1] ?? r.y + 1, 3, [[SW("crate"), 2], [SW("barrel"), 2], [SW("bucket"), 1], [SW("crate-stack"), 1]]);
      if (e[4]) stand(c, SW("valve-wheel"), e[4][0], e[4][1]);
      for (const [x, y] of e.slice(5, 9)) if (rs() < 0.5) stand(c, c.weighted(rs, c.litter), x, y);
      return true;
    }
    case "channel": {
      // 북쪽 벽: 횃불·수문 아치(물이 드나드는 구멍) 번갈아, 위쪽 보행로엔 격자·통·잡동사니, 아래 보행로 구석엔 가로등
      c.hangAlong(slots, rs, 5, () => (rs() < 0.8 ? TORCH : SW("banner-cult")));
      const arches = c.shuffle(rs, slots.filter((q) => Math.abs(q.x - cx) > 2 && c.wallB[c.idx(q.x + 1, q.y)] === 1 && c.wallB[c.idx(q.x + 2, q.y)] === 1));
      let a = 0; for (const q of arches) { if (a >= 2) break; if (c.put(rs() < 0.6 ? SW("arch-water") : SW("arch-bars"), q.x, q.y)) a += 1; }
      const shore = c.shuffle(rs, shoreCells(c, r));
      let n = 0; for (const [x, y] of shore) { if (n >= 4) break; if (lonely(c, x, y, 2) && stand(c, c.weighted(rs, [[SW("bucket"), 2], [SW("barrel"), 2], [SW("crate"), 1], [SW("bones"), 2], [SW("rubble"), 2]]), x, y)) n += 1; }
      const e = c.edgeCells(r, rs);
      c.cluster(rs, e[0]?.[0] ?? r.x, e[0]?.[1] ?? r.y, 3, [[SW("crate"), 2], [SW("barrel"), 3], [SW("crate-stack"), 1]]);
      if (e[7]) stand(c, SW("valve-wheel"), e[7][0], e[7][1]);
      if (e[12] && rs() < 0.7) stand(c, SW("lantern-post"), e[12][0], e[12][1]);
      for (const [x, y] of c.floorCells(r)) if (rs() < 0.03 && c.isWall(x, y - 1) === false && free(c, x, y)) c.put(SW("grate-floor"), x, y, { free: true });
      return true;
    }
    case "cistern": {
      c.hangAlong(slots, rs, 4, torch, 3);
      const cells = c.floorCells(r, 0);
      // 둘레 모서리에 기둥
      for (const [x, y] of [[r.x + 1, r.y + 2], [r.x + r.w - 2, r.y + 2], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]] as const) if (cells.some(([a, b]) => a === x && b === y)) stand(c, SW("column-sewer"), x, y);
      const shore = c.shuffle(rs, shoreCells(c, r));
      let n = 0; for (const [x, y] of shore) { if (n >= 3) break; if (lonely(c, x, y, 2) && stand(c, c.weighted(rs, [[SW("bucket"), 2], [SW("valve-wheel"), 1], [SW("barrel"), 2], [SW("bones"), 2]]), x, y)) n += 1; }
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 6)) if (rs() < 0.4) stand(c, c.weighted(rs, c.litter), x, y);
      return true;
    }
    case "pump": {
      // 북쪽 벽 가운데에 큰 관(분기관) 하나, 양옆에 밸브 바퀴, 바닥 널판. 통·양동이.
      const m = centerFirst.find((q) => c.wallB[c.idx(q.x + 1, q.y)] === 1 && c.wallB[c.idx(q.x - 1, q.y)] === 1);
      if (m) {
        const fy = r.y; // 가운데 열 첫 바닥 줄은 방 위쪽(모따기가 없으면 r.y)
        const man = [m.x - 1, m.x, m.x - 2].map((x) => [x, fy] as [number, number]);
        const got = c.putAny(SW("manifold-3"), man.map(([x, y]) => [x, y - 1] as [number, number]));
        if (got) { stand(c, SW("valve-wheel"), got[0] - 2, fy); stand(c, SW("valve-wheel"), got[0] + 4, fy); }
      }
      c.hangAlong(slots, rs, 3, torch, 3);
      const e = c.edgeCells(r, rs);
      c.cluster(rs, e[0]?.[0] ?? r.x, e[0]?.[1] ?? r.y, 3, [[SW("barrel"), 3], [SW("bucket"), 2], [SW("crate"), 1]]);
      for (const [x, y] of e.slice(3, 8)) if (rs() < 0.4) stand(c, c.weighted(rs, [[SW("bones"), 1], [SW("rubble"), 2], [SW("bucket"), 1]]), x, y);
      return true;
    }
    default: return false;
  }
}

// ---------------------------------------------------------------- 폐허 신전

const TEMPLE_COL = TP("column-temple");
const TEMPLE_COL_BROKEN = TP("column-temple-broken");
const TEMPLE_FALLEN = TP("fallen-column-temple");
const TEMPLE_RUBBLE = TP("rubble-temple");
const VINES = TP("vines-2");

function mirrorPut(c: DressCtx, kitId: string, cx: number, dx: number, fy: number, width = 1): boolean {
  // 가운데 열 cx 에서 dx 만큼 떨어진 좌우 대칭 한 쌍(둘 다 놓이면 true, 한쪽만 놓이면 되돌리지 못하니 먼저 둘 다 놓일 수 있는지 본다).
  const lx = cx - dx - (width - 1), rx = cx + dx;
  if (!c.hasKit(kitId)) return false;
  const ok = (x: number) => { const def = c.kit(kitId); for (let k = 0; k < width; k += 1) if (!free(c, x + k, fy) ) return false; void def; return true; };
  if (!ok(lx) || !ok(rx)) return false;
  const a = stand(c, kitId, lx, fy);
  const b = stand(c, kitId, rx, fy);
  return a && b;
}

function dressTemple(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[], centerFirst: Slot[]): boolean {
  const cx = r.x + Math.floor(r.w / 2);
  const ruin = (rr: PlacedRoom, n: number) => {
    // 무너진 구석: 잔해 모둠 + 부러진 기둥/쓰러진 기둥 + 인접 벽 덩굴
    for (let k = 0; k < n; k += 1) {
      // 잔해 모둠은 벽가(벽에서 두 칸 안)에서만 — 신랑 한가운데 모자이크 위를 흰 잔해가 덮었다(2026-10-25 floor VQA r0·r3 유적).
      const e = c.shuffle(rs, c.floorCells(rr, 1)).filter(([x, y]) => free(c, x, y) && lonely(c, x, y, 1) && nearWall(c, x, y, 2));
      const at = e[0]; if (!at) continue;
      c.cluster(rs, at[0], at[1], 3, [[TEMPLE_RUBBLE, 4], [CC("rubble"), 1], [SW("bones"), 1]]);
      // 풀 난 판석(theme-earth r2): 무너진 구석 곁 바닥이 뿌리·이끼로 갈라진다.
      if (c.hasKit(TK("overgrown")) && rs() < 0.7) { const g = c.shuffle(rs, c.floorCells(rr, 1)).find(([x, y]) => Math.abs(x - at[0]) + Math.abs(y - at[1]) <= 4 && nearWall(c, x, y, 1) && free(c, x, y) && free(c, x + 1, y) && free(c, x, y + 1) && free(c, x + 1, y + 1)); if (g) c.put(TK("overgrown"), g[0], g[1], { free: true }); }
      // 주제 그림(theme-earth): 무너진 석상 머리·큰 돌무더기가 있으면 구석마다 하나씩 섞는다 — 「옛 신의 신전」으로 읽히게.
      const big = rs();
      if (big < 0.3 && c.hasKit(TK("statue-head")) && stand(c, TK("statue-head"), at[0] + 2, at[1])) continue;
      if (big < 0.55 && c.hasKit(TK("rubble-heap")) && stand(c, TK("rubble-heap"), at[0] + 2, at[1])) continue;
      if (rs() < 0.5) stand(c, TEMPLE_FALLEN, at[0] + 2, at[1]);
      else stand(c, TEMPLE_COL_BROKEN, at[0] + 2, at[1]);
    }
    const vs = c.shuffle(rs, slots).filter((q) => c.wallB[c.idx(q.x + 1, q.y)] === 1);
    for (const q of vs.slice(0, 2 + Math.floor(rs() * 2))) if (lonely(c, q.x, q.y, 1)) c.put(VINES, q.x, q.y);
  };
  switch (r.kind) {
    case "entrance": {
      // 현관: 계단 양옆 횃불, 앞쪽 기둥 두 쌍(좌우 대칭), 덩굴·잔해
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
      const fy = r.y + r.h - 3;
      for (const d of [3, 6]) mirrorPut(c, TEMPLE_COL, cx, d, fy);
      mirrorPut(c, SW("brazier"), cx, 1, r.y + r.h - 2);
      ruin(r, 1);
      return true;
    }
    case "nave": {
      // 신랑: 가운데 통로(비움) 양쪽 기둥 두 줄(좌우 대칭, 몇 개만 부러짐), 중앙 모자이크, 벽 횃불·깃발 쌍
      const rows: number[] = [];
      for (let y = r.y + 3; y <= r.y + r.h - 3; y += 4) rows.push(y);
      for (const [k, y] of rows.entries()) for (const d of [4, 7]) {
        const kitId = (k + d) % 3 === 0 && rs() < 0.5 ? TEMPLE_COL_BROKEN : TEMPLE_COL;
        mirrorPut(c, kitId, cx, d, y);
      }
      const my = r.y + Math.floor(r.h / 2);
      if (c.hasKit(TP("mosaic-medallion-7x7"))) c.put(TP("mosaic-medallion-7x7"), cx - 3, my - 3, { free: true });
      for (const dx of [2, 5]) { const q = slots.find((t) => t.x === cx - dx), q2 = slots.find((t) => t.x === cx + dx); if (q && q2 && c.put(dx === 2 ? TORCH : VINES, q.x, q.y)) c.put(dx === 2 ? TORCH : VINES, q2.x, q2.y); }
      mirrorPut(c, SW("brazier"), cx, 2, r.y + 2);
      mirrorPut(c, SW("brazier"), cx, 2, r.y + r.h - 2);
      ruin(r, 2);
      return true;
    }
    case "boss": {
      // 성소: 제단 가운데, 깃발·화로 대칭, 모서리 기둥 네 개, 촛불
      const ax = cx - 1;
      const altar = c.putAny(CC("altar-stone"), [0, 1, -1].map((d) => [ax + d, r.y] as [number, number]));
      if (altar) {
        for (const d of [2, 4]) { const l = slots.find((q) => q.x === altar[0] - d + 0), rr = slots.find((q) => q.x === altar[0] + 1 + d); if (l && rr && c.put(VINES, l.x, l.y)) c.put(VINES, rr.x, rr.y); }
        c.put(SW("brazier"), altar[0] - 1, altar[1] + 1); c.put(SW("brazier"), altar[0] + 2, altar[1] + 1);
        mirrorPut(c, SW("brazier"), altar[0] + 1, 3, altar[1] + 2);
      }
      // 보스가 설 무대: 가운데 의식 원(모자이크) — 둥근 탑 방처럼 북벽이 통로로 갈려 제단이 못 서면 화로 한 쌍이 원을 감싼다.
      // 「왕좌 방인데 맨 체크무늬 바닥」(2026-10-23 dg2-r5 VQA 탑 3층).
      {
        const my = r.y + Math.floor(r.h / 2) - 1;
        if (c.put(P("temple-ruins", "mosaic-medallion-5x5"), cx - 2, my)) {
          c.seats[r.id] = { x: cx, y: my + 2 };
          if (!altar) { c.put(SW("brazier"), cx - 4, my + 2); c.put(SW("brazier"), cx + 4, my + 2); }
        }
      }
      for (const d of [5, 7]) mirrorPut(c, TEMPLE_COL, cx, d, r.y + r.h - 3);
      c.hangAlong(slots, rs, 3, () => TORCH, 4);
      ruin(r, 1);
      return true;
    }
    case "shrine": {
      // 곁 예배당: 벽감 항아리 줄, 가운데 작은 제단, 기둥 한 쌍
      for (const q of centerFirst.slice(0, 5)) if (rs() < 0.7) c.put(CC("niche-urn"), q.x, q.y);
      // 돌 제단 + 화로 — 하수도 사교 제단(붉은 눈)·핏빛 촛농이 고전 신전과 안 맞았다(2026-10-25 floor VQA r5 ruins).
      const alt = c.putAny(CC("altar-stone"), [0, -1, 1].map((d) => [cx - 1 + d, r.y] as [number, number]));
      mirrorPut(c, TEMPLE_COL, cx, 3, r.y + r.h - 3);
      if (alt) { c.put(SW("brazier"), alt[0] - 1, alt[1] + 1); c.put(SW("brazier"), alt[0] + 2, alt[1] + 1); }
      ruin(r, 1);
      return true;
    }
    default: return false;
  }
}

// ---------------------------------------------------------------- 광산

const MV_ROCKS: readonly (readonly [string, number])[] = [[MV("ore"), 3], [MV("slagrock"), 2], [MV("slagheap"), 1]];

function dressMine(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[], centerFirst: Slot[]): boolean {
  const cx = r.x + Math.floor(r.w / 2);
  const trackY = r.y + Math.floor(r.h / 2);
  const wallLamp = () => MV("lamp");
  const lampAt = (x: number, fy: number) => stand(c, MV("lamp"), x, fy);
  const ores = (n: number) => {
    let k = 0;
    for (const [x, y] of c.edgeCells(r, rs)) { if (k >= n) break; if (rs() < 0.55 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, MV_ROCKS), x, y)) k += 1; }
  };
  switch (r.kind) {
    case "entrance": {
      // 갱구: 계단 양옆 횃불(가장자리 램프), 광차·통·상자
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
      // 갱구 표지: 계단 앞 길 양옆 갱목 기둥 한 쌍(주제 그림 theme-earth) — 길(계단 앞 세로 줄)은 비운다.
      if (s && c.hasKit(TK("timber-post"))) { const y = Math.min(r.y + r.h - 2, s.y + 3); if (stand(c, TK("timber-post"), s.x - 2, y)) stand(c, TK("timber-post"), s.x + 2, y); }
      const e = c.edgeCells(r, rs);
      c.cluster(rs, e[0]?.[0] ?? r.x + 1, e[0]?.[1] ?? r.y + 1, 3, [[MV("barrel"), 2], [MV("crates"), 1], [SW("crate"), 2]]);
      if (e[3]) stand(c, MV("cart"), e[3][0], e[3][1]);
      if (e[6] && rs() < 0.7) lampAt(e[6][0], e[6][1]);
      return true;
    }
    case "junction": {
      // 갈림 방: 선로 줄 위에 광차, 벽에 램프, 가장자리에 광석·통
      const cart = [r.x + 2, r.x + r.w - 4];
      if (rs() < 0.8) c.put(pickKit(c, [TK("minecart"), MV("cart-h")]), cart[Math.floor(rs() * 2)]!, trackY - 1);
      timberFrames(c, rs, slots, 1);
      oreVeins(c, rs, slots, 1);
      for (const q of centerFirst.slice(0, 3)) if (rs() < 0.6 && lonely(c, q.x, q.y, 1)) c.put(TORCH, q.x, q.y);
      ores(2);
      sprinkle(c, rs, r, 0.05, () => c.weighted(rs, [[MV("barrel"), 2], [SW("rubble"), 2], [MV("slagrock"), 1]]), { max: 3 });
      return true;
    }
    case "stope": {
      // 채굴장: 벽을 따라 광석 덩이 모둠, 쌓은 통나무, 광차, 램프
      const e = c.edgeCells(r, rs);
      let k = 0; for (const [x, y] of e) { if (k >= 6) break; if (rs() < 0.6 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, [[MV("ore"), 4], [MV("slagheap"), 2], [MV("slagrock"), 2], [MV("pile"), 1]]), x, y)) k += 1; }
      const f = c.shuffle(rs, c.floorCells(r, 2));
      if (f[0]) stand(c, MV("cart"), f[0][0], f[0][1]);
      if (f[1] && rs() < 0.6) stand(c, MV("rack"), f[1][0], f[1][1]);
      if (f[2]) lampAt(f[2][0], f[2][1]);
      timberFrames(c, rs, slots, 2);
      oreVeins(c, rs, slots, 3);
      c.hangAlong(slots, rs, 5, () => TORCH, 2);
      return true;
    }
    case "depot": {
      // 창고: 상자·통·선반·게시판 모둠
      const e = c.edgeCells(r, rs);
      for (let k = 0; k < 3; k += 1) { const p = e[k * 4]; if (p) c.cluster(rs, p[0], p[1], 3, [[MV("crates"), 2], [MV("barrel"), 3], [MV("rack"), 1]]); }
      const f = c.shuffle(rs, c.floorCells(r, 2));
      if (f[0]) stand(c, MV("bench"), f[0][0], f[0][1]);
      if (f[1]) lampAt(f[1][0], f[1][1]);
      c.hangAlong(slots, rs, 4, wallLamp === wallLamp ? () => TORCH : () => TORCH, 2);
      return true;
    }
    case "boss": {
      // 심부: 광석·슬래그 더미 고리, 권양탑 하나(벽 앞), 램프, 뼈
      const m = centerFirst[0];
      if (m) c.putAny(MV("headframe"), [0, -1, 1].map((d) => [cx - 1 + d, r.y - 0] as [number, number]).map(([x, y]) => [x, y - 3] as [number, number]));
      for (const [x, y] of [[r.x + 2, r.y + r.h - 2], [r.x + r.w - 5, r.y + r.h - 2], [r.x + 2, r.y + 4], [r.x + r.w - 5, r.y + 4]] as const) stand(c, MV("slagheap"), x, y);
      ores(5);
      oreVeins(c, rs, slots, 3, 0.6);
      for (const [x, y] of [[cx - 4, r.y + 3], [cx + 3, r.y + 3]] as const) lampAt(x, y);
      sprinkle(c, rs, r, 0.04, () => c.weighted(rs, [[SW("bones"), 2], [SW("skulls"), 1], [MV("slagrock"), 2]]), { inset: 2, max: 4 });
      c.hangAlong(slots, rs, 4, () => TORCH, 3);
      return true;
    }
    case "vault": {
      oreVeins(c, rs, slots, 2, 1);
      for (const q of centerFirst.slice(0, 3)) if (rs() < 0.6) c.put(TORCH, q.x, q.y);
      const e = c.edgeCells(r, rs);
      if (e[0]) c.cluster(rs, e[0][0], e[0][1], 4, [[VC("ingots"), 2], [MV("ore"), 2], [MV("crates"), 1], [VC("coal-pile"), 1]]);
      const f = c.shuffle(rs, c.floorCells(r, 1));
      if (f[0]) lampAt(f[0][0], f[0][1]);
      return true;
    }
    default: return false;
  }
}

/** 갱목 틀(3×2, 벽 앞면에 붙는 버팀목 — theme-earth): 벽 앞면 가운데 줄 칸 중 양옆도 벽인 곳에 n 개. */
function timberFrames(c: DressCtx, rs: () => number, slots: Slot[], n: number): void {
  const id = TK("timber-frame");
  if (!c.hasKit(id)) return;
  let k = 0, lastX = -99;
  for (const q of c.shuffle(rs, slots)) {
    if (k >= n) break;
    if (Math.abs(q.x - lastX) < 5) continue;
    if (c.put(id, q.x - 1, q.y, { label: "timber-frame" })) { k += 1; lastX = q.x; }
  }
}

/** 광맥(theme-earth r2): 벽 앞면 아래 두 줄에 박힌 금·쇠 광맥(2×2, 좁으면 1×1) n 개, 4칸 간격. gold 는 금 비율. */
function oreVeins(c: DressCtx, rs: () => number, slots: Slot[], n: number, gold = 0.35): void {
  if (!c.hasKit(TK("ore-vein-iron"))) return;
  let k = 0, lastX = -99;
  for (const q of c.shuffle(rs, slots)) {
    if (k >= n) break;
    if (Math.abs(q.x - lastX) < 4) continue;
    const g = rs() < gold;
    const big = g ? TK("ore-vein-gold") : TK("ore-vein-iron"), small = g ? TK("ore-vein-gold-1") : TK("ore-vein-iron-1");
    if ((c.wallB[c.idx(q.x + 1, q.y)] === 1 && c.put(big, q.x, q.y, { label: "ore-vein" })) || (c.hasKit(small) && c.put(small, q.x, q.y + (rs() < 0.5 ? 1 : 0), { label: "ore-vein" }))) { k += 1; lastX = q.x; }
  }
}

// ---------------------------------------------------------------- 자연 동굴

const MUSH = CV("glow-mushroom");
function vinesOnWalls(c: DressCtx, rs: () => number, slots: Slot[], n: number, kitId = CV("vines-2")) {
  let k = 0;
  for (const q of c.shuffle(rs, slots)) { if (k >= n) break; if (lonely(c, q.x, q.y, 1) && c.put(kitId, q.x, q.y)) k += 1; }
}

/** 소굴 야영지: 방 바닥 가운데 쪽 모닥불, 벽가 가죽 걸이·궤짝·통·자루 무더기, 흩어진 뼈. 보스방(chief)은 무더기를 더 쌓는다. */
/** gap 고블린 야영 조각(bake_gap.py, 하네스 dungeon-chipset gap-props-r1). 없으면 다른 버들항 장소 조각으로 물러선다. */
const GOBLIN = { fire: "bd-dg-goblin-campfire", tent: "bd-dg-goblin-tent", bones: "bd-dg-goblin-bones", loot: "bd-dg-goblin-loot" } as const;
const PALISADE = { w: "bd-dg-palisade-w-end", e: "bd-dg-palisade-e-end", mids: ["bd-dg-palisade-mid", "bd-dg-palisade-mid2", "bd-dg-palisade-mid3"] } as const;

/** 말뚝 울 한 줄(서끝 + 가운데 섞음 + 동끝, 1×2 조각). 한 조각이라도 못 놓으면(길을 막음·자리 없음) 그 줄을 통째로 걷는다. */
function palisadeRun(c: DressCtx, rs: () => number, r: PlacedRoom, len: number): boolean {
  if (!c.hasKit(PALISADE.w) || !c.hasKit(PALISADE.e)) return false;
  const mids = PALISADE.mids.filter((k) => c.hasKit(k));
  if (!mids.length) return false;
  const ys = c.shuffle(rs, Array.from({ length: Math.max(0, r.h - 4) }, (_, k) => r.y + 2 + k));
  for (const y of ys) {
    for (const x0 of c.shuffle(rs, Array.from({ length: Math.max(0, r.w - len - 1) }, (_, k) => r.x + 1 + k))) {
      if (!Array.from({ length: len }, (_, k) => x0 + k).every((x) => free(c, x, y) && free(c, x, y - 1) && free(c, x, y + 1) && lonely(c, x, y, 0))) continue;
      const snap = Array.from({ length: len }, (_, k) => [y - 1, y].map((yy) => [c.lower[c.idx(x0 + k, yy)]!, c.upper[c.idx(x0 + k, yy)]!] as const));
      let placed = 0;
      for (let k = 0; k < len; k += 1) {
        const id = k === 0 ? PALISADE.w : k === len - 1 ? PALISADE.e : mids[Math.floor(rs() * mids.length)]!;
        if (!stand(c, id, x0 + k, y, { label: "palisade" })) break;
        placed += 1;
      }
      if (placed === len) return true;
      for (let k = 0; k < placed; k += 1) [y - 1, y].forEach((yy, j) => { c.lower[c.idx(x0 + k, yy)] = snap[k]![j]![0]; c.upper[c.idx(x0 + k, yy)] = snap[k]![j]![1]; });
      c.counts["palisade"] = (c.counts["palisade"] ?? placed) - placed;
    }
  }
  return false;
}

function lairCamp(c: DressCtx, r: PlacedRoom, rs: () => number, edge: [number, number][], chief: boolean): void {
  const FIRE = c.hasKit(GOBLIN.fire) ? GOBLIN.fire : c.hasKit("bd-pick-deep-forest-path-campfire") ? "bd-pick-deep-forest-path-campfire" : "bd-pick-shipwreck-reef-campfire";
  const inner = c.shuffle(rs, c.floorCells(r, 3));
  // 큰 방(우두머리 방·넓은 굴)엔 천막 하나 — 「누가 사는 곳」이 한눈에 읽힌다. gap 고블린 가죽 천막(3×3)이 있으면 그것.
  const TENT = c.hasKit(GOBLIN.tent) ? GOBLIN.tent : "bd-pick-desert-oasis-tent";
  if ((chief || r.w * r.h >= 150) && c.hasKit(TENT)) {
    const tw = c.kit(TENT).width;
    for (const [x, y] of inner) if (lonely(c, x, y, 3) && lonely(c, x + tw - 1, y, 2) && stand(c, TENT, x, y)) break;
  }
  // 모닥불 둘레 야영 무더기: 불 한 칸 + 곁에 자루·궤짝·가죽 걸이.
  let fires = 0;
  for (const [x, y] of inner) {
    if (fires >= (chief ? 2 : 1)) break;
    if (!lonely(c, x, y, 2) || !stand(c, FIRE, x, y)) continue;
    fires += 1;
    const around: [number, number][] = [[x - 2, y], [x + 2, y], [x, y - 2], [x - 2, y + 1], [x + 2, y - 1]];
    let k = 0;
    for (const [ax, ay] of c.shuffle(rs, around)) { if (k >= 2) break; if (lonely(c, ax, ay, 0) && stand(c, c.weighted(rs, [["bd-pick-walled-market-sack-pile", 2], [SW("crate"), 2], ["bd-pick-deep-forest-path-hide-rack", 1], [SW("barrel"), 2]]), ax, ay)) k += 1; }
  }
  const goods: readonly (readonly [string, number])[] = [["bd-pick-deep-forest-path-hide-rack", 2], [SW("crate-stack"), 3], [SW("barrel"), 3], ["bd-pick-walled-market-sack-pile", 2], [SW("bone-heap"), chief ? 2 : 1],
    ...(c.hasKit(GOBLIN.bones) ? [[GOBLIN.bones, 3] as const] : []), ...(c.hasKit(GOBLIN.loot) ? [[GOBLIN.loot, chief ? 3 : 2] as const] : [])];
  let n = 0;
  for (const [x, y] of edge) { if (n >= (chief ? 6 : 4)) break; if (rs() < 0.55 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, goods), x, y)) n += 1; }
  sprinkle(c, rs, r, 0.03, () => c.weighted(rs, [[SW("bones"), 3], [SW("skulls"), 1], ...(c.hasKit(GOBLIN.bones) ? [[GOBLIN.bones, 2] as const] : [])]), { inset: 2, max: chief ? 4 : 2 });
  // 큰 야영지는 말뚝 울 한 줄(gap 고블린 울) — 우두머리 방은 더 길게.
  if (chief || r.w * r.h >= 150) palisadeRun(c, rs, r, chief ? 6 : 4);
  c.counts["lair-camp"] = (c.counts["lair-camp"] ?? 0) + 1;
}

/** 입구 앵커: 먼저 온 이들의 야영 흔적(모닥불 + 자루·궤짝) — 동굴·화산 입구 굴이 맨바닥으로 읽혔다(2026-10-23 dg2-r1 VQA). 계단 앞 세로 길(계단 x±2)은 비운다. */
function entranceCamp(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null): void {
  const FIRE = c.hasKit("bd-pick-deep-forest-path-campfire") ? "bd-pick-deep-forest-path-campfire" : "bd-pick-shipwreck-reef-campfire";
  const inner = c.shuffle(rs, c.floorCells(r, 1)).filter(([x]) => !s || Math.abs(x - s.x) >= 3);
  for (const [x, y] of inner) {
    if (!lonely(c, x, y, 2) || !stand(c, FIRE, x, y)) continue;
    for (const [ax, ay] of c.shuffle(rs, [[x - 2, y], [x + 2, y], [x - 1, y + 1], [x + 1, y - 1]] as [number, number][]).slice(0, 2)) if (lonely(c, ax, ay, 0)) stand(c, c.weighted(rs, [["bd-pick-walled-market-sack-pile", 2], [SW("crate"), 2], [SW("barrel"), 1]]), ax, ay);
    c.counts["entrance-camp"] = (c.counts["entrance-camp"] ?? 0) + 1;
    return;
  }
}

/** 동굴 벽 앞면 윗단 종유석(tc.cave_stalactite, 2026-10-27) — 구워진 사본에서만. 1칸·2칸을 섞어 벽을 따라 드문드문. */
function stalactites(c: DressCtx, rs: () => number, slots: Slot[], n: number): void {
  if (!c.hasKit(TK("stalactites"))) return;
  const two = c.hasKit(TK("stalactites-2w"));
  // 덩이 사이를 적어도 두 칸 띄운다 — 붙여 걸면 한 줄 빗살·울타리로 읽혔다(2026-10-27 지도 속 검수 r4).
  const placed: Slot[] = [];
  for (const q of c.shuffle(rs, slots)) {
    if (placed.length >= n) break;
    if (placed.some((p) => p.y === q.y && Math.abs(p.x - q.x) < 5)) continue;
    // 2칸은 오른 칸도 같은 줄 벽 칸일 때만 — 벽 끝 모서리에 반쯤 걸려 갈고리처럼 잘렸다(2026-10-27 지도 검수 r6)
    const wide = two && rs() < 0.35 && slots.some((o) => o.y === q.y && o.x === q.x + 1);
    const id = wide ? TK("stalactites-2w") : TK("stalactites");
    if (c.put(id, q.x, q.y)) placed.push(q);
  }
}

function dressCave(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[]): boolean {
  const SPIKES: readonly (readonly [string, number])[] = [[CV("stalagmite-1"), 4], [CV("rock-pillar-2"), 1], [CV("rubble-cave"), 1]];
  const spikes = () => c.weighted(rs, SPIKES);
  // 벽가 덩이는 석순·바위 기둥만 — 잔돌을 덩이마다 끼우면 흰 잔돌이 벽가마다 흩어졌다.
  const CLUMP: readonly (readonly [string, number])[] = [[CV("stalagmite-1"), 3], [CV("rock-pillar-2"), 2]];   // 잔돌은 드물게 — 흰 잔돌이 길가 쓰레기로 읽혔다(2026-10-25 floor VQA r2)
  const glow = () => c.weighted(rs, [[MUSH, 4], [CV("glow-moss-floor"), 2]]);
  const mossPatch = (cells: [number, number][], n: number) => {
    // 이끼 빛 한 덩이: 씨앗 칸 둘레 번짐
    const seed = c.shuffle(rs, cells)[0];
    if (!seed) return;
    c.cluster(rs, seed[0], seed[1], n, [[CV("glow-moss-floor"), 4], [MUSH, 3]]);
  };
  switch (r.kind) {
    case "entrance": {
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
      const e = c.edgeCells(r, rs);
      edgeClumps(c, rs, e, 2, CLUMP);
      mossPatch(e, 3);
      stalactites(c, rs, slots, 2);
      entranceCamp(c, r, rs, s);
      return true;
    }
    case "cavern": {
      const e = c.edgeCells(r, rs);
      if (c.lair) lairCamp(c, r, rs, e, false);
      edgeClumps(c, rs, e, 3, CLUMP);
      sprinkle(c, rs, r, 0.03, spikes, { inset: 2, rad: 2, max: 3 });
      if (!c.lair) mossPatch(e, 3);   // 이끼 빛은 벽가 한 덩이만 — 방 한가운데 덩이가 걷는 길을 막아 보였다(2026-10-25 floor VQA r1)
      if (rs() < 0.7) { for (const [x, y] of shoreCells(c, r).slice(0, 3)) stand(c, MUSH, x, y); }
      stalactites(c, rs, slots, 3);   // 덩굴보다 먼저 — 덩굴이 벽 칸을 다 차지하면 종유석이 한 개도 못 걸렸다(2026-10-27)
      vinesOnWalls(c, rs, slots, 2);
      c.hangAlong(slots, rs, 7, () => TORCH, 1);
      return true;
    }
    case "lake": {
      const shore = c.shuffle(rs, shoreCells(c, r));
      let boat: [number, number] | null = null;
      for (const [x, y] of shore) {
        // 배는 물가 바로 옆 물 위에(2×2 전부 물) — 뭍에 얹힌 배로 읽혔다(2026-10-25 floor VQA r5 cave).
        if (!boat) for (const [dx, dy] of [[0, 1], [0, -2], [1, 0], [-2, 0]] as const) if (!boat && c.put(CV("boat"), x + dx, y + dy, { liquidOk: true, free: true })) boat = [x, y];
        if (boat) break;
      }
      // 계류 말뚝은 배를 맨 물가에 하나만. 통나무·말뚝을 물가 아무 데나 흩으면 「물가에 떠 있는 용도 모를 통나무 기둥」으로 읽혔다
      // (2026-10-29 야외 VQA 동굴 물가 통나무·말뚝 7건) — 나머지 물가는 버섯·잔돌만.
      if (boat) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]] as const) if (free(c, boat[0] + dx, boat[1] + dy) && stand(c, CV("dock-post"), boat[0] + dx, boat[1] + dy)) break;
      let n = 0; for (const [x, y] of shore) { if (n >= 4) break; if (rs() < 0.45 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, [[MUSH, 4], [CV("rubble-cave"), 1]]), x, y)) n += 1; }
      const e = c.edgeCells(r, rs);
      edgeClumps(c, rs, e, 2, CLUMP);
      stalactites(c, rs, slots, 2);
      vinesOnWalls(c, rs, slots, 3);
      return true;
    }
    case "grotto": {
      const e = c.edgeCells(r, rs);
      if (c.lair) { lairCamp(c, r, rs, e, false); return true; }
      mossPatch(e, 5);
      for (const [x, y] of e.slice(0, 6)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, glow(), x, y);
      sprinkle(c, rs, r, 0.04, () => c.weighted(rs, [[SW("bones"), 2], [SW("skulls"), 1], [CV("rubble-cave"), 2]]), { max: 3 });
      stalactites(c, rs, slots, 2);
      vinesOnWalls(c, rs, slots, 2);
      return true;
    }
    case "boss": {
      // 보스 동굴: 가장자리 석순 둘레, 뼈 더미, 가운데는 비움, 벽 덩굴
      // (석순보다 먼저 — 석순이 깃발 자리를 먼저 차지했다) 보스 자리 앵커: 북쪽 벽 앞 가운데 — 소굴은 우두머리 깃발 한 쌍 사이 약탈품 더미, 그 밖은 뼈 더미 제단. 가운데 맨바닥이
      // 「보스방인지 안 읽힌다」·「우두머리가 졸개와 구별되지 않는다」(2026-10-23 dg2-r1 VQA 작은 동굴·고블린 굴).
      {
        const fc = c.floorCells(r, 1).filter(([x, y]) => c.isWall(x, y - 1) && c.isWall(x, y - 2));
        const mid = r.x + Math.floor(r.w / 2);
        fc.sort((a, b) => Math.abs(a[0] - mid) - Math.abs(b[0] - mid));
        for (const [x, y] of fc) {
          if (c.lair && c.hasKit("bd-pick-walled-market-banner-red")) {
            // 깃발 둘이 다 설 자리에서만(한쪽만 서면 짝 잃은 깃발이 됐다)
            if (!lonely(c, x, y, 1) || !lonely(c, x - 2, y, 0) || !lonely(c, x + 2, y, 0) || !c.isWalk(x - 2, y) || !c.isWalk(x + 2, y)) continue;
            if (!stand(c, "bd-pick-walled-market-sack-pile", x, y)) continue;
            stand(c, "bd-pick-walled-market-banner-red", x - 2, y); stand(c, "bd-pick-walled-market-banner-red", x + 2, y);
            stand(c, SW("crate-stack"), x - 1, y); stand(c, SW("barrel"), x + 1, y);
            c.counts["chief-seat"] = (c.counts["chief-seat"] ?? 0) + 1;
            c.seats[r.id] = { x, y: y + 2 };
            break;
          }
          if (lonely(c, x, y, 1) && stand(c, SW("bone-heap"), x, y)) { stand(c, SW("skulls"), x - 2, y); stand(c, SW("skulls"), x + 2, y); c.seats[r.id] = { x, y: y + 2 }; break; }
        }
      }
      const e = c.edgeCells(r, rs);
      edgeClumps(c, rs, e, 3, CLUMP);
      if (e[0]) stand(c, SW("bone-heap"), e[0][0], e[0][1]);
      if (c.lair) lairCamp(c, r, rs, e.slice(1), true);
      sprinkle(c, rs, r, 0.04, () => c.weighted(rs, [[SW("bones"), 2], [SW("skulls"), 2]]), { inset: 2, max: 5 });
      stalactites(c, rs, slots, 3);
      vinesOnWalls(c, rs, slots, 3);
      c.hangAlong(slots, rs, 5, () => TORCH, 2);
      return true;
    }
    case "vault": {
      mossPatch(c.floorCells(r, 1), 6);
      const e = c.edgeCells(r, rs);
      edgeClumps(c, rs, e, 2, [[MUSH, 3], [CV("stalagmite-1"), 2]]);
      return true;
    }
    default: return false;
  }
}

/**
 * 벽가 덩이: 벽가 칸 몇 곳을 씨앗으로(씨앗끼리 5칸 이상) 골라 그 곁에 1~2개를 더 붙여 2~3개 덩이로 놓는다.
 * 덩이 안에서는 같은 그림을 두 번 쓰지 않고(종류 수가 덩이 크기 상한), 둘째부터는 한 줄로 늘어서지 않게 위·아래로 어긋나게 붙인다.
 * 벽가를 따라 한 칸씩 띄운 낱개 석순은 「같은 석순을 같은 간격으로 복붙해 일렬로 세웠다」로 읽혔다
 * (2026-10-29 야외 VQA vm1·vm2 jrpg 동굴 — 석순·바위 기둥 일렬 반복 11건).
 */
function edgeClumps(c: DressCtx, rs: () => number, e: readonly [number, number][], groups: number, kinds: readonly (readonly [string, number])[]): number {
  const edge = new Set(e.map(([x, y]) => c.idx(x, y)));
  const seeds: [number, number][] = [];
  const have = kinds.filter(([id]) => c.hasKit(id));
  let n = 0;
  for (const [x, y] of e) {
    if (seeds.length >= groups || !have.length) break;
    if (seeds.some(([sx, sy]) => Math.max(Math.abs(sx - x), Math.abs(sy - y)) < 5) || !lonely(c, x, y, 2)) continue;
    // 덩이 안 그림: 앞의 둘은 서로 다른 종류, 셋째는 첫째 종류를 다시 써도 되지만 앞의 둘과 다른 줄에만(아래 검사).
    const left = [...have];
    const first = c.weighted(rs, left);
    left.splice(left.findIndex(([k]) => k === first), 1);
    const take = (): string => { if (!left.length) return first; const id = c.weighted(rs, left); left.splice(left.findIndex(([k]) => k === id), 1); return id; };
    if (!stand(c, first, x, y)) continue;
    seeds.push([x, y]); n += 1;
    const members: [number, number][] = [[x, y]];
    const want = have.length > 1 && rs() < 0.5 ? 2 : 1;
    // 어긋난 자리 먼저(대각선·위아래), 같은 줄 옆자리는 마지막 — 같은 줄에 셋이 서면 울타리처럼 읽혔다.
    const offs = [...c.shuffle(rs, [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1]] as [number, number][]), ...c.shuffle(rs, [[1, 0], [-1, 0]] as [number, number][])];
    for (const [dx, dy] of offs) {
      if (members.length > want || (!left.length && members.length < 2)) break;
      const nx = x + dx, ny = y + dy;
      if (!c.inb(nx, ny) || (!edge.has(c.idx(nx, ny)) && !nearWall(c, nx, ny, 1)) || !free(c, nx, ny)) continue;
      if (members.length === 2 && members.some(([, my]) => my === ny)) continue;
      if (stand(c, take(), nx, ny)) { members.push([nx, ny]); n += 1; }
    }
  }
  return n;
}

// ---------------------------------------------------------------- 화산 동굴

const VSPIKES: readonly (readonly [string, number])[] = [[VC("spike-wide"), 2], [VC("spike-tall"), 3], [VC("spike-small"), 3], [VC("stalagmite"), 2]];

function dressVolcano(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[]): boolean {
  const spikes = () => c.weighted(rs, VSPIKES);
  const heat = (cells: [number, number][], n: number) => {
    let k = 0;
    for (const [x, y] of cells) { if (k >= n) break; if (rs() < 0.5 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, [[VC("steam-vent"), 3], [VC("ember-a"), 3], [VC("fire-crystal"), 2]]), x, y)) k += 1; }
  };
  switch (r.kind) {
    case "entrance": {
      if (s) { stand(c, VC("brazier"), s.x - 2, s.y + 2); stand(c, VC("brazier"), s.x + 2, s.y + 2); }
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 8)) if (rs() < 0.4 && lonely(c, x, y, 1)) stand(c, spikes(), x, y);
      heat(e.slice(4), 2);
      entranceCamp(c, r, rs, s);
      return true;
    }
    case "cavern": {
      const e = c.edgeCells(r, rs);
      let n = 0; for (const [x, y] of e) { if (n >= 8) break; if (rs() < 0.55 && lonely(c, x, y, 1) && stand(c, spikes(), x, y)) n += 1; }
      heat(shoreCells(c, r), 4); heat(c.floorCells(r, 2), 2);
      sprinkle(c, rs, r, 0.03, spikes, { inset: 2, rad: 2, max: 3 });
      c.hangAlong(slots, rs, 6, () => VC("hanging-chain"), 2);
      return true;
    }
    case "lake": {
      heat(c.shuffle(rs, shoreCells(c, r)), 6);
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 8)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, spikes(), x, y);
      c.hangAlong(slots, rs, 6, () => VC("hanging-chain"), 2);
      return true;
    }
    case "forge": {
      // 옛 대장간 방: 북쪽 벽에 용광로, 곁에 모루·풀무·괴·석탄, 화로
      const cx = r.x + Math.floor(r.w / 2);
      const f = c.putAny(VC("furnace"), [0, -1, 1, -2, 2].map((d) => [cx - 1 + d, r.y - 2] as [number, number]));
      if (f) {
        stand(c, VC("anvil"), f[0] - 1, f[1] + 3);
        stand(c, VC("bellows"), f[0] + 3, f[1] + 2);
        stand(c, VC("brazier"), f[0] - 2, f[1] + 2);
      }
      const e = c.edgeCells(r, rs);
      c.cluster(rs, e[0]?.[0] ?? r.x, e[0]?.[1] ?? r.y, 3, [[VC("ingots"), 2], [VC("coal-pile"), 3], [VC("anvil"), 1]]);
      for (const [x, y] of e.slice(3, 8)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[VC("coal-pile"), 2], [VC("bones"), 1], [VC("ember-a"), 2]]), x, y);
      return true;
    }
    case "grotto": {
      heat(c.edgeCells(r, rs), 5);
      sprinkle(c, rs, r, 0.05, () => c.weighted(rs, [[VC("fire-crystal"), 3], [VC("bones"), 2], [VC("coal-pile"), 1]]), { max: 5 });
      return true;
    }
    case "boss": {
      // 보스 화구: 제단 가운데 북벽, 화로·부러진 기둥 대칭, 사슬, 가장자리 뾰족돌
      const cx = r.x + Math.floor(r.w / 2);
      const altar = c.putAny(VC("altar"), [0, -1, 1].map((d) => [cx - 2 + d, r.y - 2] as [number, number]));
      if (altar) { stand(c, VC("brazier"), altar[0] - 2, altar[1] + 3); stand(c, VC("brazier"), altar[0] + 5, altar[1] + 3); }
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 10)) if (rs() < 0.55 && lonely(c, x, y, 1)) stand(c, spikes(), x, y);
      heat(shoreCells(c, r), 3);
      for (const x of [r.x + 2, r.x + r.w - 3]) stand(c, c.weighted(rs, [[VC("pillar-broken-a"), 1], [VC("pillar-broken-b"), 1]]), x, r.y + r.h - 2);
      c.hangAlong(slots, rs, 4, () => VC("hanging-chain"), 4);
      return true;
    }
    case "vault": {
      const e = c.edgeCells(r, rs);
      if (e[0]) c.cluster(rs, e[0][0], e[0][1], 4, [[VC("ingots"), 3], [VC("fire-crystal"), 2], [VC("coal-pile"), 1]]);
      heat(e.slice(3), 2);
      return true;
    }
    default: return false;
  }
}

// ---------------------------------------------------------------- 미궁

function dressMaze(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null): boolean {
  if (r.kind !== "entrance") return false;      // 보스·보물 방은 공통 방 규칙
  if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
  // 미궁 전체: 벽 횃불은 드문드문, 길바닥에 뼈·잔해·격자, 막다른 길목에 상자 모둠
  const slots = allWallSlots(c).filter((q) => c.roomAt[c.idx(q.x, q.y + 2)] !== 0);
  let next = 0;
  for (const q of slots) {
    if (q.x < next && c.rooms.length) continue;
    if (rs() < 0.35 && lonely(c, q.x, q.y, 1)) {
      const kitId = c.weighted(rs, [[TORCH, 6], [CC("niche-skull"), 2], [CC("niche-urn"), 1], [SW("chains"), 2], [SW("banner-cult"), 1]]);
      if (c.put(kitId, q.x, q.y)) next = q.x + 3 + Math.floor(rs() * 4);
    }
  }
  const walk: [number, number][] = [];
  for (let y = 0; y < c.H; y += 1) for (let x = 0; x < c.W; x += 1) if (free(c, x, y) && !c.doorstep[c.idx(x, y)] && c.roomAt[c.idx(x, y)] < 0) walk.push([x, y]);
  let placed = 0;
  for (const [x, y] of c.shuffle(rs, walk)) {
    if (placed >= walk.length * 0.07) break;
    if (!lonely(c, x, y, 2)) continue;
    const dead = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !c.isWalk(x + dx!, y + dy!)).length >= 2;
    const kitId = dead ? c.weighted(rs, [[SW("crate"), 2], [SW("barrel"), 2], [SW("skulls"), 3], [SW("bones"), 3]]) : c.weighted(rs, c.litter);
    if (stand(c, kitId, x, y)) placed += 1;
  }
  for (let k = 0; k < walk.length * 0.012; k += 1) { const w = walk[Math.floor(rs() * walk.length)]!; if (free(c, w[0], w[1])) c.put(SW("grate-floor"), w[0], w[1], { free: true }); }
  return false;     // 입구 방 자체는 공통 규칙(계단 옆 상자 모둠)으로 이어서
}


// ================================================================ 2026-10-23 dungeon-themes: 새 주제 장식
// 새 그림(TK(...))은 구워져 있을 때만 놓이고(pickKit·hasKit), 없으면 기존 버들항 키트로 물러선다 — 옛 사본도 같은 배치로 짓는다.

const FF = (id: string) => P("deep-forest-path", id);
const SP = (id: string) => P("swamp-stilt", id);
const DS = (id: string) => P("desert-oasis", id);
const SF = (id: string) => P("snowfield", id);
// 늪 갈대 = 살아 있는 갈대 무더기(오아시스·늪 공용) — 묶은 갈대 단(reed-stack)은 노란 막대라 마른 진흙 위 「널판·말뚝」으로 읽혔다(2026-10-25 floor VQA r5 swamp).
const REEDS = DS("reed");
const WZ = (id: string) => P("wizard-tower", id);
/** 후보 중 이 타일셋에 있는 첫 키트. */
function pickKit(c: DressCtx, ids: readonly string[]): string { return ids.find((id) => c.hasKit(id)) ?? ids[ids.length - 1]!; }
const TREES_S = ["bd-tree-f4f319", "bd-tree-e9d9b3", "bd-tree-37f48b", "bd-tree-47e17a", "bd-tree-d105b2", "bd-tree-0f7ed1"];
const TREES_M = ["bd-tree-03a8f7", "bd-tree-3e8732", "bd-tree-a80c85", "bd-tree-7ecdb8"];
const TREES_L = ["bd-tree-d43edd", "bd-tree-5844f6", "bd-tree-b1d104"];
const FOREST_BITS: readonly (readonly [string, number])[] = [[FF("fern-a"), 3], [FF("fern-b"), 3], [FF("fern-c"), 2], [FF("heath-a"), 2], [FF("heath-b"), 2], [FF("wild-a"), 2], [FF("wild-b"), 1], [FF("stones-a"), 1], [FF("toadstools-a"), 1]];

/** 방 북쪽 끝 가운데(보스 자리·큰 기물): 바닥 첫 줄 근처, 가운데에 가까운 순. */
function northCenter(c: DressCtx, r: PlacedRoom, w: number, inset = 1): [number, number][] {
  const mid = r.x + Math.floor(r.w / 2) - Math.floor(w / 2);
  return c.floorCells(r, inset).filter(([, y]) => y <= r.y + Math.max(2, Math.floor(r.h / 3))).sort((a, b) => a[1] - b[1] || Math.abs(a[0] - mid) - Math.abs(b[0] - mid));
}
/** 큰 기물을 북쪽 가운데에 세운다(맨 아랫줄 기준). 놓인 기물의 왼쪽 x·아랫줄 y. */
function standNorth(c: DressCtx, r: PlacedRoom, kitId: string, inset = 1): [number, number] | null {
  if (!c.hasKit(kitId)) return null;
  const def = c.kit(kitId);
  const cands = northCenter(c, r, def.width, inset).slice(0, 40);
  // 벽에 등을 댄 자리 먼저(윗줄 바로 위가 벽·천장) — 문 앞 칸을 피해 한 줄 내려선 옥좌가 방 가운데 떠 보였다(2026-10-25 floor VQA r4 castle).
  const backed = ([x, y]: [number, number]) => Array.from({ length: def.width }, (_, dx) => x + dx).every((X) => !c.isWalk(X, y - 1));
  for (const [x, y] of [...cands.filter(backed), ...cands.filter((q) => !backed(q))]) {
    const fy = y + def.height - 1;
    if (stand(c, kitId, x, fy)) return [x, fy];
  }
  return null;
}
/** 나무 덤불 한두 덩이(빈터 안 섬) — 숲이 빈터 안까지 들어와 「풀밭 한 장」이 아니게. */
function treeIslands(c: DressCtx, r: PlacedRoom, rs: () => number, n: number): void {
  let placed = 0;
  for (const [x, y] of c.shuffle(rs, c.floorCells(r, 3))) {
    if (placed >= n) break;
    if (!lonely(c, x, y, 3)) continue;
    const pool = rs() < 0.5 ? TREES_M : TREES_S;
    const id = pool[Math.floor(rs() * pool.length)]!;
    if (stand(c, id, x, y)) {
      placed += 1;
      for (const [dx, dy] of [[-1, 0], [2, 0], [0, 1], [1, 1]] as const) if (rs() < 0.5) stand(c, c.weighted(rs, FOREST_BITS), x + dx, y + dy);
    }
  }
}

function dressForest(c: DressCtx, r: PlacedRoom, rs: () => number): boolean {
  const bits = () => c.weighted(rs, FOREST_BITS);
  const e = c.edgeCells(r, rs);
  const edgeBits = (n: number) => { let k = 0; for (const [x, y] of e) { if (k >= n) break; if (rs() < 0.55 && lonely(c, x, y, 1) && stand(c, bits(), x, y)) k += 1; } };
  switch (r.kind) {
    case "entrance": {
      entranceCamp(c, r, rs, null);
      stand(c, FF("hunter-post"), r.x + 1, r.y + r.h - 1); stand(c, FF("cairn"), r.x + r.w - 2, r.y + r.h - 1);
      edgeBits(6);
      return true;
    }
    case "cavern": {
      treeIslands(c, r, rs, r.w * r.h > 120 ? 2 : 1);
      // 쓰러진 통나무·그루터기·바위 — 빈터가 길이 아니라 숲속 공터로 읽히게
      sprinkle(c, rs, r, 0.03, () => c.weighted(rs, [[FF("log-fallen"), 2], [FF("stump"), 3], [P("mountain-pass", "boulder-m"), 1], [pickKit(c, [TK("mossy-boulder"), FF("stones-b")]), 2]]), { inset: 2, rad: 2, max: 3 });
      edgeBits(9);
      return true;
    }
    case "lake": {
      // 연못: 물가 갈대·돌, 물 위 연잎
      for (const [x, y] of c.shuffle(rs, shoreCells(c, r)).slice(0, 8)) if (rs() < 0.6 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[FF("fern-b"), 2], [FF("stones-c"), 1], [FF("wild-c"), 1], [REEDS, 1]]), x, y);
      let lily = 0;
      for (const [x, y] of c.shuffle(rs, c.floorCells(r, 0).concat(waterCells(c, r)))) { if (lily >= 4) break; if (openWater(c, x, y) && rs() < 0.2 && c.put(pickKit(c, [TK("lily-pads"), DS("lily")]), x, y, { liquidOk: true })) lily += 1; }
      edgeBits(6);
      return true;
    }
    case "grotto": {
      // 버섯 고리(요정 고리) — 숲 던전의 「장소」. 순간이동 장치가 있으면 장치가 따로 그 자리를 쓴다.
      const cells = c.floorCells(r, 2);
      const mid = cells[Math.floor(cells.length / 2)];
      if (mid) { const ring = pickKit(c, [TK("mushroom-ring")]); if (c.hasKit(ring)) stand(c, ring, mid[0] - 1, mid[1]); else for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]] as const) stand(c, rs() < 0.5 ? FF("toadstools-a") : FF("toadstools-c"), mid[0] + dx, mid[1] + dy); }
      stand(c, FF("hide-rack"), r.x + 1, r.y + 2);
      edgeBits(7);
      return true;
    }
    case "boss": {
      // 거대한 고목(보스 자리): 새 그림이 있으면 그것, 없으면 큰 나무 셋 사이 옛 숲 문(돌 아치).
      const giant = standNorth(c, r, TK("giant-tree"), 0);
      if (giant) c.seats[r.id] = { x: giant[0] + Math.floor(c.kit(TK("giant-tree")).width / 2), y: giant[1] + 2 };
      else {
        const gate = standNorth(c, r, FF("ruin-gate"), 0);
        if (gate) {
          stand(c, TREES_L[0]!, gate[0] - 4, gate[1]); stand(c, TREES_L[1]!, gate[0] + 4, gate[1]);
          c.seats[r.id] = { x: gate[0] + 1, y: gate[1] + 2 };
        }
      }
      edgeBits(10);
      sprinkle(c, rs, r, 0.03, () => c.weighted(rs, [[FF("toadstools-b"), 2], [SW("bones"), 1], [FF("stump"), 1]]), { inset: 2, max: 4 });
      return true;
    }
    case "vault": {
      standNorth(c, r, FF("cairn"), 1);
      stand(c, FF("stones-a"), r.x + 1, r.y + r.h - 2); stand(c, FF("stones-b"), r.x + r.w - 2, r.y + r.h - 2);
      edgeBits(5);
      return true;
    }
    default: return false;
  }
}
/** 방 상자 안의 물 칸(연못 안쪽 — floorCells 는 걸을 수 있는 칸만 준다). */
function waterCells(c: DressCtx, r: PlacedRoom): [number, number][] {
  const out: [number, number][] = [];
  for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (c.inb(x, y) && c.liquid[c.idx(x, y)]) out.push([x, y]);
  return out;
}

/** 빈 창 메우기: 방 안 w×w 창이 전부 빈 걷는 바닥이면 가운데에 하나 세운다(창이 안 남을 때까지, 최대 max). 「목적 없는 맨바닥 네모」 방지 — 늪·숲처럼 넓은 자연 방. */
function fillVoids(c: DressCtx, r: PlacedRoom, rs: () => number, pick: () => string, w = 6, max = 8): number {
  let n = 0;
  for (let pass = 0; pass < max; pass += 1) {
    let hit: [number, number] | null = null;
    const ys = c.shuffle(rs, Array.from({ length: Math.max(0, r.h - w + 1) }, (_, k) => r.y + k));
    const xs = c.shuffle(rs, Array.from({ length: Math.max(0, r.w - w + 1) }, (_, k) => r.x + k));
    outer: for (const y0 of ys) for (const x0 of xs) {
      for (let dy = 0; dy < w; dy += 1) for (let dx = 0; dx < w; dx += 1) if (!free(c, x0 + dx, y0 + dy)) continue outer;
      hit = [x0 + Math.floor(w / 2), y0 + Math.floor(w / 2)]; break;
    }
    if (!hit) break;
    let ok = false;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1]] as const) if (stand(c, pick(), hit[0] + dx, hit[1] + dy)) { ok = true; break; }
    if (!ok) break;
    n += 1;
  }
  if (n) c.counts["void-fill"] = (c.counts["void-fill"] ?? 0) + n;
  return n;
}

function dressSwamp(c: DressCtx, r: PlacedRoom, rs: () => number): boolean {
  if (!dressSwampRoom(c, r, rs)) return false;
  const moss = pickKit(c, [TK("swamp-moss"), SP("snag")]);
  fillVoids(c, r, rs, () => c.weighted(rs, [[SP("snag"), 2], [moss, 2], [REEDS, 2], [SP("moss-log"), 1], [FF("fern-c"), 1]]));
  return true;
}

function dressSwampRoom(c: DressCtx, r: PlacedRoom, rs: () => number): boolean {
  const bits = () => c.weighted(rs, [[REEDS, 2], [FF("fern-c"), 2], [FF("toadstools-b"), 2], [SP("crab-trap"), 1], [SW("bones"), 1], [MUSH, 2]]);
  const e = c.edgeCells(r, rs);
  const edgeBits = (n: number) => { let k = 0; for (const [x, y] of e) { if (k >= n) break; if (rs() < 0.5 && lonely(c, x, y, 1) && stand(c, bits(), x, y)) k += 1; } };
  const wisp = pickKit(c, [TK("will-o-wisp"), MUSH]);
  const trees = () => (rs() < 0.6 ? SP("mangrove") : SP("snag"));
  switch (r.kind) {
    case "entrance": {
      stand(c, SP("lantern"), r.x + 1, r.y + r.h - 1); stand(c, SP("lantern"), r.x + r.w - 2, r.y + r.h - 1);
      stand(c, SP("moss-log"), r.x + 2, r.y + 1);
      edgeBits(5);
      return true;
    }
    case "cavern": case "grotto": {
      let t = 0; for (const [x, y] of c.shuffle(rs, c.floorCells(r, 2))) { if (t >= (r.w * r.h > 110 ? 2 : 1)) break; if (lonely(c, x, y, 3) && stand(c, trees(), x, y)) t += 1; }
      if (r.kind === "grotto") { const root = pickKit(c, [TK("mangrove-roots")]); if (c.hasKit(root)) sprinkle(c, rs, r, 0.05, () => root, { inset: 2, rad: 2, max: 1 }); stand(c, SP("snag"), r.x + 1, r.y + 3); }
      sprinkle(c, rs, r, 0.03, () => wisp, { inset: 2, rad: 2, max: 2 });
      sprinkle(c, rs, r, 0.03, () => SP("moss-log"), { inset: 2, rad: 2, max: 1 });
      edgeBits(8);
      return true;
    }
    case "lake": {
      let boat = false;
      for (const [x, y] of c.shuffle(rs, waterCells(c, r))) {
        if (!boat && c.liquid[c.idx(x + 1, y)] && c.put(SP("rowboat"), x, y, { liquidOk: true })) { boat = true; continue; }
        if (rs() < 0.08 && openWater(c, x, y)) c.put(pickKit(c, [TK("lily-pads"), DS("lily")]), x, y, { liquidOk: true });
      }
      // 말뚝은 물 속에(물가 바로 앞 물 칸), 갈대·오리만 물가 뭍에 — 말뚝이 마른 진흙에 박혀 「뭍의 계류 말뚝」으로 읽혔다(2026-10-25 floor VQA r5 swamp).
      let pile = 0;
      for (const [x, y] of c.shuffle(rs, waterCells(c, r))) { if (pile >= 2) break; if (openWater(c, x, y) && openWater(c, x, y + 1) && [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => !c.liquid[c.idx(x + dx!, y + dy!)]) && c.put(SP("pilings"), x, y, { liquidOk: true, free: true })) pile += 1; }
      for (const [x, y] of c.shuffle(rs, shoreCells(c, r)).slice(0, 5)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[REEDS, 2], [SP("ducks"), 1]]), x, y);
      edgeBits(5);
      return true;
    }
    case "boss": {
      // 가라앉은 우상(새 그림) — 없으면 늪 사당. 그 앞이 보스 자리.
      const idol = standNorth(c, r, pickKit(c, [TK("sunken-idol"), CC("altar-stone")]), 0);
      if (idol) c.seats[r.id] = { x: idol[0] + 1, y: idol[1] + 2 };
      for (const side of [-1, 1]) { const at = idol ? [idol[0] + (side < 0 ? -2 : 4), idol[1]] as const : null; if (at) stand(c, SP("lantern"), at[0], at[1]); }
      sprinkle(c, rs, r, 0.04, () => wisp, { inset: 2, rad: 2, max: 3 });
      edgeBits(9);
      return true;
    }
    case "vault": { stand(c, SP("snag"), r.x + 1, r.y + 3); edgeBits(4); return true; }
    default: return false;
  }
}

function dressPyramid(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[], _centerFirst: Slot[]): boolean {
  const cx = r.x + Math.floor(r.w / 2);
  const obelisk = pickKit(c, [TK("obelisk"), TP("column-temple-tall")]);
  const sarco = pickKit(c, [TK("pharaoh-sarcophagus"), SW("coffin")]);
  const statue = pickKit(c, [TK("jackal-statue"), TP("column-temple")]);
  const gold = pickKit(c, [TK("gold-pile"), DS("jars")]);
  const drift = pickKit(c, rs() < 0.5 ? [TK("sand-drift-2"), TK("sand-drift"), DS("bones")] : [TK("sand-drift"), DS("bones")]);
  const torch = () => TORCH;
  const sand = (n: number) => sprinkle(c, rs, r, 0.05, () => c.weighted(rs, [[drift, 4], [DS("bones"), 1], [DS("jars"), 1]]), { inset: 1, rad: 2, max: n });
  switch (r.kind) {
    case "entrance": {
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); if (stand(c, obelisk, s.x - 3, s.y + 4)) stand(c, obelisk, s.x + 3, s.y + 4); }
      sand(3);
      return true;
    }
    case "hall": {
      // 열주 홀: 두 줄 기둥(간격 흔들기) 사이 가운데 길, 벽에 횃불, 기둥 사이 짐승 석상
      const rowsY = r.h >= 8 ? [r.y + 2, r.y + r.h - 2] : [r.y + Math.floor(r.h / 2)];
      for (let x = r.x + 2 + Math.floor(rs() * 2); x < r.x + r.w - 2; x += 3 + Math.floor(rs() * 2)) for (const y of rowsY) stand(c, TP("column-temple"), x, y);
      // 짐승 석상 한 쌍: 자칼 또는 풍뎅이(방마다 하나로, 쌍은 같게).
      const pair = c.hasKit(TK("scarab-statue")) && rs() < 0.4 ? TK("scarab-statue") : statue;
      if (r.h >= 7) { const my = r.y + Math.floor(r.h / 2); if (stand(c, pair, cx - 3, my)) stand(c, pair, cx + 3, my); }
      c.hangAlong(slots, rs, 4, torch);
      sand(3);
      return true;
    }
    case "crypt": {
      // 석관 묘실: 석관 줄 + 벽 앞 항아리
      const want = Math.max(2, Math.round((r.w * r.h) / 24));
      let n = 0;
      for (let y = r.y + 2; y < r.y + r.h - 1 && n < want; y += 3) for (let x = r.x + 1; x < r.x + r.w - 2 && n < want; x += 3) if (rs() < 0.8 && stand(c, sarco, x, y)) n += 1;
      for (const q of slots.slice(0, 6)) if (rs() < 0.4) c.put(TORCH, q.x, q.y);
      for (const [x, y] of c.edgeCells(r, rs).slice(0, 6)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[DS("jars"), 2], [DS("bones"), 2], [drift, 2]]), x, y);
      return true;
    }
    case "shrine": {
      const altar = c.putAny(CC("altar-stone"), [0, 1, -1].map((d) => [cx - 1 + d, r.y] as [number, number]));
      if (altar) { stand(c, VC("brazier"), altar[0] - 2, altar[1] + 2); stand(c, VC("brazier"), altar[0] + 3, altar[1] + 2); stand(c, statue, altar[0] - 2, altar[1] + 1); }
      c.hangAlong(slots, rs, 4, torch, 2);
      sand(2);
      return true;
    }
    case "storage": case "vault": {
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 8)) if (rs() < 0.55 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[DS("jars"), 3], [gold, r.kind === "vault" ? 3 : 1], [DS("bales"), 1]]), x, y);
      c.hangAlong(slots, rs, 4, torch, 2);
      return true;
    }
    case "boss": {
      // 파라오 묘실: 가운데 큰 석관 + 의식 원, 양옆 오벨리스크·화로, 벽 횃불
      put5(c, TP("mosaic-medallion-5x5"), cx - 2, r.y + Math.floor(r.h / 2) - 2);
      const sar = standNorth(c, r, sarco, 1);
      if (sar) { stand(c, obelisk, sar[0] - 3, sar[1]); stand(c, obelisk, sar[0] + 3 + (c.hasKit(sarco) ? c.kit(sarco).width - 1 : 0), sar[1]); c.seats[r.id] = { x: sar[0], y: sar[1] + 3 }; }
      for (const [x, y] of [[r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]] as const) stand(c, VC("brazier"), x, y);
      c.hangAlong(slots, rs, 3, torch);
      sand(3);
      return true;
    }
    default: return false;
  }
}
function put5(c: DressCtx, id: string, x: number, y: number): void { if (c.hasKit(id)) c.put(id, x, y, { free: true }); }

function dressTower(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[], _centerFirst: Slot[]): boolean {
  const cx = r.x + Math.floor(r.w / 2);
  const shelf = pickKit(c, [TK("bookshelf"), WZ("herb-rack")]);
  const tall = pickKit(c, [TK("bookshelf-tall"), shelf]);
  const lectern = pickKit(c, [TK("lectern"), WZ("globe")]);
  const crystal = pickKit(c, [TK("crystal-pedestal"), VC("fire-crystal")]);
  const circle = pickKit(c, [TK("arcane-circle"), TP("mosaic-medallion-5x5")]);
  const candles = pickKit(c, [TK("candelabra"), SW("candles")]);
  const ring = r.shape === "ring";
  /** 링 방 안쪽 첫 둘레: 링 그림(안벽 그늘·띠)이 덮지 않은 바닥 중 이웃이 링 그림·벽인 칸 — 링 그림 칸 위에는 물건이 못 앉는다. */
  const ringEdge = (): [number, number][] => c.floorCells(r, 0).filter(([x, y]) => c.upper[c.idx(x, y)]! < 0
    && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !c.isWalk(x + dx!, y + dy!) || c.upper[c.idx(x + dx!, y + dy!)]! >= 0));
  /** 링 방 둘레(동·서 호 밑 바닥 칸): 촛대·수정·지구의를 드문드문(링 방은 북쪽 벽 칸 장식이 없어 둘레가 비었다). */
  const ringRim = (n: number) => {
    if (!ring) return;
    const cells = ringEdge().filter(([, y]) => y >= r.y + 2);
    let k = 0;
    for (const [x, y] of c.shuffle(rs, cells)) { if (k >= n) break; if (lonely(c, x, y, 1) && stand(c, c.weighted(rs, [[candles, 3], [crystal, 2], [WZ("globe"), 1], [WZ("lamppost"), 1]]), x, y)) k += 1; }
  };
  /** 북쪽 벽에 붙은 첫 바닥 줄을 따라 책장을 세운다(앞길 한 칸씩 비움). */
  const shelves = (max: number) => {
    let n = 0;
    // 둥근 탑 링 방(shape ring): 북쪽 안벽이 키트 그림이라 벽 칸 표시가 없다 — 북쪽 이웃이 걷지 못하는 칸이면 안벽 밑이다.
    const row = (ring ? ringEdge().filter(([, y]) => y < r.y + Math.floor(r.h / 2)) : c.floorCells(r, 0).filter(([x, y]) => c.isWall(x, y - 1))).sort((a, b) => a[0] - b[0]);
    for (const [x, y] of row) { if (n >= max) break; if (s && Math.abs(x - s.x) <= 1) continue; if (rs() < 0.7 && stand(c, rs() < 0.4 ? tall : shelf, x, y + (c.hasKit(tall) ? c.kit(tall).height - 1 : 0))) n += 1; }
    return n;
  };
  switch (r.kind) {
    case "entrance": {
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
      stand(c, WZ("globe"), r.x + 1, r.y + r.h - 2); stand(c, WZ("lamppost"), r.x + r.w - 2, r.y + r.h - 2);
      return true;
    }
    case "library": case "hall": {
      shelves(r.kind === "library" ? 6 : 3);
      const mid = c.floorCells(r, 2);
      if (mid.length) { const [x, y] = mid[Math.floor(mid.length / 2)]!; stand(c, lectern, x, y); stand(c, candles, x + 2, y); }
      stand(c, r.kind === "library" ? DS("rug") : WZ("starmap"), cx - 1, r.y + r.h - 2);
      if (r.kind === "hall" && !ring) { stand(c, WZ("orrery"), r.x + 1, r.y + r.h - 2); stand(c, WZ("armillary"), r.x + r.w - 3, r.y + r.h - 1); }
      if (r.kind === "hall" && ring) { stand(c, WZ("orrery"), r.x + r.w - 3, r.y + r.h - 3); }
      ringRim(4);
      c.hangAlong(slots, rs, 5, () => TORCH, 2);
      return true;
    }
    case "shrine": case "boss": {
      // 마법진 방: 가운데 마법진(보스방은 그 위가 탑 주인의 자리), 둘레 수정 받침·달돌 표석
      const k = c.hasKit(circle) ? c.kit(circle) : null;
      if (k) put5(c, circle, cx - Math.floor(k.width / 2), r.y + Math.floor(r.h / 2) - Math.floor(k.height / 2));
      for (const [dx, dy] of [[-4, -1], [4, -1], [-4, 3], [4, 3]] as const) if (rs() < 0.85) stand(c, r.kind === "boss" && dy < 0 ? WZ("moon-obelisk") : crystal, cx + dx, r.y + Math.floor(r.h / 2) + dy);
      if (r.kind === "boss") { c.seats[r.id] = { x: cx, y: r.y + Math.floor(r.h / 2) }; shelves(3); }
      ringRim(3);
      c.hangAlong(slots, rs, 4, () => TORCH, 3);
      return true;
    }
    case "storage": {
      stand(c, WZ("athanor"), r.x + 1, r.y + 2); stand(c, WZ("herb-rack"), r.x + 4, r.y + 1);
      for (const [x, y] of c.edgeCells(r, rs).slice(0, 6)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[SW("crate"), 2], [SW("barrel"), 2], [crystal, 1]]), x, y);
      return true;
    }
    case "vault": { for (const [x, y] of c.edgeCells(r, rs).slice(0, 5)) if (rs() < 0.6 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[crystal, 2], [WZ("globe"), 1]]), x, y); return true; }
    default: return false;
  }
}

function dressOtherworld(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[]): boolean {
  const crystal = () => pickKit(c, rs() < 0.5 ? [TK("corrupt-crystal"), VC("fire-crystal")] : [TK("corrupt-crystal-big"), TK("corrupt-crystal"), VC("spike-wide")]);
  const fire = pickKit(c, [TK("void-brazier"), VC("brazier")]);
  const pillar = pickKit(c, [TK("bone-pillar"), VC("spike-tall")]);
  // 뼈는 가끔만 — 길가 곳곳의 흰 뼈가 「바닥이 지저분하다」로 읽혔다(2026-10-25 floor VQA r0·r1).
  const bits = () => c.weighted(rs, [[crystal(), 3], [VC("spike-small"), 2], [SW("bones"), 1], [pillar, 1]]);
  const e = c.edgeCells(r, rs);
  const edgeBits = (n: number) => { let k = 0; for (const [x, y] of e) { if (k >= n) break; if (rs() < 0.5 && lonely(c, x, y, 1) && stand(c, bits(), x, y)) k += 1; } };
  switch (r.kind) {
    case "entrance": {
      if (s) { stand(c, fire, s.x - 2, s.y + 3); stand(c, fire, s.x + 2, s.y + 3); }
      edgeBits(5);
      return true;
    }
    case "cavern": case "lake": case "grotto": {
      edgeBits(8);
      sprinkle(c, rs, r, 0.03, crystal, { inset: 2, rad: 2, max: 2 });
      vinesOnWalls(c, rs, slots, 3, VC("hanging-chain"));
      if (r.kind === "grotto") { const a = standNorth(c, r, SW("altar-cult"), 1); if (a) { stand(c, fire, a[0] - 2, a[1]); stand(c, fire, a[0] + 3, a[1]); } }
      return true;
    }
    case "boss": {
      // 마왕의 옥좌(새 그림) — 없으면 교단 제단 + 깃발 + 보랏빛 화로. 둘레 뼈 기둥.
      const throne = standNorth(c, r, pickKit(c, [TK("demon-throne"), SW("altar-cult")]), 1);
      if (throne) {
        const w = c.kit(pickKit(c, [TK("demon-throne"), SW("altar-cult")])).width;
        stand(c, fire, throne[0] - 2, throne[1] + 1); stand(c, fire, throne[0] + w + 1, throne[1] + 1);
        c.seats[r.id] = { x: throne[0] + Math.floor(w / 2), y: throne[1] + 2 };
      }
      // 열린 차원문(소용돌이 3장면) — 마왕이 건너온 문. 없으면 봉인된 문.
      const portal = pickKit(c, [TK("portal-gate-open"), TK("portal-gate")]);
      if (c.hasKit(portal)) sprinkle(c, rs, r, 0.05, () => portal, { inset: 2, rad: 3, max: 1 });
      for (const [x, y] of [[r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]] as const) stand(c, pillar, x, y);
      vinesOnWalls(c, rs, slots, 4, VC("hanging-chain"));
      edgeBits(8);
      return true;
    }
    case "vault": {
      const sealed = pickKit(c, [TK("portal-gate")]);
      if (c.hasKit(sealed)) standNorth(c, r, sealed, 1);
      edgeBits(5);
      return true;
    }
    default: return false;
  }
}

function dressIce(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[]): boolean {
  const crystal = pickKit(c, [TK("ice-crystal"), VC("fire-crystal")]);
  const rock = () => pickKit(c, rs() < 0.5 ? ["bd-pick-dungeon-gap-ice-rock", SF("rock")] : [SF("rock")]);
  const icicle = pickKit(c, [TK("icicles"), CV("vines-2")]);
  const frozen = pickKit(c, [TK("frozen-warrior"), SF("snowman")]);
  const drift = pickKit(c, rs() < 0.5 ? [TK("snow-drift-2"), TK("snow-drift"), SF("mound")] : [TK("snow-drift"), SF("mound")]);
  // 흙빛 동굴 석순(CV stalagmite-1)은 얼음굴에서 빼었다 — 「얼음 동굴에 갈색 석순」(2026-10-27 themes audit ice)
  const bits = () => c.weighted(rs, [[drift, 3], [rock(), 3], [crystal, 2], [SF("mound"), 1]]);
  const e = c.edgeCells(r, rs);
  const edgeBits = (n: number) => { let k = 0; for (const [x, y] of e) { if (k >= n) break; if (rs() < 0.5 && lonely(c, x, y, 1) && stand(c, bits(), x, y)) k += 1; } };
  const icicles = (n: number) => { if (c.hasKit(TK("icicles"))) c.hangAlong(slots, rs, 3, () => icicle, n); };
  switch (r.kind) {
    case "entrance": {
      if (s) { c.put(TORCH, s.x - 2, s.y); c.put(TORCH, s.x + 2, s.y); }
      entranceCamp(c, r, rs, s);
      edgeBits(5); icicles(3);
      return true;
    }
    case "cavern": case "grotto": {
      edgeBits(9); icicles(4);
      sprinkle(c, rs, r, 0.03, () => crystal, { inset: 2, rad: 2, max: 2 });
      return true;
    }
    case "lake": {
      // 얼어붙은 호수: 가운데는 빙판(미끄럼 장치 자리)이라 비우고, 둘레에 얼음 바위·얼음 구멍
      for (const [x, y] of c.shuffle(rs, e).slice(0, 10)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[rock(), 2], [drift, 2], [SF("ice-hole"), 1]]), x, y);
      icicles(4);
      return true;
    }
    case "boss": {
      const mid = r.x + Math.floor(r.w / 2);
      for (const dx of [-3, 3]) stand(c, frozen, mid + dx, r.y + 2);
      const cr = standNorth(c, r, crystal, 1);
      if (cr) c.seats[r.id] = { x: cr[0], y: cr[1] + 2 };
      edgeBits(10); icicles(5);
      return true;
    }
    case "vault": { edgeBits(5); sprinkle(c, rs, r, 0.05, () => crystal, { max: 2 }); return true; }
    default: return false;
  }
}

/** 성·요새: 옥좌의 방만 따로 — 북쪽 가운데 옥좌, 문에서 옥좌까지 붉은 카펫, 양옆 깃발·갑옷. 나머지 방은 공통 규칙(성 벽돌). */
/** 카펫 줄(theme-earth carpet-runner: 키트 1행 = 위 끝 · 2행 = 반복 가운데 · 3행 = 아래 끝): 가운데 x 에 y0..y1 로 깐다.
 * 바닥 데칼(사람 밑)이라 칸에 직접 쓴다 — 빈 걷는 칸에만, 막힌 칸에서 끊는다. */
function layRunner(c: DressCtx, id: string, cx: number, y0: number, y1: number): void {
  const k = c.kit(id), w = k.width, x0 = cx - Math.floor(w / 2);
  const tileAt = (row: number, dx: number) => { const rr = k.rows[row]!; const u = rr.upperTiles?.[dx] ?? -1; return u >= 0 ? u : rr.tiles[dx]!; };
  let end = y0;
  while (end + 1 <= y1 && Array.from({ length: w }, (_, dx) => x0 + dx).every((x) => free(c, x, end + 1))) end += 1;
  if (end - y0 < 2 || !Array.from({ length: w }, (_, dx) => x0 + dx).every((x) => free(c, x, y0))) return;
  for (let y = y0; y <= end; y += 1) for (let dx = 0; dx < w; dx += 1) {
    const row = y === y0 ? 0 : y === end ? k.rows.length - 1 : 1;
    c.upper[c.idx(x0 + dx, y)] = tileAt(row, dx);
  }
  c.counts["carpet"] = (c.counts["carpet"] ?? 0) + 1;
}

function dressCastle(c: DressCtx, r: PlacedRoom, rs: () => number, slots: Slot[], centerFirst: Slot[]): boolean {
  if (r.kind !== "boss") return false;
  const cx = r.x + Math.floor(r.w / 2);
  const throneId = pickKit(c, [TK("throne"), CC("altar-stone")]);
  const tw = c.hasKit(throneId) ? c.kit(throneId).width : 2;
  // 카펫 먼저(바닥 그림이라 길을 막지 않는다): 새 그림 줄이 있으면 그것, 없으면 사막 카펫 깔개 2×2 를 이어 깐다.
  const runner = pickKit(c, r.w >= 11 ? [TK("carpet-runner-3w"), TK("carpet-runner"), DS("rug")] : [TK("carpet-runner"), DS("rug")]);
  const themedRunner = c.hasKit(runner) && runner.startsWith(TK(""));
  if (c.hasKit(runner) && !themedRunner) { const rw = c.kit(runner).width; for (let y = r.y + 2; y < r.y + r.h; y += c.kit(runner).height) c.put(runner, cx - Math.floor(rw / 2), y, { free: true, label: "carpet" }); }
  const t = standNorth(c, r, throneId, 0);
  if (t) c.seats[r.id] = { x: t[0] + Math.floor(tw / 2), y: t[1] + 2 };
  // 주제 카펫 줄은 옥좌 단 바로 앞에서 방 남쪽 끝까지(옥좌가 먼저 자리를 잡는다).
  if (themedRunner) layRunner(c, runner, t ? t[0] + Math.floor(tw / 2) : cx, t ? t[1] + 1 : r.y + 2, r.y + r.h - 1);
  const banner = pickKit(c, [TK("royal-banner"), SW("banner-cult")]);
  for (const d of [3, 5]) { const l = centerFirst.find((q) => q.x === cx - d), rr = centerFirst.find((q) => q.x === cx + d); if (l && rr && c.put(banner, l.x, l.y)) c.put(banner, rr.x, rr.y); }
  const armor = pickKit(c, [TK("armor-stand"), CC("iron-maiden")]);
  for (let y = r.y + 3; y < r.y + r.h - 1; y += 3) { stand(c, armor, cx - 4, y); stand(c, armor, cx + 4, y); }
  c.hangAlong(slots, rs, 4, () => TORCH, 4);
  return true;
}
