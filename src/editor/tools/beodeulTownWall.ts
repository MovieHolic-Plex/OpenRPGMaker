/**
 * 버들항 마을 성벽 둘레(2026-10-22). 칸 그림은 scripts/content/beodeul-wall/wall_art.py(행 문자열 손 도트)를 bake_wall.py 가
 * 버들항 시트 꼬리 28,544~ 에 구웠다. 조각 이름 → 칸 번호는 src/assets/beodeulTownWallPieces.json(굽기가 쓴다).
 *
 * 둘레 규칙은 bake_wall.py 의 plan_ring 과 같다(조립 예 키트 bd-wall-ring-sample 이 그 결과다):
 * - 통로 사각형 북 y0 · 남 y1 · 서 x0 · 동 x1. 가로 성벽(북·남)은 통로 한 줄 + 그 아래 앞면 두 줄, 세로 성벽(서·동)은 통로 한 열.
 * - 북쪽 성벽은 마을 쪽 앞면(뒤 흉벽 hn), 남쪽 성벽은 바깥 앞면(앞 흉벽 hs). 서·동 성벽은 위만 보인다(3/4).
 * - 가로 성벽을 길이 지나는 곳은 4×4 성문루(가운데 두 열이 통로), 세로 성벽을 길이 지나는 곳은 끝 마감 틈.
 * - 망루 2×7 은 가로 성벽 줄에(지붕이 통로 줄 위로 세 줄 솟고, 앞면이 성벽 앞으로 6px 내민다 — 마지막 줄은 밑동·그림자), 계단은 북쪽 성벽 앞면 두 칸 자리에.
 */
import type { GameMap, TilesetDef } from "@/project/types";
import { setLayerTileAt } from "@/project/mapLayers";
import pieces from "@/assets/beodeulTownWallPieces.json";

const TILES = (pieces as { tiles: Record<string, number> }).tiles;
const LOWER = new Set((pieces as { lower: string[] }).lower);
export const BEODEUL_TOWN_WALL_FIRST_TILE = (pieces as { base: number }).base;

export interface WallGate { side: "N" | "S"; x: number; closed?: boolean }
export interface WallGap { side: "W" | "E"; y: number; rows: number }
export interface WallTower { side: "N" | "S"; x: number }
export interface TownWallPlan {
  x0: number; y0: number; x1: number; y1: number;
  gates: WallGate[]; gaps: WallGap[]; towers: WallTower[]; stairs: number[];
}
export type Cells = Map<string, string>;
const key = (x: number, y: number) => `${x},${y}`;

/** 둘레 계획 → 위층(3층)·아래층(2층) 칸별 조각 이름. 성문루 통로 칸은 아래층에도 바닥이 들어간다. */
export function planTownWallRing(p: TownWallPlan): { up: Cells; lo: Cells } {
  const up: Cells = new Map(), lo: Cells = new Map();
  const { x0, y0, x1, y1 } = p;
  const face = (x: number, y: number, k: "u" | "l", left = "", right = "") => {
    let n: string;
    if (left === "end" && right === "end") n = `f_${k}_col`;
    else if (left === "end") n = `f_${k}_endL`;
    else if (right === "end") n = `f_${k}_endR`;
    else if (left === "sh") n = `f_${k}_shL`;
    else if (right === "ab") n = `f_${k}_abR`;
    else n = `f_${k}_${"abc"[(x * 7 + y * 3) % 3]}`;
    up.set(key(x, y), n);
  };
  for (let x = x0; x <= x1; x += 1) {
    up.set(key(x, y0), x === x0 ? "c_nw" : x === x1 ? "c_ne" : "hn");
    up.set(key(x, y1), x === x0 ? "c_sw" : x === x1 ? "c_se" : "hs");
    if (x0 < x && x < x1) {
      face(x, y0 + 1, "u", x === x0 + 1 ? "sh" : "", x === x1 - 1 ? "ab" : "");
      face(x, y0 + 2, "l", x === x0 + 1 ? "sh" : "", x === x1 - 1 ? "ab" : "");
    }
    face(x, y1 + 1, "u", x === x0 ? "end" : "", x === x1 ? "end" : "");
    face(x, y1 + 2, "l", x === x0 ? "end" : "", x === x1 ? "end" : "");
  }
  for (let y = y0 + 1; y < y1; y += 1) { up.set(key(x0, y), "vw"); up.set(key(x1, y), "ve"); }
  const shadeRight = (x: number, yw: number) => {
    const n = up.get(key(x, yw));
    if (n === "hs" || n === "hn") up.set(key(x, yw), `${n}_shL`);
    for (const [dy, k] of [[1, "u"], [2, "l"]] as const) if (up.get(key(x, yw + dy))?.startsWith("f_")) up.set(key(x, yw + dy), `f_${k}_shL`);
  };
  for (const g of p.gates) {
    const yw = g.side === "S" ? y1 : y0;
    for (let cx = 0; cx < 4; cx += 1) for (let cy = 0; cy < 4; cy += 1) {
      const x = g.x - 1 + cx, y = yw - 1 + cy, k = key(x, y);
      up.delete(k); lo.delete(k);
      if (g.closed && cy >= 1 && (cx === 1 || cx === 2)) { const n = `gatec_${cx}_${cy}`; (LOWER.has(n) ? lo : up).set(k, n); continue; }
      const n = `gate_${cx}_${cy}`;
      (LOWER.has(n) ? lo : up).set(k, n);
      if (cy === 0 && (cx === 1 || cx === 2)) lo.set(k, `gate_floor_${cx}`);
      if (cy === 1 && (cx === 1 || cx === 2) && !g.closed) lo.set(k, `gate_dark_${cx}`);
    }
    shadeRight(g.x + 3, yw);
  }
  for (const g of p.gaps) {
    const x = g.side === "W" ? x0 : x1, e = g.side === "W" ? "vw" : "ve";
    up.set(key(x, g.y - 3), `${e}_endS`); up.set(key(x, g.y - 2), "f_u_col"); up.set(key(x, g.y - 1), "f_l_col");
    for (let i = 0; i < g.rows; i += 1) up.delete(key(x, g.y + i));
    up.set(key(x, g.y + g.rows), `${e}_endN`);
  }
  for (const t of p.towers) {
    const yw = t.side === "S" ? y1 : y0;
    for (let cx = 0; cx < 2; cx += 1) for (let cy = 0; cy < 7; cy += 1) up.set(key(t.x + cx, yw - 3 + cy), `tower_${cx}_${cy}`);
    shadeRight(t.x + 2, yw);
  }
  for (const sx of p.stairs) { up.set(key(sx, y0), "hn_stair"); up.set(key(sx, y0 + 1), "stair_u"); up.set(key(sx, y0 + 2), "stair_l"); }
  return { up, lo };
}

