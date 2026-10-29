// editor/tools/beodeulHeightFirst.ts — 버들항 마을 「높이 먼저」 시제품(2026-10-29, 옵션 landform).
//
// 왜: 사용자 「마을을 만드는 게 불만이 많다. 높이를 우선 만들고 그 뒤에 마을을 만드는 방식은 어떤가?」.
// 지금 시공기(beodeulTerrain.planVillageTerrain)는 물·큰길 줄(mainBase)을 먼저 정하고 그 북쪽에 단을 깎는다 — 높이가 길에 끌려가는 장식이다.
// 여기서는 땅 모양(landform)과 마을이 앉을 단(settle)을 먼저 정하고, 큰길·뒷길·물가 길이 그 단의 등고선을 따라간다.
// 길은 단 안에서는 단을 건너지 않고, 이음길(남북)만 단을 건너며 경사로를 탄다(시공기 3b).
//
// 모양 규칙은 beodeulTerrain 과 같다(3/4 시점은 남쪽을 보는 절벽 면만 그린다): 등고선은 동서로 달리고 북쪽이 높다, 열쇠점 사이는 곧고
// 한 줄만 꺾인다, 골·언덕 옆면은 남북 직선. 모델은 이름(landform·settle)만 고르고 모양·간격은 이 함수가 seed 로 정한다.
//   terraces  계단식 단 — 남쪽 낮은 땅(밭·물가) · 마을 단 · 북쪽 높은 단 한두 개가 맵 폭 전체로.
//   hill      언덕 — 마을 단 북쪽 가운데에만 두 층 언덕이 솟는다(옆면은 남북 직선), 동서는 마을 단과 같은 높이로 트인다.
//   slope     산비탈 — 7칸 간격으로 단이 너덧 겹 오르는 산골(맨 윗단은 산 숲).
// settle(마을이 앉는 단): middle = 가운데 단(남쪽에 한 단 낮은 땅이 남는다, 기본) · low = 맨 아래 단(북쪽으로만 오른다).
import { contour, tidyLevels, type VillageTerrain, type VillageTerrainPlan } from "./beodeulTerrain";
import type { BeodeulVillageTheme } from "./beodeulVillage";

export const VILLAGE_LANDFORMS = ["terraces", "hill", "slope"] as const;
export type VillageLandform = (typeof VILLAGE_LANDFORMS)[number];
export const VILLAGE_SETTLES = ["middle", "low"] as const;
export type VillageSettle = (typeof VILLAGE_SETTLES)[number];
export const LANDFORM_LABEL: Record<VillageLandform, string> = { terraces: "계단식 단", hill: "언덕", slope: "산비탈" };

function rng(seed: number): () => number {
  let s = (seed ^ 0x3a7f1c29) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

export interface HeightFirstPlan {
  landform: VillageLandform;
  settle: VillageSettle;
  /** 물을 깎기 전 단 높이. */
  levels: Uint8Array;
  /** 마을 단의 북쪽 등고선(y < seamAbove(x) 가 한 단 높다) — 뒷길(북)이 그 위 단의 맨 아래 줄을 따라간다. */
  seamAbove: ((x: number) => number) | null;
  /** 마을 단의 남쪽 등고선(y ≥ seamBelow(x) 가 한 단 낮다) — 남쪽 길이 그 아래 단에서 등고선을 따라간다. */
  seamBelow: ((x: number) => number) | null;
  /** 큰길 윗줄(마을 단 안, 북쪽 집 띠 9~10줄 아래). */
  mainY: (x: number) => number;
  /** 지형 이름(시공기의 지형 분기용: slope = highland 처럼 맨 윗단을 산 숲으로). */
  terrainName: VillageTerrain;
  note: string;
}

/** 이 테마에서 기본 landform·settle — 모델이 비워 보내면. */
export function defaultLandform(theme: BeodeulVillageTheme, seed: number): VillageLandform {
  const xs: VillageLandform[] = theme === "snow" ? ["slope", "terraces"] : theme === "desert" || theme === "swamp" ? ["terraces", "hill"] : ["terraces", "hill", "slope"];
  return xs[Math.floor(rng(seed * 977 + 13)() * xs.length)]!;
}

export function parseLandform(v: unknown): VillageLandform | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim().toLowerCase();
  if ((VILLAGE_LANDFORMS as readonly string[]).includes(s)) return s as VillageLandform;
  throw new Error(`landform 은 ${VILLAGE_LANDFORMS.join("|")} 중 하나다(받은 값: ${v}).`);
}
export function parseSettle(v: unknown): VillageSettle | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim().toLowerCase();
  if ((VILLAGE_SETTLES as readonly string[]).includes(s)) return s as VillageSettle;
  throw new Error(`settle 은 ${VILLAGE_SETTLES.join("|")} 중 하나다(받은 값: ${v}).`);
}

