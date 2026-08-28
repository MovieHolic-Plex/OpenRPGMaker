// project/footprintLanding.ts
// 워프 착지 해소 — 발자국이 안 맞는 목적지를 가까운 유효 칸으로 밀어낸다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3.
//
// footprint.ts 에 두지 않은 이유: 이 함수는 collision 과 runtimeEventState 를
// 둘 다 필요로 한다. footprint.ts 는 의존성 없는 순수 프리미티브로 남긴다.

import { inBounds, isPassable } from "./collision";
import { footprintBounds, footprintCells } from "./footprint";
import { findBlockingEventOverlappingRect, type RuntimeEventPositions } from "./runtimeEventState";
import type { CharacterFootprint, GameMap, Project } from "./types";
import type { PlaySessionLike } from "./sessionRuntimeTypes";

export type LandingPoint = { readonly x: number; readonly y: number };

/**
 * 발자국이 들어갈 착지 지점을 정한다.
 *
 * 1x1 은 **검사하지 않고 그대로 준다.** 기존 transfer 는 통행 불가 칸에도 강제
 * 착지하고(컷신 배치 등에 실제로 쓰인다) 여기에 검사를 걸면 기존 게임이 깨진다.
 *
 * 다중 타일은 지정 좌표를 먼저 보고, 안 맞으면 체비쇼프 거리 순으로 나선 탐색한다.
 * 반경 안에 자리가 없으면 지정 좌표를 그대로 준다 — 게임을 죽이지 않는다.
 */
export function resolveFootprintLanding(
  project: Project,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  footprint: CharacterFootprint,
  maxRadius = 8
): LandingPoint {
  if (footprint.width === 1 && footprint.height === 1) return { x, y };
  if (footprintFits(project, map, session, positions, x, y, footprint)) return { x, y };
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (const candidate of ringCells(x, y, radius)) {
      if (footprintFits(project, map, session, positions, candidate.x, candidate.y, footprint)) return candidate;
    }
  }
  return { x, y };
}

function footprintFits(
  project: Project,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  footprint: CharacterFootprint
): boolean {
  for (const cell of footprintCells(x, y, footprint)) {
    if (!inBounds(map, cell.x, cell.y)) return false;
    if (!isPassable(project, map, cell.x, cell.y)) return false;
  }
  const rect = footprintBounds(x, y, footprint);
  return findBlockingEventOverlappingRect(project, map, session, positions, rect) === undefined;
}

/**
 * 체비쇼프 거리가 정확히 radius 인 칸들. 순서가 결정적이어야 같은 입력에
 * 같은 착지점이 나온다 — 위 행(좌→우), 아래 행(좌→우), 왼쪽 열, 오른쪽 열.
 */
function ringCells(cx: number, cy: number, radius: number): LandingPoint[] {
  const cells: LandingPoint[] = [];
  for (let x = cx - radius; x <= cx + radius; x += 1) {
    cells.push({ x, y: cy - radius });
    cells.push({ x, y: cy + radius });
  }
  for (let y = cy - radius + 1; y <= cy + radius - 1; y += 1) {
    cells.push({ x: cx - radius, y });
    cells.push({ x: cx + radius, y });
  }
  return cells;
}
