// project/playerFootprint.ts
// 주인공의 몸 사각과 통행 사각 — 저작값(system) 위에 세션 오버라이드를 얹어 한 곳에서 해소한다.
// 2차 스펙 docs/superpowers/specs/2026-08-30-character-body-vs-passage-rect-design.md §9.
//
// 해소를 함수 하나로 모으는 이유: 이동·워프 착지·스프라이트 배치가 각자 `system.playerFootprint`
// 를 읽으면 정규화를 한 곳이라도 빠뜨리는 순간 통행 판정과 렌더가 서로 다른 크기를 본다.
// 소비자에게는 크기가 아니라 **이름 붙은 사각**을 준다(설계 결정 D4).

import { footprintBounds, normalizeCharacterFootprint, normalizePassRows, passageBounds } from "./footprint";
import type { CharacterFootprint, FootprintRect, Project } from "./types";

/** 정규화가 끝난 주인공 몸. 축은 1..8, passRows 는 1..height 로 굳어 있다. */
export interface PlayerBody {
  readonly footprint: CharacterFootprint;
  readonly passRows: number;
}

/** 세션 오버라이드만 담은 최소 형태 — PlaySession 전체를 요구하지 않아 테스트가 얇아진다. */
export interface PlayerBodyOverride {
  readonly playerFootprint?: CharacterFootprint;
  readonly playerPassRows?: number;
}

/**
 * 주인공 몸을 해소한다. 우선순위는 **세션 오버라이드 → 저작값 → 1x1**.
 *
 * 둘 다 없으면 `{ width: 1, height: 1 }` + `passRows: 1` 이고, 그때 몸 사각·통행 사각·
 * 스프라이트 중앙이 전부 앵커 한 칸으로 환원된다 — 기존 프로젝트는 동작이 안 바뀐다(항등).
 *
 * `passRows` 는 몸 높이가 바뀌면 같이 조여야 하므로 **해소된 높이**를 기준으로 정규화한다.
 * 저작값이 3 이었는데 몸을 2 높이로 줄이면 2 로 클램프된다. 비정규 값은 몸 높이 전체로
 * 올라가므로(fail-closed) 잘못된 입력이 벽을 여는 일은 없다.
 */
export function resolvePlayerBody(
  project: Pick<Project, "system">,
  session?: PlayerBodyOverride
): PlayerBody {
  const raw = session?.playerFootprint ?? project.system.playerFootprint;
  const footprint = normalizeCharacterFootprint(raw);
  const rows = session?.playerPassRows ?? project.system.playerPassRows;
  return { footprint, passRows: normalizePassRows(rows, footprint.height) };
}

/** 조사·클릭·전투가 쓰는 몸 사각. */
export function playerBodyRect(body: PlayerBody, x: number, y: number): FootprintRect {
  return footprintBounds(x, y, body.footprint);
}

/** 지형·이벤트 통행 차단이 쓰는 사각. passRows 가 몸 높이면 몸 사각과 같다(항등). */
export function playerPassageRect(body: PlayerBody, x: number, y: number): FootprintRect {
  return passageBounds(x, y, body.footprint, body.passRows);
}
