// editor/tools/beodeulTerrain.ts — 버들항 마을 시공기의 0단계 「지형」(2026-10-11).
//
// 왜: 마을을 다 지은 뒤 남은 가장자리를 올리고 계단을 떨구던 방식(언덕이 마을과 무관한 장식, 계단은 아무 데도 안 이어짐)을
// 사용자가 「지형을 먼저 기획하고 그 위에 마을을 만들어야 한다」고 짚었다. 여기서 단 높이 격자를 먼저 만들고,
// 마을 시공기(beodeulVillage.ts)가 물·길·집·밭을 그 위에 앉힌다. 길이 단을 건너는 곳은 매끈한 경사로(코드 1~4)로 오른다.
//
// 지형 이름(terrain)은 AI 가 고르는 선택지이고 모양은 이 함수가 정한다(같은 seed = 같은 지형).
//   flat      평지.
//   highland  높은 산비탈(river) — terraces 와 같은 동서 등고선을 7칸 간격으로 세 단까지(산골).
//   terraces  계단식 비탈 — 큰길 북쪽 집 띠 뒤로 한 단, 그 뒤로 또 한 단. 강은 높은 단을 곧게 깎은 골(0단)로 흐른다.
//   hillside  설원 비탈 — terraces 와 같은 모양(눈 덮인 계단식 언덕), 얼음 못은 골.
//   basin     오아시스 골 — 북쪽 모래 단을 오아시스 둘레만 곧게 깎아 낮춘 골.
//   ridge     마른 둔덕(늪) — 북쪽이 한 단 높은 마른 땅, 늪물은 낮은 땅에만 고인다(시공기의 늪 단계가 높은 단을 물로 바꾸지 않는다).
// 모양 규칙(3/4 시점에서는 남쪽을 보는 절벽 면만 그려진다 — 다른 방향의 단 가장자리는 땅이 어긋난 가는 선으로만 보인다):
// 등고선은 동서로 달리고 북쪽이 높다, 열쇠점 사이는 곧고 열쇠점에서 한 줄만 꺾인다, 골 가장자리는 남북 직선,
// 사선·둥근 단 가장자리(옛 강 골짜기·분지 고리)는 쓰지 않는다. 1칸 가시·홈은 다듬어 지운다, 물과 그 둑은 0단.
import type { BeodeulVillageForm, BeodeulVillageTheme } from "./beodeulVillage";

export const VILLAGE_TERRAINS = ["flat", "terraces", "highland", "hillside", "basin", "ridge"] as const;
export type VillageTerrain = (typeof VILLAGE_TERRAINS)[number];
export const TERRAIN_LABEL: Record<VillageTerrain, string> = { flat: "평지", terraces: "계단식 비탈", highland: "높은 산비탈", hillside: "눈 덮인 비탈", basin: "오아시스 골", ridge: "마른 둔덕" };

/** theme 에서 고를 수 있는 지형(기본으로 고르는 것 먼저, flat 은 늘 마지막). */
export function allowedVillageTerrains(theme: BeodeulVillageTheme): VillageTerrain[] {
  switch (theme) {
    case "river": return ["terraces", "highland", "flat"];
    case "coast": return ["terraces", "flat"];
    case "desert": return ["basin", "flat"];
    case "snow": return ["hillside", "flat"];
    case "swamp": return ["ridge", "flat"];
    default: return ["flat"];
  }
}