/**
 * 땅을 먼저 짓는다. 물(강·바다·못)은 아직 없다 — 시공기가 물을 놓은 뒤 carveHeightFirstWater 로 골을 깎는다.
 * coastShore: 포구면 물가가 시작하는 대략의 줄(낮은 단이 물가와 물가 길을 품게 그 위 7칸에서 마을 단이 시작한다).
 */
export function planHeightFirst(W: number, H: number, seed: number, _theme: BeodeulVillageTheme, landform: VillageLandform, settle: VillageSettle, coastShore?: number): HeightFirstPlan {
  const rand = rng(seed * 6343 + landform.length * 29 + settle.length * 7);
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const lv = new Uint8Array(W * H);
  const idx = (x: number, y: number) => y * W + x;
  const raise = (fn: (x: number) => number, level: number, x0 = 0, x1 = W - 1) => {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x += 1) for (let y = 0; y < Math.min(H, fn(x)); y += 1) if (lv[idx(x, y)]! < level) lv[idx(x, y)] = level;
  };
  const minOf = (fn: (x: number) => number) => { let m = H; for (let x = 0; x < W; x += 1) m = Math.min(m, fn(x)); return m; };
  const maxOf = (fn: (x: number) => number) => { let m = 0; for (let x = 0; x < W; x += 1) m = Math.max(m, fn(x)); return m; };
  // 띠 나누기(맵 높이에 맞춰): 북쪽 높은 단 ≥ 7줄(slope 는 더) · 마을 단 17~22줄(북쪽 집 띠 10 + 큰길 2 + 남쪽 띠) · 낮은 단 8~16줄.
  // 작은 맵(34줄)에서 마을 단 20줄 고정이면 북쪽 단이 사라졌다(A/B 1판: 10판 중 8판 「북쪽에 단을 둘 자리 없음」).
  const NORTH_STRIP = 10;
  const northMin = landform === "slope" ? 14 : 8;
  let below: ((x: number) => number) | null = null;
  let yBand: number; // 마을 단 북쪽 등고선 기준 줄
  if (settle === "middle") {
    let lowH = coastShore !== undefined ? Math.max(8, H - (coastShore - 7)) : Math.max(8, Math.min(16, Math.round(H * 0.24)));
    let band = Math.max(19, Math.min(23, H - lowH - northMin));
    if (H - lowH - band < northMin) { lowH = Math.max(8, H - band - northMin); band = Math.max(19, H - lowH - northMin); }
    const yB = H - lowH + ri(-1, 1);
    below = contour(W, yB, rand);
    raise(below, 1);
    yBand = yB - band;
  } else {
    yBand = Math.max(northMin, Math.round(H * 0.5) + ri(-2, 2) - NORTH_STRIP);
  }
  const L0 = settle === "middle" ? 1 : 0; // 마을 단 높이
  let above: ((x: number) => number) | null = null;
  const notes: string[] = [];
  if (yBand >= 5) {
    above = contour(W, yBand, rand);
    if (minOf(above) < 4) above = null;
  }
  let terrainName: VillageTerrain = "terraces";
  if (above) {
    if (landform === "hill") {
      // 언덕: 마을 단 북쪽 전체가 한 단, 그 위 가운데에 꼭대기 단이 남쪽으로 불룩 솟는다.
      // 옆면을 남북 직선으로 자르면 3/4 시점에서 맵을 위아래로 가르는 가는 선(잘린 판)으로 보였다(A/B 4판 블라인드 판정 2·7·9번) —
      // 꼭대기 등고선을 가운데서 가장 남쪽, 양옆으로 두 칸마다 한 줄씩 올라가 맵 위 끝에서 사라지게 한다(동서로 달리는 절벽 띠만 남는다).
      raise(above, L0 + 1);
      const span = Math.round(W * (0.3 + rand() * 0.15)), cx = Math.round(W / 2) + ri(-Math.round(W * 0.08), Math.round(W * 0.08));
      const hx0 = cx - Math.floor(span / 2), hx1 = hx0 + span - 1;
      const top = contour(W, yBand - 5 - ri(0, 1), rand);
      const bulge = (x: number) => { const d = x < hx0 ? hx0 - x : x > hx1 ? x - hx1 : 0; return top(x) - Math.ceil(d / 2); };
      if (top(cx) >= 3) { raise(bulge, L0 + 2); notes.push(`언덕(꼭대기 ${span}칸, 양옆으로 낮아짐)`); }
      else notes.push("언덕 한 층");
    } else if (landform === "slope") {
      // 산비탈: 마을 단 위로 7칸마다 단 — 맨 윗단(마을 단 + 3 이상)은 시공기가 산 숲으로 덮는다
      raise(above, L0 + 1);
      let k = 1, prev = above;
      for (; k < 4; k += 1) {
        const next = contour(W, minOf(prev) - 7 - ri(0, 1), rand);
        if (minOf(next) < 4) break;
        raise(next, L0 + 1 + k); prev = next;
      }
      notes.push(`산비탈 ${k}단`);
      terrainName = "highland";
    } else {
      raise(above, L0 + 1);
      const top = contour(W, yBand - 10 - ri(0, 1), rand);
      if (minOf(top) >= 4) { raise(top, L0 + 2); notes.push("계단식 두 단"); } else notes.push("계단식 한 단");
    }
  } else notes.push("마을 단 북쪽에 단을 둘 자리 없음");
  // slope 는 맨 윗단을 숲으로 덮는 분기(시공기 highland: L ≥ 3)를 탄다 — 마을 단이 1이면 3 이상이 마을 단 + 2 이상
  if (landform === "slope" && L0 === 0) terrainName = "highland";
  const mainY = above ? (x: number) => above!(x) + NORTH_STRIP : () => yBand + NORTH_STRIP;
  // 남쪽 등고선이 큰길과 너무 가까우면(남쪽 띠 6줄 미만) 낮은 단을 그 열만 아래로 민다 — 큰길 남쪽 집이 앉을 띠를 지킨다
  if (below && above) {
    const gap = Math.min(...Array.from({ length: W }, (_, x) => below!(x) - mainY(x)));
    if (gap < 8) notes.push(`마을 단 남쪽 띠가 좁다(${gap}줄)`);
  }
  tidyLevels(lv, W, H);
  const counts = new Map<number, number>(); for (const v of lv) counts.set(v, (counts.get(v) ?? 0) + 1);
  const note = `높이 먼저 · ${LANDFORM_LABEL[landform]} · 마을 단 ${settle === "middle" ? "가운데" : "맨 아래"}(${L0}) · ${notes.join(" · ")} · 단 ${[...counts.keys()].sort().join("/")}`
    + (below ? ` · 낮은 단 y≈${minOf(below)}~${maxOf(below)}` : "");
  return { landform, settle, levels: lv, seamAbove: above, seamBelow: below, mainY, terrainName, note };
}

