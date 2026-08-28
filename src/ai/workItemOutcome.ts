// ai/workItemOutcome.ts
//
// WorkItem 완료 게이트의 **산출물 검사**.
//
// 2026-08-28 실측(project oprn-4f65d09fb1, 요청 "음 다른맵을 더 만들자"): 플래너가 낸 항목은
//   instruction "create_map으로 30x30 크기의 야외 필드 맵 생성 후 지형 및 길 타일 페인팅"
//   doneWhen    "새로운 야외 필드 맵이 생성되고 기본 지형이 칠해짐"
// 인데 successTools 는 ["create_map"] 하나였다. advanceWorkPlanFromTools 가 doneWhen 을
// 읽지 않으므로 create_map 이 성공한 그 초(08:06:23)에 항목이 done 으로 넘어갔고 페인팅은
// 한 번도 실행되지 않았다. 남은 결과물은 create_map 초기값 그대로인 잔디 단색 맵 2장
// (30×30 · 20×20, lower 고유 타일 1종, upper 전부 EMPTY, 이벤트 0)이었다.
//
// 그래서 완료 판정을 "툴 이름이 성공했나"에서 **"산출물이 실제로 채워졌나"** 로 한 겹 더 조인다.
// 이 검사는 자연어 doneWhen 을 파싱하지 않는다 — 프로젝트 상태만 본다.

import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types/project";

/** 새 맵을 만들어 내는 툴 — 이 툴이 성공하면 만들어진 mapId 를 항목 산출물로 추적한다. */
export const MAP_CREATING_TOOLS: ReadonlySet<string> = new Set([
  "create_map",
  "duplicate_map",
  "run_interior_room_pipeline",
]);

/** 툴 결과에서 새로 만들어진 mapId 를 꺼낸다(툴마다 data/args 위치가 달라 순서대로 훑는다). */
export function createdMapIdFrom(
  name: string,
  args: Record<string, unknown> | undefined,
  data: unknown,
): string | null {
  if (!MAP_CREATING_TOOLS.has(name)) return null;
  const fromData =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).mapId : undefined;
  for (const candidate of [fromData, args?.id, args?.mapId]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

/**
 * create_map 직후 상태 그대로인 맵인가 — 즉 "만들기만 하고 아무것도 안 채운" 맵.
 * 판정: 이벤트 0 + upper 전부 EMPTY + 타일 스택 없음 + lower 가 단일 타일로 균일.
 * 하나라도 어긋나면(길 한 줄, 가구 한 칸, 이벤트 하나) 저작이 시작된 것으로 본다.
 */
export function isUnauthoredMap(map: GameMap): boolean {
  if (map.events.length > 0) return false;
  if (Object.keys(map.lowerTileStacks ?? {}).length > 0) return false;
  if (Object.keys(map.upperTileStacks ?? {}).length > 0) return false;
  if (map.upperTiles.some((tile) => tile !== TILE.EMPTY)) return false;
  if (map.lowerTiles.length === 0) return true;
  const first = map.lowerTiles[0];
  return map.lowerTiles.every((tile) => tile === first);
}

/** 주어진 mapId 중 아직 손도 대지 않은 맵의 이름 목록(사용자/모델에게 보여줄 문구용). */
export function unauthoredMapLabels(project: Project, mapIds: Iterable<string>): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const mapId of mapIds) {
    if (seen.has(mapId)) continue;
    seen.add(mapId);
    const map = project.maps[mapId];
    if (map && isUnauthoredMap(map)) labels.push(`${map.name}(${mapId})`);
  }
  return labels;
}

export type WorkItemOutcomeVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * 이번 항목에서 **새로 만든 맵**이 전부 저작됐는지 확인한다.
 * 기존 맵은 검사하지 않는다 — 사용자가 의도적으로 비워 둔 맵(예: "빈 맵")을 건드렸다는
 * 이유만으로 항목을 막으면 오탐이 된다. 항목이 만든 맵은 그 항목이 채울 책임이 있다.
 */
export function verifyCreatedMapsAuthored(
  project: Project,
  createdMapIds: Iterable<string>,
): WorkItemOutcomeVerdict {
  const blank = unauthoredMapLabels(project, createdMapIds);
  if (blank.length === 0) return { ok: true };
  return {
    ok: false,
    reason:
      `산출물 미완성: ${blank.join(", ")} — 맵을 만들기만 하고 지형·구조·이벤트를 하나도 넣지 않았습니다. ` +
      `fill_region/paint_road/author_house/place_props/place_npc 등으로 내용을 채운 뒤 완료하세요. ` +
      `정말 빈 맵으로 남겨야 하면 skip_work_item으로 사유를 남기고 건너뛰세요.`,
  };
}
