// 생성 맵이 참고 견본 맵을 칸 그대로 옮긴 것인지 재는 순수 함수(2026-11-23 monster-map-generator).
// 겹침 = 생성 맵 전체 칸 중, 견본을 평행이동(±shift 칸)·좌우반전해 겹쳤을 때 하위 레이어 타일이 같은 칸의 비율. 모든 이동·반전 중 최대값.
// 같은 타일셋의 견본만 비교한다(다른 타일셋의 타일 번호는 같은 그림이 아니다).

/** 길·필드·던전 맵이 참고 견본과 이 비율 이상 같으면 견본 복사로 본다(생성기는 다시 짜고 review_monster_game 은 경고). */
export const TEMPLATE_COPY_GATE = 0.4;

export interface OverlapGrid { readonly width: number; readonly height: number; readonly lower: readonly number[]; readonly tilesetId: string }
export interface OverlapHit { readonly key: string; readonly overlap: number; readonly dx: number; readonly dy: number; readonly flip: boolean }

/** 견본 하나와의 최대 겹침(0~1). */
export function templateOverlap(map: OverlapGrid, t: OverlapGrid, shift = 10): { overlap: number; dx: number; dy: number; flip: boolean } {
  const W = map.width, H = map.height, total = W * H;
  let best = { overlap: 0, dx: 0, dy: 0, flip: false };
  if (!total) return best;
  for (const flip of [false, true]) {
    for (let dy = -shift; dy <= shift; dy++) {
      const y0 = Math.max(0, dy), y1 = Math.min(H, t.height + dy);
      if (y1 <= y0) continue;
      for (let dx = -shift; dx <= shift; dx++) {
        const x0 = Math.max(0, dx), x1 = Math.min(W, t.width + dx);
        if (x1 <= x0) continue;
        // 상한이 지금 최대보다 작으면 건너뛴다.
        if ((y1 - y0) * (x1 - x0) <= best.overlap * total) continue;
        let same = 0;
        for (let y = y0; y < y1; y++) {
          const row = (y - dy) * t.width;
          for (let x = x0; x < x1; x++) {
            const tx = flip ? t.width - 1 - (x - dx) : x - dx;
            if (map.lower[y * W + x] === t.lower[row + tx]) same++;
          }
        }
        if (same > best.overlap * total) best = { overlap: same / total, dx, dy, flip };
      }
    }
  }
  return best;
}

/** 어떤 이동·반전으로도 넘을 수 없는 겹침 상한: 타일마다 min(맵 개수, 견본 개수)의 합 / 맵 칸 수. */
export function tileCountBound(map: OverlapGrid, t: OverlapGrid): number {
  const total = map.width * map.height;
  if (!total) return 0;
  const count = new Map<number, number>();
  for (const v of t.lower) count.set(v, (count.get(v) ?? 0) + 1);
  let same = 0;
  for (const v of map.lower) { const n = count.get(v) ?? 0; if (n > 0) { same++; count.set(v, n - 1); } }
  return same / total;
}

/**
 * 같은 타일셋 견본 전부와 비교해 가장 닮은 견본과 겹침. 견본이 없으면 undefined.
 * 타일 개수 상한(tileCountBound)이 지금 최대나 floor 보다 낮은 견본은 이동·반전을 돌지 않는다 — 결과가 floor 이상이면 정확하고, 모두 floor 아래면 undefined.
 */
export function maxTemplateOverlap(map: OverlapGrid, templates: Readonly<Record<string, OverlapGrid>>, options: { shift?: number; exclude?: (key: string) => boolean; floor?: number } = {}): OverlapHit | undefined {
  let best: OverlapHit | undefined;
  const ranked = Object.entries(templates)
    .filter(([key, t]) => t.tilesetId === map.tilesetId && !options.exclude?.(key))
    .map(([key, t]) => ({ key, t, bound: tileCountBound(map, t) }))
    .sort((a, b) => b.bound - a.bound);
  for (const { key, t, bound } of ranked) {
    if (bound < (options.floor ?? 0) || (best && bound <= best.overlap)) continue;
    const hit = templateOverlap(map, t, options.shift ?? 10);
    if (!best || hit.overlap > best.overlap) best = { key, ...hit };
  }
  return best;
}
