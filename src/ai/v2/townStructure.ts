// 마을 배치 구조 비교(2026-11-09 assistant-reward 오너 규칙: 「마을의 배치 구조가 비슷한 게 계속 나온다 — 비슷한 구조가 쓰였으면 막아라」).
// 칩셋 그림이 아니라 «구조»를 본다: 칸 중 배경이 아닌 덩어리(건물·울타리·숲…)의 위치·크기를 맵 크기로 나눠 점으로 만들고,
// 8가지 뒤집기·돌리기 중 가장 잘 맞는 겹침을 본다. 알려진 마을은 데이터 파일(knownTowns.json, 조수가 지은 판·번들 예제 26장).
import type { GameMap, Project } from "@/project/types";
import known from "./data/knownTowns.json";

export interface TownComp { readonly x: number; readonly y: number; readonly size: number }
export interface TownStruct { readonly comps: readonly TownComp[]; readonly density: number }
interface KnownTown { readonly id: string; readonly comps: readonly (readonly [number, number, number])[]; readonly density: number }

/** 이 값 이상이면 «같은 마을 구조»로 본다(reward 의 마을 배치 유사 기준과 같다). */
export const TOWN_SIMILARITY_LIMIT = 0.75;
const MIN_CELLS = 600;
const MIN_COMP = 6;

/** 맵 → 구조 지문. 배경(칸의 60% 를 덮는 가장 흔한 바닥 타일들)이 아닌 칸·위층 칸이 이루는 덩어리(4방향 이어짐, 6칸 이상). */
export function townStructOf(map: GameMap): TownStruct | undefined {
  const w = map.width, h = map.height, n = w * h;
  if (n < MIN_CELLS) return undefined;
  const lo = (map.lowerTiles ?? []) as readonly number[], up = (map.upperTiles ?? []) as readonly number[];
  const up2 = ((map as unknown as { upperOverlayTiles?: readonly number[] }).upperOverlayTiles ?? []) as readonly number[];
  const at = (arr: readonly number[], i: number) => (typeof arr[i] === "number" ? arr[i]! : -1);
  const count = new Map<number, number>();
  for (let i = 0; i < n; i += 1) { const t = at(lo, i); count.set(t, (count.get(t) ?? 0) + 1); }
  const bg = new Set<number>();
  let cover = 0;
  for (const [tile, c] of [...count.entries()].sort((a, b) => b[1] - a[1])) { bg.add(tile); cover += c; if (cover >= 0.6 * n) break; }
  const fg = new Uint8Array(n);
  let fgCount = 0;
  for (let i = 0; i < n; i += 1) {
    const on = !bg.has(at(lo, i)) || at(up, i) >= 0 || at(up2, i) >= 0;
    if (on) { fg[i] = 1; fgCount += 1; }
  }
  const seen = new Uint8Array(n);
  const comps: TownComp[] = [];
  const stack: number[] = [];
  for (let s = 0; s < n; s += 1) {
    if (!fg[s] || seen[s]) continue;
    let size = 0, sx = 0, sy = 0;
    stack.length = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      size += 1; sx += x; sy += y;
      if (x > 0 && fg[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && fg[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && fg[i - w] && !seen[i - w]) { seen[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && fg[i + w] && !seen[i + w]) { seen[i + w] = 1; stack.push(i + w); }
    }
    if (size >= MIN_COMP) comps.push({ x: sx / size / w, y: sy / size / h, size: size / n });
  }
  return { comps, density: fgCount / n };
}

const SYM: readonly ((x: number, y: number) => readonly [number, number])[] = [
  (x, y) => [x, y], (x, y) => [1 - x, y], (x, y) => [x, 1 - y], (x, y) => [1 - x, 1 - y],
  (x, y) => [y, x], (x, y) => [1 - y, x], (x, y) => [y, 1 - x], (x, y) => [1 - y, 1 - x],
];

/** 두 마을 구조의 유사도 0..1 — 8가지 뒤집기·돌리기 중 최선. 덩어리가 3개 미만이거나 채움이 3% 미만이면 비교하지 않는다(0). */
export function townSimilarity(a: { readonly comps: readonly (readonly [number, number, number])[]; readonly density: number }, b: { readonly comps: readonly (readonly [number, number, number])[]; readonly density: number }): number {
  if (a.comps.length < 3 || b.comps.length < 3 || a.density < 0.03 || b.density < 0.03) return 0;
  const cnt = Math.sqrt(Math.min(a.comps.length, b.comps.length) / Math.max(a.comps.length, b.comps.length));
  let best = 0;
  for (const f of SYM) {
    const pts = a.comps.map(([x, y]) => f(x, y));
    let sumA = 0;
    for (const p of pts) { let m = Infinity; for (const q of b.comps) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); sumA += m; }
    let sumB = 0;
    for (const q of b.comps) { let m = Infinity; for (const p of pts) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); sumB += m; }
    const pos = Math.max(0, 1 - 2.5 * (sumA / pts.length + sumB / b.comps.length) / 2);
    if (pos > best) best = pos;
  }
  return best * cnt;
}

export interface TownMatch { readonly id: string; readonly similarity: number }

/** 지은 마을이 알려진 마을 중 어느 것과 가장 닮았나(없으면 undefined). */
export function nearestKnownTown(map: GameMap, extra: readonly KnownTown[] = []): TownMatch | undefined {
  const s = townStructOf(map);
  if (!s) return undefined;
  const mine = { comps: s.comps.map((c) => [c.x, c.y, c.size] as const), density: s.density };
  let best: TownMatch | undefined;
  for (const k of [...(known as unknown as readonly KnownTown[]), ...extra]) {
    const sim = townSimilarity(mine, k);
    if (!best || sim > best.similarity) best = { id: k.id, similarity: sim };
  }
  return best;
}

const VARIANTS = "광장을 가운데가 아닌 한쪽 끝으로 옮기기 · 큰길을 십자 대신 굽은 길이나 고리길로 바꾸기 · 건물을 한 줄 대신 두세 무리로 나누고 빈 터를 두기 · 강·언덕·숲 같은 큰 지형을 마을 한가운데에 두기 · 집 수나 마을 크기를 바꾸기";

/**
 * 새로 지은 마을 맵(요청 시작 저장본에 없던 맵)의 구조가 알려진 마을과 같다 — 끝맺음 관문 문제 글. 비교는 구조(덩어리의 위치·크기)라 건물 그림을 바꿔도 소용없다.
 * 규칙 문장이 아니라 지은 맵을 재서 막는다(2026-11-09 오너: 「비슷한 구조가 쓰였으면 감점하고·막아라」).
 */
export function townStructureProblems(before: Project, after: Project): string[] {
  const out: string[] = [];
  for (const [id, map] of Object.entries(after.maps)) {
    if (before.maps[id] || map.width * map.height < MIN_CELLS) continue;
    const hit = nearestKnownTown(map);
    if (!hit || hit.similarity < TOWN_SIMILARITY_LIMIT) continue;
    out.push(`[마을 구조] 「${map.name || id}」(${id}) 의 배치 구조가 알려진 마을(${hit.id})과 ${Math.round(hit.similarity * 100)}% 같다(${Math.round(TOWN_SIMILARITY_LIMIT * 100)}% 이상은 같은 마을로 본다) — 건물 그림이 아니라 덩어리의 위치·크기가 같다. 이 마을의 배치를 바꿔 다시 짓는다(edit_place 또는 make_place 의 villageLayout): ${VARIANTS}.`);
  }
  return out;
}
