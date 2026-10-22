/**
 * 버들항 마을 성벽 둘레(3판, 2026-10-22). 칸 그림은 scripts/content/beodeul-wall/wall_art.py(코드 손 도트)를 bake_wall.py 가
 * 버들항 시트 꼬리 28,544~ 에 구웠다. 조각 이름 → 칸 번호는 src/assets/beodeulTownWallPieces.json(굽기가 쓴다).
 *
 * 둘레 규칙은 bake_wall.py 의 plan_ring 과 같다(조립 예 키트 bd-wall-ring-sample 이 그 결과다):
 * - 통로 사각형 북 y0 · 남 y1 · 서 x0 · 동 x1. 가로 성벽(북·남)은 윗면 두 줄(판석 통로 + 흉벽) + 그 아래 앞면 네 줄(64px — 단층 민가보다 높다),
 *   세로 성벽(서·동)은 두 열 폭 윗면(x0·x0+1, x1−1·x1). 모서리는 2×2.
 * - 북쪽 성벽은 마을 쪽 앞면(뒤 흉벽 hn), 남쪽 성벽은 바깥 앞면(앞 흉벽 hs). 서·동 성벽은 위만 보인다(3/4).
 * - 가로 성벽을 길이 지나는 곳은 4×8 성문루(가운데 두 열이 통로, yw−1 부터 — 안쪽 길 칸에 터널 입 그늘 mo_n),
 *   세로 성벽을 길이 지나는 곳은 쪽문 터널(윗면은 덮개돌 *_pt_* 로 잇고 ★, 양옆 땅에 터널 입 그늘 mo_w·mo_e — 3판 r8, 예전 끝 마감 틈은 「뚫린 성벽」으로 읽혔다).
 * - 망루 3×9 는 가로 성벽 줄에(윗면 플랫폼이 통로 줄 위로 두 줄 솟고, 앞면이 성벽 앞으로 한 줄 내민다 — 망루 윗면이 성벽 흉벽보다 한 줄 위에 선다.
 *   통로가 망루 밑을 ★ 로 지난다). 망루·성문루 윗면 소품은 자리마다 변형(tower·tower1·tower2, gate·gate1).
 * - 기후 변형: 같은 조각 이름 앞에 snow:(눈 덮인 성벽) · desert:(사막 사암 성벽). stampTownWall 의 biome 으로 고른다.
 *   계단은 북쪽 성벽 앞면 네 줄에 붙인 3×4 옆 계단(왼쪽 아래 땅 → 오른쪽 위 통로, 머리 = 윗면 아래 줄 sx+2).
 * - 땅 그림자 sh_* 는 2층(앞면 밑 줄 · 세로 성벽 오른쪽 열), 이미 2·3층에 무엇이 있는 칸에는 두지 않는다.
 */
import type { GameMap, TilesetDef } from "@/project/types";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import pieces from "@/assets/beodeulTownWallPieces.json";

const TILES = (pieces as { tiles: Record<string, number> }).tiles;
const LOWER = new Set((pieces as { lower: string[] }).lower);
export const BEODEUL_TOWN_WALL_FIRST_TILE = (pieces as { base: number }).base;

