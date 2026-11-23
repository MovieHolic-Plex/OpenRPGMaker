// 생성 맵끼리의 구조 유사도(2026-11-23 map-variety). 칸을 길·물·막힘·땅 네 갈래로 나눠 N×N 으로 줄인 뒤,
// 칸마다 갈래가 같은 비율을 우연 일치로 보정한 값(Cohen 카파)을 낸다. 좌우·상하 뒤집기 넷 중 최대값 — 거울에 비친 같은 배치도 같은 배치로 본다.
// 갈래별 IoU 평균은 못 썼다: 벽·바닥이 반반인 동굴은 아무 덩이끼리도 0.5 를 넘고, 물이 없는 판은 물 갈래가 빠져 점수가 올라
// 한 꼴로 찍은 전 동굴(0.564)과 문법을 바꾼 후 동굴(0.563)을 못 갈랐다. 카파는 0.644 → 0.419 로 가른다(2026-11-23 전/후 60맵).
// 크기가 달라도 비교된다(둘 다 N×N 으로 줄인다). 타일 번호는 보지 않는다: 같은 문법을 다른 칩셋 칸으로 깔아도 같은 구조다.
import type { GameMap, Project } from "@/project/types";
import { surfaceKind } from "./surface";

/** 0 땅 · 1 길(출구 포함) · 2 물 · 3 막힘(벽·집·나무). */
export type StructureClass = 0 | 1 | 2 | 3;
export const STRUCTURE_N = 24;
const CLASSES = 4;

export interface StructureGrid { readonly n: number; readonly cells: Uint8Array }

/** 맵 → N×N 갈래 격자(칸 묶음마다 가장 많은 갈래; 길·물은 묶음의 1/4 이상이면 그 갈래 — 가는 길이 사라지지 않게). */
export function structureGrid(project: Project, map: GameMap, n = STRUCTURE_N): StructureGrid {
  const full = new Uint8Array(map.width * map.height);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const k = surfaceKind(project, map, x, y);
    full[y * map.width + x] = k === "road" || k === "gate" ? 1 : k === "water" ? 2 : k === "wall" ? 3 : 0;
  }
  return downsample(full, map.width, map.height, n);
}

export function downsample(full: ArrayLike<number>, w: number, h: number, n = STRUCTURE_N): StructureGrid {
  const cells = new Uint8Array(n * n);
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const x0 = Math.floor((gx * w) / n), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / n));
    const y0 = Math.floor((gy * h) / n), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / n));
    const count = [0, 0, 0, 0];
    for (let y = y0; y < y1 && y < h; y++) for (let x = x0; x < x1 && x < w; x++) count[full[y * w + x]!]! += 1;
    const total = count.reduce((a, b) => a + b, 0) || 1;
    let pick = 0;
    if (count[1]! * 4 >= total) pick = 1;
    else if (count[2]! * 4 >= total) pick = 2;
    else pick = count.indexOf(Math.max(...count));
    cells[gy * n + gx] = pick;
  }
  return { n, cells };
}

function kappa(a: Uint8Array, b: Uint8Array, n: number, fx: boolean, fy: boolean): number {
  const ca = new Array<number>(CLASSES).fill(0), cb = new Array<number>(CLASSES).fill(0);
  let agree = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const A = a[y * n + x]!, B = b[(fy ? n - 1 - y : y) * n + (fx ? n - 1 - x : x)]!;
    ca[A]! += 1; cb[B]! += 1;
    if (A === B) agree++;
  }
  const N = n * n, po = agree / N;
  let pe = 0;
  for (let c = 0; c < CLASSES; c++) pe += (ca[c]! / N) * (cb[c]! / N);
  return pe >= 1 ? 1 : (po - pe) / (1 - pe);
}

/**
 * 생성물끼리 관문 기준. 전 측정(scripts/qa/assistant-v2/mapVariety.mts, 같은 빌더·다른 요청 20개)에서 한 꼴로 찍은 동굴 쌍의 가운데 값(0.665)·숲(0.592) 근처 —
 * 이 값 이상이면 «같은 틀에서 찍은 맵»으로 본다.
 */
export const VARIETY_GATE = 0.6;

export interface Twin { readonly mapId: string; readonly similarity: number }

/** 프로젝트의 다른 맵(같은 칩셋, others 가 고른 것) 중 구조가 가장 닮은 맵과 그 유사도. */
export function closestTwin(project: Project, map: GameMap, others: (mapId: string) => boolean): Twin | undefined {
  const g = structureGrid(project, map);
  let best: Twin | undefined;
  for (const m of Object.values(project.maps)) {
    if (m.id === map.id || m.tilesetId !== map.tilesetId || !others(m.id)) continue;
    const s = structureSimilarity(g, structureGrid(project, m));
    if (!best || s > best.similarity) best = { mapId: m.id, similarity: s };
  }
  return best;
}

/** 두 격자의 구조 유사도(카파, 1 같음 · 0 우연 수준 · 음수 우연보다 다름 — 뒤집기 넷 중 최대). */
export function structureSimilarity(a: StructureGrid, b: StructureGrid): number {
  if (a.n !== b.n) throw new Error(`structureSimilarity: grid size ${a.n} != ${b.n}`);
  let best = -1;
  for (const fx of [false, true]) for (const fy of [false, true]) best = Math.max(best, kappa(a.cells, b.cells, a.n, fx, fy));
  return best;
}