function rng(seed: number): () => number {
  let s = (seed ^ 0x2c1b3c6d) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

/** 지형을 정한다. 생략하면 seed 로(평지가 아닌 것 중에서 — 늘 평지가 나오지 않게). 마을 본 난수열과 따로 뽑는다. */
export function resolveVillageTerrain(theme: BeodeulVillageTheme, seed: number, terrain?: string): VillageTerrain {
  const ok = allowedVillageTerrains(theme);
  // highland(산골) 은 요청할 때만 — 생략하면 예전처럼 계단식 비탈
  if (terrain === undefined || terrain === "") { const xs = ok.filter((t) => t !== "flat" && t !== "highland"); return xs.length ? xs[Math.floor(rng(seed * 5113 + 31)() * xs.length)]! : "flat"; }
  if (!(VILLAGE_TERRAINS as readonly string[]).includes(terrain)) throw new Error(`terrain 은 ${VILLAGE_TERRAINS.join("|")} 중 하나다(받은 값: ${terrain}).`);
  if (!ok.includes(terrain as VillageTerrain)) throw new Error(`terrain ${terrain} 은 theme ${theme} 에서 고를 수 없다(가능: ${ok.join("|")}).`);
  return terrain as VillageTerrain;
}

export interface TerrainFrame {
  W: number; H: number; theme: BeodeulVillageTheme; form: BeodeulVillageForm; seed: number;
  /** 강·바다 물 칸(1단계에서 정한 것). */
  water: (x: number, y: number) => boolean;
  riverLeft: boolean;
  /** 동서 큰길의 기준 줄(집 띠가 그 북쪽에 앉는다). */
  mainBase: number;
  /** 못(오아시스·얼음 못) 자리. */
  pond: { cx: number; cy: number; rx: number; ry: number } | null;
}
export interface VillageTerrainPlan {
  name: VillageTerrain;
  levels: Uint8Array;
  /** 북쪽 단 등고선: y < northSeam(x) 인 칸이 한 단 높다. 북쪽 뒷길이 높은 단의 맨 아래 줄(이 선 바로 북쪽)을 따라간다. */
  northSeam: ((x: number) => number) | null;
  /** 높은 단을 세로로 깎은 골(강·못 자리) — x0..x1 열은 0단. 뒷길은 이 골 가장자리를 건너지 않는다. */
  coves: { x0: number; x1: number }[];
  note: string;
}

/** 등고선: 10~13칸마다 열쇠점, 열쇠점 사이는 곧게(같은 줄), 열쇠점에서 한 줄만 꺾인다.
 *  3/4 시점에서는 남쪽을 보는 절벽 면만 그려지므로 사선·완만한 굽이(smoothstep)는 1칸 계단이 이어진 가는 선으로 보였다(2026-10-11 사용자 「지형과 길이 이상하게 이어진다」). */
// 꺾임은 한 방향으로 이어 가다 ±1 끝에서 돌아선다(b−1 → b → b+1 → b → …) — 폭 2 뒷길은 한 줄 꺾일 때마다 한 줄이 겹쳐 이어지므로
// 왔다 갔다(b, b+1, b, b+1 …) 하면 그 줄이 맵 끝까지 곧게 남는다(88×56 포구에서 57칸 곧은 길). 이렇게 하면 겹친 줄은 세 토막(10~13칸씩) 안에서 끊긴다.
function contour(len: number, base: number, rand: () => number): (t: number) => number {
  const ys = new Int16Array(len);
  let y = base, dir = rand() < 0.5 ? -1 : 1, next = 10 + Math.floor(rand() * 4);
  for (let t = 0; t < len; t += 1) {
    if (t === next && t < len - 6) { if (Math.abs(y + dir - base) > 1) dir = -dir; y += dir; next += 10 + Math.floor(rand() * 4); }
    ys[t] = y;
  }
  return (t: number) => ys[Math.max(0, Math.min(len - 1, t))]!;
}

export function planVillageTerrain(f: TerrainFrame, name: VillageTerrain): VillageTerrainPlan {
  const { W, H } = f;
  const lv = new Uint8Array(W * H);
  const rand = rng(f.seed * 6271 + f.theme.length * 17 + 5);
  const idx = (x: number, y: number) => y * W + x;
  const flat = (note: string): VillageTerrainPlan => ({ name: "flat", levels: new Uint8Array(W * H), northSeam: null, coves: [], note });
  if (name === "flat") return flat("평지");

  // 모든 지형은 같은 뼈대: 큰길 북쪽 집 띠(8칸 안팎) 뒤로 동서 등고선 하나(북쪽이 높다), 그 뒤 11칸에 또 하나.
  // 물(강·못)은 높은 단을 세로로 곧게 깎은 골에 있다 — 등고선은 동서, 골 가장자리는 남북 직선, 사선·둥근 단 가장자리는 없다.
  // 큰길 북쪽 띠 = 앵커 건물(여관 9줄)까지 앉는 폭. 맵 위가 가까우면(포구 큰길 y≈16) 집 한 채 높이(8)로 줄인다
  const yS0 = f.mainBase - 10 - Math.floor(rand() * 2);
  const yS = yS0 >= 6 ? yS0 : f.mainBase - 10 >= 6 ? 6 : f.mainBase - 8;
  if (yS < 6) return flat(`평지(큰길이 맵 위에 가까워 단을 둘 자리 없음, 큰길 y=${f.mainBase})`);
  const s1 = contour(W, yS, rand);
  for (let x = 0; x < W; x += 1) for (let y = 0; y < s1(x); y += 1) lv[idx(x, y)] = 1;
  let note = "한 단";
  // highland(산골, 2026-10-22 「산골 마을인데 산이 없다」): 단 사이를 7칸으로 좁혀 세 단까지 — 맵 위쪽이 가파르게 올라간다
  const gap = name === "highland" ? 7 : 11;
  const s2 = contour(W, yS - gap, rand);
  if (Math.min(...Array.from({ length: W }, (_, x) => s2(x))) >= 4) {
    for (let x = 0; x < W; x += 1) for (let y = 0; y < s2(x); y += 1) lv[idx(x, y)] = 2;
    note = "두 단";
    const s3 = name === "highland" ? contour(W, yS - gap * 2, rand) : null;
    if (s3 && Math.min(...Array.from({ length: W }, (_, x) => s3(x))) >= 4) {
      for (let x = 0; x < W; x += 1) for (let y = 0; y < s3(x); y += 1) lv[idx(x, y)] = 3;
      note = "세 단";
    }
  }
  const coves: { x0: number; x1: number }[] = [];
  const cut = (x0: number, x1: number) => {
    x0 = Math.max(0, x0); x1 = Math.min(W - 1, x1); if (x1 < x0) return;
    // 맵 가장자리까지 3칸 이하로 남는 높은 띠는 같이 깎는다(좁은 띠 절벽은 어색하다)
    if (x0 <= 3) x0 = 0; if (x1 >= W - 4) x1 = W - 1;
    for (let y = 0; y < H; y += 1) for (let x = x0; x <= x1; x += 1) lv[idx(x, y)] = 0;
    coves.push({ x0, x1 });
  };
  // 강: 높은 단 줄들에서 물이 지난 가장 넓은 범위 + 서쪽 8칸(물레방아·방앗간 자리) · 동쪽 3칸을 곧은 골로
  let a = W, b = -1;
  const top = Math.max(...Array.from({ length: W }, (_, x) => s1(x))) + 2;
  for (let y = 0; y < Math.min(H, top); y += 1) for (let x = 0; x < W; x += 1) if (f.water(x, y)) { a = Math.min(a, x); b = Math.max(b, x); }
  if (b >= 0) { cut(a - 8, b + 3); note += " · 강은 골"; }
  // 못: 못 둘레 3칸 상자를 골로(맵 위 끝부터 등고선까지 곧게)
  if (f.pond) { cut(f.pond.cx - f.pond.rx - 3, f.pond.cx + f.pond.rx + 3); note += name === "basin" ? " · 오아시스는 골" : " · 못은 골"; }
  // 바다: 해안선과 그 둑 2칸은 0단(포구 마을의 등고선은 큰길 북쪽이라 보통 닿지 않는다)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!f.water(x, y)) continue;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) lv[idx(X, Y)] = 0; }
  }
  tidyLevels(lv, W, H);
  if (!lv.some((v) => v > 0)) return flat("평지(골을 깎고 나니 높은 단이 남지 않음)");
  return { name, levels: lv, northSeam: s1, coves, note };
}

