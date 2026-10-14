// editor/tools/composerStart.ts
// 칩셋 구성기(compose_*_map)가 야외 맵을 짠 뒤 「게임 시작 위치」를 정하는 공용 도우미.
//
// 왜 필요한가 (2026-10-14 실조수 검증, argon medium): steam·sengoku·prehistoric·desert 구성기는 맵만 짓고
// 시작 위치를 건드리지 않았다. 모델이 set_start_position 을 따로 부르지 않으면 프로젝트 시작 맵이 문도 이벤트도
// 없는 기본 「빈 맵」(20×15)으로 남아, 플레이를 누르면 지은 마을이 아니라 빈 방에서 시작한다(4/10 곳).
//
// 규칙 — 작가가 정한 시작은 덮어쓰지 않는다:
//  - 지금 시작 맵이 없거나, 아직 손대지 않은 빈 맵이고 어디와도 이어지지 않았을 때만 새 맵의 시작 칸으로 옮긴다.
//  - 시작 맵이 이 맵 자신이면 시작 좌표가 맵 밖·통행 불가일 때만 고친다.

import { isPassable } from "@/project/collision";
import { collectMapLinkStats } from "@/project/mapLinkStats";
import { isUntouchedMap } from "@/project/projectBlankness";
import type { GameMap, Project } from "@/project/types";

export type ComposerStartResult = {
  /** 시작 위치를 바꿨나. */
  readonly claimed: boolean;
  /** 도구 결과 요약 뒤에 붙일 한 문장(바꾸지 않았으면 빈 문자열). */
  readonly note: string;
};

const NONE: ComposerStartResult = { claimed: false, note: "" };

function passableAt(draft: Project, map: GameMap, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(draft, map, x, y);
}

/**
 * `draft.maps[mapId]` 가 이미 칠해진 뒤에 부른다. 시작 맵·좌표를 바꾸면 `draft` 를 직접 고친다.
 * 실내 방(출구로 드나드는 맵)에는 부르지 않는다.
 */
export function claimStartIfBlank(draft: Project, mapId: string, spawn: { x: number; y: number }): ComposerStartResult {
  const target = draft.maps[mapId];
  if (!target || !passableAt(draft, target, spawn.x, spawn.y)) return NONE;
  const current = draft.maps[draft.startMapId];
  if (draft.startMapId === mapId) {
    const pos = draft.startPos;
    if (pos && passableAt(draft, target, pos.x, pos.y)) return NONE;
    draft.startPos = { x: spawn.x, y: spawn.y };
    return { claimed: true, note: ` 시작 위치가 막힌 칸이어서 (${spawn.x},${spawn.y}) 로 옮겼다.` };
  }
  const blankStart = !current || (isUntouchedMap(current) && collectMapLinkStats(draft, current.id).playLinkCount === 0);
  if (!blankStart) return NONE;
  draft.startMapId = target.id;
  draft.startPos = { x: spawn.x, y: spawn.y };
  const old = current ? ` 이전 시작 맵 '${current.name}'(${current.id}) 은 빈 채로 남았다 — 쓸 곳이 없으면 remove_map 으로 지운다.` : "";
  return { claimed: true, note: ` 게임 시작 위치를 이 맵 (${spawn.x},${spawn.y}) 로 잡았다(set_start_position 불필요).${old}` };
}