/**
 * 물을 놓은 뒤 골을 깎는다(beodeulTerrain.planVillageTerrain 과 같은 규칙): 강은 물이 지난 열 범위 + 서쪽 8칸·동쪽 3칸을 맵 위아래로 곧게 0단,
 * 못은 둘레 3칸 상자, 바다는 해안선과 둑 2칸. 결과를 시공기가 쓰는 VillageTerrainPlan 으로 돌려준다.
 */
export function carveHeightFirstWater(plan: HeightFirstPlan, W: number, H: number, water: (x: number, y: number) => boolean, pond: { cx: number; rx: number } | null): VillageTerrainPlan {
  const lv = plan.levels;
  const idx = (x: number, y: number) => y * W + x;
  const coves: { x0: number; x1: number }[] = [];
  const cut = (x0: number, x1: number) => {
    x0 = Math.max(0, x0); x1 = Math.min(W - 1, x1); if (x1 < x0) return;
    if (x0 <= 3) x0 = 0; if (x1 >= W - 4) x1 = W - 1;
    for (let y = 0; y < H; y += 1) for (let x = x0; x <= x1; x += 1) lv[idx(x, y)] = 0;
    coves.push({ x0, x1 });
  };
  let note = plan.note;
  // 강: 바다(해안선)는 아래 고리에서 — 여기서는 맵 위쪽 절반에도 물이 있는 세로 물줄기만 골로 본다
  let a = W, b = -1;
  for (let y = 0; y < Math.round(H * 0.6); y += 1) for (let x = 0; x < W; x += 1) if (water(x, y)) { a = Math.min(a, x); b = Math.max(b, x); }
  // 골은 물 안쪽 둑 2칸만(현행 시공기의 서쪽 8칸 둑 골은 풀밭 한가운데 남북 선을 남겼다 — 블라인드 판정 1·3·5번 「잘린 사각 판」).
  // 못은 맵 위아래로 곧게 깎지 않는다 — 아래 물 둘레 2칸이 못 자리만 낮춘다(오아시스 골이 마을 단을 세로로 갈랐다, 7번).
  // 강은 가장자리 골짜기(시공기가 맵 가장자리에 놓는다) — 강 바깥쪽 둑까지 맵 끝으로 같이 낮춰, 남북 단 경계가 물가에만 남게 한다(풀밭 한가운데 세로 선 금지).
  if (b >= 0) { if ((a + b) / 2 >= W / 2) cut(a - 2, W - 1); else cut(0, b + 2); note += " · 강은 가장자리 골"; }
  if (pond) note += " · 못은 우묵";
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!water(x, y)) continue;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) lv[idx(X, Y)] = 0; }
  }
  tidyLevels(lv, W, H);
  return { name: plan.terrainName, levels: lv, northSeam: plan.seamAbove, coves, note };
}
