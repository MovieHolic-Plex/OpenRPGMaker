// editor/tools/mapAreaUse.ts
// 「지도는 큰데 쓰는 곳은 일부」 경고 — run_lint · evaluate_game_quality 의 warning `map-area-unused`.
//
// 왜(2026-10-31 이세계 고딩 맵 적대적 VQA): 마왕성 꼭대기는 지도의 72% 가 허공이고 아래 방은 아무 이벤트도 없었다.
// 왕도는 이벤트가 전부 가운데 가로 띠(y25-32)에 있고 북쪽 1/3 이 빈 풀밭이었다. 저작 도구는 둘 다 말없이 통과시켰다.
// 차단이 아니라 경고다 — 모델에게 구체 띠·호출문(shift_map + resize_map)을 준다.
//
// 측정(순수 함수, 렌더 없음):
//   - 도달 칸: 들어오는 지점(playerAnchors, 없으면 첫 이벤트)에서 canMove BFS.
//   - 허공: 도달 칸에서 2칸 이상 떨어지고 3×3 이웃이 타일 2종 이하인 막힌 칸(배경 그림이 있는 맵은 0). 벽·나무·건물은 무늬가 섞여 빠진다.
//   - 쓰는 범위: 들어오는 지점·이벤트(투명 자동 실행 이벤트 제외)를 감싼 상자를 반 화면씩 넓힌 것.
//   - 경고 A: 허공 ≥ 30%.  경고 B: 관심 지점 4개 이상 · 쓰는 범위 밖이 지도의 33% 이상 · 그 밖의 45% 이상이 도달 칸이나 허공.
// 보정(2026-10-31, 130장): 걸린 것은 마왕성 꼭대기·폐허(A·B)와 왕도(B)뿐. 폴른 스타 마을·숲·천문대·탑, region-reference 장소 전부 통과
//   (가장 가까운 것: 허공 vault_b4 24%, B 의 jp-city-school-2f 밖 51%·빈 칸 39%, 지점 3개라 빠지는 jp-city-tram-street).

import type { LintIssue } from "@/project/lint/projectLint";
import { canMove, isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { playerAnchors } from "./transferReachability";

export const AREA_VOID_RATIO = 0.3;
export const AREA_OUTSIDE_RATIO = 0.33;
export const AREA_OUTSIDE_EMPTY_RATIO = 0.45;
export const AREA_MIN_INTEREST_POINTS = 4;
const SCREEN_W_PX = 480;
const SCREEN_H_PX = 270;

export interface MapAreaUse {
  readonly cells: number;
  readonly reachable: number;
  /** 허공(무늬 없는 막힌 칸) 비율 0~1. */
  readonly voidRatio: number;
  /** 들어오는 지점 + 이벤트 수(같은 칸은 하나). */
  readonly interestPoints: number;
  /** 쓰는 범위(관심 지점 상자 + 반 화면). */
  readonly keep: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
  readonly outsideRatio: number;
  /** 쓰는 범위 밖 칸 중 도달 칸·허공 비율(벽·나무·건물 아닌 빈 땅). */
  readonly outsideEmptyRatio: number;
  readonly voidHeavy: boolean;
  readonly unusedBand: boolean;
}

/** 투명하고 자동/병렬 실행만 하는 이벤트는 장소가 아니다(맵 진입 연출이 (0,0) 에 놓인다). */
function isAmbientEvent(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  if (pages.length === 0) return false;
  const hidden = pages.every((page) => !page.graphic || page.graphic.transparent === true);
  return hidden && pages.some((page) => page.trigger?.kind === "auto" || page.trigger?.kind === "parallel");
}

export function measureMapAreaUse(project: Project, map: GameMap): MapAreaUse | null {
  const W = map.width, H = map.height, N = W * H;
  if (N === 0) return null;
  const anchors = playerAnchors(project, map).filter((point) => isPassable(project, map, point.x, point.y)).map((point) => point.y * W + point.x);
  const events = map.events
    .filter((event) => event.x >= 0 && event.y >= 0 && event.x < W && event.y < H && !isAmbientEvent(event))
    .map((event) => event.y * W + event.x);
  const points = new Set([...anchors, ...events]);
  if (points.size < 2) return null;

  const reach = new Uint8Array(N);
  const queue: number[] = [];
  for (const start of anchors.length > 0 ? anchors : events.slice(0, 1)) if (!reach[start]) { reach[start] = 1; queue.push(start); }
  for (let k = 0; k < queue.length; k += 1) {
    const i = queue[k]!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (reach[j] || !canMove(project, map, x, y, nx, ny)) continue;
      reach[j] = 1; queue.push(j);
    }
  }

  // 도달 칸까지 체비셰프 거리(2 이상만 알면 된다).
  const dist = new Uint8Array(N).fill(255);
  const ring: number[] = [];
  for (let i = 0; i < N; i += 1) if (reach[i]) { dist[i] = 0; ring.push(i); }
  for (let k = 0; k < ring.length; k += 1) {
    const i = ring[k]!, d = dist[i]!;
    if (d >= 2) continue;
    const x = i % W, y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dist[j]! <= d + 1) continue;
      dist[j] = d + 1; ring.push(j);
    }
  }
  const key = (i: number): string => `${map.lowerTiles[i]}|${map.upperTiles[i] ?? -1}|${map.lowerOverlayTiles?.[i] ?? -1}|${map.upperOverlayTiles?.[i] ?? -1}`;
  const empty = new Uint8Array(N);
  let voidCells = 0;
  const hasBackground = Boolean(map.background);
  for (let i = 0; i < N; i += 1) {
    if (reach[i]) { empty[i] = 1; continue; }
    if (hasBackground || dist[i]! < 2) continue;
    const x = i % W, y = (i - x) / W;
    const kinds = new Set<string>();
    for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1) && kinds.size <= 2; yy += 1) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx += 1) kinds.add(key(yy * W + xx));
    }
    if (kinds.size <= 2) { empty[i] = 1; voidCells += 1; }
  }

  let px0 = W, py0 = H, px1 = -1, py1 = -1;
  for (const i of points) { const x = i % W, y = (i - x) / W; px0 = Math.min(px0, x); px1 = Math.max(px1, x); py0 = Math.min(py0, y); py1 = Math.max(py1, y); }
  const tile = map.tileSize ?? 16;
  const halfW = Math.ceil(SCREEN_W_PX / tile / 2), halfH = Math.ceil(SCREEN_H_PX / tile / 2);
  const keep = { x0: Math.max(0, px0 - halfW), y0: Math.max(0, py0 - halfH), x1: Math.min(W - 1, px1 + halfW), y1: Math.min(H - 1, py1 + halfH) };
  let outside = 0, outsideEmpty = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (x >= keep.x0 && x <= keep.x1 && y >= keep.y0 && y <= keep.y1) continue;
    outside += 1; outsideEmpty += empty[y * W + x]!;
  }
  const voidRatio = voidCells / N, outsideRatio = outside / N, outsideEmptyRatio = outside > 0 ? outsideEmpty / outside : 0;
  return {
    cells: N, reachable: queue.length, voidRatio, interestPoints: points.size, keep, outsideRatio, outsideEmptyRatio,
    voidHeavy: voidRatio >= AREA_VOID_RATIO,
    unusedBand: points.size >= AREA_MIN_INTEREST_POINTS && outsideRatio >= AREA_OUTSIDE_RATIO && outsideEmptyRatio >= AREA_OUTSIDE_EMPTY_RATIO,
  };
}

