import { USER_FACING_REPORT_RULE } from "./userFacingCopy";
// Pi 에이전트 기본 시스템 프롬프트. 순수 함수 — 프로젝트 요약과 작업 범위만 넣는다.
// 기존 세션의 긴 규칙 텍스트는 대부분 툴 설명으로 옮겨져 있으므로 여기서는 범위·절차만 말한다.

import type { Project } from "@/project/types";
import { HOUSE_VARIETY_POLICY_LINE } from "../promptPolicies";

export function describeScopedMaps(project: Project, mapIds: readonly string[]): string[] {
  return mapIds.map((id) => {
    const map = project.maps[id];
    if (!map) return `- ${id}: (프로젝트에 없음 — 새로 만들어야 할 수도 있다)`;
    return `- ${id} "${map.name}" ${map.width}×${map.height}`;
  });
}

/**
 * @param scopeStrict 사용자가 `/pi 맵id …` 로 범위를 **직접 적었는가**. true 면 그 맵들 밖은 계약
 *   위반이고 병합이 실제로 버린다. false(평문 턴의 기본 대상 맵)면 범위는 출발점일 뿐이다 —
 *   예전에는 이 둘을 구별하지 않아, 「회복약 아이템 만들어줘」 턴의 모델이 「데이터베이스는
 *   건드리지 않는다」는 지시를 받았다. 사용자가 시킨 바로 그 일을 하지 말라는 지시였다(2026-09-17 실측).
 */
export function buildPiAgentSystemPrompt(project: Project, mapIds: readonly string[], scopeStrict = true): string[] {
  const scope = mapIds.length > 0
    ? [
      scopeStrict
        ? `이번 작업의 대상 맵은 다음 ${mapIds.length}개다. 이 맵들과 여기서 파생되는 실내 맵만 편집한다.`
        : `이번 작업의 기본 대상 맵은 다음 ${mapIds.length}개다(사용자가 보고 있는 맵). 여기서 시작한다.`,
      ...describeScopedMaps(project, mapIds),
      scopeStrict
        ? "다른 맵·데이터베이스·시작 위치·시스템 설정은 건드리지 않는다. 범위 밖 변경은 병합 때 버려진다."
        : "요청이 데이터베이스·시스템 설정·다른 맵을 필요로 하면 거기도 바꾼다 — 요청을 맵 안의 일로 축소하지 않는다.",
    ]
    : ["작업 범위는 프로젝트 전체다. 그래도 요청과 무관한 데이터는 건드리지 않는다."];
  return [
    "너는 웹 JRPG 메이커의 시공 에이전트다. 제공된 도구만으로 프로젝트를 편집하며, 도구 밖의 텍스트 편집은 없다.",
    USER_FACING_REPORT_RULE,
    ...scope,
    "절차: 먼저 읽기 도구(get_map_region 등)로 현재 상태를 확인하고, 쓰기 도구를 호출한다. 도구가 ok:false 를 돌려주면 issues 를 읽고 인자를 고쳐 재시도한다. 같은 실패를 세 번 반복하지 않는다.",
    "필요한 도구가 보이지 않으면 find_tools 에 기능 키워드를 넣어 찾는다 — 발견된 도구는 다음 턴부터 바로 호출할 수 있다.",
    "네 지식밖의 사실은 web_search 로 확인한다. (a) 최신 사실 — 버전·릴리스·요금·현행 표준. (b) 사용자가 실존 작품을 비유한 경우(‘해리포터 같은’, ‘OO 느낌으로’) — 그 작품의 분위기·장소·직업·사건 구조를 검색해 설계의 근거로 삼는다. 암기로 바로 쓰지 말고 최소 한 번은 검색해 사실을 고정한 뒤 계획을 세운다 — 그러지 않으면 세계관이 사용자의 기대와 달라진다. 고유명사(인물·지명·마법 이름)는 그대로 쓰지 않고 새 이름을 짓는다. 검색 결과를 사용자에게 전할 때는 근거 URL을 밝힌다. 프로젝트 안의 사실은 검색하지 말고 프로젝트 조회 도구로 읽는다.",
    "완료하면 무엇을 했는지 한두 문장으로 보고하고 종료한다. 사용자에게 되묻지 않는다 — 판단이 필요하면 합리적인 기본값을 택하고 보고에 적는다.",
    // 집 규칙은 채팅 세션과 같은 문장을 쓴다 — 툴 설명만으로는 모델이 templateId 를 비워 사각형만 깔았다(2026-09-17).
    HOUSE_VARIETY_POLICY_LINE,
  ];
}
