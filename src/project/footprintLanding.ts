// project/footprintLanding.ts
// 워프 착지 해소 — 발자국이 안 맞는 목적지를 가까운 유효 칸으로 밀어낸다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3.
//
// footprint.ts 에 두지 않은 이유: 이 함수는 collision 과 runtimeEventState 를
// 둘 다 필요로 한다. footprint.ts 는 의존성 없는 순수 프리미티브로 남긴다.

import { inBounds, isPassable } from "./collision";
import { footprintBounds, characterFootprintCells, passageBounds } from "./footprint";
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
  maxRadius = 8,
  passRows?: number
): LandingPoint {
  if (footprint.width === 1 && footprint.height === 1) return { x, y };
  if (footprintFits(project, map, session, positions, x, y, footprint, passRows)) return { x, y };
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (const candidate of ringCells(x, y, radius)) {
      if (footprintFits(project, map, session, positions, candidate.x, candidate.y, footprint, passRows)) return candidate;
    }
  }
  return { x, y };
}

/**
 * 이 앵커에 몸이 들어가는가. 검사는 **통행 사각**으로 한다 — passRows 로 상체를 열어 둔
 * 3x3 은 벽을 스치며 걸어갈 수 있으니, 워프도 같은 자리에 내려앉을 수 있어야 한다.
 * 착지가 이동보다 엄격하면 "걸어서는 가는데 문으로는 못 들어가는" 칸이 생긴다.
 *
 * `passRows` 생략 시 몸 사각 전체다(= 1차 동작). 맵 경계는 통행 사각이 아니라 **몸 사각**으로
 * 보는데, 상체가 맵 밖으로 나가면 통행과 무관하게 그림이 잘리기 때문이다.
 */
function footprintFits(
  project: Project,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  footprint: CharacterFootprint,
  passRows?: number
): boolean {
  for (const cell of characterFootprintCells(x, y, footprint)) {
    if (!inBounds(map, cell.x, cell.y)) return false;
  }
  const rect = passRows === undefined
    ? footprintBounds(x, y, footprint)
    : passageBounds(x, y, footprint, passRows);
  for (let cy = rect.top; cy <= rect.bottom; cy += 1) {
    for (let cx = rect.left; cx <= rect.right; cx += 1) {
      if (!isPassable(project, map, cx, cy)) return false;
    }
  }
  return findBlockingEventOverlappingRect(project, map, session, positions, rect) === undefined;
}

/**
 * 체비쇼프 거리가 정확히 radius 인 칸들 — 정확히 8*radius 개.
 *
 * 순서가 결정적이어야 같은 입력에 같은 착지점이 나온다. 실제 순서는 열 단위로
 * 교대한다: 먼저 x 를 왼쪽에서 오른쪽으로 훑으며 각 x 마다 **위 칸과 아래 칸을
 * 짝으로** 넣고(위 행 전체 → 아래 행 전체가 아니다), 그다음 남은 안쪽 y 를 위에서
 * 아래로 훑으며 각 y 마다 **왼쪽 칸과 오른쪽 칸을 짝으로** 넣는다.
 *
 * 한 링 안에서는 모든 칸이 등거리라 이 교대 순서가 행 우선 순서보다 불리할 게
 * 없다. 다만 순서 자체는 계약이다 — `test/footprintLanding.test.ts` 의 동순위
 * 테스트가 이 순서를 고정하므로, 루프를 행 우선으로 바꾸면 그 테스트가 깨진다.
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