function bandNames(map: GameMap, keep: MapAreaUse["keep"]): string[] {
  const bands: string[] = [];
  if (keep.y0 > 0) bands.push(`top rows y0-${keep.y0 - 1}`);
  if (keep.y1 < map.height - 1) bands.push(`bottom rows y${keep.y1 + 1}-${map.height - 1}`);
  if (keep.x0 > 0) bands.push(`left columns x0-${keep.x0 - 1}`);
  if (keep.x1 < map.width - 1) bands.push(`right columns x${keep.x1 + 1}-${map.width - 1}`);
  return bands;
}

/** 이 맵을 쓰는 범위로 줄이는 호출문(위·왼쪽을 자르면 shift_map 먼저). */
export function cropCalls(map: GameMap, keep: MapAreaUse["keep"]): string {
  const width = keep.x1 - keep.x0 + 1, height = keep.y1 - keep.y0 + 1;
  const shift = keep.x0 > 0 || keep.y0 > 0 ? `shift_map(${JSON.stringify({ mapId: map.id, dx: -keep.x0, dy: -keep.y0 })}) then ` : "";
  return `${shift}resize_map(${JSON.stringify({ mapId: map.id, width, height })})`;
}

export function areaUseMessage(map: GameMap, use: MapAreaUse): string {
  const pct = (value: number): number => Math.round(value * 100);
  const parts: string[] = [];
  if (use.voidHeavy) parts.push(`${pct(use.voidRatio)}% of the map is blank void (featureless blocked cells away from any walkable floor)`);
  const bands = bandNames(map, use.keep);
  if (use.unusedBand && bands.length > 0) {
    parts.push(`${bands.join(", ")} lie more than half a screen from every event, transfer and arrival point, and ${pct(use.outsideEmptyRatio)}% of that area is open ground or void`);
  }
  const fix = bands.length > 0
    ? `Shrink the map to the used part x${use.keep.x0}-${use.keep.x1} y${use.keep.y0}-${use.keep.y1}: ${cropCalls(map, use.keep)}; or give the unused band a purpose (an event, a building, a path that leads somewhere).`
    : "Tighten the rooms or fill the void with walls, rock or a map background instead of leaving blank space.";
  return `'${map.name}'(${map.id}) ${map.width}×${map.height} uses only part of its area: ${parts.join("; ")}. ${fix} This is a warning, not a block.`;
}

/** 쓰는 범위가 지도보다 훨씬 작은 맵마다 warning `map-area-unused` 하나. 월드맵 제외. */
export function areaUseIssues(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    if (map.worldmapSource) continue;
    const use = measureMapAreaUse(project, map);
    if (!use || (!use.voidHeavy && !use.unusedBand)) continue;
    issues.push({ severity: "warning", code: "map-area-unused", mapId: map.id, message: areaUseMessage(map, use) });
  }
  return issues;
}
