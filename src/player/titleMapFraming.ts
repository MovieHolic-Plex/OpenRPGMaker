// 타이틀 배경 「게임 속 맵 그대로」(map-view:<mapId>) 의 틀 잡기 — 어느 배율로, 맵의 어느 쪽을 보여 줄까.
//
// 2026-10-28 스위트 조립 장부: 작은 방(20×15칸)을 화면 가득 늘리니 3배가 넘어 거칠었고, 큰 마을은 아무 데나 잘렸다.
// 규칙: 배율은 정수 1~2배(도트가 고르게 보이는 최대). 그 배율로 화면보다 크면 «가구·소품이 가장 많은 창»(시작 위치가 들면 가산)을 보이고,
// 화면보다 작으면 가운데에 두고 둘레는 검은 바탕이다(억지로 늘리지 않는다).
import type { GameMap } from "@/project/types";

export interface TitleMapFrame {
  /** 맵 그림을 그릴 크기(px). */
  readonly width: number;
  readonly height: number;
  /** 화면 왼쪽 위 기준 맵 그림의 자리(px, 음수면 잘린다). */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

const EMPTY = new Set([0, -1]);
const WINDOW_CACHE = new WeakMap<GameMap, Map<string, { x: number; y: number }>>();

/**
 * 가장 볼 것이 많은 창: 두 층에서 서로 다른 칸 번호가 가장 많이 든 창 + 이벤트 수. 집·가구·소품은 조각마다 번호가 달라 많이 세이고,
 * 잔디·밭·되풀이 나무는 몇 번호뿐이라 적게 세인다 — 칸을 그냥 세면 조선 마을이 나무·밭만 있는 강가를 골랐다(2026-10-28).
 * 시작 위치가 든 창은 조금(최고점의 5%) 가산, 같으면 맵 가운데에 가까운 창. 2칸 걸음으로 잰다(큰 맵 200×208 도 가볍게).
 */
function busiestWindow(map: GameMap, winW: number, winH: number, start: { readonly mapId: string; readonly x: number; readonly y: number } | undefined): { x: number; y: number } {
  const w = map.width, h = map.height;
  const xs: number[] = [], ys: number[] = [];
  for (let x = 0; x <= w - winW; x += 2) xs.push(x);
  if (xs[xs.length - 1] !== w - winW) xs.push(w - winW);
  for (let y = 0; y <= h - winH; y += 2) ys.push(y);
  if (ys[ys.length - 1] !== h - winH) ys.push(h - winH);
  const events = map.events ?? [];
  const scored: { x: number; y: number; score: number }[] = [];
  const seen = new Set<number>();
  for (const y of ys) for (const x of xs) {
    seen.clear();
    for (let ty = y; ty < y + winH; ty++) for (let tx = x; tx < x + winW; tx++) {
      const i = ty * w + tx;
      const lo = map.lowerTiles[i], up = map.upperTiles[i];
      if (lo !== undefined && !EMPTY.has(lo)) seen.add(lo);
      if (up !== undefined && !EMPTY.has(up)) seen.add(up + 1e7);
    }
    const ev = events.filter((e) => e.x >= x && e.x < x + winW && e.y >= y && e.y < y + winH).length;
    scored.push({ x, y, score: seen.size + ev });
  }
  const top = Math.max(1, ...scored.map((c) => c.score));
  let best = scored[0]!, bestScore = -Infinity;
  for (const c of scored) {
    const startIn = start && start.mapId === map.id && start.x >= c.x && start.x < c.x + winW && start.y >= c.y && start.y < c.y + winH ? 0.05 * top : 0;
    const centre = -(Math.abs(c.x + winW / 2 - w / 2) + Math.abs(c.y + winH / 2 - h / 2)) * 1e-3;
    const score = c.score + startIn + centre;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return { x: best.x, y: best.y };
}

export function titleMapFrame(map: GameMap, start: { readonly mapId: string; readonly x: number; readonly y: number } | undefined, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): TitleMapFrame {
  const cover = Math.max(viewWidth / imageWidth, viewHeight / imageHeight);
  const scale = Math.max(1, Math.min(2, Math.floor(cover)));
  const width = imageWidth * scale, height = imageHeight * scale;
  const tile = (imageWidth / Math.max(1, map.width)) * scale;
  // 창 크기(칸) — 이 배율에서 화면이 덮는 칸 수.
  const winW = Math.min(map.width, Math.ceil(viewWidth / tile));
  const winH = Math.min(map.height, Math.ceil(viewHeight / tile));
  let bestX = Math.floor((map.width - winW) / 2), bestY = Math.floor((map.height - winH) / 2);
  if (winW < map.width || winH < map.height) {
    const key = `${winW}x${winH}:${start?.mapId === map.id ? `${start.x},${start.y}` : ""}`;
    let byMap = WINDOW_CACHE.get(map);
    if (!byMap) WINDOW_CACHE.set(map, (byMap = new Map()));
    const hit = byMap.get(key) ?? busiestWindow(map, winW, winH, start);
    byMap.set(key, hit);
    bestX = hit.x; bestY = hit.y;
  }
  const x = width <= viewWidth ? Math.round((viewWidth - width) / 2) : Math.round(-Math.min(bestX * tile, width - viewWidth));
  const y = height <= viewHeight ? Math.round((viewHeight - height) / 2) : Math.round(-Math.min(bestY * tile, height - viewHeight));
  return { width, height, x, y, scale };
}

/** 제목·메뉴 글자가 바쁜 지도 위에서 읽히게 까는 어두운 판: 전체를 조금 어둡게 + 가장자리 비네트 + 글자 쪽(왼쪽) 그라데이션. */
export const TITLE_MAP_SHADE = [
  "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0) 75%)",
  "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.65) 100%)",
];
