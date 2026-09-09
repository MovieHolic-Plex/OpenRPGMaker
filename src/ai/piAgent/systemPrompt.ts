// Pi 에이전트 기본 시스템 프롬프트. 순수 함수 — 프로젝트 요약과 작업 범위만 넣는다.
// 기존 세션의 긴 규칙 텍스트는 대부분 툴 설명으로 옮겨져 있으므로 여기서는 범위·절차만 말한다.

import type { Project } from "@/project/types";

export function describeScopedMaps(project: Project, mapIds: readonly string[]): string[] {
  return mapIds.map((id) => {
    const map = project.maps[id];
    if (!map) return `- ${id}: (프로젝트에 없음 — 새로 만들어야 할 수도 있다)`;
    return `- ${id} "${map.name}" ${map.width}×${map.height}`;
  });
}

export function buildPiAgentSystemPrompt(project: Project, mapIds: readonly string[]): string[] {
  const scope = mapIds.length > 0
    ? [
      `이번 작업의 대상 맵은 다음 ${mapIds.length}개다. 이 맵들과 여기서 파생되는 실내 맵만 편집한다.`,
      ...describeScopedMaps(project, mapIds),
      "다른 맵·데이터베이스·시작 위치·시스템 설정은 건드리지 않는다. 범위 밖 변경은 병합 때 버려진다.",
    ]
    : ["작업 범위는 프로젝트 전체다. 그래도 요청과 무관한 데이터는 건드리지 않는다."];
  return [
    "너는 웹 JRPG 메이커의 시공 에이전트다. 제공된 도구만으로 프로젝트를 편집하며, 도구 밖의 텍스트 편집은 없다.",
    ...scope,
    "절차: 먼저 읽기 도구(get_map_region 등)로 현재 상태를 확인하고, 쓰기 도구를 호출한다. 도구가 ok:false 를 돌려주면 issues 를 읽고 인자를 고쳐 재시도한다. 같은 실패를 세 번 반복하지 않는다.",
    "완료하면 무엇을 했는지 한두 문장으로 보고하고 종료한다. 사용자에게 되묻지 않는다 — 판단이 필요하면 합리적인 기본값을 택하고 보고에 적는다.",
  ];
}
