// 던전 종류별 장식 규칙 — compose.ts 가 만든 바닥·벽 위에 종류마다 다른 물건을 놓는다(2026-10-14 던전 종류 확장).
// 놓기는 전부 ctx.put 을 거친다: 받침 규칙(groundSupport)·액체/다리 위 금지·문 앞 금지·길 막으면 되돌림이 거기서 걸린다.
// true 를 돌려주면 그 방은 이 파일이 다 꾸민 것이고, false 면 compose 의 공통 방 규칙(홀·묘실·감방·제단·창고·보물 방)이 그 종류의 테마 키트로 이어서 꾸민다.
import type { StructureKitDef } from "@/project/types";
import type { DungeonType, PlacedCorridor, PlacedRoom } from "../types";

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
function shoreCells(c: DressCtx, r: PlacedRoom): [number, number][] {
  return c.floorCells(r).filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => c.liquid[c.idx(x + dx!, y + dy!)] === 1));
}

/** 방 안쪽에 드문드문(확률 p, 둘레 rad 비움) 흩뿌린다. */
function sprinkle(c: DressCtx, rs: () => number, r: PlacedRoom, p: number, pick: () => string, opts: { inset?: number; rad?: number; max?: number; bottomOnly?: boolean } = {}): number {
  let n = 0;
  for (const [x, y] of c.shuffle(rs, c.floorCells(r, opts.inset ?? 1))) {
    if (n >= (opts.max ?? 99)) break;
    if (rs() > p || !lonely(c, x, y, opts.rad ?? 1)) continue;
    if (stand(c, pick(), x, y)) n += 1;
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
    default: return false;
  }
}

/**
 * 통로 장식(2026-10-15). true 면 이 파일이 다 꾸민 통로(공통 규칙의 배수 창살·뼈 흩뿌림을 건너뛴다).
 * 광산: 선로 줄 위에 광차 한두 대, 갱목 틀(선반 조각)을 양 벽 쪽에 쌍으로 세우고 램프. 동굴·화산: 창살(하수구 그림) 대신 잔돌만.
 */