export interface WallGate { side: "N" | "S"; x: number; closed?: boolean }
export interface WallGap { side: "W" | "E"; y: number; rows: number }
export interface WallTower { side: "N" | "S"; x: number; corner?: boolean }
export type TownWallBiome = "snow" | "desert" | null;
export interface TownWallPlan {
  x0: number; y0: number; x1: number; y1: number;
  gates: WallGate[]; gaps: WallGap[]; towers: WallTower[]; stairs: number[];
}
export type Cells = Map<string, string>;
const key = (x: number, y: number) => `${x},${y}`;
/** bake_wall.py 의 hsh 와 같은 값(곱셈 뒤 섞기 — 곱셈만 쓰면 6칸 주기로 같은 변형이 돌아왔다). */
const hsh = (x: number, y: number, salt: number) => {
  let h = Math.imul(x * 31 + y * 17 + salt * 101 + 7, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  return h & 0xffff;
};
const FACE_ROWS = ["u", "m", "n", "l"] as const;
/** 앞면 줄 수(4)와 성문루·망루 높이(8 = 플랫폼이 한 줄 솟고 + 윗면 둘 + 앞면 넷 + 한 줄 앞으로 내민다). */
const NF = FACE_ROWS.length, GH = 2 + NF + 2, FB = 2 + NF;
/** 망루 높이(9): 플랫폼이 두 줄 솟는다. 윗면 소품 변형 수(망루 3 · 성문루 2) — bake_wall.py 와 같다. */
const GT = GH + 1, TOWER_VARS = 3, GATE_VARS = 2;
/** corner = "w"(서쪽 모서리 망루) · "e"(동쪽): 바깥 열의 통로 두 줄(cy 2·3)은 바깥쪽 걸음을 막은 조각 — 안 막으면 성 밖 땅에서 망루 밑 통로로 들어온다. */
const towerName = (v: number, cx: number, cy: number, corner = "") => {
  const c = corner && (cy === 2 || cy === 3) && cx === (corner === "w" ? 0 : 2) ? corner : "";
  return `tower${v === 0 || cy >= 3 ? "" : v}${c}_${cx}_${cy}`;
};
const gateName = (v: number, cx: number, cy: number, shut = false) => {
  if (shut && cy >= 3 && (cx === 1 || cx === 2)) return `gatec_${cx}_${cy}`;
  const own = cy < 3 || ((cy === 3 || cy === 4) && (cx === 0 || cx === 3)); // 변형 1 은 윗면 + 방패 건 앞면 기둥
  return `gate${v && own ? v : ""}_${cx}_${cy}`;
};

/** 둘레 계획 → 위층(3층)·아래층(2층) 칸별 조각 이름. 성문 터널 칸과 땅 그림자는 아래층이다. */
export function planTownWallRing(p: TownWallPlan): { up: Cells; lo: Cells } {
  const up: Cells = new Map(), lo: Cells = new Map();
  const { x0, y0, x1, y1 } = p;
  // 마을 쪽(북쪽 성벽 안쪽) 앞면에는 화살 구멍 변형 c 를 쓰지 않는다. 바로 왼쪽 열과 같은 변형이면 다음 변형(같은 칸이 나란히 서지 않게)
  const fvar = (x: number, town: boolean) => {
    // 열마다 1~(n−1) 단씩 걸어가는 누적 합 — 이웃 열은 늘 다르고, 값은 x 만으로 정해진다(bake_wall.py 와 같다)
    // 3판 r9: 변형 여덟(a b c e f g h + 드문 d 물빼기 구멍) — 넷이면 긴 앞면이 4칸 주기로 보였다
    if (hsh(x, 1, 4) % 13 === 0) return "d";
    const vs = town ? "abefgh" : "abcefgh", n = vs.length;
    let acc = 0;
    for (let i = 0; i <= Math.max(0, x); i += 1) acc += 1 + (hsh(i, 0, 3) % (n - 1));
    return vs[acc % n]!;
  };
  const face = (x: number, y: number, k: string, kind = "", town = false) => up.set(key(x, y), kind ? `f_${k}_${kind}` : `f_${k}_${fvar(x, town)}`);
  for (let x = x0; x <= x1; x += 1) {
    if (x0 + 1 < x && x < x1 - 1) {
      let v = hsh(x, y0, 1) % 4;
      up.set(key(x, y0), `hn${v}_a`); up.set(key(x, y0 + 1), `hn${v}_b`);
      v = hsh(x, y1, 1) % 4;
      up.set(key(x, y1), `hs${v}_a`); up.set(key(x, y1 + 1), `hs${v}_b`);
      FACE_ROWS.forEach((k, i) => face(x, y0 + 2 + i, k, x === x0 + 2 ? "shL" : "", true));
    }
    FACE_ROWS.forEach((k, i) => face(x, y1 + 2 + i, k, x === x0 ? "endL" : x === x1 ? "endR" : ""));
  }
  for (const [k, cx0, cy0] of [["nw", x0, y0], ["ne", x1 - 1, y0], ["sw", x0, y1], ["se", x1 - 1, y1]] as const)
    for (let cy = 0; cy < 2; cy += 1) for (let cx = 0; cx < 2; cx += 1) up.set(key(cx0 + cx, cy0 + cy), `c_${k}_${cx}${cy}`);
  for (let y = y0 + 2; y < y1; y += 1) {
    let r = hsh(y, 0, 6) % 4;
    up.set(key(x0, y), `vw${r}_0`); up.set(key(x0 + 1, y), `vw${r}_1`);
    r = hsh(y, 1, 6) % 4;
    up.set(key(x1 - 1, y), `ve${r}_0`); up.set(key(x1, y), `ve${r}_1`);
  }
  const shadeRight = (x: number, yw: number) => {
    if (up.get(key(x, yw))?.startsWith("hs")) { up.set(key(x, yw), "hs_sh_a"); up.set(key(x, yw + 1), "hs_sh_b"); }
    FACE_ROWS.forEach((k, i) => {
      const n = up.get(key(x, yw + 2 + i));
      if (n?.startsWith("f_") && !n.endsWith("endL") && !n.endsWith("endR")) up.set(key(x, yw + 2 + i), `f_${k}_shL`);
    });
  };
  // 변형은 목록 순서로 돌려 쓴다(이웃 망루·성문루가 같은 윗면이 되지 않게 — r8: 해시로 고르니 세 망루가 같았다)
  const g0 = p.gates[0] ? hsh(p.gates[0].x, 0, 6) : 0, t0 = p.towers[0] ? hsh(p.towers[0].x, 0, 5) : 0;
  for (const [gi, g] of p.gates.entries()) {
    const yw = g.side === "S" ? y1 : y0, v = (g0 + gi) % GATE_VARS;
    for (let cx = 0; cx < 4; cx += 1) for (let cy = 0; cy < GH; cy += 1) {
      const k = key(g.x - 1 + cx, yw - 1 + cy);
      up.delete(k); lo.delete(k);
      const n = gateName(v, cx, cy, g.closed === true);
      (LOWER.has(n) ? lo : up).set(k, n);
    }
    shadeRight(g.x + 3, yw);
    // 통로가 성문루 플랫폼 밑으로 들어가는 칸(성문루 뒤)의 터널 입 그늘
    if (!g.closed) for (const cx of [g.x, g.x + 1]) lo.set(key(cx, yw - 2), "mo_n");
  }
  for (const [ti, t] of p.towers.entries()) {
    const yw = t.side === "S" ? y1 : y0, v = (t0 + ti) % TOWER_VARS;
    const corner = t.x === x0 ? "w" : t.x === x1 - 2 ? "e" : "";
    for (let cx = 0; cx < 3; cx += 1) for (let cy = 0; cy < GT; cy += 1) up.set(key(t.x + cx, yw - 2 + cy), towerName(v, cx, cy, corner));
    shadeRight(t.x + 3, yw);
  }
  for (const g of p.gaps) {
    // 쪽문 터널: 성벽 윗면은 덮개돌로 잇고(★ — 사람이 밑으로 지난다), 양옆 땅에 터널 입 그늘
    const xa = g.side === "W" ? x0 : x1 - 1, e = g.side === "W" ? "vw" : "ve";
    for (let i = 0; i < g.rows; i += 1) {
      up.set(key(xa, g.y + i), `${e}_pt_0`); up.set(key(xa + 1, g.y + i), `${e}_pt_1`);
      lo.set(key(xa - 1, g.y + i), "mo_w"); lo.set(key(xa + 2, g.y + i), "mo_e");
    }
  }
  // 옆 계단 3×4: 왼쪽 아래(sx, y0+5) 땅에서 오른쪽 위(sx+2, y0+2) → 통로(sx+2, y0+1)
  for (const sx of p.stairs) {
    up.set(key(sx + 2, y0 + 1), "hn_stair");
    FACE_ROWS.forEach((k, i) => { for (let cx = 0; cx < 3; cx += 1) up.set(key(sx + cx, y0 + 2 + i), `stair_${cx}_${k}`); });
  }
  // 땅 그림자(2층): 성벽 칸이 아닌 땅에만
  const sh = new Map<string, string>();
  const putSh = (x: number, y: number, k: string) => {
    const c = key(x, y);
    if (up.has(c) || lo.has(c)) return;
    const old = sh.get(c);
    sh.set(c, old && old !== k ? "se" : k);
  };
  for (let x = x0 + 2; x < x1 - 1; x += 1) putSh(x, y0 + FB, "s");
  for (let x = x0; x <= x1; x += 1) putSh(x, y1 + FB, "s");
  const gapRow = (side: "W" | "E", y: number) => p.gaps.some((g) => g.side === side && y >= g.y && y < g.y + g.rows);
  for (let y = y0 + FB; y < y1; y += 1) if (!gapRow("W", y)) putSh(x0 + 2, y, "e");
  for (let y = y0; y < y1 + FB; y += 1) if (!gapRow("E", y)) putSh(x1 + 1, y, "e");
  for (const t of p.towers) { const yw = t.side === "S" ? y1 : y0; for (let cx = 0; cx < 3; cx += 1) putSh(t.x + cx, yw + FB + 1, "s"); putSh(t.x + 3, yw + FB, "se"); }
  for (const g of p.gates) { const yw = g.side === "S" ? y1 : y0; for (let cx = 0; cx < 4; cx += 1) putSh(g.x - 1 + cx, yw + FB + 1, "s"); putSh(g.x + 3, yw + FB, "se"); }
  for (const [c, k] of sh) lo.set(c, `sh_${k}`);
  return { up, lo };
}

/** 칸 번호가 그 조각인지(버들항 시트에 3판 성벽 꼬리가 실려 있는지) 확인한다. */
export function townWallAvailable(ts: TilesetDef | undefined): boolean {
  if (!ts) return false;
  const last = Math.max(...Object.values(TILES));
  return ts.count > last && (ts.tileMeta?.[TILES.hs0_a!]?.label ?? "").includes("성벽");
}

/** 계획을 맵에 싣는다: 위층 조각은 3층, 아래층 조각은 2층. 성벽 칸의 2·4층(풀꽃·그림자 덧그림)은 비운다. 바뀐 칸 수.
 * biome 이 snow·desert 면 그 기후 변형 조각(snow:… · desert:…)을 쓴다 — 그림자·터널 입 그늘처럼 변형이 없는 조각은 기본 그대로. */
export function stampTownWall(map: GameMap, plan: TownWallPlan, biome: TownWallBiome = null): number {
  const { up, lo } = planTownWallRing(plan);
  const W = map.width, H = map.height;
  let n = 0;
  const tileOf = (name: string) => (biome ? TILES[`${biome}:${name}`] : undefined) ?? TILES[name];
  const at = (k: string) => { const [x, y] = k.split(",").map(Number) as [number, number]; return x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x; };
  for (const [k, name] of up) {
    const c = at(k), t = tileOf(name); if (c < 0 || t === undefined) continue;
    setLayerTileAt(map, 4, c, -1); if (!lo.has(k)) setLayerTileAt(map, 2, c, -1);
    setLayerTileAt(map, 3, c, t); n += 1;
  }
  for (const [k, name] of lo) {
    const c = at(k), t = tileOf(name); if (c < 0 || t === undefined) continue;
    if (name.startsWith("sh_") || name.startsWith("mo_")) {
      // 그림자·터널 입 그늘은 빈 땅에만: 2·3층에 무엇(집·나무·길 장식)이 있으면 두지 않는다
      if (layerTileAt(map, 2, c) >= 0 || layerTileAt(map, 3, c) >= 0) continue;
      setLayerTileAt(map, 2, c, t); n += 1; continue;
    }
    setLayerTileAt(map, 2, c, t); n += 1;
    // 아래층 성문 칸은 위층을 비운다(나무 덧그림이 통로를 막지 않게)
    if (!up.has(k)) setLayerTileAt(map, 3, c, -1);
  }
  return n;
}

/**
 * 둘레 자리: 통로 사각형(서 1 · 북 2 · 동 W-2 · 남 H-8)과 망루 후보 자리(seed 로 두 칸까지 비켜 선다 — 마을마다 같은 틀로 찍힌 듯 보이지 않게). inBand = 마을 시공이 집·나무·소품을 앉히지 않는 칸
 * (세로 성벽 두 열과 그 밖 + 북쪽 윗면·앞면 여섯 줄과 그 앞 땅 한 줄 + 남쪽 성문루·망루 머리 한 줄부터 아래). 길은 이 띠를 지나도 된다 — 지나는 곳이 성문·틈이 된다.
 */
export function townWallLayout(W: number, H: number, seed = 0): { x0: number; y0: number; x1: number; y1: number; towers: WallTower[]; inBand: (x: number, y: number) => boolean } {
  const x0 = 1, y0 = 2, x1 = W - 2, y1 = H - 2 - FB;
  const j = (i: number) => (hsh(seed & 0xffff, i, 8) % 5) - 2;
  // 망루 수·간격도 seed 로(3판 r9 — 세 마을이 같은 틀로 찍힌 듯 보였다). 성문과 겹치는 자리는 마을 시공이 뺀다.
  const SOUTH = [[0.2, 0.8], [0.15, 0.38, 0.62, 0.85], [0.27, 0.73]], NORTH = [[0.28, 0.72], [0.2, 0.5, 0.8], [0.36, 0.64]];
  const towers: WallTower[] = [];
  for (const [side, opts, salt] of [["S", SOUTH, 1], ["N", NORTH, 2]] as const)
    for (const f of opts[hsh(seed & 0xffff, salt, 9) % opts.length]!) towers.push({ side, x: Math.round(W * f) - 1 + j(towers.length) });
  // 모서리 망루(seed 로 없음 · 남쪽 둘 · 넷 · 북쪽 둘): 모서리 2×2 와 이어진 앞면·세로 성벽 끝을 망루 3×9 가 덮는다(r9 「모서리에 망루가 없다」)
  const corners = [[], ["S"], ["S", "N"], ["N"]][hsh(seed & 0xffff, 3, 9) % 4] as ("S" | "N")[];
  for (const side of corners) towers.push({ side, x: x0, corner: true }, { side, x: x1 - 2, corner: true });
  // 남쪽 망루 윗면은 성벽 통로 위로 두 줄 솟는다(y1−2) — 그 세 칸에도 집·나무를 앉히지 않는다
  const southTop = (x: number, y: number) => y === y1 - 2 && towers.some((t) => t.side === "S" && x >= t.x && x <= t.x + 2);
  return { x0, y0, x1, y1, towers, inBand: (x, y) => x <= x0 + 1 || x >= x1 - 1 || y <= y0 + FB || y >= y1 - 1 || southTop(x, y) };
}