/** 칸 번호가 그 조각인지(버들항 시트에 성벽 꼬리가 실려 있는지) 확인한다. */
export function townWallAvailable(ts: TilesetDef | undefined): boolean {
  if (!ts) return false;
  const last = Math.max(...Object.values(TILES));
  return ts.count > last && (ts.tileMeta?.[TILES.hs!]?.label ?? "").includes("성벽");
}

/** 계획을 맵에 싣는다: 위층 조각은 3층, 아래층 조각은 2층. 성벽 칸의 2·4층(풀꽃·그림자 덧그림)은 비운다. 바뀐 칸 수. */
export function stampTownWall(map: GameMap, plan: TownWallPlan): number {
  const { up, lo } = planTownWallRing(plan);
  const W = map.width, H = map.height;
  let n = 0;
  const put = (cells: Cells, layer: 2 | 3) => {
    for (const [k, name] of cells) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const t = TILES[name]; if (t === undefined) continue;
      const c = y * W + x;
      if (layer === 3) { setLayerTileAt(map, 4, c, -1); if (!lo.has(k)) setLayerTileAt(map, 2, c, -1); }
      setLayerTileAt(map, layer, c, t); n += 1;
    }
  };
  put(lo, 2); put(up, 3);
  // 아래층 성문 칸은 위층을 비운다(나무 덧그림이 통로를 막지 않게)
  for (const k of lo.keys()) if (!up.has(k)) { const [x, y] = k.split(",").map(Number) as [number, number]; if (x >= 0 && y >= 0 && x < W && y < H) setLayerTileAt(map, 3, y * W + x, -1); }
  return n;
}

/**
 * 둘레 자리: 통로 사각형(서 1 · 북 3 · 동 W-2 · 남 H-4)과 망루 후보 자리. inBand = 마을 시공이 집·나무·소품을 앉히지 않는 칸
 * (사각형 밖 + 북쪽 앞면 두 줄 + 남쪽 성문루 머리 한 줄 + 남쪽 망루 지붕 세 줄). 길은 이 띠를 지나도 된다 — 지나는 곳이 성문·틈이 된다.
 */
export function townWallLayout(W: number, H: number): { x0: number; y0: number; x1: number; y1: number; towers: WallTower[]; inBand: (x: number, y: number) => boolean } {
  const x0 = 1, y0 = 3, x1 = W - 2, y1 = H - 4;
  const towers: WallTower[] = [
    { side: "S", x: Math.round(W * 0.22) - 1 }, { side: "S", x: Math.round(W * 0.78) - 1 },
    { side: "N", x: Math.round(W * 0.3) - 1 }, { side: "N", x: Math.round(W * 0.7) - 1 },
  ];
  const southCols = new Set(towers.filter((t) => t.side === "S").flatMap((t) => [t.x, t.x + 1]));
  const northCols = new Set(towers.filter((t) => t.side === "N").flatMap((t) => [t.x, t.x + 1]));
  return { x0, y0, x1, y1, towers, inBand: (x, y) => x <= x0 || x >= x1 || y <= y0 + 2 || y >= y1 - 1 || (y >= y1 - 3 && southCols.has(x)) || (y === y0 + 3 && northCols.has(x)) };
}