export function dressCorridor(c: DressCtx, type: DungeonType, cor: PlacedCorridor, rs: () => number): boolean {
  const r = cor.rect;
  if (type === "cave" || type === "volcano") {
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (hashDoor(c, x, y) || rs() > 0.05) continue;
      stand(c, type === "volcano" ? VC("ember-a") : CV("rubble-cave"), x, y);
    }
    return true;
  }
  if (type !== "mine") return false;
  const horizontal = cor.dir === "E" || cor.dir === "W";
  if (!horizontal) {
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 3) if (rs() < 0.5) stand(c, MV("barrel"), r.x + (rs() < 0.5 ? 0 : r.w - 1), y);
    return true;
  }
  const trackY = r.y + Math.floor(r.h / 2);
  // 광차: 선로 줄 위(통로 한가운데 줄이 널판이다), 너무 붙지 않게.
  if (r.w >= 8 && rs() < 0.7) c.put(MV("cart-h"), r.x + 2 + Math.floor(rs() * (r.w - 5)), trackY - 1);
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
      const e = c.shuffle(rs, c.floorCells(rr, 1)).filter(([x, y]) => free(c, x, y) && lonely(c, x, y, 1));
      const at = e[0]; if (!at) continue;
      c.cluster(rs, at[0], at[1], 4, [[TEMPLE_RUBBLE, 4], [CC("rubble"), 1], [SW("bones"), 1]]);
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
      for (const dx of [2, 5]) { const q = slots.find((t) => t.x === cx - dx), q2 = slots.find((t) => t.x === cx + dx); if (q && q2 && c.put(dx === 2 ? TORCH : SW("banner-cult"), q.x, q.y)) c.put(dx === 2 ? TORCH : SW("banner-cult"), q2.x, q2.y); }
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
        for (const d of [2, 4]) { const l = slots.find((q) => q.x === altar[0] - d + 0), rr = slots.find((q) => q.x === altar[0] + 1 + d); if (l && rr && c.put(SW("banner-cult"), l.x, l.y)) c.put(SW("banner-cult"), rr.x, rr.y); }
        c.put(SW("candles"), altar[0] - 1, altar[1] + 1); c.put(SW("candles"), altar[0] + 2, altar[1] + 1);
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
      c.putAny(SW("altar-cult"), [0, -1, 1].map((d) => [cx - 1 + d, r.y] as [number, number]));
      mirrorPut(c, TEMPLE_COL, cx, 3, r.y + r.h - 3);
      c.put(SW("candles"), cx - 3, r.y + 1); c.put(SW("candles"), cx + 2, r.y + 1);
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
      const e = c.edgeCells(r, rs);
      c.cluster(rs, e[0]?.[0] ?? r.x + 1, e[0]?.[1] ?? r.y + 1, 3, [[MV("barrel"), 2], [MV("crates"), 1], [SW("crate"), 2]]);
      if (e[3]) stand(c, MV("cart"), e[3][0], e[3][1]);
      if (e[6] && rs() < 0.7) lampAt(e[6][0], e[6][1]);
      return true;
    }
    case "junction": {
      // 갈림 방: 선로 줄 위에 광차, 벽에 램프, 가장자리에 광석·통
      const cart = [r.x + 2, r.x + r.w - 4];
      if (rs() < 0.8) c.put(MV("cart-h"), cart[Math.floor(rs() * 2)]!, trackY - 1);
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
      for (const [x, y] of [[cx - 4, r.y + 3], [cx + 3, r.y + 3]] as const) lampAt(x, y);
      sprinkle(c, rs, r, 0.04, () => c.weighted(rs, [[SW("bones"), 2], [SW("skulls"), 1], [MV("slagrock"), 2]]), { inset: 2, max: 4 });
      c.hangAlong(slots, rs, 4, () => TORCH, 3);
      return true;
    }
    case "vault": {
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

// ---------------------------------------------------------------- 자연 동굴

const MUSH = CV("glow-mushroom");
function vinesOnWalls(c: DressCtx, rs: () => number, slots: Slot[], n: number, kitId = CV("vines-2")) {
  let k = 0;
  for (const q of c.shuffle(rs, slots)) { if (k >= n) break; if (lonely(c, q.x, q.y, 1) && c.put(kitId, q.x, q.y)) k += 1; }
}

/** 소굴 야영지: 방 바닥 가운데 쪽 모닥불, 벽가 가죽 걸이·궤짝·통·자루 무더기, 흩어진 뼈. 보스방(chief)은 무더기를 더 쌓는다. */
function lairCamp(c: DressCtx, r: PlacedRoom, rs: () => number, edge: [number, number][], chief: boolean): void {
  const FIRE = c.hasKit("bd-pick-deep-forest-path-campfire") ? "bd-pick-deep-forest-path-campfire" : "bd-pick-shipwreck-reef-campfire";
  const inner = c.shuffle(rs, c.floorCells(r, 3));
  // 큰 방(우두머리 방·넓은 굴)엔 천막 하나 — 「누가 사는 곳」이 한눈에 읽힌다.
  if ((chief || r.w * r.h >= 150) && c.hasKit("bd-pick-desert-oasis-tent")) {
    for (const [x, y] of inner) if (lonely(c, x, y, 3) && lonely(c, x + 3, y, 2) && stand(c, "bd-pick-desert-oasis-tent", x, y)) break;
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
  const goods: readonly (readonly [string, number])[] = [["bd-pick-deep-forest-path-hide-rack", 2], [SW("crate-stack"), 3], [SW("barrel"), 3], ["bd-pick-walled-market-sack-pile", 2], [SW("bone-heap"), chief ? 2 : 1]];
  let n = 0;
  for (const [x, y] of edge) { if (n >= (chief ? 6 : 4)) break; if (rs() < 0.55 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, goods), x, y)) n += 1; }
  sprinkle(c, rs, r, 0.03, () => c.weighted(rs, [[SW("bones"), 3], [SW("skulls"), 1]]), { inset: 2, max: chief ? 4 : 2 });
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

function dressCave(c: DressCtx, r: PlacedRoom, rs: () => number, s: Slot | null, slots: Slot[]): boolean {
  const spikes = () => c.weighted(rs, [[CV("stalagmite-1"), 4], [CV("rock-pillar-2"), 1], [CV("rubble-cave"), 3]]);
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
      for (const [x, y] of e.slice(0, 8)) if (rs() < 0.45 && lonely(c, x, y, 1)) stand(c, spikes(), x, y);
      mossPatch(e, 3);
      entranceCamp(c, r, rs, s);
      return true;
    }
    case "cavern": {
      const e = c.edgeCells(r, rs);
      if (c.lair) lairCamp(c, r, rs, e, false);
      let n = 0; for (const [x, y] of e) { if (n >= 7) break; if (rs() < 0.5 && lonely(c, x, y, 1) && stand(c, spikes(), x, y)) n += 1; }
      sprinkle(c, rs, r, 0.03, spikes, { inset: 2, rad: 2, max: 3 });
      if (!c.lair) { mossPatch(e, 4); mossPatch(c.floorCells(r, 2), 3); }
      if (rs() < 0.7) { for (const [x, y] of shoreCells(c, r).slice(0, 3)) stand(c, MUSH, x, y); }
      vinesOnWalls(c, rs, slots, 3);
      c.hangAlong(slots, rs, 7, () => TORCH, 1);
      return true;
    }
    case "lake": {
      const shore = c.shuffle(rs, shoreCells(c, r));
      let boat = false;
      for (const [x, y] of shore) {
        if (!boat && lonely(c, x, y, 2) && c.isWalk(x + 1, y) && stand(c, CV("boat"), x, y)) { boat = true; continue; }
      }
      let n = 0; for (const [x, y] of shore) { if (n >= 6) break; if (rs() < 0.45 && lonely(c, x, y, 1) && stand(c, c.weighted(rs, [[MUSH, 4], [CV("driftwood"), 1], [CV("dock-post"), 1], [CV("rubble-cave"), 2]]), x, y)) n += 1; }
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 8)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, spikes(), x, y);
      vinesOnWalls(c, rs, slots, 4);
      return true;
    }
    case "grotto": {
      const e = c.edgeCells(r, rs);
      if (c.lair) { lairCamp(c, r, rs, e, false); return true; }
      mossPatch(e, 6); mossPatch(c.floorCells(r, 1), 5);
      for (const [x, y] of e.slice(0, 6)) if (rs() < 0.5 && lonely(c, x, y, 1)) stand(c, glow(), x, y);
      sprinkle(c, rs, r, 0.04, () => c.weighted(rs, [[SW("bones"), 2], [SW("skulls"), 1], [CV("rubble-cave"), 2]]), { max: 3 });
      vinesOnWalls(c, rs, slots, 3);
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
      for (const [x, y] of e.slice(0, 12)) if (rs() < 0.6 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[CV("stalagmite-1"), 4], [CV("rock-pillar-2"), 2]]), x, y);
      if (e[0]) stand(c, SW("bone-heap"), e[0][0], e[0][1]);
      if (c.lair) lairCamp(c, r, rs, e.slice(1), true);
      sprinkle(c, rs, r, 0.04, () => c.weighted(rs, [[SW("bones"), 2], [SW("skulls"), 2]]), { inset: 2, max: 5 });
      vinesOnWalls(c, rs, slots, 4);
      c.hangAlong(slots, rs, 5, () => TORCH, 2);
      return true;
    }
    case "vault": {
      mossPatch(c.floorCells(r, 1), 6);
      const e = c.edgeCells(r, rs);
      for (const [x, y] of e.slice(0, 5)) if (rs() < 0.6 && lonely(c, x, y, 1)) stand(c, c.weighted(rs, [[MUSH, 3], [CV("stalagmite-1"), 2], [CV("rubble-cave"), 1]]), x, y);
      return true;
    }
    default: return false;
  }
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