/** 1칸 가시·홈 지우기: 4이웃 중 셋 이상이 같은 다른 높이면 그 높이로. 두 칸 폭 목도 지운다(가로·세로 양옆이 같은 높이). */
export function tidyLevels(lv: Uint8Array, W: number, H: number): void {
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = 0;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const c = y * W + x, v = lv[c]!;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => { const X = x + dx!, Y = y + dy!; return X >= 0 && Y >= 0 && X < W && Y < H ? lv[Y * W + X]! : -1; }).filter((u) => u >= 0);
      const counts = new Map<number, number>(); for (const u of n) if (u !== v) counts.set(u, (counts.get(u) ?? 0) + 1);
      for (const [u, k] of counts) if (k >= 3 || (k >= 2 && n.length <= 3)) { lv[c] = u; changed += 1; break; }
      if (lv[c] !== v) continue;
      // 가로·세로로 양옆이 모두 다른(같은) 높이인 1칸 폭 목
      const l = x > 0 ? lv[c - 1]! : v, r = x < W - 1 ? lv[c + 1]! : v, u = y > 0 ? lv[c - W]! : v, d = y < H - 1 ? lv[c + W]! : v;
      if (l === r && l !== v && x > 0 && x < W - 1) { lv[c] = l; changed += 1; } else if (u === d && u !== v && y > 0 && y < H - 1) { lv[c] = u; changed += 1; }
    }
    if (!changed) break;
  }
}
